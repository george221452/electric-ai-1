import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddingService } from '@/src/infrastructure/adapters/embedding/embedding-service';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, workspaceId, type = 'keyword' } = body;

    if (!query || !workspaceId) {
      return NextResponse.json(
        { error: 'Query and workspaceId required' },
        { status: 400 }
      );
    }

    console.log(`[Advanced Search] Type: ${type}, Query: "${query}"`);

    let results: any[] = [];

    // Strategy 1: Direct Prisma search for exact matches
    const prismaResults = await prisma.paragraph.findMany({
      where: {
        AND: [
          { document: { workspaceId } },
          {
            OR: [
              { content: { contains: query, mode: 'insensitive' } },
              { content: { contains: query.replace(/\s/g, ''), mode: 'insensitive' } },
              { content: { contains: query.replace(/\./g, '.'), mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        content: true,
        pageNumber: true,
        document: { select: { name: true } },
      },
      take: 20,
    });

    // Strategy 2: Vector search for semantic similarity
    const qdrant = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
    });

    const embeddingService = new OpenAIEmbeddingService();
    const queryEmbedding = await embeddingService.embed(query);

    const vectorResults = await qdrant.search('legal_paragraphs', {
      vector: queryEmbedding,
      limit: 15,
      with_payload: true,
      filter: {
        must: [
          { key: 'workspaceId', match: { value: workspaceId } },
        ],
      },
    }) as any[];

    // Combine and deduplicate
    const seen = new Set<string>();
    
    for (const p of prismaResults) {
      const key = `${p.pageNumber}-${p.content.substring(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          id: p.id,
          pageNumber: p.pageNumber,
          documentName: p.document.name,
          content: p.content,
          score: 0.95,
        });
      }
    }

    for (const vr of vectorResults) {
      const content = vr.payload.content;
      const key = `${vr.payload.pageNumber}-${content.substring(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          id: vr.id,
          pageNumber: vr.payload.pageNumber,
          documentName: 'normativ.odt',
          content: content,
          score: vr.score,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    results = results.slice(0, 15);

    // Process results
    const processedResults = results.map(r => {
      const queryLower = query.toLowerCase();
      const contentLower = r.content.toLowerCase();
      const idx = contentLower.indexOf(queryLower);
      
      let excerpt = r.content;
      if (idx !== -1) {
        const start = Math.max(0, idx - 200);
        const end = Math.min(r.content.length, idx + query.length + 300);
        excerpt = r.content.substring(start, end);
        if (start > 0) excerpt = '...' + excerpt;
        if (end < r.content.length) excerpt = excerpt + '...';
      } else {
        excerpt = r.content.substring(0, 500) + '...';
      }

      const highlightedContent = excerpt.replace(
        new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
        '<mark class="bg-yellow-200 font-semibold">$1</mark>'
      );

      return {
        id: r.id,
        pageNumber: r.pageNumber,
        documentName: r.documentName,
        content: r.content,
        highlightedContent,
        score: r.score,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        query,
        type,
        found: processedResults.length,
        results: processedResults,
      }
    });

  } catch (error) {
    console.error('[Advanced Search] Error:', error);
    return NextResponse.json(
      { error: 'Search failed', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
