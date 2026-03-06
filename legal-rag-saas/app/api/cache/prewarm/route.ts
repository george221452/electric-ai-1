import { NextRequest, NextResponse } from 'next/server';
import { prewarmCache, shouldPrewarm, getPrewarmProgress } from '@/lib/cache/prewarm-service';

/**
 * GET /api/cache/prewarm
 * Get pre-warm status and progress
 */
export async function GET(req: NextRequest) {
  try {
    const progress = getPrewarmProgress();
    const needsPrewarm = await shouldPrewarm();

    return NextResponse.json({
      success: true,
      data: {
        progress,
        needsPrewarm,
      },
    });
  } catch (error) {
    console.error('[Cache Prewarm API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get pre-warm status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cache/prewarm
 * Trigger cache pre-warming
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, force } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // Check if pre-warming is needed
    if (!force) {
      const needsPrewarm = await shouldPrewarm();
      if (!needsPrewarm) {
        return NextResponse.json({
          success: true,
          message: 'Cache already has sufficient entries. Use force=true to pre-warm anyway.',
          skipped: true,
        });
      }
    }

    // Start pre-warming in background
    // Note: In production, this should be a background job
    const result = await prewarmCache(workspaceId);

    return NextResponse.json({
      success: true,
      message: `Cache pre-warming complete`,
      data: result,
    });

  } catch (error) {
    console.error('[Cache Prewarm API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to pre-warm cache' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
