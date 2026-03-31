/**
 * Unit tests for RAG Architecture Settings Service
 */

// Simple mock for Prisma
const mockFindUnique = jest.fn();
const mockUpsert = jest.fn();
const mockCreate = jest.fn();
const mockDeleteMany = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    ragArchitectureSettings: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
      create: mockCreate,
      deleteMany: mockDeleteMany,
    },
  })),
}));

// Import after mocking
import {
  getArchitectureSettings,
  updateArchitectureSettings,
  switchArchitecture,
  resetArchitectureSettings,
} from '@/lib/rag-architectures/settings-service';

describe('Settings Service', () => {
  const mockDbSettings = {
    id: 'global',
    activeArchitecture: 'legacy',
    chunkMaxSize: 1500,
    chunkMinSize: 200,
    chunkOverlap: 100,
    preserveParagraphBoundaries: true,
    preserveSentenceBoundaries: true,
    cleanDiacritics: true,
    removeExtraWhitespace: true,
    fixHyphenatedWords: true,
    embeddingModel: 'text-embedding-3-small',
    embeddingDimensions: 1536,
    embeddingBatchSize: 100,
    legacyUseKeywordSearch: true,
    legacyUseVectorSearch: true,
    legacyMinScoreThreshold: 0.4,
    legacyMaxResults: 10,
    legacyFinalResults: 3,
    legacySearchStrategy: 'parallel',
    legacyCombineMethod: 'merge',
    legacyOpenaiModel: 'gpt-4o-mini',
    legacyMaxTokens: 500,
    legacyTemperature: 0.2,
    legacySystemPrompt: 'Test',
    legacyPromptTemplate: 'standard',
    legacyIncludeCitations: true,
    legacyRequireCitations: true,
    hybridUseKeywordSearch: true,
    hybridUseVectorSearch: true,
    hybridUseSynonymExpansion: false,
    hybridSynonymMaxVariants: 3,
    hybridUseNumericalBoost: false,
    hybridNumericalBoostWeight: 0.3,
    hybridUseSmartRouter: false,
    hybridSmartRouterQuizThreshold: 0.75,
    hybridSmartRouterNormalThreshold: 0.5,
    hybridSmartRouterMaxRetries: 2,
    hybridUseConfidenceOptimizer: false,
    hybridUseQueryUnderstanding: false,
    hybridUseIntentDetection: false,
    hybridMinScoreThreshold: 0.4,
    hybridMaxResults: 10,
    hybridFinalResults: 3,
    hybridRerankEnabled: false,
    hybridRerankMethod: 'score',
    hybridOpenaiModel: 'gpt-4o-mini',
    hybridMaxTokens: 600,
    hybridTemperature: 0.2,
    hybridSystemPrompt: 'Test',
    hybridPromptTemplate: 'adaptive',
    hybridIncludeCitations: true,
    hybridRequireCitations: true,
    hybridQuizEnabled: true,
    hybridQuizStrictMode: false,
    hybridQuizConfidenceThreshold: 70,
    enableQueryCache: true,
    cacheTtlSeconds: 3600,
    enableResultCache: false,
    resultCacheTtlSeconds: 86400,
    showDebugInfo: false,
    logQueries: true,
    logPerformanceMetrics: false,
    enableQueryTracing: false,
    answerFormat: 'markdown',
    includeSources: true,
    includeConfidenceScore: true,
    includeExecutionTime: false,
    addDocumentBanner: false,
    fallbackOnLowConfidence: true,
    fallbackConfidenceThreshold: 40,
    fallbackToGeneralKnowledge: false,
    showClarificationOnNoResults: true,
    extractMetadata: true,
    extractArticleNumbers: true,
    extractKeywords: true,
    classifyParagraphs: false,
    updatedAt: new Date('2024-01-01'),
    updatedBy: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getArchitectureSettings', () => {
    it('should return settings from database', async () => {
      mockFindUnique.mockResolvedValue(mockDbSettings);

      const settings = await getArchitectureSettings();

      expect(settings).toBeDefined();
      expect(settings.id).toBe('global');
      expect(settings.activeArchitecture).toBe('legacy');
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'global' },
      });
    });

    it('should return valid settings object', async () => {
      mockFindUnique.mockResolvedValue(mockDbSettings);

      const settings = await getArchitectureSettings();

      expect(settings).toHaveProperty('id');
      expect(settings).toHaveProperty('activeArchitecture');
      expect(settings).toHaveProperty('legacyUseKeywordSearch');
      expect(settings).toHaveProperty('hybridUseKeywordSearch');
    });
  });

  describe('updateArchitectureSettings', () => {
    it('should call upsert with correct data', async () => {
      mockUpsert.mockResolvedValue(mockDbSettings);
      mockFindUnique.mockResolvedValue(mockDbSettings);

      const updates = {
        activeArchitecture: 'hybrid' as const,
        legacyMaxResults: 20,
      };

      await updateArchitectureSettings(updates, 'admin-id');

      expect(mockUpsert).toHaveBeenCalled();
      const callArg = mockUpsert.mock.calls[0][0];
      expect(callArg.where).toEqual({ id: 'global' });
    });

    it('should return settings after update', async () => {
      mockUpsert.mockResolvedValue(mockDbSettings);
      mockFindUnique.mockResolvedValue(mockDbSettings);

      const settings = await updateArchitectureSettings({ legacyMaxResults: 20 }, 'admin-id');

      expect(settings).toBeDefined();
      expect(settings.id).toBe('global');
    });
  });

  describe('switchArchitecture', () => {
    it('should switch from legacy to hybrid', async () => {
      mockUpsert.mockResolvedValue({
        ...mockDbSettings,
        activeArchitecture: 'hybrid',
      });
      mockFindUnique.mockResolvedValue({
        ...mockDbSettings,
        activeArchitecture: 'hybrid',
      });

      const settings = await switchArchitecture('hybrid', 'admin-id');

      expect(settings.activeArchitecture).toBe('hybrid');
      expect(mockUpsert).toHaveBeenCalled();
    });

    it('should switch from hybrid to legacy', async () => {
      mockUpsert.mockResolvedValue(mockDbSettings);
      mockFindUnique.mockResolvedValue(mockDbSettings);

      const settings = await switchArchitecture('legacy', 'admin-id');

      expect(settings.activeArchitecture).toBe('legacy');
    });
  });

  describe('resetArchitectureSettings', () => {
    it('should delete existing settings', async () => {
      mockFindUnique.mockResolvedValue(mockDbSettings);
      mockDeleteMany.mockResolvedValue({ count: 1 });
      mockCreate.mockResolvedValue(mockDbSettings);

      await resetArchitectureSettings('admin-id');

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { id: 'global' },
      });
    });

    it('should create new default settings', async () => {
      mockFindUnique.mockResolvedValue(mockDbSettings);
      mockDeleteMany.mockResolvedValue({ count: 1 });
      mockCreate.mockResolvedValue(mockDbSettings);

      const settings = await resetArchitectureSettings('admin-id');

      expect(mockCreate).toHaveBeenCalled();
      expect(settings).toBeDefined();
    });
  });
});
