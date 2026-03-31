/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RAG ARCHITECTURES MODULE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Exportă toate componentele configurabile pentru sistemul RAG.
 */

// Servicii de bază
export { 
  getArchitectureSettings, 
  updateArchitectureSettings, 
  switchArchitecture,
  resetArchitectureSettings 
} from './settings-service';

// Arhitecturi
export { processLegacyRag, type LegacyRagOptions, type LegacyRagResult } from './legacy-rag';
export { processHybridRag, type HybridRagOptions, type HybridRagResult } from './hybrid-rag';

// Servicii configurabile
export { chunkText, preprocessDocument, type Chunk, type ChunkingOptions } from './configurable-chunker';
export { 
  generateEmbedding, 
  generateEmbeddingsBatch, 
  cosineSimilarity,
  getAvailableEmbeddingModels,
  type EmbeddingResult,
  type BatchEmbeddingResult 
} from './configurable-embedding';
export { 
  generateAnswer, 
  getAvailableModels, 
  getAvailablePromptTemplates,
  type GenerateAnswerOptions,
  type ArchitectureType 
} from './configurable-openai';

// Re-export types
export type { ArchitectureSettings } from './settings-service';
