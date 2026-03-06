import { Redis } from 'ioredis';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

export class RateLimiter {
  private redis: Redis;

  constructor(redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379') {
    this.redis = new Redis(redisUrl);
  }

  async checkLimit(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = `ratelimit:${identifier}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Remove old entries outside the window
    await this.redis.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    const currentCount = await this.redis.zcard(key);

    if (currentCount >= config.maxRequests) {
      // Get the oldest request to calculate retry after
      const oldestRequest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestTimestamp = parseInt(oldestRequest[1]);
      const retryAfter = Math.ceil((oldestTimestamp + config.windowMs - now) / 1000);

      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetAt: new Date(oldestTimestamp + config.windowMs),
        retryAfter: Math.max(1, retryAfter),
      };
    }

    // Add current request
    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.pexpire(key, config.windowMs);

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - currentCount - 1,
      resetAt: new Date(now + config.windowMs),
    };
  }

  async reset(identifier: string): Promise<void> {
    await this.redis.del(`ratelimit:${identifier}`);
  }

  // Predefined configs
  static get apiConfig(): RateLimitConfig {
    return {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60,
    };
  }

  static get queryConfig(): RateLimitConfig {
    return {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 queries per minute
    };
  }

  static get uploadConfig(): RateLimitConfig {
    return {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 10, // 10 uploads per hour
    };
  }
}

// In-memory fallback for development
export class MemoryRateLimiter {
  private storage = new Map<string, number[]>();

  async checkLimit(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    let timestamps = this.storage.get(identifier) || [];
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length >= config.maxRequests) {
      const oldestTimestamp = timestamps[0];
      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetAt: new Date(oldestTimestamp + config.windowMs),
        retryAfter: Math.ceil((oldestTimestamp + config.windowMs - now) / 1000),
      };
    }

    timestamps.push(now);
    this.storage.set(identifier, timestamps);

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - timestamps.length,
      resetAt: new Date(now + config.windowMs),
    };
  }

  async reset(identifier: string): Promise<void> {
    this.storage.delete(identifier);
  }
}

// Factory
export function createRateLimiter(): RateLimiter | MemoryRateLimiter {
  if (process.env.REDIS_URL) {
    return new RateLimiter();
  }
  return new MemoryRateLimiter();
}
