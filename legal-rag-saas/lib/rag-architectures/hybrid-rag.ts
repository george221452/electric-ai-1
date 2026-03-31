/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ARHITECTURA HIBRIDĂ - RAG Configurabil
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Arhitectura hibridă permite activarea/dezactivarea componentelor individuale:
 * 
 * Componente Opționale (toggle):
 * • Synonym Expansion - generează variante de căutare
 * • Numerical Boost - boostează scorul pentru match-uri numerice
 * • Smart Router - routing inteligent quiz vs normal
 * • Confidence Optimizer - optimizare scor de încredere
 * 
 * Componente De Bază (mereu active):
 * • Vector Search în Qdrant
 * • Keyword Search în Prisma (revenit la metoda veche, mai bună)
 * • Filtrare și ranking
 * • OpenAI Completion
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { PrismaClient } from '@prisma/client';
import { OpenAIEmbeddingService } from '@/src/infrastructure/adapters/embedding/embedding-service';
import OpenAI from 'openai';
import { createSearchVariants, hasExpandableTerms } from '@/lib/search/synonyms';
import { extractMeasurementIntent, parseNumericalQuery, findNumericalValues, scoreNumericalMatch } from '@/lib/search/numerical-search';
import { optimizeConfidence, selectOptimalCitations, detectPracticalScenario } from '@/lib/search/confidence-optimizer';
import { SmartAnswerRouter } from '@/lib/quiz/smart-answer-router';
import AdvancedQuizHandler from '@/lib/quiz/advanced-quiz-handler';

export interface HybridRagOptions {
  // Componente de bază
  useKeywordSearch: boolean;
  useVectorSearch: boolean;
  minScoreThreshold: number;
  maxResults: number;
  finalResults: number;
  
  // Componente opționale (toggle)
  useSynonymExpansion: boolean;
  useNumericalBoost: boolean;
  useSmartRouter: boolean;
  useConfidenceOptimizer: boolean;
}

export interface HybridRagResult {
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
    relevanceReason?: string;
  }>;
  confidence: number;
  executionTime: number;
  componentsUsed: {
    synonymExpansion: boolean;
    numericalBoost: boolean;
    smartRouter: boolean;
    confidenceOptimizer: boolean;
  };
  debug: {
    vectorResultsCount: number;
    keywordResultsCount: number;
    searchVariantsUsed: number;
    finalResultsCount: number;
    processingSteps: string[];
  };
}

const DEFAULT_OPTIONS: HybridRagOptions = {
  useKeywordSearch: true,
  useVectorSearch: true,
  minScoreThreshold: 0.40,
  maxResults: 10,
  finalResults: 3,
  useSynonymExpansion: false,
  useNumericalBoost: false,
  useSmartRouter: false,
  useConfidenceOptimizer: false,
};

// Smart Router - inițializat doar dacă e nevoie
let smartRouter: SmartAnswerRouter | null = null;

function getSmartRouter(): SmartAnswerRouter {
  if (!smartRouter) {
    smartRouter = new SmartAnswerRouter({
      minConfidenceQuiz: 0.75,
      minConfidenceNormal: 0.5,
      enableNumericVerification: true,
      maxRetries: 2
    });
  }
  return smartRouter;
}

/**
 * Procesează o query folosind arhitectura hibridă configurabilă
 */
