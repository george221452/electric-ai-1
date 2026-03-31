/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ARHITECTURA LEGACY (VECHE) - RAG Simplu și Direct
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Aceasta este arhitectura originală care funcționa bine:
 * - Vector search în Qdrant (parallel)
 * - Keyword search în Prisma (parallel) 
 * - Combinare + filtrare
 * - Top 3 rezultate
 * - Un singur call OpenAI
 * 
 * Caracteristici:
 * ✓ Simplă și predictibilă
 * ✓ Rapidă (2 call-uri DB în paralel)
 * ✓ Stabilă - puține puncte de eșec
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { PrismaClient } from '@prisma/client';
import { OpenAIEmbeddingService } from '@/src/infrastructure/adapters/embedding/embedding-service';
import OpenAI from 'openai';

export interface LegacyRagOptions {
  useKeywordSearch: boolean;
  useVectorSearch: boolean;
  minScoreThreshold: number;
  maxResults: number;
  finalResults: number;
}

export interface LegacyRagResult {
  answer: string | null;
  citations: Array<{
    index: number;
    paragraphId: string;
    documentId: string;
    documentName: string;
    pageNumber: number;
    articleNumber?: string;
    paragraphLetter?: string;
    text: string;
    score: number;
    confidence: number;
  }>;
  confidence: number;
  executionTime: number;
  debug: {
    vectorResultsCount: number;
    keywordResultsCount: number;
    finalResultsCount: number;
  };
}

const DEFAULT_OPTIONS: LegacyRagOptions = {
  useKeywordSearch: true,
  useVectorSearch: true,
  minScoreThreshold: 0.40,
  maxResults: 10,
  finalResults: 3,
};

/**
 * Procesează o query folosind arhitectura Legacy simplă
 */
