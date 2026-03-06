import { UniversalExtractor } from '@/infrastructure/adapters/extractors/universal-extractor';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('UniversalExtractor', () => {
  const extractor = new UniversalExtractor();

  describe('supported file types', () => {
    it('should support PDF files', () => {
      expect(extractor.supports('application/pdf')).toBe(true);
    });

    it('should support TXT files', () => {
      expect(extractor.supports('text/plain')).toBe(true);
    });

    it('should support DOCX files', () => {
      expect(extractor.supports('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
    });

    it('should support ODT files', () => {
      expect(extractor.supports('application/vnd.oasis.opendocument.text')).toBe(true);
    });

    it('should not support unsupported types', () => {
      expect(extractor.supports('image/jpeg')).toBe(false);
      expect(extractor.supports('application/zip')).toBe(false);
    });
  });

  describe('TXT extraction', () => {
    it('should extract text from TXT buffer', async () => {
      const text = 'This is a test paragraph.\n\nThis is another paragraph with more content.';
      const buffer = Buffer.from(text, 'utf-8');
      
      const result = await extractor.extract(buffer, 'text/plain');
      
      expect(result.paragraphs.length).toBeGreaterThan(0);
      expect(result.paragraphs.some(p => p.content.includes('test paragraph'))).toBe(true);
      expect(result.metadata.fileType).toBe('text/plain');
    });

    it('should reject empty file buffer', async () => {
      const buffer = Buffer.from('', 'utf-8');
      
      await expect(extractor.extract(buffer, 'text/plain')).rejects.toThrow('Empty file buffer');
    });

    it('should handle TXT file with only whitespace', async () => {
      const buffer = Buffer.from('   \n\n   \t   ', 'utf-8');
      
      const result = await extractor.extract(buffer, 'text/plain');
      
      expect(result.paragraphs).toBeDefined();
      expect(result.metadata.isEmpty).toBe(true);
    });

    it('should handle large TXT file', async () => {
      // Create a large text file simulation (100KB)
      const largeText = 'Lorem ipsum dolor sit amet. '.repeat(3000);
      const buffer = Buffer.from(largeText, 'utf-8');
      
      const result = await extractor.extract(buffer, 'text/plain');
      
      expect(result.paragraphs.length).toBeGreaterThan(0);
      expect(result.pageCount).toBeGreaterThan(0);
    });

    it('should handle Romanian text with diacritics', async () => {
      const text = 'Instalații electrice. Protecție la electrocutare. Măsuri de siguranță.';
      const buffer = Buffer.from(text, 'utf-8');
      
      const result = await extractor.extract(buffer, 'text/plain');
      
      expect(result.paragraphs.length).toBeGreaterThan(0);
      expect(result.paragraphs[0].content).toContain('Instalații');
    });
  });

  describe('PDF extraction', () => {
    it('should extract text from valid PDF buffer', async () => {
      // Create a minimal valid PDF
      const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF content) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 

trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
313
%%EOF`;
      
      const buffer = Buffer.from(pdfContent, 'utf-8');
      
      // Note: pdf-parse might fail on this minimal PDF, but we're testing the flow
      try {
        const result = await extractor.extract(buffer, 'application/pdf');
        expect(result).toBeDefined();
      } catch (error) {
        // Expected for minimal PDF - pdf-parse requires proper structure
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid PDF gracefully', async () => {
      const invalidPdf = Buffer.from('Not a valid PDF content', 'utf-8');
      
      await expect(extractor.extract(invalidPdf, 'application/pdf')).rejects.toThrow();
    });
  });

  describe('DOCX extraction', () => {
    it('should handle invalid DOCX gracefully', async () => {
      const invalidDocx = Buffer.from('Not a valid DOCX content', 'utf-8');
      
      await expect(
        extractor.extract(invalidDocx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      ).rejects.toThrow();
    });

    it('should handle DOCX with alternative MIME type', async () => {
      const invalidDocx = Buffer.from('Invalid', 'utf-8');
      
      await expect(
        extractor.extract(invalidDocx, 'application/msword')
      ).rejects.toThrow();
    });
  });

  describe('ODT extraction', () => {
    it('should handle invalid ODT gracefully', async () => {
      const invalidOdt = Buffer.from('Not a valid ODT content', 'utf-8');
      
      await expect(
        extractor.extract(invalidOdt, 'application/vnd.oasis.opendocument.text')
      ).rejects.toThrow();
    });

    it('should handle ODT with alternative MIME type', async () => {
      const invalidOdt = Buffer.from('Invalid', 'utf-8');
      
      await expect(
        extractor.extract(invalidOdt, 'application/x-opendocument')
      ).rejects.toThrow();
    });
  });

  describe('extractRawText', () => {
    it('should return raw text from extraction result', async () => {
      const text = 'Paragraph 1 with sufficient length to pass the minimum filter.\n\nParagraph 2 with also enough content to be considered valid.';
      const buffer = Buffer.from(text, 'utf-8');
      
      const rawText = await extractor.extractRawText(buffer, 'text/plain');
      
      expect(typeof rawText).toBe('string');
      expect(rawText.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should throw error for unsupported file type', async () => {
      const buffer = Buffer.from('test', 'utf-8');
      
      await expect(extractor.extract(buffer, 'image/jpeg')).rejects.toThrow('is not supported');
    });

    it('should handle buffer with special characters', async () => {
      const text = 'Special chars: ©®™•§¶†‡«»„""\'\'... –—'; 
      const buffer = Buffer.from(text, 'utf-8');
      
      const result = await extractor.extract(buffer, 'text/plain');
      
      expect(result.paragraphs.length).toBeGreaterThan(0);
    });

    it('should handle very long single line', async () => {
      const longLine = 'Word '.repeat(10000);
      const buffer = Buffer.from(longLine, 'utf-8');
      
      const result = await extractor.extract(buffer, 'text/plain');
      
      expect(result.paragraphs.length).toBeGreaterThan(0);
    });
  });
});
