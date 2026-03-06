import { Query } from '../value-objects/query';
import { Paragraph } from '../entities/paragraph';
import { SearchResult } from '../value-objects/search-result';

export interface SearchContext {
  workspaceId: string;
  documentIds?: string[];
  minScore: number;
  maxResults: number;
  boostConfig?: BoostConfiguration;
}

export interface BoostConfiguration {
  obligationKeywords?: string[];
  prohibitionKeywords?: string[];
  definitionKeywords?: string[];
  procedureKeywords?: string[];
  customBoosts?: Array<{
    pattern: RegExp;
    boost: number;
  }>;
}

export interface IRAGEngine {
  /**
   * Căutare semantică - returnează paragrafe relevante fără modificarea conținutului
   * @param query - Query-ul utilizatorului
   * @param context - Contextul de căutare (workspace, documente, etc.)
   * @returns Array de paragrafe ordonate după relevanță
   */
  search(query: Query, context: SearchContext): Promise<SearchResult[]>;
  
  /**
   * Căutare hibridă - combină vector search cu keyword search
   */
  hybridSearch(query: Query, context: SearchContext): Promise<SearchResult[]>;
  
  /**
   * Indexare document - stochează embedding-uri pentru paragrafe
   * @param paragraphs - Paragrafele de indexat
   * @param documentId - ID-ul documentului
   */
  indexParagraphs(paragraphs: Paragraph[], documentId: string): Promise<void>;
  
  /**
   * Ștergere document din index
   * @param documentId - ID-ul documentului de șters
   */
  removeDocument(documentId: string): Promise<void>;
  
  /**
   * Actualizare embedding pentru un paragraf
   */
  updateParagraph(paragraph: Paragraph): Promise<void>;
  
  /**
   * Verificare sănătate conexiune
   */
  healthCheck(): Promise<boolean>;
}
