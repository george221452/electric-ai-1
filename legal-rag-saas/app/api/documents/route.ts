import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { LocalStorage } from '@/src/infrastructure/adapters/storage/minio-storage';
import { UniversalExtractor } from '@/src/infrastructure/adapters/extractors/universal-extractor';
import { OpenAIEmbeddingService } from '@/src/infrastructure/adapters/embedding/embedding-service';
import { QdrantClient } from '@qdrant/js-client-rest';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Initialize storage (local filesystem for development)
const storage = new LocalStorage('./uploads');

// Supported MIME types and their extensions
const SUPPORTED_MIME_TYPES: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'text/plain': ['txt'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.oasis.opendocument.text': ['odt'],
};

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  'pdf': 'application/pdf',
  'txt': 'text/plain',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'odt': 'application/vnd.oasis.opendocument.text',
};

/**
 * Validates if the file type is supported
 */
function isSupportedFileType(fileType: string, extension: string): boolean {
  // Check by MIME type
  if (SUPPORTED_MIME_TYPES[fileType]) {
    return true;
  }
  // Check by extension
  if (MIME_TYPE_BY_EXTENSION[extension]) {
    return true;
  }
  return false;
}

/**
 * Detects the correct MIME type from file extension or returns the provided type
 */
function detectFileType(fileType: string, extension: string): string {
  // If we have a valid MIME type, use it
  if (SUPPORTED_MIME_TYPES[fileType]) {
    return fileType;
  }
  
  // If MIME type is generic or missing, detect from extension
  if ((!fileType || fileType === 'application/octet-stream') && extension) {
    const detectedType = MIME_TYPE_BY_EXTENSION[extension.toLowerCase()];
    if (detectedType) {
      return detectedType;
    }
  }
  
  return fileType || 'application/octet-stream';
}

// GET - List documents
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id || 'demo-user';

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    const documents = await prisma.document.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        fileType: true,
        fileSize: true,
        status: true,
        pageCount: true,
        ragConfigId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: { documents },
    });
  } catch (error) {
    console.error('[Documents API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Upload document
export async function POST(req: NextRequest) {
  let documentId: string | null = null;
  
  try {
    const session = await auth();
    const userId = session?.user?.id || 'demo-user';

    // Log request info for debugging
    console.log('[Documents API] Processing upload request');

    // Parse FormData
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (parseError) {
      console.error('[Documents API] Failed to parse form data:', parseError);
      return NextResponse.json(
        { error: 'Invalid form data', message: 'Could not parse the uploaded file' },
        { status: 400 }
      );
    }
    
    const file = formData.get('file') as File;
    const workspaceId = formData.get('workspaceId') as string;
    const ragConfigId = (formData.get('ragConfigId') as string) || 'auto';

    // Validate file presence
    if (!file) {
      console.error('[Documents API] No file provided');
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Validate workspace
    if (!workspaceId) {
      console.error('[Documents API] No workspaceId provided');
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // Extract and validate file extension
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension) {
      console.error('[Documents API] File has no extension:', file.name);
      return NextResponse.json(
        { error: 'Invalid file name', message: 'File must have an extension' },
        { status: 400 }
      );
    }

    // Detect file type
    const detectedFileType = detectFileType(file.type, fileExtension);
    
    // Validate file type is supported
    if (!isSupportedFileType(detectedFileType, fileExtension)) {
      console.error('[Documents API] Unsupported file type:', {
        name: file.name,
        type: file.type,
        extension: fileExtension,
        detectedType: detectedFileType,
      });
      return NextResponse.json(
        { 
          error: 'Unsupported file type', 
          message: `File type "${fileExtension}" is not supported. Supported formats: PDF, DOCX, ODT, TXT` 
        },
        { status: 400 }
      );
    }

    console.log('[Documents API] Processing file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      detectedType: detectedFileType,
      extension: fileExtension,
    });

    // Validate file size (100MB limit)
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      console.error('[Documents API] File too large:', file.size);
      return NextResponse.json(
        { error: 'File too large', message: 'Maximum file size is 100MB' },
        { status: 400 }
      );
    }

    // Generate unique ID and storage key
    documentId = randomUUID();
    const storageKey = `${workspaceId}/${documentId}.${fileExtension}`;

    // Convert File to Buffer
    let buffer: Buffer;
    try {
      const bytes = await file.arrayBuffer();
      buffer = Buffer.from(bytes);
    } catch (bufferError) {
      console.error('[Documents API] Failed to read file:', bufferError);
      return NextResponse.json(
        { error: 'Failed to read file', message: 'Could not process the uploaded file' },
        { status: 400 }
      );
    }

    // Upload to storage
    try {
      await storage.upload(storageKey, buffer, { 'content-type': detectedFileType });
      console.log('[Documents API] File uploaded to storage:', storageKey);
    } catch (storageError) {
      console.error('[Documents API] Storage upload failed:', storageError);
      return NextResponse.json(
        { error: 'Storage error', message: 'Failed to save the file' },
        { status: 500 }
      );
    }

    // Create document record in database
    let document;
    try {
      document = await prisma.document.create({
        data: {
          id: documentId,
          name: file.name,
          fileType: detectedFileType,
          fileSize: file.size,
          storageKey,
          workspaceId,
          userId,
          ragConfigId: ragConfigId === 'auto' ? 'generic-document' : ragConfigId,
          status: 'PENDING',
          metadata: {
            originalMimeType: file.type,
            detectedExtension: fileExtension,
          },
        },
      });
      console.log('[Documents API] Document record created:', document.id);
    } catch (dbError) {
      console.error('[Documents API] Database error:', dbError);
      // Try to clean up uploaded file
      try {
        await storage.delete(storageKey);
      } catch (cleanupError) {
        console.error('[Documents API] Failed to cleanup storage:', cleanupError);
      }
      return NextResponse.json(
        { error: 'Database error', message: 'Failed to create document record' },
        { status: 500 }
      );
    }

    // Start async processing (don't await - let it run in background)
    processDocument(documentId, buffer, detectedFileType, workspaceId).catch(error => {
      console.error('[Document Processing] Error:', error);
    });

    return NextResponse.json({
      success: true,
      data: {
        document: {
          id: document.id,
          name: document.name,
          fileType: document.fileType,
          fileSize: document.fileSize,
          status: document.status,
          createdAt: document.createdAt,
        },
      },
    }, { status: 201 });

  } catch (error) {
    console.error('[Documents API] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error',
        documentId: documentId || undefined,
      },
      { status: 500 }
    );
  }
}

