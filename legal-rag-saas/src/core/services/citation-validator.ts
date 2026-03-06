import { Paragraph } from '../entities/paragraph';

export interface ValidationResult {
  isValid: boolean;
  confidence: number; // 0-100 (validation accuracy)
  relevanceScore: number; // 0-1 (relevance to query)
  method: ValidationMethod;
  details?: string;
}

export type ValidationMethod = 
  | 'EXACT_MATCH' 
  | 'NORMALIZED_MATCH' 
  | 'SUBSET_MATCH' 
  | 'LEVENSHTEIN_SIMILAR' 
  | 'SEMANTIC_SIMILAR'
  | 'VALIDATION_FAILED';

export interface ICitationValidator {
  /**
   * Validează dacă un text citat corespunde cu paragraful sursă
   * @param citedText - Textul citat (extras din răspunsul AI sau query)
   * @param sourceParagraph - Paragraful sursă original
   * @param queryText - Optional: query-ul utilizatorului pentru relevance scoring
   * @returns Rezultatul validării cu confidence score și relevance score
   */
  validate(citedText: string, sourceParagraph: Paragraph, queryText?: string): Promise<ValidationResult>;
  
  /**
   * Verificare rapidă anti-halucinație
   * Compară text extras cu original pentru a detecta modificări
   */
  verifyFactualAccuracy(extractedText: string, originalText: string, queryText?: string): ValidationResult;
  
  /**
   * Validează multiple citate în bulk
   */
  validateBatch(
    citations: Array<{ text: string; paragraphId: string }>,
    paragraphs: Map<string, Paragraph>
  ): Promise<Map<string, ValidationResult>>;
  
  /**
   * Calculează similaritatea între două texte
   */
  calculateSimilarity(text1: string, text2: string): number;
  
  /**
   * Calculează relevance score între query și conținut
   * Returns 0-1 score based on keyword matching
   */
  calculateRelevanceScore(query: string, content: string): number;
}
