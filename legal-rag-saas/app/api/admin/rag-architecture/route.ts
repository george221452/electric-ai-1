/**
 * API Admin pentru managementul arhitecturii RAG
 * 
 * GET  - Obține setările curente
 * POST - Actualizează setările
 * PUT  - Comută arhitectura activă
 * DELETE - Resetează la default
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import {
  getArchitectureSettings,
  updateArchitectureSettings,
  switchArchitecture,
  resetArchitectureSettings,
} from '@/lib/rag-architectures/settings-service';
import { z } from 'zod';

const prisma = new PrismaClient();

// Schema pentru validare
const UpdateSettingsSchema = z.object({
  activeArchitecture: z.enum(['legacy', 'hybrid']).optional(),
  legacy: z.object({
    useKeywordSearch: z.boolean().optional(),
    useVectorSearch: z.boolean().optional(),
    minScoreThreshold: z.number().min(0).max(1).optional(),
    maxResults: z.number().int().min(1).max(50).optional(),
    finalResults: z.number().int().min(1).max(20).optional(),
  }).optional(),
  hybrid: z.object({
    useKeywordSearch: z.boolean().optional(),
    useVectorSearch: z.boolean().optional(),
    useSynonymExpansion: z.boolean().optional(),
    useNumericalBoost: z.boolean().optional(),
    useSmartRouter: z.boolean().optional(),
    useConfidenceOptimizer: z.boolean().optional(),
    minScoreThreshold: z.number().min(0).max(1).optional(),
    maxResults: z.number().int().min(1).max(50).optional(),
    finalResults: z.number().int().min(1).max(20).optional(),
  }).optional(),
  general: z.object({
    showDebugInfo: z.boolean().optional(),
    enableQueryCache: z.boolean().optional(),
  }).optional(),
});

const SwitchArchitectureSchema = z.object({
  architecture: z.enum(['legacy', 'hybrid']),
});

// Verificare admin
async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, email: true }
  });
  
  // User e admin dacă are flag isAdmin sau e adminul default
  return user?.isAdmin === true || user?.email === 'admin@example.com';
}

/**
 * Transform flat DB settings to nested structure for UI
 */
function transformSettingsToNested(settings: any) {
  return {
    id: settings.id,
    activeArchitecture: settings.activeArchitecture,
    legacy: {
      useKeywordSearch: settings.legacyUseKeywordSearch,
      useVectorSearch: settings.legacyUseVectorSearch,
      minScoreThreshold: settings.legacyMinScoreThreshold,
      maxResults: settings.legacyMaxResults,
      finalResults: settings.legacyFinalResults,
    },
    hybrid: {
      useKeywordSearch: settings.hybridUseKeywordSearch,
      useVectorSearch: settings.hybridUseVectorSearch,
      useSynonymExpansion: settings.hybridUseSynonymExpansion,
      useNumericalBoost: settings.hybridUseNumericalBoost,
      useSmartRouter: settings.hybridUseSmartRouter,
      useConfidenceOptimizer: settings.hybridUseConfidenceOptimizer,
      minScoreThreshold: settings.hybridMinScoreThreshold,
      maxResults: settings.hybridMaxResults,
      finalResults: settings.hybridFinalResults,
    },
    general: {
      showDebugInfo: settings.showDebugInfo,
      enableQueryCache: settings.enableQueryCache,
    },
    updatedAt: settings.updatedAt,
  };
}

/**
 * GET - Obține setările curente de arhitectură
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const settings = await getArchitectureSettings();
    const nestedSettings = transformSettingsToNested(settings);

    return NextResponse.json({
      success: true,
      data: nestedSettings,
    });
  } catch (error) {
    console.error('[Admin API] Error fetching architecture settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Actualizează setările de arhitectură
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!await isAdmin(session.user.id)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = UpdateSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.errors },
        { status: 400 }
      );
    }

    const settings = await updateArchitectureSettings(
      validation.data,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      data: transformSettingsToNested(settings),
    });
  } catch (error) {
    console.error('[Admin API] Error updating architecture settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Comută arhitectura activă (legacy ↔ hybrid)
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!await isAdmin(session.user.id)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = SwitchArchitectureSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.errors },
        { status: 400 }
      );
    }

    const settings = await switchArchitecture(
      validation.data.architecture,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      message: `Architecture switched to ${validation.data.architecture}`,
      data: transformSettingsToNested(settings),
    });
  } catch (error) {
    console.error('[Admin API] Error switching architecture:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Resetează setările la default
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!await isAdmin(session.user.id)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const settings = await resetArchitectureSettings(session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Settings reset to default',
      data: transformSettingsToNested(settings),
    });
  } catch (error) {
    console.error('[Admin API] Error resetting architecture settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
