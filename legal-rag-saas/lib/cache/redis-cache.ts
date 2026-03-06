/**
 * Redis Cache Module
 * 
 * Persistent cache using Redis for production environments.
 * Falls back to in-memory cache if Redis is not available.
 */

import Redis from 'ioredis';
import { queryCache as memoryCache } from './query-cache';

interface CacheEntry {
  answer: string;
  citations: any[];
  confidence: number;
  timestamp: number;
  hitCount: number;
}

class RedisCache {
  private redis: Redis | null = null;
  private readonly DEFAULT_TTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly KEY_PREFIX = 'rag:query:';
  private useMemory = false;

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = new Redis(redisUrl, {
        retryStrategy: (times) => {
          if (times > 3) {
            console.log('[RedisCache] Failed to connect, using memory cache');
            this.useMemory = true;
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        maxRetriesPerRequest: 3,
      });

      this.redis.on('connect', () => {
        console.log('[RedisCache] Connected to Redis');
        this.useMemory = false;
      });

      this.redis.on('error', (err) => {
        console.error('[RedisCache] Redis error:', err.message);
        this.useMemory = true;
      });
    } catch (error) {
      console.error('[RedisCache] Failed to initialize Redis:', error);
      this.useMemory = true;
    }
  }

  private generateKey(query: string, workspaceId: string): string {
    const normalized = query
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[?.,!]/g, '');
    return `${this.KEY_PREFIX}${workspaceId}:${normalized}`;
  }

  async get(query: string, workspaceId: string): Promise<CacheEntry | null> {
    if (this.useMemory || !this.redis) {
      return memoryCache.get(query, workspaceId);
    }

    try {
      const key = this.generateKey(query, workspaceId);
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      const entry: CacheEntry = JSON.parse(data);
      
      // Update hit count
      entry.hitCount++;
      await this.redis.setex(key, this.DEFAULT_TTL, JSON.stringify(entry));
      
      return entry;
    } catch (error) {
      console.error('[RedisCache] Get error:', error);
      return memoryCache.get(query, workspaceId);
    }
  }

  async set(
    query: string,
    workspaceId: string,
    result: Omit<CacheEntry, 'timestamp' | 'hitCount'>
  ): Promise<void> {
    if (this.useMemory || !this.redis) {
      memoryCache.set(query, workspaceId, result);
      return;
    }

    try {
      const key = this.generateKey(query, workspaceId);
      const entry: CacheEntry = {
        ...result,
        timestamp: Date.now(),
        hitCount: 1,
      };

      await this.redis.setex(key, this.DEFAULT_TTL, JSON.stringify(entry));
    } catch (error) {
      console.error('[RedisCache] Set error:', error);
      memoryCache.set(query, workspaceId, result);
    }
  }

  async clear(): Promise<void> {
    if (this.useMemory || !this.redis) {
      memoryCache.clear();
      return;
    }

    try {
      const keys = await this.redis.keys(`${this.KEY_PREFIX}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('[RedisCache] Clear error:', error);
      memoryCache.clear();
    }
  }

  async getStats(): Promise<{
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
    usingRedis: boolean;
  }> {
    if (this.useMemory || !this.redis) {
      const memStats = memoryCache.getStats();
      return { ...memStats, usingRedis: false };
    }

    try {
      const keys = await this.redis.keys(`${this.KEY_PREFIX}*`);
      return {
        hits: 0, // Would need to track separately
        misses: 0,
        size: keys.length,
        hitRate: 0,
        usingRedis: true,
      };
    } catch (error) {
      const memStats = memoryCache.getStats();
      return { ...memStats, usingRedis: false };
    }
  }

  async getPopularQueries(limit: number = 10): Promise<Array<{ query: string; hits: number }>> {
    if (this.useMemory || !this.redis) {
      return memoryCache.getPopularQueries(limit);
    }

    try {
      const keys = await this.redis.keys(`${this.KEY_PREFIX}*`);
      const queries: Array<{ query: string; hits: number }> = [];

      for (const key of keys.slice(0, 100)) {
        const data = await this.redis.get(key);
        if (data) {
          const entry: CacheEntry = JSON.parse(data);
          const query = key.split(':').slice(2).join(':');
          queries.push({ query, hits: entry.hitCount });
        }
      }

      return queries
        .sort((a, b) => b.hits - a.hits)
        .slice(0, limit);
    } catch (error) {
      return memoryCache.getPopularQueries(limit);
    }
  }

  async prewarm(workspaceId: string, questions: Array<{
    query: string;
    answer: string;
    citations: any[];
    confidence: number;
  }>): Promise<void> {
    console.log(`[RedisCache] Pre-warming cache with ${questions.length} questions...`);
    
    for (const q of questions) {
      await this.set(q.query, workspaceId, {
        answer: q.answer,
        citations: q.citations,
        confidence: q.confidence,
      });
    }
    
    console.log(`[RedisCache] Pre-warming complete`);
  }

  isConnected(): boolean {
    return !this.useMemory && this.redis?.status === 'ready';
  }
}

// Export singleton instance
export const redisCache = new RedisCache();

// Export a unified cache that uses Redis if available
export const unifiedCache = {
  async get(query: string, workspaceId: string): Promise<CacheEntry | null> {
    return redisCache.get(query, workspaceId);
  },

  async set(query: string, workspaceId: string, result: Omit<CacheEntry, 'timestamp' | 'hitCount'>): Promise<void> {
    return redisCache.set(query, workspaceId, result);
  },

  async clear(): Promise<void> {
    return redisCache.clear();
  },

  async getStats() {
    return redisCache.getStats();
  },

  async getPopularQueries(limit?: number) {
    return redisCache.getPopularQueries(limit);
  },

  async prewarm(workspaceId: string, questions: any[]) {
    return redisCache.prewarm(workspaceId, questions);
  },

  isConnected() {
    return redisCache.isConnected();
  },
};
