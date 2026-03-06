import { StrictCitationValidator } from '@/infrastructure/adapters/validators/strict-citation-validator';
import { Paragraph } from '@/core/entities/paragraph';

describe('StrictCitationValidator', () => {
  const validator = new StrictCitationValidator();

  describe('exact match', () => {
    it('should return 100 confidence for identical text', async () => {
      const text = 'Se interzice utilizarea conductoarelor neizolate.';
      const paragraph = Paragraph.create({
        documentId: 'doc-1',
        content: text,
        metadata: {
          pageNumber: 1,
          paragraphNumber: 1,
          wordCount: 5,
          charCount: text.length,
          keywords: ['interzice', 'conductoare'],
        },
      });

      const result = await validator.validate(text, paragraph);

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe(100);
      expect(result.method).toBe('EXACT_MATCH');
    });
  });

  describe('normalized match', () => {
    it('should match text with different casing', async () => {
      const original = 'SE INTERZICE utilizarea conductoarelor.';
      const cited = 'se interzice utilizarea conductoarelor.';

      const paragraph = Paragraph.create({
        documentId: 'doc-1',
        content: original,
        metadata: {
          pageNumber: 1,
          paragraphNumber: 1,
          wordCount: 4,
          charCount: original.length,
          keywords: ['interzice'],
        },
      });

      const result = await validator.validate(cited, paragraph);

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe(98);
      expect(result.method).toBe('NORMALIZED_MATCH');
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      const text = 'identical text';
      expect(validator.calculateSimilarity(text, text)).toBe(1);
    });

    it('should return lower value for different strings', () => {
      const text1 = 'completely different text';
      const text2 = 'nothing alike here';
      const similarity = validator.calculateSimilarity(text1, text2);
      expect(similarity).toBeLessThan(0.5);
    });

    it('should handle empty strings', () => {
      expect(validator.calculateSimilarity('', '')).toBe(1);
      expect(validator.calculateSimilarity('text', '')).toBe(0);
    });
  });
});
