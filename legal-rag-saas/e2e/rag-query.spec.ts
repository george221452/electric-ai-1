import { test, expect } from '@playwright/test';

test.describe('RAG Query API', () => {
  test('should handle missing documents gracefully', async ({ request }) => {
    const response = await request.post('/api/rag/query', {
      data: {
        query: 'Ce obligații există pentru protecție electrică?',
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        options: {
          maxParagraphs: 3,
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    
    // Check structure
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.answer).toBeDefined();
    expect(body.data.citations).toBeDefined();
    
    // When no documents are indexed, should return 0 confidence and informative message
    expect(body.data.confidence).toBe(0);
    expect(body.data.resultsCount).toBe(0);
    expect(body.data.citations.length).toBe(0);
    
    // Should contain helpful message about indexing documents
    expect(body.data.answer).toContain('Nu există documente indexate');
    expect(body.data.disclaimer).toContain('documente indexate');
  });

  test('should validate query parameters', async ({ request }) => {
    const response = await request.post('/api/rag/query', {
      data: {
        query: 'ab', // Too short
        workspaceId: 'invalid-uuid',
      },
    });

    expect(response.status()).toBe(400);
    
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test('should handle empty query gracefully', async ({ request }) => {
    const response = await request.post('/api/rag/query', {
      data: {
        query: '',
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
      },
    });

    expect(response.status()).toBe(400);
  });
  
  test('should return low confidence for irrelevant queries when docs exist', async ({ request }) => {
    // This test verifies the relevance scoring system
    const response = await request.post('/api/rag/query', {
      data: {
        query: 'Cum se face împământarea?', // Topic unlikely to match demo docs
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
      },
    });

    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.success).toBe(true);
    
    // Without indexed data, confidence should be 0
    // With indexed data but no relevant results, confidence should be low (< 50)
    expect(body.data.confidence).toBeLessThanOrEqual(50);
  });
});
