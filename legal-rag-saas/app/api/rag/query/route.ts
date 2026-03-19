import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddingService } from '@/src/infrastructure/adapters/embedding/embedding-service';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { unifiedCache as queryCache } from '@/lib/cache/redis-cache';
import { COMMON_QUESTIONS } from '@/lib/cache/query-cache';
import { extractMeasurementIntent, parseNumericalQuery, findNumericalValues, scoreNumericalMatch } from '@/lib/search/numerical-search';
import { optimizeConfidence, selectOptimalCitations, detectPracticalScenario } from '@/lib/search/confidence-optimizer';
import { createSearchVariants, hasExpandableTerms } from '@/lib/search/synonyms';
import { detectQuizQuestion, buildQuizPrompt, parseQuizAnswer, formatQuizResponse } from '@/lib/quiz/quiz-handler';
import AdvancedQuizHandler from '@/lib/quiz/advanced-quiz-handler';
import { SmartAnswerRouter } from '@/lib/quiz/smart-answer-router';

const QuerySchema = z.object({
  query: z.string().min(3, 'Query must be at least 3 characters'),
  workspaceId: z.string().uuid('Invalid workspace ID'),
  documentIds: z.array(z.string().uuid()).optional(),
  options: z.object({
    maxParagraphs: z.number().min(1).max(20).optional(),
  }).optional(),
});

// STRICT CONFIDENCE THRESHOLD - Only answer with high confidence
const MIN_CONFIDENCE_THRESHOLD = 40; // 40% minimum confidence for OpenAI embeddings
const MIN_SCORE_THRESHOLD = 0.40; // Minimum similarity score 0.40 for OpenAI