export async function processLegacyRag(
  query: string,
  workspaceId: string,
  prisma: PrismaClient,
  qdrant: QdrantClient,
  options: Partial<LegacyRagOptions> = {}
): Promise<LegacyRagResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  console.log(`[LegacyRAG] Starting with query: "${query}"`);
  console.log(`[LegacyRAG] Options:`, opts);

  let vectorResults: any[] = [];
  let keywordResults: any[] = [];

  // ═════════════════════════════════════════════════════════════════════════════
  // PAS 1: Căutare în PARALEL (Vector + Keyword)
  // ═════════════════════════════════════════════════════════════════════════════
  
  const searchPromises: Promise<any>[] = [];

  // Vector Search în Qdrant
  if (opts.useVectorSearch) {
    searchPromises.push(
      (async () => {
        const embeddingService = new OpenAIEmbeddingService();
        const embedding = await embeddingService.embed(query);
        
        const results = await qdrant.search('legal_paragraphs', {
          vector: embedding,
          limit: opts.maxResults,
          with_payload: true,
          score_threshold: opts.minScoreThreshold,
          filter: {
            must: [
              { key: 'workspaceId', match: { value: workspaceId } },
            ],
          },
        }) as any[];
        
        vectorResults = results;
        console.log(`[LegacyRAG] Vector search: ${results.length} results`);
        return results;
      })()
    );
  }

  // Keyword Search în Prisma (PostgreSQL)
  if (opts.useKeywordSearch) {
    searchPromises.push(
      (async () => {
        // Extrage cuvinte cheie simple (cuvinte cu >3 caractere)
        const keywords = query
          .toLowerCase()
          .replace(/[^\w\săîâșț]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 3)
          .slice(0, 5);

        const results = await prisma.paragraph.findMany({
          where: {
            document: { workspaceId },
            OR: [
              { content: { contains: query, mode: 'insensitive' } },
              ...keywords.map(k => ({ 
                content: { contains: k, mode: 'insensitive' } 
              })),
              { keywords: { hasSome: keywords } },
            ],
          },
          include: { document: { select: { id: true, name: true } } },
          take: opts.maxResults,
        });

        // Convertim la format compatibil cu vector results
        keywordResults = results.map(p => ({
          id: p.id,
          score: 0.45, // Scor bazal pentru keyword match
          payload: {
            documentId: p.documentId,
            content: p.content,
            pageNumber: p.pageNumber,
            articleNumber: p.articleNumber,
            paragraphLetter: p.paragraphLetter,
          },
          _source: 'keyword', // Marker pentru debugging
        }));

        console.log(`[LegacyRAG] Keyword search: ${results.length} results`);
        return keywordResults;
      })()
    );
  }

  // Așteptăm ambele căutări în paralel
  await Promise.all(searchPromises);

  // ═════════════════════════════════════════════════════════════════════════════
  // PAS 2: Combinare și Filtrare
  // ═════════════════════════════════════════════════════════════════════════════

  // Deduplicare bazată pe ID
  const seenIds = new Set<string>();
  const combinedResults: any[] = [];

  // Adăugăm mai întâi rezultatele vector (au scor de similaritate)
  for (const r of vectorResults) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      combinedResults.push(r);
    }
  }

  // Adăugăm rezultatele keyword care nu sunt deja prezente
  for (const r of keywordResults) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      combinedResults.push(r);
    }
  }

  // Sortare după scor descrescător
  combinedResults.sort((a, b) => b.score - a.score);

  // Filtrare după threshold și limitare
  const filteredResults = combinedResults
    .filter(r => r.score >= opts.minScoreThreshold)
    .slice(0, opts.finalResults);

  console.log(`[LegacyRAG] Combined: ${combinedResults.length}, Filtered: ${filteredResults.length}`);

  // ═════════════════════════════════════════════════════════════════════════════
  // PAS 3: Construire Citații
  // ═════════════════════════════════════════════════════════════════════════════

  // Map document IDs la nume
  const documentIds = Array.from(new Set(
    filteredResults.map(r => r.payload.documentId)
  ));
  
  const documents = await prisma.document.findMany({
    where: { id: { in: documentIds } },
    select: { id: true, name: true },
  });
  const documentMap = new Map(documents.map(d => [d.id, d.name]));

  // Construim citațiile
  const citations = filteredResults.map((r, idx) => ({
    index: idx + 1,
    paragraphId: r.id,
    documentId: r.payload.documentId,
    documentName: documentMap.get(r.payload.documentId) || 'Unknown',
    pageNumber: r.payload.pageNumber,
    articleNumber: r.payload.articleNumber,
    paragraphLetter: r.payload.paragraphLetter,
    text: r.payload.content,
    score: r.score,
    confidence: Math.round(r.score * 100),
  }));

  // ═════════════════════════════════════════════════════════════════════════════
  // PAS 4: Generare Răspuns cu OpenAI (simplu)
  // ═════════════════════════════════════════════════════════════════════════════

  let answer: string | null = null;
  let finalConfidence = 0;

  if (citations.length > 0) {
    const avgScore = citations.reduce((sum, c) => sum + c.score, 0) / citations.length;
    finalConfidence = Math.round(avgScore * 100);

    answer = await generateLegacyAnswer(query, citations);
  }

  const executionTime = Date.now() - startTime;

  console.log(`[LegacyRAG] Completed in ${executionTime}ms, confidence: ${finalConfidence}%`);

  return {
    answer,
    citations,
    confidence: finalConfidence,
    executionTime,
    debug: {
      vectorResultsCount: vectorResults.length,
      keywordResultsCount: keywordResults.length,
      finalResultsCount: citations.length,
    },
  };
}

/**
 * Generează răspuns folosind OpenAI cu prompt simplu (stil Legacy)
 */
async function generateLegacyAnswer(
  query: string,
  citations: LegacyRagResult['citations']
): Promise<string> {
  const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Construim context simplu
  const context = citations.map((c, idx) => {
    return `[${idx + 1}] Pagina ${c.pageNumber}:
${c.text}`;
  }).join('\n\n---\n\n');

  const systemPrompt = `Ești un asistent specializat în normative electrice românești.
Răspunde la întrebare folosind EXCLUSIV informațiile din paragrafele furnizate.

REGULI:
1. Citează sursa pentru fiecare informație: [pag. X]
2. Dacă informația nu există în paragrafe, spune clar acest lucru
3. Fii concis și direct
4. NU adăuga informații din cunoștințe generale`;

  const userPrompt = `## Paragrafe din normativ:
${context}

## Întrebare:
${query}

Răspunde clar și citează sursele.`;

  const completion = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 500,
    temperature: 0.2,
  });

  const answer = completion.choices[0]?.message?.content?.trim();
  
  if (!answer) {
    return 'Nu s-a putut genera un răspuns.';
  }

  // Adăugăm sursele
  const sources = Array.from(new Set(
    citations.map(c => `${c.documentName}, pag. ${c.pageNumber}`)
  ));
  
  return answer + `\n\n📚 Sursă: ${sources.join('; ')}`;
}

export default processLegacyRag;
