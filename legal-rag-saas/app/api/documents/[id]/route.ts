import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { LocalStorage } from '@/src/infrastructure/adapters/storage/minio-storage';
import { QdrantClient } from '@qdrant/js-client-rest';

const prisma = new PrismaClient();
const storage = new LocalStorage('./uploads');

// DELETE - Delete a document
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id || 'demo-user';
    const documentId = params.id;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    // Get document to find storage key
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { paragraphs: { select: { id: true } } },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Delete paragraphs from Qdrant if available
    try {
      const qdrant = new QdrantClient({
        url: process.env.QDRANT_URL || 'http://localhost:6333',
      });

      const paragraphIds = document.paragraphs.map(p => p.id);
      if (paragraphIds.length > 0) {
        await qdrant.delete('legal_paragraphs', {
          points: paragraphIds,
        });
        console.log(`[Delete] Removed ${paragraphIds.length} paragraphs from Qdrant`);
      }
    } catch (qdrantError) {
      console.warn('[Delete] Failed to remove from Qdrant:', qdrantError);
      // Continue - we'll still delete from database
    }

    // Delete file from storage
    try {
      await storage.delete(document.storageKey);
      // Also delete metadata file if it exists
      try {
        await storage.delete(`${document.storageKey}.meta.json`);
      } catch {
        // Metadata file might not exist, ignore error
      }
      console.log(`[Delete] Removed file: ${document.storageKey}`);
    } catch (storageError) {
      console.warn('[Delete] Failed to remove file from storage:', storageError);
      // Continue - we'll still delete from database
    }

    // Delete document from database (cascades to paragraphs due to relation)
    await prisma.document.delete({
      where: { id: documentId },
    });

    console.log(`[Delete] Document deleted: ${documentId}`);

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });

  } catch (error) {
    console.error('[Documents API] Delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET - Get a single document
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id || 'demo-user';
    const documentId = params.id;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        fileType: true,
        fileSize: true,
        status: true,
        pageCount: true,
        ragConfigId: true,
        processingError: true,
        createdAt: true,
        workspaceId: true,
        _count: {
          select: {
            paragraphs: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        document: {
          ...document,
          paragraphCount: document._count.paragraphs,
        },
      },
    });

  } catch (error) {
    console.error('[Documents API] Get error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
