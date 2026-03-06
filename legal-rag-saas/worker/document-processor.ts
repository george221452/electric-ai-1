import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { container } from '@/src/infrastructure/container';
import { ProcessDocumentUseCase } from '@/src/application/use-cases/documents/process-document';
import { IFileStorage } from '@/src/infrastructure/adapters/storage/minio-storage';

interface ProcessingJob {
  documentId: string;
  userId: string;
  priority: 'high' | 'normal' | 'low';
}

export class DocumentProcessorWorker {
  private prisma: PrismaClient;
  private redis: Redis;
  private isRunning = false;
  private readonly QUEUE_KEY = 'document_processing_queue';

  constructor() {
    this.prisma = new PrismaClient();
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async start(): Promise<void> {
    console.log('[Worker] Starting document processor...');
    this.isRunning = true;

    while (this.isRunning) {
      try {
        // Get next job from queue
        const job = await this.getNextJob();
        
        if (job) {
          await this.processJob(job);
        } else {
          // No jobs, wait before checking again
          await this.sleep(1000);
        }
      } catch (error) {
        console.error('[Worker] Error processing job:', error);
        await this.sleep(5000);
      }
    }
  }

  stop(): void {
    console.log('[Worker] Stopping document processor...');
    this.isRunning = false;
  }

  async enqueue(documentId: string, userId: string, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<void> {
    const job: ProcessingJob = { documentId, userId, priority };
    
    // Add to sorted set with priority score
    const score = this.getPriorityScore(priority);
    await this.redis.zadd(this.QUEUE_KEY, score, JSON.stringify(job));

    // Update document status
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'PENDING' },
    });

    console.log(`[Worker] Enqueued document ${documentId} with priority ${priority}`);
  }

  private async getNextJob(): Promise<ProcessingJob | null> {
    // Get highest priority job (lowest score)
    const result = await this.redis.zpopmin(this.QUEUE_KEY);
    
    if (!result || result.length === 0) {
      return null;
    }

    return JSON.parse(result[0]);
  }

  private async processJob(job: ProcessingJob): Promise<void> {
    console.log(`[Worker] Processing document ${job.documentId}...`);

    try {
      const useCase = container.resolve(ProcessDocumentUseCase);
      
      await useCase.execute({
        documentId: job.documentId,
        userId: job.userId,
      });

      console.log(`[Worker] Completed processing document ${job.documentId}`);
    } catch (error) {
      console.error(`[Worker] Failed to process document ${job.documentId}:`, error);
      
      // Update document with error
      await this.prisma.document.update({
        where: { id: job.documentId },
        data: {
          status: 'FAILED',
          processingError: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  private getPriorityScore(priority: 'high' | 'normal' | 'low'): number {
    const now = Date.now();
    switch (priority) {
      case 'high':
        return now - 1000000; // Process first
      case 'normal':
        return now;
      case 'low':
        return now + 1000000; // Process last
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Stats
  async getQueueStats(): Promise<{ pending: number; processing: number }> {
    const pending = await this.redis.zcard(this.QUEUE_KEY);
    const processing = await this.prisma.document.count({
      where: { status: 'PROCESSING' },
    });

    return { pending, processing };
  }
}

// Start worker if run directly
if (require.main === module) {
  const worker = new DocumentProcessorWorker();
  
  worker.start().catch(console.error);

  // Graceful shutdown
  process.on('SIGTERM', () => worker.stop());
  process.on('SIGINT', () => worker.stop());
}