// Async processing function
async function processDocument(documentId: string, fileBuffer: Buffer, fileType: string, workspaceId: string) {
  try {
    console.log(`[Document Processing] Starting: ${documentId}`);
    
    // Get document and update status to PROCESSING
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    // Extract content
    let result;
    try {
      const extractor = new UniversalExtractor();
      result = await extractor.extract(fileBuffer, fileType);
      console.log(`[Document Processing] Extracted ${result.paragraphs.length} paragraphs from ${documentId}`);
    } catch (extractError) {
      console.error(`[Document Processing] Extraction failed for ${documentId}:`, extractError);
      throw new Error(`Content extraction failed: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`);
    }

    // Validate extraction result
    if (!result.paragraphs || result.paragraphs.length === 0) {
      console.warn(`[Document Processing] No paragraphs extracted from ${documentId}`);
      throw new Error('No content could be extracted from the document');
    }

    // Store paragraphs in database
    try {
      const paragraphs = result.paragraphs.map((p, index) => ({
        id: randomUUID(),
        documentId,
        content: p.content,
        pageNumber: p.pageNumber || 1,
        paragraphNumber: (p.metadata as any)?.paragraphNumber || index + 1,
        wordCount: p.content.split(/\s+/).filter((w: string) => w.length > 0).length,
        charCount: p.content.length,
        metadata: p.metadata || {},
      }));

      await prisma.paragraph.createMany({
        data: paragraphs,
      });
      console.log(`[Document Processing] Stored ${paragraphs.length} paragraphs for ${documentId}`);
    } catch (paragraphError) {
      console.error(`[Document Processing] Failed to store paragraphs for ${documentId}:`, paragraphError);
      throw new Error(`Failed to store document content: ${paragraphError instanceof Error ? paragraphError.message : 'Unknown error'}`);
    }

    // Index in Qdrant (if available)
    try {
      console.log(`[Qdrant] Starting indexing for document ${documentId} with ${result.paragraphs.length} paragraphs...`);
      
      const qdrant = new QdrantClient({
        url: process.env.QDRANT_URL || 'http://localhost:6333',
      });

      // Check if collection exists, create if not
      const collections = await qdrant.getCollections();
      const collectionExists = collections.collections.some(c => c.name === 'legal_paragraphs');
      console.log(`[Qdrant] Collection exists: ${collectionExists}`);

      if (!collectionExists) {
        await qdrant.createCollection('legal_paragraphs', {
          vectors: { size: 1536, distance: 'Cosine' },
        });
        console.log('[Qdrant] Created collection legal_paragraphs');
      }

      // Generate real embeddings for paragraphs
      const embeddingService = new OpenAIEmbeddingService();
      const batchSize = 20;
      const points = [];
      
      console.log(`[Qdrant] Generating embeddings for ${result.paragraphs.length} paragraphs...`);
      
      for (let i = 0; i < result.paragraphs.length; i += batchSize) {
        const batch = result.paragraphs.slice(i, i + batchSize);
        const contents = batch.map(p => p.content);
        console.log(`[Qdrant] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(result.paragraphs.length/batchSize)} (${batch.length} paragraphs)`);
        
        const embeddings = await embeddingService.embedBatch(contents);
        console.log(`[Qdrant] Generated ${embeddings.length} embeddings`);
        
        for (let j = 0; j < batch.length; j++) {
          points.push({
            id: randomUUID(),
            vector: embeddings[j],
            payload: {
              documentId: documentId,
              workspaceId: workspaceId,
              content: batch[j].content.substring(0, 2000),
              pageNumber: batch[j].pageNumber,
              paragraphNumber: (batch[j].metadata as any)?.paragraphNumber || i + j + 1,
            },
          });
        }
      }
      
      console.log(`[Qdrant] Upserting ${points.length} points...`);
      
      // Store in Qdrant - use the correct API format
      const response = await qdrant.upsert('legal_paragraphs', { points });
      console.log(`[Qdrant] Upsert response:`, response);
      console.log(`[Qdrant] Successfully indexed document ${documentId}`);

    } catch (qdrantError) {
      console.error('[Qdrant] Failed to index document:', qdrantError);
      // Continue - document is still stored in PostgreSQL
    }

    // Update status to COMPLETED
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'COMPLETED',
        pageCount: result.pageCount,
      },
    });

    console.log(`[Document Processing] Completed: ${documentId}`);

  } catch (error) {
    console.error('[Document Processing] Failed:', error);
    
    // Update status to FAILED
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'FAILED',
          processingError: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    } catch (updateError) {
      console.error('[Document Processing] Failed to update error status:', updateError);
    }
  }
}

export const runtime = 'nodejs';
