import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const FeedbackSchema = z.object({
  query: z.string().min(1),
  answer: z.string().min(1),
  rating: z.number().int().min(1).max(2), // 1 = thumbs down, 2 = thumbs up
  reason: z.string().optional(),
  confidence: z.number().int(),
  citations: z.array(z.any()).optional(),
  metadata: z.object({
    scenario: z.any().optional(),
    fromCache: z.boolean().optional(),
  }).optional(),
  workspaceId: z.string().uuid(),
});

/**
 * POST /api/feedback
 * Submit feedback for a RAG response
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = FeedbackSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { query, answer, rating, reason, confidence, citations, metadata, workspaceId } = validation.data;

    // Save feedback to database
    const feedback = await prisma.feedback.create({
      data: {
        query,
        answer: answer.substring(0, 5000), // Limit answer length
        rating,
        reason,
        confidence,
        citations: citations || [],
        metadata: metadata || {},
        workspaceId,
      },
    });

    console.log(`[Feedback API] Saved feedback: ${rating === 2 ? '👍' : '👎'} for query "${query.substring(0, 50)}..."`);

    return NextResponse.json({
      success: true,
      message: 'Feedback saved successfully',
      data: { id: feedback.id },
    });

  } catch (error) {
    console.error('[Feedback API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/feedback
 * Get feedback statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

    // Get feedback statistics
    const totalFeedback = await prisma.feedback.count({
      where: { workspaceId },
    });

    const positiveFeedback = await prisma.feedback.count({
      where: { workspaceId, rating: 2 },
    });

    const negativeFeedback = await prisma.feedback.count({
      where: { workspaceId, rating: 1 },
    });

    const averageConfidence = await prisma.feedback.aggregate({
      where: { workspaceId },
      _avg: { confidence: true },
    });

    // Get recent feedback
    const recentFeedback = await prisma.feedback.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        query: true,
        rating: true,
        confidence: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          total: totalFeedback,
          positive: positiveFeedback,
          negative: negativeFeedback,
          satisfactionRate: totalFeedback > 0 
            ? Math.round((positiveFeedback / totalFeedback) * 100) 
            : 0,
          averageConfidence: Math.round(averageConfidence._avg.confidence || 0),
        },
        recent: recentFeedback,
      },
    });

  } catch (error) {
    console.error('[Feedback API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get feedback stats' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
