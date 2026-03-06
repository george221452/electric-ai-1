import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { extractTablesFromText, searchTables, getTableByNumber, formatTableForDisplay, NormativeTable } from '@/lib/extraction/table-extractor';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

// Cache for extracted tables (in-memory for this instance)
let tablesCache: Map<string, NormativeTable[]> = new Map();

const SearchSchema = z.object({
  query: z.string().min(1),
  workspaceId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
});

/**
 * GET /api/tables?documentId=xxx
 * Returns all extracted tables for a document
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('documentId');
    const tableNumber = searchParams.get('tableNumber');

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId required' },
        { status: 400 }
      );
    }

    // Get tables from cache or extract
    let tables = tablesCache.get(documentId);
    
    if (!tables) {
      tables = await extractTablesFromDocument(documentId);
      tablesCache.set(documentId, tables);
    }

    // If specific table number requested
    if (tableNumber) {
      const table = getTableByNumber(tables, tableNumber);
      if (!table) {
        return NextResponse.json(
          { error: `Table ${tableNumber} not found` },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: {
          table,
          formatted: formatTableForDisplay(table),
        },
      });
    }

    // Return all tables
    return NextResponse.json({
      success: true,
      data: {
        tables: tables.map(t => ({
          id: t.id,
          tableNumber: t.tableNumber,
          title: t.title,
          pageNumber: t.pageNumber,
          rowCount: t.rows.length,
        })),
        total: tables.length,
      },
    });

  } catch (error) {
    console.error('[Tables API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get tables' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tables
 * Search tables by query
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = SearchSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { query, documentId, workspaceId } = validation.data;

    // Get document(s) to search
    let documentIds: string[] = [];
    
    if (documentId) {
      documentIds = [documentId];
    } else if (workspaceId) {
      const docs = await prisma.document.findMany({
        where: { workspaceId },
        select: { id: true },
      });
      documentIds = docs.map(d => d.id);
    }

    if (documentIds.length === 0) {
      return NextResponse.json(
        { error: 'No documents found' },
        { status: 404 }
      );
    }

    // Extract and search tables from all documents
    const allResults: Array<{
      table: NormativeTable;
      relevanceScore: number;
      matchedCells: any[];
    }> = [];

    for (const docId of documentIds) {
      let tables = tablesCache.get(docId);
      
      if (!tables) {
        tables = await extractTablesFromDocument(docId);
        tablesCache.set(docId, tables);
      }

      const results = searchTables(tables, query);
      allResults.push(...results);
    }

    // Sort by relevance
    allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return NextResponse.json({
      success: true,
      data: {
        query,
        results: allResults.slice(0, 10).map(r => ({
          table: {
            id: r.table.id,
            tableNumber: r.table.tableNumber,
            title: r.table.title,
            pageNumber: r.table.pageNumber,
            documentName: r.table.documentName,
          },
          relevanceScore: r.relevanceScore,
          matchedCells: r.matchedCells,
          formatted: formatTableForDisplay(r.table),
        })),
        total: allResults.length,
      },
    });

  } catch (error) {
    console.error('[Tables API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search tables' },
      { status: 500 }
    );
  }
}

/**
 * Extract tables from a document
 */
async function extractTablesFromDocument(documentId: string): Promise<NormativeTable[]> {
  // Get document from database
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    return [];
  }

  // Try to read the text content
  // First check if there's a text file version
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const textPath = path.join(uploadsDir, document.workspaceId, `${documentId}.txt`);
  
  try {
    const text = await fs.readFile(textPath, 'utf-8');
    return extractTablesFromText(text, documentId, document.name);
  } catch (e) {
    // Try to extract from storage path
    try {
      const storagePath = path.join(uploadsDir, document.workspaceId, document.storagePath || documentId);
      const text = await fs.readFile(storagePath, 'utf-8');
      return extractTablesFromText(text, documentId, document.name);
    } catch (e2) {
      console.log(`[Tables API] Could not read document ${documentId}:`, e2);
      return [];
    }
  }
}

export const runtime = 'nodejs';
