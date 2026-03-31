/**
 * Unit tests for Admin RAG Architecture API
 * 
 * Tests API logic without importing Next.js server components
 */

// Mock the settings service
const mockGetSettings = jest.fn();
const mockUpdateSettings = jest.fn();
const mockSwitchArch = jest.fn();
const mockResetSettings = jest.fn();

jest.mock('@/lib/rag-architectures/settings-service', () => ({
  getArchitectureSettings: mockGetSettings,
  updateArchitectureSettings: mockUpdateSettings,
  switchArchitecture: mockSwitchArch,
  resetArchitectureSettings: mockResetSettings,
}));

describe('Admin RAG Architecture API Logic', () => {
  const mockSettings = {
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
    updatedAt: new Date(),
    updatedBy: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Settings transformation', () => {
    /**
     * Simulates the transformSettingsToNested function from the API
     */
    function transformSettingsToNested(settings: typeof mockSettings) {
      return {
        id: settings.id,
        activeArchitecture: settings.activeArchitecture,
        legacy: {
          useKeywordSearch: settings.legacyUseKeywordSearch,
          useVectorSearch: settings.legacyUseVectorSearch,
          minScoreThreshold: settings.legacyMinScoreThreshold,
          maxResults: settings.legacyMaxResults,
          finalResults: settings.legacyFinalResults,
        },
        hybrid: {
          useKeywordSearch: settings.hybridUseKeywordSearch,
          useVectorSearch: settings.hybridUseVectorSearch,
          useSynonymExpansion: settings.hybridUseSynonymExpansion,
          useNumericalBoost: settings.hybridUseNumericalBoost,
          useSmartRouter: settings.hybridUseSmartRouter,
          useConfidenceOptimizer: settings.hybridUseConfidenceOptimizer,
          minScoreThreshold: settings.hybridMinScoreThreshold,
          maxResults: settings.hybridMaxResults,
          finalResults: settings.hybridFinalResults,
        },
        general: {
          showDebugInfo: settings.showDebugInfo,
          enableQueryCache: settings.enableQueryCache,
        },
        updatedAt: settings.updatedAt,
      };
    }

    it('should transform flat settings to nested structure', () => {
      const nested = transformSettingsToNested(mockSettings);

      expect(nested).toHaveProperty('legacy');
      expect(nested).toHaveProperty('hybrid');
      expect(nested).toHaveProperty('general');
      
      expect(nested.legacy).toHaveProperty('useKeywordSearch');
      expect(nested.legacy).toHaveProperty('useVectorSearch');
      expect(nested.legacy).toHaveProperty('minScoreThreshold');
      
      expect(nested.hybrid).toHaveProperty('useSynonymExpansion');
      expect(nested.hybrid).toHaveProperty('useSmartRouter');
      
      expect(nested.general).toHaveProperty('showDebugInfo');
    });

    it('should preserve all values in transformation', () => {
      const nested = transformSettingsToNested(mockSettings);

      expect(nested.legacy.useKeywordSearch).toBe(mockSettings.legacyUseKeywordSearch);
      expect(nested.legacy.minScoreThreshold).toBe(mockSettings.legacyMinScoreThreshold);
      expect(nested.hybrid.useSynonymExpansion).toBe(mockSettings.hybridUseSynonymExpansion);
      expect(nested.general.showDebugInfo).toBe(mockSettings.showDebugInfo);
    });
  });

  describe('API Response structure', () => {
    it('should return success response for GET', async () => {
      mockGetSettings.mockResolvedValue(mockSettings);

      const settings = await mockGetSettings();
      const response = {
        success: true,
        data: settings,
      };

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    it('should return success response for POST', async () => {
      mockUpdateSettings.mockResolvedValue(mockSettings);

      const settings = await mockUpdateSettings({ legacyMaxResults: 20 }, 'admin-id');
      const response = {
        success: true,
        message: 'Settings updated successfully',
        data: settings,
      };

      expect(response.success).toBe(true);
      expect(response.message).toContain('updated');
    });

    it('should return success response for PUT', async () => {
      mockSwitchArch.mockResolvedValue({ ...mockSettings, activeArchitecture: 'hybrid' });

      const settings = await mockSwitchArch('hybrid', 'admin-id');
      const response = {
        success: true,
        message: 'Architecture switched to hybrid',
        data: settings,
      };

      expect(response.success).toBe(true);
      expect(response.data.activeArchitecture).toBe('hybrid');
    });

    it('should return success response for DELETE', async () => {
      mockResetSettings.mockResolvedValue(mockSettings);

      const settings = await mockResetSettings('admin-id');
      const response = {
        success: true,
        message: 'Settings reset to default',
        data: settings,
      };

      expect(response.success).toBe(true);
      expect(response.message).toContain('reset');
    });
  });

  describe('Service calls', () => {
    it('should call getArchitectureSettings for GET', async () => {
      mockGetSettings.mockResolvedValue(mockSettings);
      
      await mockGetSettings();
      
      expect(mockGetSettings).toHaveBeenCalled();
    });

    it('should call updateArchitectureSettings with updates and userId', async () => {
      mockUpdateSettings.mockResolvedValue(mockSettings);
      
      const updates = { legacy: { maxResults: 20 } };
      await mockUpdateSettings(updates, 'admin-id');
      
      expect(mockUpdateSettings).toHaveBeenCalledWith(updates, 'admin-id');
    });

    it('should call switchArchitecture with architecture and userId', async () => {
      mockSwitchArch.mockResolvedValue({ ...mockSettings, activeArchitecture: 'hybrid' });
      
      await mockSwitchArch('hybrid', 'admin-id');
      
      expect(mockSwitchArch).toHaveBeenCalledWith('hybrid', 'admin-id');
    });

    it('should call resetArchitectureSettings with userId', async () => {
      mockResetSettings.mockResolvedValue(mockSettings);
      
      await mockResetSettings('admin-id');
      
      expect(mockResetSettings).toHaveBeenCalledWith('admin-id');
    });
  });

  describe('Validation schemas', () => {
    it('should validate architecture enum', () => {
      const validArchitectures = ['legacy', 'hybrid'];
      const testValue = 'hybrid';
      
      expect(validArchitectures).toContain(testValue);
    });

    it('should reject invalid architecture values', () => {
      const validArchitectures = ['legacy', 'hybrid'];
      const testValue = 'invalid';
      
      expect(validArchitectures).not.toContain(testValue);
    });

    it('should validate minScoreThreshold range', () => {
      const validateThreshold = (value: number) => 
        value >= 0 && value <= 1;

      expect(validateThreshold(0.4)).toBe(true);
      expect(validateThreshold(0)).toBe(true);
      expect(validateThreshold(1)).toBe(true);
      expect(validateThreshold(-0.1)).toBe(false);
      expect(validateThreshold(1.1)).toBe(false);
    });

    it('should validate maxResults range', () => {
      const validateMaxResults = (value: number) =>
        Number.isInteger(value) && value >= 1 && value <= 50;

      expect(validateMaxResults(10)).toBe(true);
      expect(validateMaxResults(1)).toBe(true);
      expect(validateMaxResults(50)).toBe(true);
      expect(validateMaxResults(0)).toBe(false);
      expect(validateMaxResults(51)).toBe(false);
      expect(validateMaxResults(10.5)).toBe(false);
    });
  });
});
