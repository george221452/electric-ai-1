import { Document } from '../entities/document';

export interface DocumentFilter {
  workspaceId?: string;
  userId?: string;
  status?: Document['status'];
  ragConfigId?: string;
  searchQuery?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: 'createdAt' | 'name' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface IDocumentRepository {
  /**
   * Găsește document după ID
   */
  findById(id: string): Promise<Document | null>;
  
  /**
   * Găsește document cu toate paragrafele
   */
  findByIdWithParagraphs(id: string): Promise<Document | null>;
  
  /**
   * Găsește document după storage key
   */
  findByStorageKey(storageKey: string): Promise<Document | null>;
  
  /**
   * Listă documente cu filtrare și paginare
   */
  findMany(
    filter: DocumentFilter,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<Document>>;
  
  /**
   * Salvează document nou
   */
  create(document: Document): Promise<Document>;
  
  /**
   * Actualizează document
   */
  update(document: Document): Promise<Document>;
  
  /**
   * Șterge document
   */
  delete(id: string): Promise<void>;
  
  /**
   * Verifică existență
   */
  exists(id: string): Promise<boolean>;
  
  /**
   * Numără documente după filtru
   */
  count(filter: DocumentFilter): Promise<number>;
  
  /**
   * Găsește documente după workspace
   */
  findByWorkspace(
    workspaceId: string,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<Document>>;
  
  /**
   * Găsește documente pentru RAG query (doar cele procesate)
   */
  findForRAG(workspaceId: string, documentIds?: string[]): Promise<Document[]>;
}
