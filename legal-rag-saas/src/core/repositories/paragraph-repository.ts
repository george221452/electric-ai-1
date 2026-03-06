import { Paragraph } from '../entities/paragraph';

export interface IParagraphRepository {
  /**
   * Găsește paragraf după ID
   */
  findById(id: string): Promise<Paragraph | null>;
  
  /**
   * Găsește toate paragrafele unui document
   */
  findByDocumentId(documentId: string): Promise<Paragraph[]>;
  
  /**
   * Găsește paragrafe după ID-uri (pentru citate)
   */
  findByIds(ids: string[]): Promise<Paragraph[]>;
  
  /**
   * Salvează paragraf nou
   */
  create(paragraph: Paragraph): Promise<Paragraph>;
  
  /**
   * Salvează multiple paragrafe (bulk insert)
   */
  createMany(paragraphs: Paragraph[]): Promise<Paragraph[]>;
  
  /**
   * Actualizează embedding pentru paragraf
   */
  updateEmbedding(id: string, embedding: number[]): Promise<void>;
  
  /**
   * Șterge toate paragrafele unui document
   */
  deleteByDocumentId(documentId: string): Promise<void>;
  
  /**
   * Căutare full-text (PostgreSQL)
   */
  searchFullText(query: string, documentIds?: string[]): Promise<Paragraph[]>;
  
  /**
   * Găsește paragrafe după număr articol (pentru documente legale)
   */
  findByArticleNumber(documentId: string, articleNumber: string): Promise<Paragraph[]>;
  
  /**
   * Numără paragrafe per document
   */
  countByDocumentId(documentId: string): Promise<number>;
  
  /**
   * Numără paragrafe cu embedding
   */
  countWithEmbeddings(documentId: string): Promise<number>;
}
