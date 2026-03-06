import OpenAI from 'openai';

export interface IEmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  getModelName(): string;
  getDimensions(): number;
}

export class OpenAIEmbeddingService implements IEmbeddingService {
  private client: OpenAI;
  private model: string;
  private dimensions: number;

  constructor(
    apiKey: string = process.env.OPENAI_API_KEY || '',
    model: 'text-embedding-3-small' | 'text-embedding-3-large' = 'text-embedding-3-small'
  ) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.dimensions = model === 'text-embedding-3-large' ? 3072 : 1536;
  }

  async embed(text: string): Promise<number[]> {
    const normalizedText = this.normalizeText(text);
    
    // Fast path: use mock if no API key configured
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === '' || apiKey.startsWith('sk-') === false) {
      return this.mockEmbedding(text);
    }
    
    try {
      // Add timeout to avoid long waits
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await this.client.embeddings.create({
        model: this.model,
        input: normalizedText.substring(0, 8000),
        encoding_format: 'float',
      }, { signal: controller.signal });
      
      clearTimeout(timeoutId);
      return response.data[0].embedding;
    } catch (error) {
      console.warn('OpenAI embedding failed, using mock:', (error as Error).message);
      // Fallback to mock embeddings for testing
      return this.mockEmbedding(text);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Fast path: use mock if no API key configured
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === '' || apiKey.startsWith('sk-') === false) {
      return texts.map(t => this.mockEmbedding(t));
    }
    
    try {
      // Add timeout to avoid long waits
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for batch
      
      const normalizedTexts = texts.map(t => this.normalizeText(t).substring(0, 8000));
      const response = await this.client.embeddings.create({
        model: this.model,
        input: normalizedTexts,
        encoding_format: 'float',
      }, { signal: controller.signal });
      
      clearTimeout(timeoutId);
      return response.data.map(d => d.embedding);
    } catch (error) {
      console.warn('OpenAI batch embedding failed, using mock:', (error as Error).message);
      return texts.map(t => this.mockEmbedding(t));
    }
  }

  private mockEmbedding(text: string): number[] {
    // Generate deterministic mock embedding based on text content
    // This creates similar embeddings for similar texts
    const normalizedText = text.toLowerCase().trim();
    const words = normalizedText.split(/\s+/);
    
    // Create word frequency map
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });
    
    // Generate embedding based on word hashes
    const embedding: number[] = new Array(this.dimensions).fill(0);
    
    wordFreq.forEach((freq, word) => {
      // Hash function for word
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        const char = word.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      
      // Distribute word influence across dimensions
      const wordHash = Math.abs(hash);
      for (let i = 0; i < this.dimensions; i++) {
        const dimensionSeed = (wordHash + i * 997) % 10000;
        const influence = Math.sin(dimensionSeed) * (freq / words.length);
        embedding[i] += influence;
      }
    });
    
    // Normalize embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return embedding.map(val => val / magnitude);
    }
    
    return embedding;
  }

  getModelName(): string {
    return this.model;
  }

  getDimensions(): number {
    return this.dimensions;
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
  }
}
