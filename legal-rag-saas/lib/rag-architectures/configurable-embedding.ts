/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CONFIGURABLE EMBEDDING SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Serviciu de embeddings complet configurabil din admin.
 * Suportă multiple modele și dimensiuni configurabile.
 */

import OpenAI from 'openai';
import { getArchitectureSettings } from './settings-service';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  model: string;
  dimensions: number;
  successful: number;
  failed: number;
}

// Cache pentru client OpenAI
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * Generează embedding pentru un text conform setărilor din admin
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const settings = await getArchitectureSettings();
  const model = settings.embeddingModel;
  const dimensions = settings.embeddingDimensions;

  console.log(`[Embedding] Generating embedding with model: ${model}, dimensions: ${dimensions}`);

  const openai = getOpenAIClient();

  try {
    const response = await openai.embeddings.create({
      model,
      input: text,
      dimensions: dimensions < 1536 ? dimensions : undefined, // Doar pentru modele care suportă
    });

    const embedding = response.data[0].embedding;

    return {
      embedding,
      model,
      dimensions: embedding.length,
    };
  } catch (error) {
    console.error('[Embedding] Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generează embeddings în batch conform setărilor din admin
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<BatchEmbeddingResult> {
  const settings = await getArchitectureSettings();
  const model = settings.embeddingModel;
  const dimensions = settings.embeddingDimensions;
  const batchSize = settings.embeddingBatchSize;

  console.log(`[Embedding] Processing ${texts.length} texts in batches of ${batchSize}`);

  const openai = getOpenAIClient();
  const embeddings: number[][] = [];
  let successful = 0;
  let failed = 0;

  // Procesăm în batch-uri
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    try {
      const response = await openai.embeddings.create({
        model,
        input: batch,
        dimensions: dimensions < 1536 ? dimensions : undefined,
      });

      for (const item of response.data) {
        embeddings.push(item.embedding);
        successful++;
      }

      console.log(`[Embedding] Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} processed`);
    } catch (error) {
      console.error(`[Embedding] Batch ${Math.floor(i / batchSize) + 1} failed:`, error);
      // Adăugăm null pentru fiecare text din batch-ul eșuat
      for (let j = 0; j < batch.length; j++) {
        embeddings.push([]);
        failed++;
      }
    }
  }

  return {
    embeddings,
    model,
    dimensions: dimensions,
    successful,
    failed,
  };
}

/**
 * Calculează similaritatea cosinus între două vectori
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Normalizează un vector (L2 normalization)
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vector;
  return vector.map(val => val / magnitude);
}

/**
 * Calculează distanța euclidiană între doi vectori
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Listează modelele de embedding disponibile
 */
export function getAvailableEmbeddingModels(): Array<{
  id: string;
  name: string;
  dimensions: number;
  description: string;
  recommended: boolean;
}> {
  return [
    {
      id: 'text-embedding-3-small',
      name: 'OpenAI Embedding 3 Small',
      dimensions: 1536,
      description: 'Rapid și eficient pentru majoritatea cazurilor',
      recommended: true,
    },
    {
      id: 'text-embedding-3-large',
      name: 'OpenAI Embedding 3 Large',
      dimensions: 3072,
      description: 'Mai precis, dar mai lent și mai scump',
      recommended: false,
    },
    {
      id: 'text-embedding-ada-002',
      name: 'OpenAI Ada 002 (Legacy)',
      dimensions: 1536,
      description: 'Model vechi, păstrat pentru compatibilitate',
      recommended: false,
    },
  ];
}

/**
 * Validează dacă un model este suportat
 */
export function isValidEmbeddingModel(model: string): boolean {
  const validModels = getAvailableEmbeddingModels().map(m => m.id);
  return validModels.includes(model);
}

/**
 * Estimează costul pentru un număr de embeddings
 */
export function estimateEmbeddingCost(
  textCount: number,
  avgCharsPerText: number,
  model: string = 'text-embedding-3-small'
): { tokens: number; costUSD: number } {
  // Estimare aproximativă: 4 caractere = 1 token
  const estimatedTokens = Math.ceil((textCount * avgCharsPerText) / 4);
  
  // Prețuri per 1M tokens (actualizate 2024)
  const prices: Record<string, number> = {
    'text-embedding-3-small': 0.02,
    'text-embedding-3-large': 0.13,
    'text-embedding-ada-002': 0.10,
  };

  const costUSD = (estimatedTokens / 1_000_000) * (prices[model] || 0.02);

  return {
    tokens: estimatedTokens,
    costUSD,
  };
}

export default {
  generateEmbedding,
  generateEmbeddingsBatch,
  cosineSimilarity,
  normalizeVector,
  euclideanDistance,
  getAvailableEmbeddingModels,
  isValidEmbeddingModel,
  estimateEmbeddingCost,
};
