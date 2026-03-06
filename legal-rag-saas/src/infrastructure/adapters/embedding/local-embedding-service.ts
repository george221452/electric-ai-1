import { IEmbeddingService } from './embedding-service';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

/**
 * Local Embedding Service using Xenova/Transformers
 * Runs entirely locally - no API calls, no costs
 * Uses 'Xenova/all-MiniLM-L6-v2' - 384 dimensions, good quality
 */
export class LocalEmbeddingService implements IEmbeddingService {
  private model: FeatureExtractionPipeline | null = null;
  private modelName: string;
  private dimensions: number;
  private isLoading: boolean = false;
  private loadPromise: Promise<void> | null = null;

  constructor(
    modelName: string = 'Xenova/all-MiniLM-L6-v2',
    dimensions: number = 384
  ) {
    this.modelName = modelName;
    this.dimensions = dimensions;
  }

  private async loadModel(): Promise<void> {
    if (this.model) return;
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = (async () => {
      console.log(`[LocalEmbedding] Loading model: ${this.modelName}...`);
      const startTime = Date.now();
      
      this.model = await pipeline(
        'feature-extraction',
        this.modelName,
        {
          quantized: true, // Use quantized model for faster loading
        }
      );
      
      console.log(`[LocalEmbedding] Model loaded in ${Date.now() - startTime}ms`);
    })();

    return this.loadPromise;
  }

  async embed(text: string): Promise<number[]> {
    await this.loadModel();
    
    if (!this.model) {
      throw new Error('Model not loaded');
    }

    // Truncate long texts
    const truncatedText = text.substring(0, 500);
    
    const result = await this.model(truncatedText, {
      pooling: 'mean',
      normalize: true,
    });

    // Convert to number array
    return Array.from(result.data as Float32Array);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    await this.loadModel();
    
    if (!this.model) {
      throw new Error('Model not loaded');
    }

    // Process in parallel
    const results = await Promise.all(
      texts.map(async (text) => {
        const truncatedText = text.substring(0, 500);
        const result = await this.model!(truncatedText, {
          pooling: 'mean',
          normalize: true,
        });
        return Array.from(result.data as Float32Array);
      })
    );

    return results;
  }

  getModelName(): string {
    return this.modelName;
  }

  getDimensions(): number {
    return this.dimensions;
  }
}
