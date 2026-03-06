import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddingService } from '@/src/infrastructure/adapters/embedding/embedding-service';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { queryCache, COMMON_QUESTIONS } from '@/lib/cache/query-cache';
import { extractMeasurementIntent, parseNumericalQuery, findNumericalValues, scoreNumericalMatch } from '@/lib/search/numerical-search';
import { optimizeConfidence, selectOptimalCitations, detectPracticalScenario } from '@/lib/search/confidence-optimizer';

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

    // CHECK CACHE FIRST
    const cached = queryCache.get(query, workspaceId);
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
          message: hasDocuments 
            ? 'Nu există documente indexate în sistem. Răspunsul este oferit pe baza cunoștințelor generale.'
            : 'Sistemul nu are documente încărcate. Răspunsul este oferit pe baza cunoștințelor generale. Pentru răspunsuri bazate pe documente specifice, încărcați documentele dorite.',
        },
      });
    }

    // Generate query embedding
    const queryEmbedding = await embeddingService.embed(query);
    
    // Detect if query is about prohibitions/obligations - need more results
    const queryNormalized = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isProhibitionQuery = queryNormalized.includes('interdicti') || queryNormalized.includes('interzis') || 
                               queryNormalized.includes('obligatii') || queryNormalized.includes('obligatoriu');
    
    // Use more results for prohibition/obligation queries
    const searchLimit = isProhibitionQuery ? 30 : 10;

    // Search in Qdrant (vector search)
    const searchResults = await qdrant.search('legal_paragraphs', {
      vector: queryEmbedding,
      limit: searchLimit,
      with_payload: true,
      score_threshold: MIN_SCORE_THRESHOLD,
      filter: {
        must: [
          { key: 'workspaceId', match: { value: workspaceId } },
        ],
      },
    }) as any[];

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
    const answer = await buildStrictAnswer(query, allResultsForAnswer, finalConfidence);

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

    queryCache.set(query, workspaceId, {
      answer: answer || '',
      citations: responseCitations,
      confidence: finalConfidence,
    });

    console.log(`[RAG API] Response cached. Cache stats:`, queryCache.getStats());

    return NextResponse.json({
      success: true,
      data: {
        answer,
        citations: responseCitations,
        confidence: finalConfidence,
        queryIntent: detectIntent(query),
        resultsCount: citations.length,
        disclaimer: 'Text citat ad-literam din documente. Verificați sursa pentru informații complete.',
        needsClarification: false,
        fromCache: false,
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

    const systemPrompt = `Ești un electrician expert care citește normativul I7/2011 și răspunde la întrebări.

SARCINA TA:
Citește paragrafele furnizate și răspunde direct la întrebare. Extrage informația relevantă și prezint-o clar.

REGULI:
1. Răspunde EXACT la întrebarea pusă
2. Folosește informațiile din paragrafele furnizate
3. Reformulează pentru claritate, dar păstrează sensul tehnic exact
4. Menționează pagina: [pag. X]
5. Dacă informația nu e clară în paragrafe, spune ce știi din ele și menționează că detaliile complete sunt în document

EXEMPLU:
Întrebare: "Ce reprezintă 30mA pentru DDR?"
Paragraf: "...DDR care nu depășește 30 mA pentru prize de utilizare generală..."
Răspuns: "Valoarea de 30 mA reprezintă curentul maxim de defect admis pentru DDR-urile utilizate la prize de uz general. Acest DDR asigură protecția suplimentară pentru prizele cu curent nominal până la 20A [pag. 34]."

Răspunde în română, ca un coleg electrician, clar și direct.`;

    const userPrompt = `Întrebare: "${query}"

PARAGRAFE DIN NORMATIVUL I7/2011:
${context}

Sarcina: 
1. Găsește în paragrafele de mai sus informația care răspunde la întrebare
2. Formulează un răspuns clar și direct
3. Menționează pagina [pag. X] pentru fiecare informație
4. Dacă nu găsești răspunsul complet, prezintă ce informații relevante ai găsit`;

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
}> {
  const queryLower = query.toLowerCase();
  const queryNormalized = queryLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Use AI only to understand the query intent and formulate clarifying questions
  // NEVER provide answers from general knowledge - only guide to documents
  try {
    const openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Ești un asistent care analizează întrebări despre normative tehnice (instalații electrice, I7/2011, PE 116/1995, etc.).

**REGULI STRICTE:**
1. NU oferi răspunsuri tehnice din cunoștințele tale
2. NU "inventa" informații despre normative
3. Analizează doar ce solicită utilizatorul
4. Formulează întrebări de clarificare pentru a înțelege exact ce documente/capitole îi trebuiesc
5. Sugerează ce documente normative ar trebui încărcate

Scopul tău: înțelege ce vrea utilizatorul și ghidează-l să încarce documentele corecte.`,
        },
        {
          role: 'user',
          content: `Analizează această întrebare: "${query}"

Ce solicită utilizatorul? Ce documente normative ar trebui încărcate? Ce întrebări de clarificare sunt necesare?`,
        },
      ],
      max_tokens: 500,
    });
    
    const analysis = completion.choices[0]?.message?.content || '';
    
    // Generate appropriate clarifying question based on the analysis
    const clarifyingQuestion = formulateClarifyingQuestion(query, analysis);
    
    return {
      answer: null,
      needsClarification: true,
      clarifyingQuestion,
      confidence: 0,
    };
    
  } catch (error) {
    console.error('[RAG API] Error analyzing query:', error);
    
    // Fallback - simple clarifying question
    return {
      answer: null,
      needsClarification: true,
      clarifyingQuestion: generateClarifyingQuestionForVagueQuery(query),
      confidence: 0,
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
  const queryLower = query.toLowerCase();
  
  // Generate specific clarifying questions based on the query
  if (queryLower.includes('priza') || queryLower.includes('prize')) {
    return `Nu am găsit informații clare despre "${query}". Puteți specifica:\n• Este vorba despre prize în băi, bucătării sau exterior?\n• Căutați informații despre înălțimea de montaj sau protecție?`;
  }
  
  if (queryLower.includes('ddr') || queryLower.includes('dispozitiv diferential')) {
    return `Am găsit informații parțiale despre DDR. Puteți clarifica:\n• Doriți definiția DDR?\n• Sau caracteristicile tehnice (tip A, AC, curent nominal)?\n• Sau condiții de montaj?`;
  }
  
  if (queryLower.includes('impamantare') || queryLower.includes('legare la pamant')) {
    return `Subiectul împământare este vast. Puteți specifica:\n• Electrozii de pământ (tipuri, dimensiuni)?\n• Conductorii de legare la pământ?\n• Prizele de pământ (dispunere tip A sau B)?`;
  }

  if (queryLower.includes('electrod') || queryLower.includes('electrozi')) {
    return `Despre electrozi am găsit referințe limitate. Puteți clarifica:\n• Electrozi în fundație?\n• Electrozi verticali în sol?\n• Sau electrozi în buclă (dispunere tip B)?`;
  }

  if (citations && citations.length > 0) {
    const avgConfidence = Math.round(citations.reduce((s, c) => s + c.confidence, 0) / citations.length);
    return `Am găsit informații cu ${avgConfidence}% încredere, dar sub pragul de 50% necesar pentru un răspuns sigur.\n\nPuteți reformula întrebarea pentru a fi mai specifică?\n\nSau consultați direct documentul la paginile: ${citations.map((c: any) => c.pageNumber).join(', ')}.`;
  }

  return `Nu am găsit informații suficient de clare în documente pentru: "${query}".\n\nVă sugerez să:\n• Reformulați întrebarea cu termeni mai specifici din normativ\n• Verificați dacă documentele încărcate conțin această informație\n• Încărcați documente suplimentare dacă este necesar`;
}

function detectIntent(query: string): string {
  const lower = query.toLowerCase();
  if (lower.includes('trebuie') || lower.includes('obligat') || lower.includes('obligatoriu')) return 'obligation';
  if (lower.includes('interzis') || lower.includes('nu este permis')) return 'prohibition';
  if (lower.includes('ce este') || lower.includes('definitie')) return 'definition';
  if (lower.includes('cum se face') || lower.includes('procedura')) return 'procedure';
  return 'general';
}

export const runtime = 'nodejs';
