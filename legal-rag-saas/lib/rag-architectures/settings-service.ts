/**
 * RAG ARCHITECTURE SETTINGS SERVICE - EXTENDED
 * 
 * Serviciu pentru managementul complet al setărilor RAG.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cache pentru setări
let settingsCache: ArchitectureSettings | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000;

export interface ArchitectureSettings {
  // Arhitectura activa
  id: string;
  activeArchitecture: 'legacy' | 'hybrid';
  
  // Chunking
  chunkMaxSize: number;
  chunkMinSize: number;
  chunkOverlap: number;
  preserveParagraphBoundaries: boolean;
  preserveSentenceBoundaries: boolean;
  cleanDiacritics: boolean;
  removeExtraWhitespace: boolean;
  fixHyphenatedWords: boolean;
  
  // Embeddings
  embeddingModel: string;
  embeddingDimensions: number;
  embeddingBatchSize: number;
  
  // Legacy
  legacyUseKeywordSearch: boolean;
  legacyUseVectorSearch: boolean;
  legacyMinScoreThreshold: number;
  legacyMaxResults: number;
  legacyFinalResults: number;
  legacySearchStrategy: string;
  legacyCombineMethod: string;
  legacyOpenaiModel: string;
  legacyMaxTokens: number;
  legacyTemperature: number;
  legacySystemPrompt: string;
  legacyPromptTemplate: string;
  legacyIncludeCitations: boolean;
  legacyRequireCitations: boolean;
  
  // Hybrid
  hybridUseKeywordSearch: boolean;
  hybridUseVectorSearch: boolean;
  hybridUseSynonymExpansion: boolean;
  hybridSynonymMaxVariants: number;
  hybridUseNumericalBoost: boolean;
  hybridNumericalBoostWeight: number;
  hybridUseSmartRouter: boolean;
  hybridSmartRouterQuizThreshold: number;
  hybridSmartRouterNormalThreshold: number;
  hybridSmartRouterMaxRetries: number;
  hybridUseConfidenceOptimizer: boolean;
  hybridUseQueryUnderstanding: boolean;
  hybridUseIntentDetection: boolean;
  hybridMinScoreThreshold: number;
  hybridMaxResults: number;
  hybridFinalResults: number;
  hybridRerankEnabled: boolean;
  hybridRerankMethod: string;
  hybridOpenaiModel: string;
  hybridMaxTokens: number;
  hybridTemperature: number;
  hybridSystemPrompt: string;
  hybridPromptTemplate: string;
  hybridIncludeCitations: boolean;
  hybridRequireCitations: boolean;
  hybridQuizEnabled: boolean;
  hybridQuizStrictMode: boolean;
  hybridQuizConfidenceThreshold: number;
  
  // Cache & Performance
  enableQueryCache: boolean;
  cacheTtlSeconds: number;
  enableResultCache: boolean;
  resultCacheTtlSeconds: number;
  
  // Debug
  showDebugInfo: boolean;
  logQueries: boolean;
  logPerformanceMetrics: boolean;
  enableQueryTracing: boolean;
  
  // Answer Formatting
  answerFormat: string;
  includeSources: boolean;
  includeConfidenceScore: boolean;
  includeExecutionTime: boolean;
  addDocumentBanner: boolean;
  
  // Fallback
  fallbackOnLowConfidence: boolean;
  fallbackConfidenceThreshold: number;
  fallbackToGeneralKnowledge: boolean;
  showClarificationOnNoResults: boolean;
  
  // Document Processing
  extractMetadata: boolean;
  extractArticleNumbers: boolean;
  extractKeywords: boolean;
  classifyParagraphs: boolean;
  
  updatedAt: Date;
  updatedBy?: string;
}

export async function getArchitectureSettings(): Promise<ArchitectureSettings> {
  if (settingsCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return settingsCache;
  }

  const dbSettings = await prisma.ragArchitectureSettings.findUnique({
    where: { id: 'global' },
  });

  if (!dbSettings) {
    return createDefaultSettings();
  }

  settingsCache = dbSettings as unknown as ArchitectureSettings;
  cacheTimestamp = Date.now();

  return settingsCache;
}

export async function updateArchitectureSettings(
  updates: Partial<ArchitectureSettings>,
  userId?: string
): Promise<ArchitectureSettings> {
  const data: any = { ...updates };
  if (userId) data.updatedBy = userId;

  await prisma.ragArchitectureSettings.upsert({
    where: { id: 'global' },
    update: data,
    create: {
      id: 'global',
      ...getDefaultSettingsData(),
      ...data,
    },
  });

  settingsCache = null;
  cacheTimestamp = 0;

  return getArchitectureSettings();
}

export async function switchArchitecture(
  architecture: 'legacy' | 'hybrid',
  userId?: string
): Promise<ArchitectureSettings> {
  return updateArchitectureSettings({ activeArchitecture: architecture }, userId);
}

export async function resetArchitectureSettings(userId?: string): Promise<ArchitectureSettings> {
  await prisma.ragArchitectureSettings.deleteMany({ where: { id: 'global' } });
  settingsCache = null;
  cacheTimestamp = 0;
  return createDefaultSettings();
}

async function createDefaultSettings(): Promise<ArchitectureSettings> {
  const data = getDefaultSettingsData();
  
  await prisma.ragArchitectureSettings.create({
    data: { id: 'global', ...data },
  });

  return { ...data, id: 'global', updatedAt: new Date() } as ArchitectureSettings;
}

function getDefaultSettingsData() {
  return {
    activeArchitecture: 'legacy',
    
    // Chunking defaults
    chunkMaxSize: 1500,
    chunkMinSize: 200,
    chunkOverlap: 100,
    preserveParagraphBoundaries: true,
    preserveSentenceBoundaries: true,
    cleanDiacritics: true,
    removeExtraWhitespace: true,
    fixHyphenatedWords: true,
    
    // Embedding defaults
    embeddingModel: 'text-embedding-3-small',
    embeddingDimensions: 1536,
    embeddingBatchSize: 100,
    
    // Legacy defaults
    legacyUseKeywordSearch: true,
    legacyUseVectorSearch: true,
    legacyMinScoreThreshold: 0.40,
    legacyMaxResults: 10,
    legacyFinalResults: 3,
    legacySearchStrategy: 'parallel',
    legacyCombineMethod: 'merge',
    legacyOpenaiModel: 'gpt-4o-mini',
    legacyMaxTokens: 500,
    legacyTemperature: 0.2,
    legacySystemPrompt: 'Esti un asistent specializat in normative electrice romanesti.',
    legacyPromptTemplate: 'standard',
    legacyIncludeCitations: true,
    legacyRequireCitations: true,
    
    // Hybrid defaults
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
    hybridMinScoreThreshold: 0.40,
    hybridMaxResults: 10,
    hybridFinalResults: 3,
    hybridRerankEnabled: false,
    hybridRerankMethod: 'score',
    hybridOpenaiModel: 'gpt-4o-mini',
    hybridMaxTokens: 600,
    hybridTemperature: 0.2,
    hybridSystemPrompt: 'Esti un asistent specializat in normative electrice romanesti.',
    hybridPromptTemplate: 'adaptive',
    hybridIncludeCitations: true,
    hybridRequireCitations: true,
    hybridQuizEnabled: true,
    hybridQuizStrictMode: false,
    hybridQuizConfidenceThreshold: 70,
    
    // Cache defaults
    enableQueryCache: true,
    cacheTtlSeconds: 3600,
    enableResultCache: false,
    resultCacheTtlSeconds: 86400,
    
    // Debug defaults
    showDebugInfo: false,
    logQueries: true,
    logPerformanceMetrics: false,
    enableQueryTracing: false,
    
    // Formatting defaults
    answerFormat: 'markdown',
    includeSources: true,
    includeConfidenceScore: true,
    includeExecutionTime: false,
    addDocumentBanner: false,
    
    // Fallback defaults
    fallbackOnLowConfidence: true,
    fallbackConfidenceThreshold: 40,
    fallbackToGeneralKnowledge: false,
    showClarificationOnNoResults: true,
    
    // Document processing defaults
    extractMetadata: true,
    extractArticleNumbers: true,
    extractKeywords: true,
    classifyParagraphs: false,
  };
}

export default {
  getArchitectureSettings,
  updateArchitectureSettings,
  switchArchitecture,
  resetArchitectureSettings,
};
