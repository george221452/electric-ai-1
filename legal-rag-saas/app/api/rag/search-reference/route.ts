import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddingService } from '@/src/infrastructure/adapters/embedding/embedding-service';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reference, workspaceId } = body;

    if (!reference || !workspaceId) {
      return NextResponse.json(
        { error: 'Reference and workspaceId required' },
        { status: 400 }
      );
    }

    console.log(`[Search Reference] Looking for: "${reference}"`);

    // Search in Prisma with various patterns
    const searchPatterns = [
      reference,
      reference.toLowerCase(),
      reference.replace(/\s/g, ''),
      reference.replace(/\./g, '.'),
    ];

    const prismaResults = await prisma.paragraph.findMany({
      where: {
        OR: searchPatterns.map(p => ({
          content: { contains: p, mode: 'insensitive' }
        })),
        document: { workspaceId }
      },
      select: {
        id: true,
        content: true,
        pageNumber: true,
        document: { select: { name: true } }
      },
      take: 20,
    });

    // Also search with vector
    const qdrant = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
    });

    const embeddingService = new OpenAIEmbeddingService();
    const queryEmbedding = await embeddingService.embed(reference);

    const qdrantResults = await qdrant.search('legal_paragraphs', {
      vector: queryEmbedding,
      limit: 10,
      with_payload: true,
      filter: {
        must: [
          { key: 'workspaceId', match: { value: workspaceId } },
        ],
      },
    }) as any[];

    // Combine results
    const combined = [...prismaResults];
    
    for (const qr of qdrantResults) {
      const content = qr.payload.content;
      const exists = combined.some(p => 
        p.content.substring(0, 100) === content.substring(0, 100)
      );
      if (!exists) {
        combined.push({
          id: qr.id,
          content: content,
          pageNumber: qr.payload.pageNumber,
          document: { name: 'normativ.odt' }
        });
      }
    }

    // Process results - extract context around reference
    const processedResults = combined.map(p => {
      const content = p.content;
      const refLower = reference.toLowerCase();
      const contentLower = content.toLowerCase();
      
      // Find position
      let idx = contentLower.indexOf(refLower);
      if (idx === -1) {
        // Try variations
        const variations = [
          refLower.replace(/\./g, ''),
          refLower.replace(/tabelul /, 'tabel '),
        ];
        for (const v of variations) {
          idx = contentLower.indexOf(v);
          if (idx !== -1) break;
        }
      }
      
      let excerpt = content;
      if (idx !== -1) {
        const start = Math.max(0, idx - 150);
        const end = Math.min(content.length, idx + 600);
        excerpt = content.substring(start, end);
        if (start > 0) excerpt = '...' + excerpt;
        if (end < content.length) excerpt = excerpt + '...';
      }

      return {
        id: p.id,
        pageNumber: p.pageNumber,
        documentName: p.document.name,
        excerpt: excerpt,
        fullContent: content,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        reference: reference,
        found: processedResults.length,
        results: processedResults,
      }
    });

  } catch (error) {
    console.error('[Search Reference] Error:', error);
    return NextResponse.json(
      { error: 'Search failed', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
