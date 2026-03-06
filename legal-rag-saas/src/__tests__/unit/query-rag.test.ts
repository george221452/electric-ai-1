import { Query } from '@/core/value-objects/query';
import { Citation } from '@/core/value-objects/citation';

const TEST_WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_PARAGRAPH_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_DOCUMENT_ID = '550e8400-e29b-41d4-a716-446655440002';

describe('Query Value Object', () => {
  describe('intent detection', () => {
    it('should detect obligation intent', () => {
      const query = Query.create({
        text: 'Ce trebuie să fac pentru împământare?',
        workspaceId: TEST_WORKSPACE_ID,
      });

      expect(query.detectQueryIntent()).toBe('obligation');
    });

    it('should detect prohibition intent', () => {
      const query = Query.create({
        text: 'Ce este interzis în instalațiile electrice?',
        workspaceId: TEST_WORKSPACE_ID,
      });

      expect(query.detectQueryIntent()).toBe('prohibition');
    });

    it('should detect definition intent', () => {
      const query = Query.create({
        text: 'Ce inseamna protectie la electrocutare?',
        workspaceId: TEST_WORKSPACE_ID,
      });

      expect(query.detectQueryIntent()).toBe('definition');
    });
  });

  describe('keywords extraction', () => {
    it('should extract keywords from query', () => {
      const query = Query.create({
        text: 'Ce obligații există pentru instalații electrice?',
        workspaceId: TEST_WORKSPACE_ID,
      });

      const keywords = query.extractKeywords();
      expect(keywords).toContain('obligații');
      expect(keywords).toContain('instalații');
      expect(keywords).toContain('electrice');
    });
  });
});

describe('Citation Value Object', () => {
  describe('validation', () => {
    it('should validate high confidence citation', () => {
      const citation = new Citation({
        paragraphId: TEST_PARAGRAPH_ID,
        documentId: TEST_DOCUMENT_ID,
        documentName: 'Test.pdf',
        pageNumber: 1,
        paragraphNumber: 1,
        text: 'Exact match text',
        confidence: 100,
      });

      expect(citation.isValid(true)).toBe(true);
      expect(citation.isHighlyConfident()).toBe(true);
    });

    it('should handle medium confidence citation', () => {
      const citation = new Citation({
        paragraphId: TEST_PARAGRAPH_ID,
        documentId: TEST_DOCUMENT_ID,
        documentName: 'Test.pdf',
        pageNumber: 1,
        paragraphNumber: 1,
        text: 'Some text',
        confidence: 75,
      });

      expect(citation.isValid(true)).toBe(false); // Strict: 85+
      expect(citation.isValid(false)).toBe(true);  // Non-strict: 70+
    });
  });
});
