import { IContentExtractor, ExtractionResult, ExtractedParagraph } from '@/core/services/content-extractor';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export class PDFExtractor implements IContentExtractor {
  private readonly supportedTypes = new Set([
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]);

  async extract(fileBuffer: Buffer, fileType: string): Promise<ExtractionResult> {
    if (fileType === 'application/pdf') {
      return this.extractPDF(fileBuffer);
    }
    
    if (fileType.includes('wordprocessingml') || fileType.includes('msword')) {
      return this.extractDOCX(fileBuffer);
    }
    
    if (fileType === 'text/plain') {
      return this.extractTXT(fileBuffer);
    }

    throw new Error(`File type ${fileType} not supported`);
  }

  private async extractPDF(buffer: Buffer): Promise<ExtractionResult> {
    const data = await pdfParse(buffer);
    const paragraphs = this.splitIntoParagraphs(data.text, 1);

    return {
      paragraphs,
      pageCount: data.numpages,
      metadata: {
        fileType: 'application/pdf',
        language: 'unknown',
      },
    };
  }

  private async extractDOCX(buffer: Buffer): Promise<ExtractionResult> {
    const result = await mammoth.extractRawText({ buffer });
    const paragraphs = this.splitIntoParagraphs(result.value, 1);

    return {
      paragraphs,
      pageCount: Math.ceil(paragraphs.length / 10), // Estimate
      metadata: {
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        language: 'unknown',
      },
    };
  }

  private async extractTXT(buffer: Buffer): Promise<ExtractionResult> {
    const text = buffer.toString('utf-8');
    const paragraphs = this.splitIntoParagraphs(text, 1);

    return {
      paragraphs,
      pageCount: Math.ceil(paragraphs.length / 20), // Estimate
      metadata: {
        fileType: 'text/plain',
        language: 'unknown',
      },
    };
  }

  private splitIntoParagraphs(text: string, startPage: number): ExtractedParagraph[] {
    // Split by multiple newlines or page breaks
    const rawParagraphs = text
      .split(/\n\s*\n|\f/)
      .map(p => p.trim())
      .filter(p => p.length > 20); // Filter out very short lines

    let pageNumber = startPage;
    let charCount = 0;
    const charsPerPage = 3000; // Approximate

    return rawParagraphs.map((content, index) => {
      charCount += content.length;
      if (charCount > charsPerPage) {
        pageNumber++;
        charCount = 0;
      }

      return {
        content,
        pageNumber,
        metadata: {
          paragraphNumber: index + 1,
        } as any,
      };
    });
  }

  async extractRawText(fileBuffer: Buffer, fileType: string): Promise<string> {
    const result = await this.extract(fileBuffer, fileType);
    return result.paragraphs.map(p => p.content).join('\n\n');
  }

  supports(fileType: string): boolean {
    return this.supportedTypes.has(fileType);
  }

  getSupportedTypes(): string[] {
    return Array.from(this.supportedTypes);
  }

  async needsOCR(fileBuffer: Buffer, fileType: string): Promise<boolean> {
    return false; // Simplified - assume text PDFs
  }
}
