export interface ExtractedParagraph {
  content: string;
  pageNumber: number;
  metadata: {
    chapterTitle?: string;
    sectionTitle?: string;
    fontSize?: number;
    isBold?: boolean;
    position?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    // Pentru documente legale
    articleNumber?: string;
    paragraphLetter?: string;
    paragraphNumber?: number;
    isChapter?: boolean;
  };
}

export interface ExtractionResult {
  paragraphs: ExtractedParagraph[];
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    creationDate?: Date;
    language?: string;
    fileType: string;
  };
}

export interface IContentExtractor {
  /**
   * Extrage conținut structurat din fișier
   * @param fileBuffer - Buffer-ul fișierului
   * @param fileType - Tipul fișierului (pdf, docx, txt, etc.)
   * @returns Conținutul extras structurat
   */
  extract(fileBuffer: Buffer, fileType: string): Promise<ExtractionResult>;
  
  /**
   * Extrage text brut (pentru fallback sau debug)
   */
  extractRawText(fileBuffer: Buffer, fileType: string): Promise<string>;
  
  /**
   * Verificare suport tip fișier
   */
  supports(fileType: string): boolean;
  
  /**
   * Obține lista de tipuri suportate
   */
  getSupportedTypes(): string[];
  
  /**
   * Verificare dacă fișierul are nevoie de OCR
   */
  needsOCR(fileBuffer: Buffer, fileType: string): Promise<boolean>;
}
