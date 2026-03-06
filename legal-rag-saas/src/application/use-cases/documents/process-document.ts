import { Document } from '@/core/entities/document';
import { Paragraph } from '@/core/entities/paragraph';
import { IDocumentRepository } from '@/core/repositories/document-repository';
import { IParagraphRepository } from '@/core/repositories/paragraph-repository';
import { IContentExtractor } from '@/core/services/content-extractor';
import { IRAGEngine } from '@/core/services/rag-engine';
import { IFileStorage } from '@/infrastructure/adapters/storage/minio-storage';
import { IEmbeddingService } from '@/infrastructure/adapters/embedding/embedding-service';
import { ProcessingError, UnauthorizedError, ValidationError } from '@/core/exceptions/domain-errors';
import { eventBus, DocumentProcessingStartedEvent, DocumentProcessedEvent, DocumentProcessingFailedEvent, ParagraphsExtractedEvent, ParagraphsIndexedEvent } from '@/core/events/domain-event';
import { RAG_CONFIGURATIONS } from '@/infrastructure/config/rag-configs';

export interface ProcessDocumentRequest {
  documentId: string;
  userId: string;
}

export interface ProcessDocumentResponse {
  documentId: string;
  status: 'COMPLETED' | 'FAILED';
  pageCount?: number;
  paragraphCount?: number;
  processingTimeMs: number;
  error?: string;
}

export class ProcessDocumentUseCase {
  constructor(
    private readonly documentRepo: IDocumentRepository,
    private readonly paragraphRepo: IParagraphRepository,
    private readonly contentExtractor: IContentExtractor,
    private readonly ragEngine: IRAGEngine,
    private readonly fileStorage: IFileStorage,
    private readonly embeddingService: IEmbeddingService,
  ) {}

  async execute(request: ProcessDocumentRequest): Promise<ProcessDocumentResponse> {
    const startTime = Date.now();
    
    try {
      // 1. Obține document
      const document = await this.documentRepo.findById(request.documentId);
      if (!document) {
        throw new ValidationError(`Document ${request.documentId} not found`);
      }

      // 2. Verifică ownership
      if (document.userId !== request.userId) {
        throw new UnauthorizedError('Not authorized to process this document');
      }

      // 3. Verifică status
      if (document.status === 'PROCESSING') {
        throw new ValidationError('Document is already being processed');
      }

      if (document.status === 'COMPLETED') {
        return {
          documentId: document.id,
          status: 'COMPLETED',
          pageCount: document.pageCount,
          paragraphCount: document.totalParagraphs,
          processingTimeMs: 0,
        };
      }

      // 4. Start processing
      const processingDoc = document.startProcessing();
      await this.documentRepo.update(processingDoc);

      await eventBus.publish(new DocumentProcessingStartedEvent(document.id, {
        documentId: document.id,
        workspaceId: document.workspaceId,
        startedAt: new Date(),
      }));

      // 5. Download file
      const fileBuffer = await this.fileStorage.download(document.storageKey);

      // 6. Extract content
      const extractionResult = await this.contentExtractor.extract(
        fileBuffer,
        document.fileType
      );

      // 7. Procesare paragrafe conform config RAG
      const config = RAG_CONFIGURATIONS[document.ragConfigId];
      const paragraphs = this.processParagraphs(
        extractionResult.paragraphs,
        document.id,
        config
      );

      // 8. Salvare paragrafe în DB
      await this.paragraphRepo.createMany(paragraphs);

      await eventBus.publish(new ParagraphsExtractedEvent(document.id, {
        documentId: document.id,
        paragraphCount: paragraphs.length,
        sampleParagraphs: paragraphs.slice(0, 3).map(p => ({
          id: p.id,
          pageNumber: p.metadata.pageNumber,
        })),
      }));

      // 9. Generare embeddings
      const paragraphsWithEmbeddings = await this.generateEmbeddings(paragraphs);

      // 10. Indexare în vector DB
      await this.ragEngine.indexParagraphs(paragraphsWithEmbeddings, document.id);

      await eventBus.publish(new ParagraphsIndexedEvent(document.id, {
        documentId: document.id,
        indexedCount: paragraphsWithEmbeddings.length,
        embeddingModel: this.embeddingService.getModelName(),
      }));

      // 11. Finalizare
      const completedDoc = processingDoc
        .addParagraphs(paragraphsWithEmbeddings)
        .completeProcessing(extractionResult.pageCount);

      await this.documentRepo.update(completedDoc);

      await eventBus.publish(new DocumentProcessedEvent(document.id, {
        documentId: document.id,
        workspaceId: document.workspaceId,
        pageCount: extractionResult.pageCount,
        paragraphCount: paragraphs.length,
        processingTimeMs: Date.now() - startTime,
      }));

      return {
        documentId: document.id,
        status: 'COMPLETED',
        pageCount: extractionResult.pageCount,
        paragraphCount: paragraphs.length,
        processingTimeMs: Date.now() - startTime,
      };

    } catch (error) {
      console.error(`[ProcessDocument:${request.documentId}] Error:`, error);

      // Update status to FAILED
      try {
        const document = await this.documentRepo.findById(request.documentId);
        if (document) {
          const failedDoc = document.failProcessing(
            error instanceof Error ? error.message : 'Unknown error'
          );
          await this.documentRepo.update(failedDoc);

          await eventBus.publish(new DocumentProcessingFailedEvent(document.id, {
            documentId: document.id,
            workspaceId: document.workspaceId,
            error: error instanceof Error ? error.message : 'Unknown error',
            failedAt: new Date(),
          }));
        }
      } catch (updateError) {
        console.error('Failed to update document status:', updateError);
      }

      throw new ProcessingError(
        'Failed to process document',
        error instanceof Error ? error : undefined
      );
    }
  }

