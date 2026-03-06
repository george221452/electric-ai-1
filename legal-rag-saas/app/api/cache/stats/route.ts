import { NextRequest, NextResponse } from 'next/server';
import { queryCache } from '@/lib/cache/query-cache';

/**
 * GET /api/cache/stats
 * Returns cache statistics and popular queries
 */
export async function GET(req: NextRequest) {
  try {
    const stats = queryCache.getStats();
    const popularQueries = queryCache.getPopularQueries(20);

    return NextResponse.json({
      success: true,
      data: {
        stats,
        popularQueries,
      },
    });
  } catch (error) {
    console.error('[Cache Stats API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache stats' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cache/stats
 * Clears all cache or pre-warms with questions
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'clear') {
      queryCache.clear();
      return NextResponse.json({
        success: true,
        message: 'Cache cleared successfully',
      });
    }

    if (action === 'prewarm') {
      const { workspaceId, questions } = body;
      if (!workspaceId || !questions) {
        return NextResponse.json(
          { error: 'workspaceId and questions required' },
          { status: 400 }
        );
      }
      queryCache.prewarm(workspaceId, questions);
      return NextResponse.json({
        success: true,
        message: `Cache pre-warmed with ${questions.length} questions`,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: clear, prewarm' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Cache Stats API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process cache action' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
