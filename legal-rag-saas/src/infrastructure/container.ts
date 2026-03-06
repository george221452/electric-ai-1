import 'reflect-metadata';
import { container, Lifecycle } from 'tsyringe';
import { PrismaClient } from '@prisma/client';
import { QdrantClient } from '@qdrant/js-client-rest';

// Repositories
import { IDocumentRepository } from '@/core/repositories/document-repository';
import { IWorkspaceRepository } from '@/core/repositories/workspace-repository';
import { PrismaDocumentRepository } from './repositories/prisma-document-repo';
import { PrismaWorkspaceRepository } from './repositories/prisma-workspace-repo';

// Services
import { IRAGEngine } from '@/core/services/rag-engine';
import { ICitationValidator } from '@/core/services/citation-validator';
import { IContentExtractor } from '@/core/services/content-extractor';
import { IResponseFormatter } from '@/core/services/response-formatter';
import { LegalRAGEngine } from './adapters/rag-engines/legal-rag-engine';
import { StrictCitationValidator } from './adapters/validators/strict-citation-validator';
import { UniversalExtractor } from './adapters/extractors/universal-extractor';
import { ConciseResponseFormatter } from './adapters/formatters/concise-formatter';

// Infrastructure
import { IEmbeddingService, OpenAIEmbeddingService } from './adapters/embedding/embedding-service';
import { IFileStorage, LocalStorage } from './adapters/storage/minio-storage';

// Use Cases
import { QueryRAGUseCase } from '@/application/use-cases/rag/query-rag';
import { ProcessDocumentUseCase } from '@/application/use-cases/documents/process-document';

// Register Prisma
container.register<PrismaClient>(PrismaClient, {
  useValue: new PrismaClient(),
});

// Register Qdrant
container.register<QdrantClient>(QdrantClient, {
  useValue: new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
  }),
});

// Also register for direct import
export const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
});

// Export prisma for direct use
export const prismaClient = new PrismaClient();

// Register Repositories
(container as any).register('DocumentRepository', {
  useFactory: (c: any) => new PrismaDocumentRepository(c.resolve(PrismaClient)),
  lifecycle: Lifecycle.Singleton,
});

(container as any).register('WorkspaceRepository', {
  useFactory: (c: any) => new PrismaWorkspaceRepository(c.resolve(PrismaClient)),
  lifecycle: Lifecycle.Singleton,
});

// Register Services
// Use OpenAI embeddings if API key available
(container as any).register('EmbeddingService', {
  useFactory: () => {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (apiKey && apiKey.startsWith('sk-') && apiKey.length > 20) {
      console.log('🚀 Using OPENAI embeddings (text-embedding-3-small) - HIGH QUALITY');
      return new OpenAIEmbeddingService(apiKey, 'text-embedding-3-small');
    }
    
    console.log('🚀 Using MOCK embeddings (deterministic) - NO API calls');
    // Use OpenAI service with empty key to trigger mock mode
    return new OpenAIEmbeddingService('', 'text-embedding-3-small');
  },
  lifecycle: Lifecycle.Singleton,
});

(container as any).register('RAGEngine', {
  useFactory: (c: any) => {
    const qdrant = c.resolve(QdrantClient);
    const embedding = c.resolve('EmbeddingService') as IEmbeddingService;
    return new LegalRAGEngine(qdrant, embedding);
  },
  lifecycle: Lifecycle.Singleton,
});

(container as any).register('CitationValidator', {
  useFactory: () => new StrictCitationValidator(),
  lifecycle: Lifecycle.Singleton,
});

(container as any).register('ContentExtractor', {
  useFactory: () => new UniversalExtractor(),
  lifecycle: Lifecycle.Singleton,
});

// CONCISE FORMATTER - răspuns scurt + surse
(container as any).register('ResponseFormatter', {
  useFactory: () => {
    console.log('✅ Using Concise Response Formatter');
    return new ConciseResponseFormatter();
  },
  lifecycle: Lifecycle.Singleton,
});

// Local storage pentru testing
(container as any).register('FileStorage', {
  useFactory: () => new LocalStorage('./uploads'),
  lifecycle: Lifecycle.Singleton,
});

// Register Use Cases
container.register<QueryRAGUseCase>(QueryRAGUseCase, {
  useFactory: (c: any) => new QueryRAGUseCase(
    c.resolve('RAGEngine') as IRAGEngine,
    c.resolve('CitationValidator') as ICitationValidator,
    c.resolve('ResponseFormatter') as IResponseFormatter,
    c.resolve('DocumentRepository') as IDocumentRepository,
    {} as any,
    c.resolve('WorkspaceRepository') as IWorkspaceRepository
  ),
});

container.register<ProcessDocumentUseCase>(ProcessDocumentUseCase, {
  useFactory: (c: any) => new ProcessDocumentUseCase(
    c.resolve('DocumentRepository') as IDocumentRepository,
    {} as any,
    c.resolve('ContentExtractor') as IContentExtractor,
    c.resolve('RAGEngine') as IRAGEngine,
    c.resolve('FileStorage') as IFileStorage,
    c.resolve('EmbeddingService') as IEmbeddingService
  ),
});

export { container };

export function resolve<T>(token: string | symbol | { new (...args: any[]): T }): T {
  return container.resolve<T>(token as any);
}
