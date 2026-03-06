import { IContentExtractor, ExtractionResult, ExtractedParagraph } from '@/core/services/content-extractor';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';

export class UniversalExtractor implements IContentExtractor {
  private readonly supportedTypes = new Set([
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text', // ODT
  ]);

  async extract(fileBuffer: Buffer, fileType: string): Promise<ExtractionResult> {
    // Validate input
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Empty file buffer provided');
    }

    // Normalize file type (handle case variations)
    const normalizedType = fileType.toLowerCase().trim();

    try {
      if (normalizedType === 'application/pdf') {
        return await this.extractPDF(fileBuffer);
      }
      
      if (normalizedType.includes('wordprocessingml') || normalizedType.includes('msword')) {
        return await this.extractDOCX(fileBuffer);
      }
      
      if (normalizedType === 'text/plain') {
        return await this.extractTXT(fileBuffer);
      }

      if (normalizedType === 'application/vnd.oasis.opendocument.text' || normalizedType.includes('opendocument')) {
        return await this.extractODT(fileBuffer);
      }

      throw new Error(`File type "${fileType}" is not supported. Supported types: PDF, DOCX, ODT, TXT`);
    } catch (error) {
      // Re-throw with more context if it's not already a specific error
      if (error instanceof Error && error.message.includes('not supported')) {
        throw error;
      }
      throw new Error(`Failed to extract content from ${fileType} file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    try {
      // Try UTF-8 first, fall back to latin1 if that fails
      let text: string;
      try {
        text = buffer.toString('utf-8');
        // Check if the text looks like valid UTF-8 (no replacement characters)
        if (text.includes('\uFFFD') && buffer.length > 0) {
          // Try latin1 (ISO-8859-1) as fallback
          text = buffer.toString('latin1');
        }
      } catch {
        text = buffer.toString('latin1');
      }

      // Handle empty files
      if (!text || text.trim().length === 0) {
        return {
          paragraphs: [],
          pageCount: 0,
          metadata: {
            fileType: 'text/plain',
            language: 'unknown',
          },
        };
      }

      let paragraphs = this.splitIntoParagraphs(text, 1);

      // If no paragraphs were extracted (e.g., very short content), create one from the full text
      if (paragraphs.length === 0 && text.trim().length > 0) {
        paragraphs = [{
          content: text.trim().substring(0, 10000), // Limit to 10K chars per paragraph
          pageNumber: 1,
          metadata: {
            paragraphNumber: 1,
          },
        }];
      }

      return {
        paragraphs,
        pageCount: Math.max(1, Math.ceil(paragraphs.length / 20)), // At least 1 page
        metadata: {
          fileType: 'text/plain',
          language: 'unknown',
        },
      };
    } catch (error) {
      throw new Error(`TXT extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractODT(buffer: Buffer): Promise<ExtractionResult> {
    try {
      // ODT is a ZIP file containing content.xml
      const zip = new AdmZip(buffer);
      const contentXml = zip.readAsText('content.xml');
      
      // Parse XML and extract paragraphs properly
      const paragraphs = this.parseODTXml(contentXml);

      return {
        paragraphs,
        pageCount: Math.ceil(paragraphs.length / 10), // Estimate
        metadata: {
          fileType: 'application/vnd.oasis.opendocument.text',
          language: 'unknown',
        },
      };
    } catch (error) {
      throw new Error(`Failed to extract ODT: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseODTXml(xml: string): ExtractedParagraph[] {
    // Parse XML properly using fast-xml-parser
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: false,
      trimValues: true,
    });

    const parsed = parser.parse(xml);
    const paragraphs: ExtractedParagraph[] = [];

    // Navigate to office:text which contains all paragraphs
    const officeText = parsed?.['office:document-content']?.['office:body']?.['office:text'];
    if (!officeText) {
      return [];
    }

    // Extract all text content from the document
    const fullText = this.extractAllText(officeText);
    
    // Split into logical paragraphs based on Romanian legal document structure
    return this.splitIntoLegalParagraphs(fullText);
  }

  private extractAllText(obj: any): string {
    if (typeof obj === 'string') {
      return this.decodeXmlEntities(obj);
    }
    
    if (typeof obj !== 'object' || obj === null) {
      return '';
    }

    let text = '';
    
    // Direct text
    if (obj['#text']) {
      text += this.decodeXmlEntities(obj['#text']);
    }
    
    // Text spans
    if (obj['text:span']) {
      const spans = Array.isArray(obj['text:span']) ? obj['text:span'] : [obj['text:span']];
      for (const span of spans) {
        text += this.extractAllText(span);
      }
    }
    
    // Line breaks
    if (obj['text:line-break']) {
      text += '\n';
    }
    
    // Tabs
    if (obj['text:tab']) {
      text += '\t';
    }
    
    // Spaces
    if (obj['text:s']) {
      const sArray = Array.isArray(obj['text:s']) ? obj['text:s'] : [obj['text:s']];
      for (const s of sArray) {
        if (typeof s === 'object' && s['@_text:c']) {
          const count = parseInt(s['@_text:c'], 10);
          text += ' '.repeat(count);
        } else {
          text += ' ';
        }
      }
    }
    
    // Soft page breaks
    if (obj['text:soft-page-break']) {
      text += '\n';
    }

    // Recursively process other properties
    for (const key of Object.keys(obj)) {
      if (!['#text', 'text:span', 'text:line-break', 'text:tab', 'text:s', 'text:soft-page-break', '@_text:style-name'].includes(key)) {
        const value = obj[key];
        if (Array.isArray(value)) {
          for (const item of value) {
            text += this.extractAllText(item);
          }
        } else if (typeof value === 'object') {
          text += this.extractAllText(value);
        }
      }
    }

    return text;
  }

  private splitIntoLegalParagraphs(fullText: string): ExtractedParagraph[] {
    const paragraphs: ExtractedParagraph[] = [];
    
    // Clean up the text
    let text = fullText
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    // Strategy: Split by major section headers for Romanian legal/technical documents
    // CAPITOLUL X - Major chapters
    // Art. X - Articles within chapters
    // X.Y.Z. - Subsections
    
    // First, identify major sections (CAPITOLUL)
    const chapterPattern = /(CAPITOLUL\s+[IVX\d]+[\.:\s]+[^\n]+)/gi;
    const chapters = text.split(chapterPattern).filter(s => s.trim());
    
    let pageNumber = 1;
    let charCount = 0;
    const charsPerPage = 3000;
    
    // Process each section
    for (let i = 0; i < chapters.length; i++) {
      const section = chapters[i].trim();
      if (!section) continue;
      
      // Check if this is a chapter header
      if (/^CAPITOLUL\s+/i.test(section)) {
        // This is a chapter header, add it
        charCount += section.length;
        if (charCount > charsPerPage) {
          pageNumber++;
          charCount = 0;
        }
        
        paragraphs.push({
          content: section.substring(0, 2000), // Limit size
          pageNumber,
          metadata: {
            paragraphNumber: paragraphs.length + 1,
            isChapter: true,
          },
        });
      } else {
        // This is content - split into articles
        // Look for "Art. X" patterns
        const articleMatches = section.split(/(?=Art\.\s*\d+[\.:\s])/i);
        
        for (const articleContent of articleMatches) {
          const trimmed = articleContent.trim();
          if (trimmed.length < 30) continue; // Skip very short fragments
          
          // Try to extract article number
          const articleMatch = trimmed.match(/^(Art\.\s*(\d+[\.:]?))/i);
          const articleNumber = articleMatch ? articleMatch[2].replace(/[\.:]$/, '') : undefined;
          
          // Clean up the content - remove trailing partial references
          let cleanContent = trimmed;
          
          // Remove trailing "art. X" fragments that got cut off
          cleanContent = cleanContent.replace(/\s+art\.\s*\d+\s*$/i, '');
          
          // Remove trailing partial words
          const lastSentence = cleanContent.match(/.*[.!?;]/);
          if (lastSentence && cleanContent.length - lastSentence[0].length < 20) {
            cleanContent = lastSentence[0];
          }
          
          if (cleanContent.length < 50) continue; // Skip if too short after cleaning
          
          charCount += cleanContent.length;
          if (charCount > charsPerPage) {
            pageNumber++;
            charCount = 0;
          }
          
          paragraphs.push({
            content: cleanContent,
            pageNumber,
            metadata: {
              paragraphNumber: paragraphs.length + 1,
              articleNumber,
            },
          });
        }
      }
    }
    
    // Fallback: if we didn't find structured content, split by large chunks
    if (paragraphs.length < 10) {
      paragraphs.length = 0; // Clear array
      
      // Split into chunks of ~1000-2000 characters at sentence boundaries
      const sentences = text.match(/[^.!?;]+[.!?;]+/g) || [];
      let currentChunk = '';
      
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > 1500) {
          // Save current chunk
          if (currentChunk.length > 100) {
            charCount += currentChunk.length;
            if (charCount > charsPerPage) {
              pageNumber++;
              charCount = 0;
            }
            
            paragraphs.push({
              content: currentChunk.trim(),
              pageNumber,
              metadata: {
                paragraphNumber: paragraphs.length + 1,
              },
            });
          }
          currentChunk = sentence;
        } else {
          currentChunk += sentence;
        }
      }
      
      // Don't forget the last chunk
      if (currentChunk.length > 100) {
        charCount += currentChunk.length;
        if (charCount > charsPerPage) {
          pageNumber++;
          charCount = 0;
        }
        
        paragraphs.push({
          content: currentChunk.trim(),
          pageNumber,
          metadata: {
            paragraphNumber: paragraphs.length + 1,
          },
        });
      }
    }
    
    return paragraphs;
  }

  private decodeXmlEntities(text: string): string {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
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
    return false; // Simplified - assume text documents
  }
}