export async function processHybridRag(
  query: string,
  workspaceId: string,
  prisma: PrismaClient,
  qdrant: QdrantClient,
  options: Partial<HybridRagOptions> = {}
): Promise<HybridRagResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const processingSteps: string[] = [];

  console.log(`[HybridRAG] Starting with query: "${query}"`);
  console.log(`[HybridRAG] Active components:`, {
    synonymExpansion: opts.useSynonymExpansion,
    numericalBoost: opts.useNumericalBoost,
    smartRouter: opts.useSmartRouter,
    confidenceOptimizer: opts.useConfidenceOptimizer,
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // PAS 1: Pregătire Query (Synonym Expansion - opțional)
  // ═════════════════════════════════════════════════════════════════════════════
  
  let searchQueries = [query];
  let usedSynonyms = false;

  if (opts.useSynonymExpansion && hasExpandableTerms(query)) {
    const variants = createSearchVariants(query);
    if (variants.length > 1) {
      searchQueries = variants.slice(0, 3); // Max 3 variante
      usedSynonyms = true;
      processingSteps.push(`synonym_expansion: ${variants.length} variants`);
      console.log(`[HybridRAG] Synonym expansion: ${variants.join(' | ')}`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PAS 2: Generare Embeddings
  // ═════════════════════════════════════════════════════════════════════════════
  
  const embeddingService = new OpenAIEmbeddingService();
  const queryEmbeddings = await Promise.all(
    searchQueries.map(q => embeddingService.embed(q))
  );
  processingSteps.push(`embeddings_generated: ${queryEmbeddings.length}`);

  // ═════════════════════════════════════════════════════════════════════════════
  // PAS 3: Căutare în PARALEL (Vector + Keyword)
  // ═════════════════════════════════════════════════════════════════════════════

  let vectorResults: any[] = [];
  let keywordResults: any[] = [];

  const searchPromises: Promise<any>[] = [];

  // Vector Search în Qdrant (pentru toate variantele)
  if (opts.useVectorSearch) {
    searchPromises.push(
      (async () => {
        const allResults: any[] = [];
        
        for (const embedding of queryEmbeddings) {
          const results = await qdrant.search('legal_paragraphs', {
            vector: embedding,
            limit: opts.maxResults,
            with_payload: true,
            score_threshold: opts.minScoreThreshold - (usedSynonyms ? 0.05 : 0),
            filter: {
              must: [{ key: 'workspaceId', match: { value: workspaceId } }],
            },
          }) as any[];
          allResults.push(...results);
        }

        // Deduplicare
        const seenIds = new Set<string>();
        vectorResults = allResults
          .filter(r => {
            if (seenIds.has(r.id)) return false;
            seenIds.add(r.id);
            return true;
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, opts.maxResults);

        console.log(`[HybridRAG] Vector search: ${vectorResults.length} results`);
        return vectorResults;
      })()
    );
  }

  // Keyword Search în Prisma (metoda veche, mai bună)
  if (opts.useKeywordSearch) {
    searchPromises.push(
      (async () => {
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

        keywordResults = results.map(p => ({
          id: p.id,
          score: 0.45,
          payload: {
            documentId: p.documentId,
            content: p.content,
            pageNumber: p.pageNumber,
            articleNumber: p.articleNumber,
            paragraphLetter: p.paragraphLetter,
          },
        }));

        console.log(`[HybridRAG] Keyword search: ${keywordResults.length} results`);
        return keywordResults;
      })()
    );
  }

  await Promise.all(searchPromises);
  processingSteps.push(`search_completed: vector=${vectorResults.length}, keyword=${keywordResults.length}`);

  // ═════════════════════════════════════════════════════════════════════════════
  // PAS 4: Combinare și Filtrare
  // ═════════════════════════════════════════════════════════════════════════════

  const seenIds = new Set<string>();
  const combinedResults: any[] = [];

  for (const r of vectorResults) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      combinedResults.push(r);
    }
  }

  for (const r of keywordResults) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      combinedResults.push(r);
    }
  }

  combinedResults.sort((a, b) => b.score - a.score);
  processingSteps.push(`combined_results: ${combinedResults.length}`);

  // ═════════════════════════════════════════════════════════════════════════════
  // PAS 5: Numerical Boost (opțional)
  // ═════════════════════════════════════════════════════════════════════════════

  let processedResults = combinedResults;

  if (opts.useNumericalBoost) {
    const numericalQuery = parseNumericalQuery(query);
    const measurementIntent = extractMeasurementIntent(query);

    if (numericalQuery || measurementIntent) {
      processingSteps.push('numerical_boost_applied');
      console.log(`[HybridRAG] Applying numerical boost`);

      processedResults = combinedResults.map(r => {
        const numMatches = findNumericalValues(r.payload.content, r.payload.pageNumber, r.id);
        let numericalScore = 0;

        if (numericalQuery) {
          for (const match of numMatches) {
            numericalScore += scoreNumericalMatch(match, numericalQuery);
          }
        }

        const boostedScore = Math.min(r.score + (numericalScore / 100), 1.0);
        return { ...r, score: boostedScore };
      }).sort((a, b) => b.score - a.score);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PAS 6: Construire Citații
  // ═════════════════════════════════════════════════════════════════════════════

  const filteredResults = processedResults
    .filter(r => r.score >= opts.minScoreThreshold)
    .slice(0, opts.finalResults);

  const documentIds = Array.from(new Set(
    filteredResults.map(r => r.payload.documentId)
  ));
  
  const documents = await prisma.document.findMany({
    where: { id: { in: documentIds } },
    select: { id: true, name: true },
  });
  const documentMap = new Map(documents.map(d => [d.id, d.name]));

  let citations = filteredResults.map((r, idx) => ({
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

  processingSteps.push(`citations_created: ${citations.length}`);

  // ═════════════════════════════════════════════════════════════════════════════
  // PAS 7: Confidence Optimizer (opțional)
  // ═════════════════════════════════════════════════════════════════════════════

  let finalConfidence = citations.length > 0
    ? Math.round(citations.reduce((sum, c) => sum + c.score, 0) / citations.length * 100)
    : 0;

  if (opts.useConfidenceOptimizer && citations.length > 0) {
    const scenario = detectPracticalScenario(query);
    
    if (scenario.isPractical) {
      processingSteps.push('confidence_optimizer_applied');
      
      const optimizedCitations = selectOptimalCitations(
        query,
        citations.map((c, idx) => ({ ...c, originalIndex: idx })),
        5
      );

      citations = optimizedCitations.map((c: any) => {
        const { combinedScore, relevanceReason, originalIndex, ...rest } = c;
        return { ...rest, relevanceReason };
      });

      const optimization = optimizeConfidence({
        query,
        citations,
        queryType: scenario.scenarioType,
      });

      finalConfidence = optimization.optimizedConfidence;
      console.log(`[HybridRAG] Confidence optimized: ${optimization.originalConfidence}% → ${optimization.optimizedConfidence}%`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PAS 8: Generare Răspuns
  // ═════════════════════════════════════════════════════════════════════════════

  let answer: string | null = null;
  let answerType: 'quiz' | 'normal' = 'normal';

  if (citations.length > 0) {
    // Quiz Detection
    const quizDetection = AdvancedQuizHandler.detectQuiz(query);

    if (opts.useSmartRouter) {
      processingSteps.push('smart_router_used');
      
      try {
        const smartResult = await getSmartRouter().generateAnswer(
          query,
          citations.map(c => ({
            paragraphId: c.paragraphId,
            documentId: c.documentId,
            content: c.text,
            score: c.score,
            metadata: {
              pageNumber: c.pageNumber,
              articleNumber: c.articleNumber,
              paragraphLetter: c.paragraphLetter,
            }
          }))
        );

        answer = smartResult.answer;
        answerType = smartResult.type;
        finalConfidence = smartResult.confidence;
        
        console.log(`[HybridRAG] Smart Router: type=${smartResult.type}, confidence=${smartResult.confidence}%`);
      } catch (error) {
        console.error('[HybridRAG] Smart Router failed, falling back:', error);
        answer = await generateHybridAnswer(query, citations);
      }
    } else if (quizDetection.isQuiz && quizDetection.options) {
      // Quiz simplu fără Smart Router
      processingSteps.push('simple_quiz_handler');
      answer = await generateSimpleQuizAnswer(query, quizDetection, citations);
      answerType = 'quiz';
    } else {
      // Răspuns normal
      processingSteps.push('normal_answer_generator');
      answer = await generateHybridAnswer(query, citations);
    }
  }

  const executionTime = Date.now() - startTime;

  console.log(`[HybridRAG] Completed in ${executionTime}ms`);

  return {
    answer,
    citations,
    confidence: finalConfidence,
    executionTime,
    componentsUsed: {
      synonymExpansion: usedSynonyms,
      numericalBoost: opts.useNumericalBoost && !!parseNumericalQuery(query),
      smartRouter: opts.useSmartRouter,
      confidenceOptimizer: opts.useConfidenceOptimizer,
    },
    debug: {
      vectorResultsCount: vectorResults.length,
      keywordResultsCount: keywordResults.length,
      searchVariantsUsed: searchQueries.length,
      finalResultsCount: citations.length,
      processingSteps,
    },
  };
}

/**
 * Generează răspuns normal (fără Smart Router)
 */
async function generateHybridAnswer(
  query: string,
  citations: HybridRagResult['citations']
): Promise<string> {
  const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
4. NU adăuga informații din cunoștințe generale
5. Pentru grile: analizează fiecare variantă și spune de ce e corectă/greșită`;

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
    max_tokens: 600,
    temperature: 0.2,
  });

  const answer = completion.choices[0]?.message?.content?.trim();
  
  if (!answer) return 'Nu s-a putut genera un răspuns.';

  const sources = Array.from(new Set(
    citations.map(c => `${c.documentName}, pag. ${c.pageNumber}`)
  ));
  
  return answer + `\n\n📚 Sursă: ${sources.join('; ')}`;
}

/**
 * Generează răspuns pentru quiz (simplificat)
 */
async function generateSimpleQuizAnswer(
  query: string,
  detection: any,
  citations: HybridRagResult['citations']
): Promise<string> {
  const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const topCitations = citations.slice(0, 3);
  const context = topCitations.map((c, idx) => {
    return `[${idx + 1}] Pagina ${c.pageNumber}:\n${c.text.substring(0, 500)}`;
  }).join('\n\n---\n\n');

  const systemPrompt = `Ești un expert în normative electrice românești.
Analizează întrebarea cu variante și răspunde EXACT cu litera corectă (A, B sau C).

REGULI:
1. Citează articolul specific din normativ
2. Explică de ce varianta corectă e corectă
3. Explică de ce variantele greșite sunt greșite
4. Răspunsul trebuie să înceapă cu: "RĂSPUNS: [litera]"`;

  const userPrompt = `## Context din normativ:
${context}

## Întrebare:
${detection.question || query}

${detection.options ? Object.entries(detection.options).map(([k, v]) => `${k}) ${v}`).join('\n') : ''}

Care este răspunsul corect?`;

  const completion = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 600,
    temperature: 0.1,
  });

  return completion.choices[0]?.message?.content?.trim() || 'Nu s-a putut determina răspunsul.';
}

export default processHybridRag;
