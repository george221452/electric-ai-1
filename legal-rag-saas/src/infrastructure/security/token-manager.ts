import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

export interface TokenUsage {
  userId: string;
  amount: number;
  operation: 'query' | 'upload' | 'process' | 'ai_format';
  metadata?: Record<string, unknown>;
}

export interface TokenBalance {
  balance: number;
  totalUsed: number;
  totalPurchased: number;
}

export interface QuotaCheck {
  allowed: boolean;
  currentBalance: number;
  required: number;
  reason?: string;
}

export class TokenManager {
  private prisma: PrismaClient;
  private redis: Redis;

  constructor(
    prisma: PrismaClient,
    redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379'
  ) {
    this.prisma = prisma;
    this.redis = new Redis(redisUrl);
  }

  // Token costs per operation
  static get COSTS(): Record<TokenUsage['operation'], number> {
    return {
      query: 1,
      upload: 5,
      process: 2, // base cost per page
      ai_format: 3,
    };
  }

  async getBalance(userId: string): Promise<TokenBalance> {
    // Try cache first
    const cacheKey = `tokens:${userId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    const balance = await this.prisma.tokenBalance.findUnique({
      where: { userId },
    });

    const result: TokenBalance = {
      balance: balance?.balance || 0,
      totalUsed: balance?.totalUsed || 0,
      totalPurchased: balance?.totalPurchased || 0,
    };

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(result));

    return result;
  }

  async checkQuota(userId: string, operation: TokenUsage['operation'], params?: { pages?: number }): Promise<QuotaCheck> {
    const balance = await this.getBalance(userId);
    
    let required = TokenManager.COSTS[operation];
    if (operation === 'process' && params?.pages) {
      required = params.pages * TokenManager.COSTS.process;
    }

    if (balance.balance < required) {
      return {
        allowed: false,
        currentBalance: balance.balance,
        required,
        reason: `Insufficient tokens. Required: ${required}, Available: ${balance.balance}`,
      };
    }

    return {
      allowed: true,
      currentBalance: balance.balance,
      required,
    };
  }

  async deductTokens(usage: TokenUsage): Promise<boolean> {
    const { userId, amount, operation, metadata } = usage;

    try {
      // Use transaction
      await this.prisma.$transaction(async (tx) => {
        // Get current balance with lock
        const current = await tx.tokenBalance.findUnique({
          where: { userId },
        });

        if (!current || current.balance < amount) {
          throw new Error('Insufficient tokens');
        }

        // Update balance
        await tx.tokenBalance.update({
          where: { userId },
          data: {
            balance: { decrement: amount },
            totalUsed: { increment: amount },
          },
        });

        // Log usage
        await tx.tokenUsage.create({
          data: {
            userId,
            amount,
            operation,
            metadata: (metadata || {}) as any,
          },
        });
      });

      // Invalidate cache
      await this.redis.del(`tokens:${userId}`);

      return true;
    } catch (error) {
      console.error('Failed to deduct tokens:', error);
      return false;
    }
  }

  async addTokens(userId: string, amount: number, source: 'purchase' | 'refill' | 'bonus'): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.tokenBalance.upsert({
        where: { userId },
        create: {
          userId,
          balance: amount,
          totalPurchased: amount,
        },
        update: {
          balance: { increment: amount },
          totalPurchased: source === 'purchase' ? { increment: amount } : undefined,
          lastRefillAt: source === 'refill' ? new Date() : undefined,
        },
      });

      await tx.tokenTransaction.create({
        data: {
          userId,
          amount,
          type: 'credit',
          source,
        },
      });
    });

    // Invalidate cache
    await this.redis.del(`tokens:${userId}`);
  }

  async getUsageHistory(userId: string, limit: number = 50): Promise<any[]> {
    return this.prisma.tokenUsage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // Free tier: Give daily tokens
  async refillDailyTokens(userId: string, amount: number = 10): Promise<void> {
    const cacheKey = `daily_refill:${userId}:${new Date().toISOString().split('T')[0]}`;
    
    // Check if already refilled today
    const alreadyRefilled = await this.redis.get(cacheKey);
    if (alreadyRefilled) {
      return;
    }

    await this.addTokens(userId, amount, 'refill');
    
    // Mark as refilled (expires at midnight)
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const ttlSeconds = Math.floor((midnight.getTime() - now.getTime()) / 1000);
    
    await this.redis.setex(cacheKey, ttlSeconds, '1');
  }
}

// Middleware for token checking
export function createTokenCheckMiddleware(tokenManager: TokenManager) {
  return async function checkTokens(
    userId: string,
    operation: TokenUsage['operation'],
    params?: { pages?: number }
  ): Promise<{ success: boolean; error?: string; quota?: QuotaCheck }> {
    const quota = await tokenManager.checkQuota(userId, operation, params);
    
    if (!quota.allowed) {
      return {
        success: false,
        error: quota.reason,
        quota,
      };
    }

    return {
      success: true,
      quota,
    };
  };
}
