import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { QdrantClient } from '@qdrant/js-client-rest';
import { IEmbeddingService } from '@/src/infrastructure/adapters/embedding/embedding-service';

interface EmbeddingJob {
  paragraphId: string;
  content: string;
  documentId: string;
  workspaceId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Worker for generating and storing embeddings in Qdrant.
 * Paragraphs are stored in PostgreSQL, vectors in Qdrant.
 */
export class EmbeddingGeneratorWorker {
  private prisma: PrismaClient;
  private redis: Redis;
  private qdrant: QdrantClient;
  private embeddingService: IEmbeddingService;
  private isRunning = false;
  private readonly QUEUE_KEY = 'embedding_queue';
  private readonly BATCH_SIZE = 20;
  private readonly COLLECTION_NAME = 'legal_paragraphs';

  constructor(embeddingService: IEmbeddingService) {
    this.prisma = new PrismaClient();
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.qdrant = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
    });
    this.embeddingService = embeddingService;
  }

  async start(): Promise<void> {
    console.log('[EmbeddingWorker] Starting...');
    this.isRunning = true;

    while (this.isRunning) {
      try {
        // Get batch of jobs
        const jobs = await this.getNextBatch();
        
        if (jobs.length > 0) {
          await this.processBatch(jobs);
        } else {
          await this.sleep(1000);
        }
      } catch (error) {
        console.error('[EmbeddingWorker] Error:', error);
        await this.sleep(5000);
      }
    }
  }

  stop(): void {
    console.log('[EmbeddingWorker] Stopping...');
    this.isRunning = false;
  }

  async enqueueParagraphs(
    paragraphs: Array<{ 
      id: string; 
      content: string; 
      documentId: string;
      workspaceId: string;
      metadata?: Record<string, unknown>;
    }>
  ): Promise<void> {
    const jobs: EmbeddingJob[] = paragraphs.map(p => ({
      paragraphId: p.id,
      content: p.content,
      documentId: p.documentId,
      workspaceId: p.workspaceId,
      metadata: p.metadata,
    }));

    // Add to queue
    const pipeline = this.redis.pipeline();
    for (const job of jobs) {
      pipeline.lpush(this.QUEUE_KEY, JSON.stringify(job));
    }
    await pipeline.exec();

    console.log(`[EmbeddingWorker] Enqueued ${jobs.length} paragraphs`);
  }

  private async getNextBatch(): Promise<EmbeddingJob[]> {
    const jobs: EmbeddingJob[] = [];

    for (let i = 0; i < this.BATCH_SIZE; i++) {
      const data = await this.redis.rpop(this.QUEUE_KEY);
      if (!data) break;
      jobs.push(JSON.parse(data));
    }

    return jobs;
  }

  private async processBatch(jobs: EmbeddingJob[]): Promise<void> {
    console.log(`[EmbeddingWorker] Processing batch of ${jobs.length} embeddings...`);

    try {
      // Generate embeddings in batch
      const contents = jobs.map(j => j.content);
      const embeddings = await this.embeddingService.embedBatch(contents);

      // Store vectors in Qdrant (not PostgreSQL)
      await this.qdrant.upsert(this.COLLECTION_NAME, {
        points: jobs.map((job, index) => ({
          id: job.paragraphId,
          vector: embeddings[index],
          payload: {
            documentId: job.documentId,
            workspaceId: job.workspaceId,
            content: job.content,
            ...job.metadata,
          },
        })),
      });

      console.log(`[EmbeddingWorker] Generated and stored ${embeddings.length} embeddings in Qdrant`);
    } catch (error) {
      console.error('[EmbeddingWorker] Batch processing failed:', error);
      
      // Re-queue failed jobs
      await this.enqueueParagraphs(jobs.map(j => ({
        id: j.paragraphId,
        content: j.content,
        documentId: j.documentId,
        workspaceId: j.workspaceId,
        metadata: j.metadata,
      })));
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
