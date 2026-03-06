/**
 * Query Cache Module
 * 
 * Caches RAG query results to improve response times for frequent questions.
 * Uses in-memory cache with TTL (Time To Live) - can be upgraded to Redis later.
 */

interface CacheEntry {
  answer: string;
  citations: any[];
  confidence: number;
  timestamp: number;
  hitCount: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class QueryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms
  private readonly MAX_SIZE = 1000; // Max cached queries
  private stats = { hits: 0, misses: 0 };

  /**
   * Generate cache key from query
   * Normalizes query for better cache hits
   */
  private generateKey(query: string, workspaceId: string): string {
    // Normalize: lowercase, remove extra spaces, trim
    const normalized = query
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[?.,!]/g, ''); // Remove punctuation
    
    return `${workspaceId}:${normalized}`;
  }

  /**
   * Get cached result if exists and not expired
   */
  get(query: string, workspaceId: string): CacheEntry | null {
    const key = this.generateKey(query, workspaceId);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.DEFAULT_TTL) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update hit count
    entry.hitCount++;
    this.stats.hits++;
    
    return entry;
  }

  /**
   * Store result in cache
   */
  set(query: string, workspaceId: string, result: Omit<CacheEntry, 'timestamp' | 'hitCount'>): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.MAX_SIZE) {
      this.evictLRU();
    }

    const key = this.generateKey(query, workspaceId);
    this.cache.set(key, {
      ...result,
      timestamp: Date.now(),
      hitCount: 1
    });
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    // Sort by hitCount (least used first) and remove 10% of entries
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].hitCount - b[1].hitCount);
    
    const toRemove = Math.floor(this.MAX_SIZE * 0.1);
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100) : 0
    };
  }

  /**
   * Get popular queries (most hit)
   */
  getPopularQueries(limit: number = 10): Array<{ query: string; hits: number }> {
    return Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        query: key.split(':').slice(1).join(':'), // Remove workspaceId prefix
        hits: entry.hitCount
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);
  }

  /**
   * Pre-warm cache with common questions
   */
  prewarm(workspaceId: string, commonQuestions: Array<{ query: string; answer: string; citations: any[]; confidence: number }>): void {
    for (const q of commonQuestions) {
      this.set(q.query, workspaceId, {
        answer: q.answer,
        citations: q.citations,
        confidence: q.confidence
      });
    }
  }
}

// Export singleton instance
export const queryCache = new QueryCache();

// Common questions for electrical normative I7/2011
export const COMMON_QUESTIONS = [
  {
    query: "ce este ddr",
    answer: "DDR (Dispozitiv Diferențial de Protecție) este un dispozitiv de protecție electrică care detectează diferențele de curent între conductorul fază și cel neutru, declanșând întreruperea circuitului când detectează scurgeri de curent. Este obligatoriu pentru protecția împotriva electrocutării în instalațiile electrice.",
    citations: [{ documentName: "I7/2011", pageNumber: 52, text: "DDR - dispozitiv diferențial de protecție" }],
    confidence: 85
  },
  {
    query: "înălțimea prizelor",
    answer: "Conform normativului I7/2011, prizele se montează la înălțimea de 0,40m de la nivelul podelei în încăperile de locuit.",
    citations: [{ documentName: "I7/2011", pageNumber: 62, text: " prize de utilizare la înălțimea de 0,40 m" }],
    confidence: 92
  },
  {
    query: "distribuție pe fază",
    answer: "Normativul I7/2011 impune ca prizele și circuitele să fie distribuite echilibrat pe cele trei faze pentru a evita dezechilibrele și suprasarcinile.",
    citations: [{ documentName: "I7/2011", pageNumber: 42, text: "distribuirea echilibrată a receptoarelor pe fază" }],
    confidence: 78
  }
];