// Initialize Smart Router for dual-mode handling
const smartRouter = new SmartAnswerRouter({
  minConfidenceQuiz: 0.75,
  minConfidenceNormal: 0.5,
  enableNumericVerification: true,
  maxRetries: 2
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = QuerySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { query, workspaceId, documentIds, options } = validation.data;

    // Initialize clients
    const qdrant = new QdrantClient({ url: process.env.QDRANT_URL || 'http://localhost:6333' });
    const prisma = new PrismaClient();
    const embeddingService = new OpenAIEmbeddingService();

    console.log(`[RAG API] Query: "${query}"`);
    console.log(`[RAG API] WorkspaceId: ${workspaceId}`);

    // Detectăm dacă e o grilă (întrebare cu variante)
    const quizQuestion = detectQuizQuestion(query);
    if (quizQuestion.isQuiz) {
      console.log(`[RAG API] Detected quiz question with ${quizQuestion.options.length} options`);
      console.log(`[RAG API] Options: ${quizQuestion.options.map(o => o.letter).join(', ')}`);
    }

    // CHECK CACHE FIRST
    const cached = await queryCache.get(query, workspaceId);
    if (cached) {
      console.log(`[RAG API] CACHE HIT! Returning cached answer (hits: ${cached.hitCount})`);
      return NextResponse.json({
        success: true,
        data: {
          answer: cached.answer,
          citations: cached.citations,
          confidence: cached.confidence,
          queryIntent: detectIntent(query),
          resultsCount: cached.citations.length,
          disclaimer: 'Răspuns din cache (întrebare frecventă). Text citat ad-literam din documente.',
          needsClarification: false,
          fromCache: true,
          cacheHits: cached.hitCount,
          answerSource: 'documents', // cache only stores document-based answers
        },
      });
    }
    console.log(`[RAG API] Cache miss - processing query...`);

    // Check if collection exists and has data
    let pointsCount = 0;
    let hasDocuments = true;
    let collectionError = null;
    try {
      const info = await qdrant.getCollection('legal_paragraphs');
      pointsCount = info.points_count || 0;
      console.log(`[RAG API] Collection legal_paragraphs exists with ${pointsCount} points`);
    } catch (e) {
      hasDocuments = false;
      collectionError = e;
      console.log(`[RAG API] Collection error:`, e);
    }

    // If no documents, act as a general legal assistant
    if (!hasDocuments || pointsCount === 0) {
      console.log(`[RAG API] No documents found. hasDocuments=${hasDocuments}, pointsCount=${pointsCount}`);
      const generalAnswer = await generateGeneralAnswer(query);
      return NextResponse.json({
        success: true,
        data: {
          answer: generalAnswer.answer,
          question: generalAnswer.needsClarification ? generalAnswer.clarifyingQuestion : null,
          citations: [],
          confidence: generalAnswer.confidence,
          queryIntent: detectIntent(query),
          resultsCount: 0,
          needsClarification: generalAnswer.needsClarification,
          isGeneralAnswer: true,
          answerSource: generalAnswer.answerSource, // 'general_knowledge' when no documents
          warning: 'RĂSPUNS GENERAT DE AI - NU DIN DOCUMENTE NORMATIVE',
          message: hasDocuments 
            ? '⚠️ Nu există documente indexate în sistem. Răspunsul este oferit de AI pe baza cunoștințelor generale și poate conține inexactități.'
            : '⚠️ Sistemul nu are documente încărcate. Răspunsul este generat de AI din cunoștințe generale. Pentru citate exacte din normative, încărcați documentele dorite.',
        },
      });
    }

    // SYNONYM EXPANSION - Create search variants
    let searchQueries = [query];
    let usedSynonyms = false;
    
    if (hasExpandableTerms(query)) {
      const variants = createSearchVariants(query);
      if (variants.length > 1) {
        searchQueries = variants;
        usedSynonyms = true;
        console.log(`[RAG API] Query expanded with synonyms: ${variants.join(' | ')}`);
      }
    }

    // Generate embeddings for all query variants
    const queryEmbeddings = await Promise.all(
      searchQueries.map(q => embeddingService.embed(q))
    );
    
    // Detect if query is about prohibitions/obligations - need more results
    const queryNormalized = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isProhibitionQuery = queryNormalized.includes('interdicti') || queryNormalized.includes('interzis') || 
                               queryNormalized.includes('obligatii') || queryNormalized.includes('obligatoriu');
    
    // Use more results for prohibition/obligation queries
    const searchLimit = isProhibitionQuery ? 30 : 10;

    // Search in Qdrant with all query variants
    const allSearchResults: any[] = [];
    
    for (const embedding of queryEmbeddings) {
      const results = await qdrant.search('legal_paragraphs', {
        vector: embedding,
        limit: searchLimit,
        with_payload: true,
        score_threshold: MIN_SCORE_THRESHOLD - 0.05, // Slightly lower threshold for synonyms
        filter: {
          must: [
            { key: 'workspaceId', match: { value: workspaceId } },
          ],
        },
      }) as any[];
      
      allSearchResults.push(...results);
    }
    
    // Deduplicate and sort results by score
    const seenIds = new Set<string>();
    const searchResults = allSearchResults
      .filter((r: any) => {
        if (seenIds.has(r.id)) return false;
        seenIds.add(r.id);
        return true;
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, searchLimit);
    
    if (usedSynonyms) {
      console.log(`[RAG API] Synonym search: ${allSearchResults.length} raw results → ${searchResults.length} unique`);
    }

    // For prohibition queries, also do keyword search to find more matches
    let keywordResults: any[] = [];
    if (isProhibitionQuery) {
      const prohibitionKeywords = ['nu se admite', 'se interzice', 'nu se permite', 'nu este permis'];
      for (const keyword of prohibitionKeywords) {
        try {
          const scrollResult = await qdrant.scroll('legal_paragraphs', {
            filter: {
              must: [
                { key: 'workspaceId', match: { value: workspaceId } },
                { key: 'content', match: { text: keyword } }
              ]
            },
            limit: 20,
            with_payload: true
          });
          
          for (const point of scrollResult.points) {
            // Check if not already in searchResults
            const exists = searchResults.some(r => r.id === point.id);
            if (!exists) {
              keywordResults.push({
                id: point.id,
                score: 0.45, // Assign a base score for keyword matches
                payload: point.payload
              });
            }
          }
        } catch (e) {
          console.log(`[RAG API] Keyword search failed for "${keyword}":`, e);
        }
      }
    }
    
    // Combine vector and keyword results
    const combinedResults = [...searchResults, ...keywordResults];
    console.log(`[RAG API] Found ${searchResults.length} vector + ${keywordResults.length} keyword = ${combinedResults.length} total results`);

    if (combinedResults.length === 0) {
      const clarifyingQuestion = generateClarifyingQuestion(query);
      return NextResponse.json({
        success: true,
        data: {
          answer: null,
          question: clarifyingQuestion,
          citations: [],
          confidence: 0,
          queryIntent: detectIntent(query),
          resultsCount: 0,
          needsClarification: true,
          reason: 'No results met the minimum confidence threshold',
        },
      });
    }

    // Get document names
    const documentIdsFound = Array.from(new Set(combinedResults.map((r: any) => r.payload.documentId)));
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIdsFound } },
      select: { id: true, name: true },
    });
    const documentMap = new Map(documents.map(d => [d.id, d.name]));

    // Build citations with strict filtering
    // Use more citations for prohibition/obligation queries
    const citationLimit = isProhibitionQuery ? 10 : 3;
    const citations = combinedResults
      .filter((r: any) => r.score >= MIN_SCORE_THRESHOLD)
      .slice(0, citationLimit)
      .map((r: any, idx: number) => ({
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

    // ENHANCE WITH NUMERICAL SEARCH
    // Check if query contains numerical values and boost matching citations
    const numericalQuery = parseNumericalQuery(query);
    const measurementIntent = extractMeasurementIntent(query);
    
    if (numericalQuery || measurementIntent) {
      console.log(`[RAG API] Numerical query detected:`, numericalQuery, measurementIntent);
      
      // Score and re-rank citations based on numerical matches
      const citationsWithNumericalScores = citations.map(c => {
        const numMatches = findNumericalValues(c.text, c.pageNumber, c.paragraphId);
        let numericalScore = 0;
        
        if (numericalQuery) {
          for (const match of numMatches) {
            numericalScore += scoreNumericalMatch(match, numericalQuery);
          }
        }
        
        // Boost original score with numerical score
        const boostedScore = c.score + (numericalScore / 100);
        
        return {
          ...c,
          score: Math.min(boostedScore, 1.0), // Cap at 1.0
          confidence: Math.round(Math.min(boostedScore, 1.0) * 100),
          numericalMatches: numMatches.slice(0, 3),
        };
      });
      
      // Re-sort by boosted score
      citationsWithNumericalScores.sort((a, b) => b.score - a.score);
      
      // Replace citations with enhanced ones
      citations.length = 0;
      citations.push(...citationsWithNumericalScores);
      
      console.log(`[RAG API] Re-ranked ${citations.length} citations with numerical enhancement`);
    }

    // OPTIMIZE CONFIDENCE FOR PRACTICAL SCENARIOS
    const scenario = detectPracticalScenario(query);
    let finalConfidence: number;
    let confidenceOptimization: any = null;
    
    if (scenario.isPractical) {
      console.log(`[RAG API] Practical scenario detected: ${scenario.scenarioType} (complexity: ${scenario.complexity})`);
      
      // Use optimized citation selection
      const optimizedCitations = selectOptimalCitations(
        query,
        citations.map((c, idx) => ({ ...c, originalIndex: idx })),
        5
      );
      
      // Update citations with optimized selection
      citations.length = 0;
      citations.push(...optimizedCitations.map((c: any) => {
        const { combinedScore, relevanceReason, originalIndex, ...rest } = c;
        return { ...rest, relevanceReason };
      }));
      
      // Optimize confidence
      const optimization = optimizeConfidence({
        query,
        citations,
        queryType: scenario.scenarioType,
      });
      
      finalConfidence = optimization.optimizedConfidence;
      confidenceOptimization = {
        original: optimization.originalConfidence,
        optimized: optimization.optimizedConfidence,
        reason: optimization.adjustmentReason,
        coverageScore: optimization.coverageScore,
        semanticScore: optimization.semanticMatchScore,
      };
      
      console.log(`[RAG API] Confidence optimized: ${optimization.originalConfidence}% → ${optimization.optimizedConfidence}%`);
    } else {
      // Calculate standard confidence
      const avgScore = citations.reduce((sum, c) => sum + c.score, 0) / citations.length;
      finalConfidence = Math.round(avgScore * 100);
    }

    console.log(`[RAG API] Final Confidence: ${finalConfidence}%`);

    // STRICT: If confidence is below threshold, DO NOT ANSWER
    if (finalConfidence < MIN_CONFIDENCE_THRESHOLD) {
      const clarifyingQuestion = generateClarifyingQuestion(query, citations);
      return NextResponse.json({
        success: true,
        data: {
          answer: null,
          question: clarifyingQuestion,
          citations: citations.map(c => ({
            index: c.index,
            documentName: c.documentName,
            pageNumber: c.pageNumber,
            text: c.text.substring(0, 200) + '...',
            confidence: c.confidence,
          })),
          confidence: finalConfidence,
          queryIntent: detectIntent(query),
          resultsCount: citations.length,
          needsClarification: true,
          reason: `Confidence ${finalConfidence}% is below threshold ${MIN_CONFIDENCE_THRESHOLD}%`,
        },
      });
    }

    // Build answer ONLY from verified citations
    // For prohibition queries, pass all combined results to find more matches
    const allResultsForAnswer = isProhibitionQuery 
      ? combinedResults.filter((r: any) => r.score >= MIN_SCORE_THRESHOLD).map((r: any, idx: number) => ({
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
        }))
      : citations;
    
    // Use new dual-mode Smart Router for answer generation
    // It automatically detects quiz vs normal questions and handles accordingly
    let answer: string | null;
    let answerType: 'quiz' | 'normal' = 'normal';
    
    try {
      const smartResult = await smartRouter.generateAnswer(query, allResultsForAnswer.map((r: any) => ({
        paragraphId: r.paragraphId,
        documentId: r.documentId,
        content: r.text,
        score: r.score,
        metadata: {
          pageNumber: r.pageNumber,
          articleNumber: r.articleNumber,
          paragraphLetter: r.paragraphLetter,
        }
      })));
      
      answer = smartResult.answer;
      answerType = smartResult.type;
      
      // Update confidence with router's confidence
      finalConfidence = smartResult.confidence;
      
      console.log(`[RAG API] Smart Router result: type=${smartResult.type}, confidence=${smartResult.confidence}%`);
      
      // If the router detected this is a quiz but gave normal answer, wrap it
      if (smartResult.type === 'normal' && quizQuestion.isQuiz && smartResult.metadata.needsClarification) {
        answer = `⚠️ **Clarificare necesară:**\n\n${answer}`;
      }
    } catch (routerError) {
      console.error('[RAG API] Smart Router error, falling back:', routerError);
      // Fallback to legacy handlers
      if (quizQuestion.isQuiz) {
        answer = await buildQuizAnswer(quizQuestion, allResultsForAnswer, finalConfidence);
        answerType = 'quiz';
      } else {
        answer = await buildStrictAnswer(query, allResultsForAnswer, finalConfidence);
        answerType = 'normal';
      }
    }

    await prisma.$disconnect();

    // STORE IN CACHE
    const responseCitations = citations.map(c => ({
      index: c.index,
      paragraphId: c.paragraphId,
      documentId: c.documentId,
      documentName: c.documentName,
      pageNumber: c.pageNumber,
      articleNumber: c.articleNumber,
      paragraphLetter: c.paragraphLetter,
      text: c.text,
      confidence: c.confidence,
    }));

    await queryCache.set(query, workspaceId, {
      answer: answer || '',
      citations: responseCitations,
      confidence: finalConfidence,
    });

    console.log(`[RAG API] Response cached. Cache stats:`, await queryCache.getStats());

    // BANNER pentru răspuns din documente
    const documentBanner = `🟢 ════════════════════════════════════════════════════════════════\n📄 RĂSPUNS BAZAT PE DOCUMENTE NORMATIVE\n🟢 ════════════════════════════════════════════════════════════════\n\n✅ Acest răspuns conține citate din documentele încărcate în sistem.\n✅ Fiecare informație este însoțită de referință la pagină și document.\n✅ Verificați întotdeauna sursa originală pentru detalii complete.\n\n──────────────────────────────────────────────────────────────────\n\n`;
    
    const finalAnswerWithBanner = answer ? `${documentBanner}${answer}` : answer;

    return NextResponse.json({
      success: true,
      data: {
        answer: finalAnswerWithBanner,
        answerType,
        isQuiz: answerType === 'quiz' || quizQuestion.isQuiz,
        citations: responseCitations,
        confidence: finalConfidence,
        queryIntent: detectIntent(query),
        resultsCount: citations.length,
        disclaimer: 'Text citat ad-literam din documente. Verificați sursa pentru informații complete.',
        needsClarification: false,
        fromCache: false,
        answerSource: 'documents', // clear indicator that this comes from documents
        detection: {
          isQuizDetected: quizQuestion.isQuiz,
          optionsCount: quizQuestion.options?.length || 0,
        },
        scenario: scenario.isPractical ? {
          type: scenario.scenarioType,
          complexity: scenario.complexity,
          optimization: confidenceOptimization,
        } : undefined,
      },
    });

  } catch (error) {
    console.error('[RAG Query API] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

async function buildStrictAnswer(query: string, citations: any[], overallConfidence: number): Promise<string | null> {
  if (citations.length === 0) return null;

  // Sort by score
  citations.sort((a, b) => b.score - a.score);
  
  // Give FULL citations to AI, not snippets - let AI find the relevant parts
  const context = citations.map((c, idx) => {
    return `[${idx + 1}] Pagina ${c.pageNumber}:\n${c.text}`;
  }).join('\n\n---\n\n');

  try {
    const openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const systemPrompt = `Ești un ASISTENT LEGAL-TEHNIC SPECIALIZAT în interpretarea normativelor electrotehnice românești (I7/2011, I6, etc.).

## SARCINA PRIMARĂ
Răspunde la întrebarea utilizatorului EXCLUSIV pe baza PARAGRAFELOR furnizate din normativ. Nu adăuga informații din cunoștințele generale.

## REGULI ABSOLUTE (rate 100% conformitate)

### 1. SURSA INFORMAȚIEI
- Folosește DOAR paragrafele marcate cu [pag. X] furnizate în context
- Dacă informația nu există în paragrafe, răspunde: "Conform paragrafelor disponibile [pag. X, Y], nu există informații despre [subiect]. Detaliile complete pot fi în alte secțiuni ale normativului."
- NU inventa articole, pagini sau prevederi

### 2. CITAREA EXACTĂ
- Pentru fiecare afirmație, citează: [pag. X, articolul Y.Z.W]
- Prezintă mai întâi citatul exact din normativ (între ghilimele), apoi explicația ta
- Exemplu: "Normativul prevede: 'căderile de tensiune...' [pag. 144, 5.3.4.3.1.4]"

### 3. IERARHIA INFORMAȚIEI (toate variantele)
- Dacă normativul menționează "RECOMANDAT: X, Y" și "SE ADMIT ȘI: A, B, C" → prezintă PE AMBELE categorii, clar distincte
- NU rezuma doar la "recomandate" ignorând "admise"
- Evidențiază diferențele: culori pentru BARE (stații) vs. culori pentru CABLURI (instalații consum)

### 4. EXPLICAȚIA PENTRU "OMUL DE RÂND"
- După citatul tehnic, adaugă secțiunea "ÎN LIMBAJ SIMPLU:"
- Explică: ce înseamnă practic, cui se aplică, ce trebuie făcut concret
- Folosește analogii din viața reală (ex: "ca un siguranță de casă, dar pentru...")

### 5. DISTINCȚII CRITICE (fără confuzii)
- BLEU (albastru) = NEUTRU (nu fază!)
- Verde/galben = PĂMÂNT (nu nul!)
- Fază = maro/negru/gri (conform tabelului specific)
- Separă clar: prescripții obligatorii vs. recomandări vs. opțiuni permise

### 6. FORMATUL RĂSPUNSULUI (obligatoriu)

---
**RĂSPUNS DIRECT:** [da/nu/depinde sau valoarea exactă]

**Baza legală:** 
"[citat exact din normativ]" [pag. X, art. Y]

**În limaj simplu:** 
[explicație pentru ne-electricieni]

**Detalii tehnice:** 
[context suplimentar din paragrafe, dacă există]

**Atenție la:** 
[capcane, excepții, condiții speciale menționate în normativ]
---

### 7. GESTIONAREA GOLURILOR
Dacă paragrafele sunt incomplete sau contradictorii:
- Spune EXACT ce știi din ele
- Indică ce lipsește: "Paragrafele furnizate nu specifică [detaliu]"
- NU completa cu "probabil" sau "în general se practică"

### 8. VERIFICĂRI ÎNAINTE DE RĂSPUNS
Înainte să generezi răspunsul final, verifică mental:
- [ ] Fiecare afirmație are [pag.] în spate?
- [ ] Am distins între "recomandat" și "admis"?
- [ ] Am explicat termenii tehnici?
- [ ] Nu am adăugat nimic din afara paragrafelor?
- [ ] Culoarea BLEU e pentru neutru, nu fază?

## EXEMPLU DE RĂSPUNS CORECT

**Întrebare:** "Ce cădere de tensiune e admisă la motoare?"

**Răspuns:**

---
**RĂSPUNS DIRECT:** 5% pentru motoare [pag. 154]

**Baza legală:** 
"În cazul alimentării consumatorului se fac... căderi de tensiune: - 5% pentru receptoarele din instalațiile..." [pag. 154, 4.2.3]

**În limaj simplu:** 
Dacă ai 230V la tablou, la motor trebuie să ai minimum 218.5V (230 - 5%). Dacă scade mai mult, motorul se încinge și se strică.

**Detalii tehnice:** 
Această limită e valabilă pentru receptoarele din instalațiile electrice ale clădirilor. Alte valori pot exista pentru alte categorii (vezi tabelul complet în normativ).

**Atenție la:** 
- 5% e maximul, nu idealul
- Se măsoară la borna motorului, nu la tablou
---`;

    const userPrompt = `## CONTEXT FURNIZAT (paragrafele din normativ):
${context}

## ÎNTREBAREA UTILIZATORULUI:
${query}

Generează răspunsul conform formatului obligatoriu de mai sus. Verifică checklist-ul înainte de a răspunde.`;

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
      return generateFallbackAnswer(query, citations);
    }

    // Add sources
    const sources = Array.from(new Set(citations.map((c: any) => `${c.documentName}, pag. ${c.pageNumber}`)));
    return answer + `\n\n📚 Sursă: ${sources.join('; ')}`;

  } catch (error) {
    console.error('[RAG API] Error:', error);
    return generateFallbackAnswer(query, citations);
  }
}

function generateFallbackAnswer(query: string, citations: any[]): string {
  // Simple fallback when AI fails
  const mainCitation = citations[0];
  const text = mainCitation.text;
  
  // For questions about examples/numbers, try to extract structured info
  const queryLower = query.toLowerCase();
  const sentences = text.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 20);
  
  // Find best matching sentence
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);
  let bestSentence = sentences[0] || '';
  let bestScore = 0;
  
  for (const sentence of sentences) {
    const sentenceLower = sentence.toLowerCase();
    let matchScore = 0;
    for (const word of queryWords) {
      if (sentenceLower.includes(word)) {
        matchScore += 1;
      }
    }
    if (matchScore > bestScore) {
      bestScore = matchScore;
      bestSentence = sentence;
    }
  }

  let answer = bestSentence.trim();
  if (!answer.endsWith('.')) answer += '.';
  
  const sources = Array.from(new Set(citations.map((c: any) => `${c.documentName}, pag. ${c.pageNumber}`)));
  return answer + `\n\n📚 Sursă: ${sources.join('; ')}`;
}

async function generateGeneralAnswer(query: string): Promise<{ 
  answer: string | null; 
  needsClarification: boolean; 
  clarifyingQuestion: string | null;
  confidence: number;
  answerSource: 'documents' | 'general_knowledge';
}> {
  const queryLower = query.toLowerCase();
  const queryNormalized = queryLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Use AI to provide a helpful general answer and guide to documents
  try {
    const openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Ești un electrician expert care răspunde la întrebări despre instalații electrice.

**REGULI:**
1. Răspunde clar și util la întrebare, bazându-te pe cunoștințe generale din domeniul electric
2. Fii practic și direct - nu cere clarificări inutile
3. La final, menționează că pentru citate exacte din normativ, documentele trebuie încărcate
4. NU refuza să răspunzi - oferă informații utile din cunoștințe generale

Scopul tău: oferă un răspuns util electricianului, chiar dacă nu ai acces la documente în acest moment.`,
        },
        {
          role: 'user',
          content: `Întrebare: "${query}"

Oferă un răspuns clar și practic. Nu cere clarificări - răspunde direct cu ce știi despre acest subiect în instalațiile electrice.`,
        },
      ],
      max_tokens: 800,
      temperature: 0.3,
    });
    
    const answer = completion.choices[0]?.message?.content || '';
    
    // BANNER VIZIBIL pentru răspuns general (AI-only)
    const banner = `🟡 ════════════════════════════════════════════════════════════════
⚠️  RĂSPUNS GENERAT DE AI - NU ESTE DIN DOCUMENTE NORMATIVE
🟡 ════════════════════════════════════════════════════════════════

📋 **Ce înseamnă acest lucru:**
• Acest răspuns este generat de inteligența artificială pe baza cunoștințelor generale
• NU conține citate exacte din normative (I7/2011, PE 116/1995, etc.)
• Poate conține inexactități sau informații incomplete
• NU înlocuiește consultarea documentelor normative oficiale

✅ **Pentru răspunsuri 100% sigure din normative:**
Încărcați documentele PDF în secțiunea "Documente" și întrebați din nou.

──────────────────────────────────────────────────────────────────

`;
    
    const fullAnswer = `${banner}${answer}`;
    
    return {
      answer: fullAnswer,
      needsClarification: false,
      clarifyingQuestion: null,
      confidence: 60, // Moderate confidence for general knowledge
      answerSource: 'general_knowledge',
    };
    
  } catch (error) {
    console.error('[RAG API] Error generating answer:', error);
    
    // Fallback - provide a helpful message
    return {
      answer: `🟡 ⚠️ RĂSPUNS AI (NU DIN DOCUMENTE)\n\nÎntrebarea dvs. despre "${query}" este înregistrată.\n\nMomentan nu am documente normative încărcate pentru a vă oferi citate exacte.\n\nPentru răspunsuri bazate pe normative (I7/2011, PE 116/1995, etc.), vă rugăm să încărcați documentele PDF în secțiunea "Documente".`,
      needsClarification: false,
      clarifyingQuestion: null,
      confidence: 30,
      answerSource: 'general_knowledge',
    };
  }
}

function formulateClarifyingQuestion(query: string, analysis: string): string {
  const queryLower = query.toLowerCase();
  const queryNormalized = queryLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Check if user already provided context/details
  const hasContext = 
    queryNormalized.includes('casa') || 
    queryNormalized.includes('apartament') || 
    queryNormalized.includes('hala') || 
    queryNormalized.includes('industrial') ||
    queryNormalized.includes('locuinta') ||
    queryNormalized.includes('rezidential') ||
    queryNormalized.includes('cladire') ||
    queryNormalized.includes('noua') || 
    queryNormalized.includes('reabilitare') ||
    queryNormalized.includes('protectie') ||
    queryNormalized.includes('functionare') ||
    queryNormalized.includes('equipotentiala') ||
    queryNormalized.includes('funda') ||
    queryNormalized.includes('vertical') ||
    queryNormalized.includes('orizontal');
  
  // Detect topic
  let topic = '';
  let documents = '';
  let specificInfo = '';
  
  if (queryNormalized.includes('impamantare') || queryNormalized.includes('legare la pamant')) {
    topic = 'împământare';
    documents = 'I7/2011 (cap. 6), PE 116/1995';
    
    // Extract what we understood from context
    if (hasContext) {
      specificInfo = 'Am înțeles că doriți informații despre: ';
      if (queryNormalized.includes('protectie')) specificInfo += '**împământare de protecție** ';
      else if (queryNormalized.includes('functionare')) specificInfo += '**împământare de funcționare** ';
      else if (queryNormalized.includes('equipotentiala')) specificInfo += '**legare equipotențială** ';
      
      if (queryNormalized.includes('casa') || queryNormalized.includes('locuinta') || queryNormalized.includes('rezidential')) specificInfo += 'pentru **o casă rezidențială**';
      else if (queryNormalized.includes('apartament')) specificInfo += 'pentru **un apartament**';
      else if (queryNormalized.includes('hala') || queryNormalized.includes('industrial')) specificInfo += 'pentru **o hală industrială**';
      
      specificInfo += '.\n\n';
    }
  } else if (queryNormalized.includes('ddr') || queryNormalized.includes('dispozitiv diferential')) {
    topic = 'dispozitive diferențiale (DDR)';
    documents = 'I7/2011 (cap. 4.3, 7.2)';
  } else if (queryNormalized.includes('priza') || queryNormalized.includes('prize')) {
    topic = 'circuite de prize';
    documents = 'I7/2011 (cap. 7.2)';
  } else if (queryNormalized.includes('cablu') || queryNormalized.includes('conduct')) {
    topic = 'cabluri și conductoare';
    documents = 'I7/2011 (cap. 5)';
  } else if (queryNormalized.includes('tablou') || queryNormalized.includes('siguranta')) {
    topic = 'tablouri și protecții';
    documents = 'I7/2011 (cap. 7.1)';
  } else if (queryNormalized.includes('protectie') || queryNormalized.includes('protectia')) {
    topic = 'protecții în instalații electrice';
    documents = 'I7/2011 (cap. 4)';
  } else {
    topic = 'instalații electrice';
    documents = 'I7/2011, PE 116/1995';
  }
  
  // If user provided context, acknowledge it and guide to upload documents
  if (hasContext && specificInfo) {
    return `${specificInfo}✅ **Pentru a vă oferi citate exacte din normativ** cu privire la acest subiect, am nevoie de documentul **${documents}** în sistem.

📥 **Ce trebuie să faceți:**
Încărcați documentul PDF/DOC în secțiunea "Documente" și apoi puteți întreba:
• "Ce spune normativul despre ${topic}?"
• "Care sunt cerințele pentru ${topic}?"
• "Ce articole reglementează ${topic}?"

🔍 Voi căuta în text și vă voi oferi răspunsuri bazate **100% pe citate din normativ**.`;
  }
  
  // Default: ask for clarification
  return `**Pentru informații exacte despre ${topic}**, am nevoie de documente normative în sistem.

**📄 Documente recomandate:**
${documents}

❓ **Spuneți-mi mai multe pentru a vă ghida corect:**
• Ce tip de construcție: casă, apartament, hală industrială?
• Despre ce aspect doriți informații: dimensiuni, materiale, metode?
• Context: proiectare nouă sau reabilitare?

💡 **După ce încărcați documentele**, voi extrage citate exacte din normativ și vă voi răspunde precis.`;
}

function generateClarifyingQuestionForVagueQuery(query: string): string {
  const queryLower = query.toLowerCase();
  
  // Very short or unclear queries
  if (query.length < 10) {
    return `Întrebarea "${query}" este prea scurtă pentru a putea oferi un răspuns util.\n\nPuteți oferi mai multe detalii despre:\n• Ce aspect specific vă interesează?\n• În ce context (instalații electrice, construcții, etc.)?\n• Căutați o definiție, o obligație sau o procedură?`;
  }
  
  return `Nu am înțeles complet ce doriți să aflați despre "${query}".\n\nPuteți clarifica:\n• Este vorba despre instalații electrice, construcții sau alt domeniu?\n• Căutați informații despre o obligație legală, o interdicție sau o definiție?\n• Aveți un context specific (ex: proiect, verificare, etc.)?`;
}

function generateClarifyingQuestion(query: string, citations?: any[]): string {
  // Provide helpful guidance instead of asking for clarifications
  if (citations && citations.length > 0) {
    const avgConfidence = Math.round(citations.reduce((s, c) => s + c.confidence, 0) / citations.length);
    const pageNumbers = citations.map((c: any) => c.pageNumber).filter(Boolean);
    
    return `Am gasit informatii partiale (${avgConfidence}% incredere).

📄 **Consultati documentul la:**
${pageNumbers.length > 0 ? `• Paginile: ${pageNumbers.slice(0, 5).join(', ')}` : '• Documentele incarcate'}

💡 **Sau reformulati** intrebarea cu termeni specifici din normativ.`;
  }

  return `Nu am gasit informatii clare pentru: "${query}".

📥 **Solutii:**
• Incarcati documente normative (I7/2011, PE 116/1995, etc.)
• Reformulati cu termeni din normativ
• Verificati daca informatia exista in documentele disponibile`;
}

/**
 * Construiește răspuns pentru grile (întrebări cu variante)
 */
async function buildQuizAnswer(
  quiz: import('@/lib/quiz/quiz-handler').QuizQuestion,
  citations: any[],
  overallConfidence: number
): Promise<string | null> {
  if (citations.length === 0) return null;

  // Sort by score
  citations.sort((a, b) => b.score - a.score);
  
  // Ia primele 5 citări pentru context
  const topCitations = citations.slice(0, 5);
  
  try {
    const openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Construim promptul special pentru grile
    const { systemPrompt, userPrompt } = buildQuizPrompt(quiz, topCitations);

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 800,
      temperature: 0.1, // Mai puțin creativ, mai precis
    });

    const aiResponse = completion.choices[0]?.message?.content?.trim();
    
    if (!aiResponse) {
      return generateQuizFallback(quiz, topCitations);
    }

    // Parsăm răspunsul AI
    const quizResult = parseQuizAnswer(aiResponse, quiz, topCitations);
    
    // Formatează răspunsul pentru afișare
    const formattedResponse = formatQuizResponse(quizResult, quiz);
    
    // Adăugăm sursele
    const sources = Array.from(new Set(topCitations.map((c: any) => `${c.documentName}, pag. ${c.pageNumber}`)));
    return formattedResponse + `\n📚 Surse: ${sources.join('; ')}`;

  } catch (error) {
    console.error('[RAG API] Quiz processing error:', error);
    return generateQuizFallback(quiz, citations);
  }
}

/**
 * Fallback pentru grile când AI-ul eșuează
 */
function generateQuizFallback(
  quiz: import('@/lib/quiz/quiz-handler').QuizQuestion,
  citations: any[]
): string {
  const mainCitation = citations[0];
  
  let formatted = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  formatted += `⚠️ **RĂSPUNS NECERT (Mod Fallback)**\n`;
  formatted += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  formatted += `Nu s-a putut determina cu certitudine răspunsul corect.\n\n`;
  
  formatted += `**Întrebare:** ${quiz.question}\n\n`;
  
  formatted += `**Variante:**\n`;
  for (const opt of quiz.options) {
    formatted += `${opt.letter}) ${opt.text}\n`;
  }
  
  formatted += `\n📖 **Text relevant din normativ:**\n`;
  formatted += `${mainCitation.text.substring(0, 300)}...\n`;
  
  const sources = Array.from(new Set(citations.map((c: any) => `${c.documentName}, pag. ${c.pageNumber}`)));
  formatted += `\n📚 Surse: ${sources.join('; ')}`;
  
  return formatted;
}

function detectIntent(query: string): string {
  const lower = query.toLowerCase();
  if (lower.includes('trebuie') || lower.includes('obligat') || lower.includes('obligatoriu')) return 'obligation';
  if (lower.includes('interzis') || lower.includes('nu este permis')) return 'prohibition';
  if (lower.includes('ce este') || lower.includes('definitie')) return 'definition';
  if (lower.includes('cum se face') || lower.includes('procedura')) return 'procedure';
  
  // Detectăm și grilele
  if (/[A-D][)\.\]]/.test(query) && (query.includes('A)') || query.includes('B)'))) {
    return 'quiz';
  }
  
  return 'general';
}

export const runtime = 'nodejs';
