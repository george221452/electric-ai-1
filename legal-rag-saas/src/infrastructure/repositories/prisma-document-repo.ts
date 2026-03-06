import { PrismaClient } from '@prisma/client';
import { Document } from '@/core/entities/document';
import { Paragraph } from '@/core/entities/paragraph';
import { IDocumentRepository, DocumentFilter, PaginationOptions, PaginatedResult } from '@/core/repositories/document-repository';

export class PrismaDocumentRepository implements IDocumentRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Document | null> {
    const doc = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!doc) return null;

    return this.toDomain(doc);
  }

  async findByIdWithParagraphs(id: string): Promise<Document | null> {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        paragraphs: {
          orderBy: {
            paragraphNumber: 'asc',
          },
        },
      },
    });

    if (!doc) return null;

    const paragraphs = doc.paragraphs.map(p => 
      Paragraph.reconstitute({
        id: p.id,
        documentId: p.documentId,
        content: p.content,
        metadata: {
          pageNumber: p.pageNumber,
          paragraphNumber: p.paragraphNumber,
          chapterTitle: p.chapterTitle || undefined,
          sectionTitle: p.sectionTitle || undefined,
          wordCount: p.wordCount,
          charCount: p.charCount,
          keywords: p.keywords,
          isObligation: p.isObligation,
          isProhibition: p.isProhibition,
          isDefinition: p.isDefinition,
          articleNumber: p.articleNumber || undefined,
          paragraphLetter: p.paragraphLetter || undefined,
        },
        createdAt: p.createdAt,
      })
    );

    return this.toDomain(doc, paragraphs);
  }

  async findByStorageKey(storageKey: string): Promise<Document | null> {
    const doc = await this.prisma.document.findUnique({
      where: { storageKey },
    });

    if (!doc) return null;

    return this.toDomain(doc);
  }

  async findMany(
    filter: DocumentFilter,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<Document>> {
    const where: any = {};

    if (filter.workspaceId) {
      where.workspaceId = filter.workspaceId;
    }

    if (filter.userId) {
      where.userId = filter.userId;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.ragConfigId) {
      where.ragConfigId = filter.ragConfigId;
    }

    if (filter.searchQuery) {
      where.name = {
        contains: filter.searchQuery,
        mode: 'insensitive',
      };
    }

    const total = await this.prisma.document.count({ where });

    const docs = await this.prisma.document.findMany({
      where,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: {
        [pagination.sortBy || 'createdAt']: pagination.sortOrder || 'desc',
      },
    });

    return {
      items: docs.map(d => this.toDomain(d)),
      total,
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit),
      hasMore: pagination.page * pagination.limit < total,
    };
  }

  async create(document: Document): Promise<Document> {
    const doc = await this.prisma.document.create({
      data: {
        id: document.id,
        workspaceId: document.workspaceId,
        userId: document.userId,
        name: document.name,
        fileType: document.fileType,
        fileSize: document.fileSize,
        storageKey: document.storageKey,
        status: document.status,
        ragConfigId: document.ragConfigId,
        metadata: document.metadata as any,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      },
    });

    return this.toDomain(doc);
  }

  async update(document: Document): Promise<Document> {
    const doc = await this.prisma.document.update({
      where: { id: document.id },
      data: {
        name: document.name,
        status: document.status,
        pageCount: document.pageCount,
        processingError: document.processingError,
        metadata: document.metadata as any,
        updatedAt: document.updatedAt,
      },
    });

    return this.toDomain(doc);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.document.delete({
      where: { id },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.document.count({
      where: { id },
    });
    return count > 0;
  }

  async count(filter: DocumentFilter): Promise<number> {
    const where: any = {};

    if (filter.workspaceId) {
      where.workspaceId = filter.workspaceId;
    }

    if (filter.userId) {
      where.userId = filter.userId;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    return this.prisma.document.count({ where });
  }

  async findByWorkspace(
    workspaceId: string,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<Document>> {
    return this.findMany({ workspaceId }, pagination);
  }

  async findForRAG(workspaceId: string, documentIds?: string[]): Promise<Document[]> {
    const where: any = {
      workspaceId,
      status: 'COMPLETED',
    };

    if (documentIds && documentIds.length > 0) {
      where.id = { in: documentIds };
    }

    const docs = await this.prisma.document.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return docs.map(d => this.toDomain(d));
  }

  private toDomain(prismaDoc: any, paragraphs: Paragraph[] = []): Document {
    return Document.reconstitute({
      id: prismaDoc.id,
      workspaceId: prismaDoc.workspaceId,
      userId: prismaDoc.userId,
      name: prismaDoc.name,
      fileType: prismaDoc.fileType,
      fileSize: prismaDoc.fileSize,
      storageKey: prismaDoc.storageKey,
      status: prismaDoc.status,
      pageCount: prismaDoc.pageCount || undefined,
      ragConfigId: prismaDoc.ragConfigId,
      paragraphs,
      processingError: prismaDoc.processingError || undefined,
      metadata: (prismaDoc.metadata as Record<string, unknown>) || {},
      createdAt: prismaDoc.createdAt,
      updatedAt: prismaDoc.updatedAt,
    });
  }
}