  private processParagraphs(
    extractedParagraphs: Array<{
      content: string;
      pageNumber: number;
      metadata: Record<string, unknown>;
    }>,
    documentId: string,
    config: typeof RAG_CONFIGURATIONS[keyof typeof RAG_CONFIGURATIONS]
  ): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    for (let i = 0; i < extractedParagraphs.length; i++) {
      const extracted = extractedParagraphs[i];
      
      // Filtrare după lungime minimă
      if (extracted.content.length < config.minParagraphLength) {
        continue;
      }

      // Chunking dacă e necesar
      if (this.shouldSplit(extracted.content, config.chunkSize)) {
        const chunks = this.splitIntoChunks(extracted.content, config.chunkSize, config.chunkOverlap);
        for (let j = 0; j < chunks.length; j++) {
          paragraphs.push(this.createParagraph(
            chunks[j],
            documentId,
            extracted.pageNumber,
            paragraphs.length + 1,
            extracted.metadata,
            j > 0 // Marcare continuare
          ));
        }
      } else {
        paragraphs.push(this.createParagraph(
          extracted.content,
          documentId,
          extracted.pageNumber,
          paragraphs.length + 1,
          extracted.metadata
        ));
      }
    }

    return paragraphs;
  }

  private createParagraph(
    content: string,
    documentId: string,
    pageNumber: number,
    paragraphNumber: number,
    metadata: Record<string, unknown>,
    isContinuation: boolean = false
  ): Paragraph {
    const words = content.split(/\s+/);
    
    return Paragraph.create({
      documentId,
      content: isContinuation ? `[...] ${content}` : content,
      metadata: {
        pageNumber,
        paragraphNumber,
        chapterTitle: metadata.chapterTitle as string | undefined,
        sectionTitle: metadata.sectionTitle as string | undefined,
        wordCount: words.length,
        charCount: content.length,
        keywords: this.extractKeywords(content),
        articleNumber: metadata.articleNumber as string | undefined,
        paragraphLetter: metadata.paragraphLetter as string | undefined,
      },
    });
  }

  private shouldSplit(content: string, maxChunkSize: number): boolean {
    const words = content.split(/\s+/);
    return words.length > maxChunkSize;
  }

  private splitIntoChunks(content: string, chunkSize: number, overlap: number): string[] {
    const words = content.split(/\s+/);
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      chunks.push(chunk);
    }
    
    return chunks;
  }

  private extractKeywords(content: string): string[] {
    // Simplificat - în producție folosești TF-IDF sau similar
    const stopWords = new Set(['the', 'and', 'or', 'in', 'on', 'de', 'si', 'și', 'sau']);
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 4 && !stopWords.has(w))
      .slice(0, 10);
  }

  private async generateEmbeddings(paragraphs: Paragraph[]): Promise<Paragraph[]> {
    const batchSize = 20;
    const results: Paragraph[] = [];

    for (let i = 0; i < paragraphs.length; i += batchSize) {
      const batch = paragraphs.slice(i, i + batchSize);
      const contents = batch.map(p => p.content);
      
      const embeddings = await this.embeddingService.embedBatch(contents);
      
      for (let j = 0; j < batch.length; j++) {
        results.push(batch[j].setEmbedding(embeddings[j]));
      }
    }

    return results;
  }
}
