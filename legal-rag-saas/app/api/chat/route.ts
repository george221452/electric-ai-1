/**
 * Chat API with Intent Tracking
 * Ensures AI always responds to the main subject, not just clarifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { chatMemory } from '@/lib/chat-memory';
import { intentTracker } from '@/lib/intent-tracker';
import { understandQuery, mergeSearchResults, validateResults } from '@/lib/query-understanding';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddings } from '@langchain/openai';
import OpenAI from 'openai';

const WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID || '550e8400-e29b-41d4-a716-446655440000';

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY,
});

const embeddings = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-small',
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Detect if response is asking for clarifications
export async function POST(req: NextRequest) {
  try {
    const { message, sessionId = 'default' } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    // Get conversation context
    const context = chatMemory.getContext(sessionId);
    const isFollowUp = chatMemory.isFollowUp(sessionId, message);
    const isClarification = context.isWaitingForClarification;
    

    
    let searchQuery = message;
    let intentReminder = '';
    let isUniversalConceptFlag = false;
    let universalResponse = '';
    
    // If this is a new question (not a follow-up/clarification)
    if (!isFollowUp && !isClarification) {
      // Extract and store the intent
      intentTracker.setIntent(sessionId, message);
      
      // Note: Don't decide here if we need clarifications
      // Wait until we see the search results first!
    }
    
    // Get current intent (either newly set or from previous context)
    const currentIntent = intentTracker.getIntent(sessionId);
    
    // If this is a clarification or follow-up, update context
    if (isClarification || (isFollowUp && currentIntent)) {
      intentTracker.updateContext(sessionId, message);
      intentReminder = intentTracker.getIntentReminder(sessionId);
    }
    
    // 🧠 QUERY UNDERSTANDING: AI analizează ce vrea userul și generează căutări optimizate
    let searchResults: any[] = [];
    let understoodQuery: any = null;
    let validation: any = null;
    
    // Doar pentru întrebări noi, nu pentru clarificări
    if (!isFollowUp && !isClarification) {
      console.log('[QueryUnderstanding] Analyzing query:', searchQuery);
      understoodQuery = await understandQuery(searchQuery);
      console.log('[QueryUnderstanding] Generated queries:', understoodQuery.searchQueries);
      
      // Caută cu toate variantele generate
      const allResults: any[][] = [];
      for (const queryVariant of understoodQuery.searchQueries.slice(0, 4)) {
        const vector = await embeddings.embedQuery(queryVariant);
        const results = await qdrant.search('legal_paragraphs', {
          vector: vector,
          limit: 3,
          filter: {
            must: [
              { key: 'workspaceId', match: { value: WORKSPACE_ID } }
            ]
          }
        });
        allResults.push(results);
      }
      
      // Combină și elimină duplicatele
      searchResults = mergeSearchResults(allResults);
      
      // Validează rezultatele
      validation = validateResults(searchResults, understoodQuery);
      console.log('[QueryUnderstanding] Validation:', validation);
      
    } else {
      // Pentru follow-up/clarificări, folosește metoda clasică
      const searchQueryForDocs = currentIntent 
        ? currentIntent.originalQuestion
        : searchQuery;
      
      const vector = await embeddings.embedQuery(searchQueryForDocs);
      searchResults = await qdrant.search('legal_paragraphs', {
        vector: vector,
        limit: 5,
        filter: {
          must: [
            { key: 'workspaceId', match: { value: WORKSPACE_ID } }
          ]
        }
      });
    }

    // Format sources
    const sources = searchResults.map(r => ({
      content: (r.payload?.content as string)?.slice(0, 300) || '',
      filename: (r.payload?.filename as string) || 'Necunoscut',
      score: ((r.score || 0) * 100).toFixed(1),
    }));

    // Build prompt
    const contextPrompt = chatMemory.getContextForAI(sessionId);
    const isQuiz = /[ABC][).]?\s/.test(message) || /varianta/i.test(message);

    // Construiește informații despre ce caută userul
    let queryUnderstandingInfo = '';
    if (understoodQuery) {
      queryUnderstandingInfo = `
🎯 ANALIZĂ ÎNTREBARE:
- Concept principal: ${understoodQuery.mainConcept}
- Termeni tehnici: ${understoodQuery.technicalTerms.join(', ') || 'N/A'}
${understoodQuery.expectedValues.length > 0 ? `- Valori căutate: ${understoodQuery.expectedValues.join(', ')}` : ''}
${validation?.missingInfo?.length > 0 ? `⚠️ ATENȚIE: Nu am găsit informații despre ${validation.missingInfo.join(', ')} în documente!` : ''}
`;
    }

    const systemPrompt = `Ești un asistent expert în legislația ANRE și normele tehnice energetice.
${isQuiz ? 'Răspunde la grile cu A, B sau C, bazându-te pe documente.' : 'Oferă răspunsuri detaliate cu citări din documente.'}

${contextPrompt}
${intentReminder}
${queryUnderstandingInfo}

Documente relevante:
${sources.map((s, i) => `[${i + 1}] ${s.filename} (relevanță: ${s.score}%):\n${s.content}...`).join('\n\n')}

${currentIntent ? `
🔴 REGULI STRICTE:
1. SUBIECTUL principal este: ${currentIntent.subject.toUpperCase()}
2. ACȚIUNEA cerută este: ${currentIntent.action}
3. RĂSPUNDE despre ${currentIntent.subject.toUpperCase()}, nu despre detalii secundare!
4. Folosește clarificările doar ca CONTEXT, nu ca subiect principal!
` : ''}

${validation?.missingInfo?.length > 0 ? `
⚠️ IMPORTANT: Documentele disponibile NU conțin informații despre ${validation.missingInfo.join(', ')}. 
Spune clar utilizatorului că nu ai găsit această informație în documentele normative încărcate.
` : ''}

Răspunde la întrebare folosind documentele de mai sus.`;

    // Get AI response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: isClarification && currentIntent 
          ? `Răspunde despre ${currentIntent.action} ${currentIntent.subject}. Context: ${message}` 
          : message 
        },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });

    let response = completion.choices[0]?.message?.content || 'Nu am putut genera un răspuns.';

    // CRITICAL: Verify AI responded to the CORRECT subject
    // CRITICAL: Verify AI responded to the CORRECT subject
    if (currentIntent && (isClarification || isFollowUp)) {
      const lowerResponse = response.toLowerCase();
      const subject = currentIntent.subject.toLowerCase();
      
      // Check if response contains the main subject keywords
      const subjectWords = subject.split(/\s+/).filter(w => w.length > 3);
      console.log(`[SUBJECT_CHECK] subject="${subject}", words=[${subjectWords.join(',')}], responseContains=${subjectWords.filter(w => lowerResponse.includes(w)).join(',')}`);
      const hasCorrectSubject = subjectWords.length === 0 || subjectWords.some(word => 
        lowerResponse.includes(word)
      );
      
      // If subject not found in response, AI likely switched topics
      if (!hasCorrectSubject) {
        console.log(`⚠️ AI switched subjects! Expected: ${subject}, regenerating...`);
        // Force regenerate with stronger prompt
        const forcedCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: systemPrompt + `

⚠️ OBLIGAȚIE CRITICĂ: Răspunde EXCLUSIV despre "${currentIntent.subject}"!
Utilizatorul a oferit clarificări despre context, dar SUBIECTUL principal rămâne "${currentIntent.subject}".
Răspunsul tău TREBUIE să conțină cuvintele "${currentIntent.subject}" sau sinonime.
FOLOSEȘTE clarificările doar pentru a rafina răspunsul despre "${currentIntent.subject}".` 
            },
            { 
              role: 'user', 
              content: `Întrebare principală: ${currentIntent.originalQuestion}
Clarificări oferite: ${message}

RĂSPUNDE EXCLUSIV despre "${currentIntent.subject}"!` 
            },
          ],
          temperature: 0.1,
          max_tokens: 1000,
        });
        response = forcedCompletion.choices[0]?.message?.content || response;
      }
    }

    // AI decided on its own if clarifications are needed - we don't interfere

    // Store in memory
    chatMemory.addUserMessage(sessionId, message);
    chatMemory.addAssistantMessage(sessionId, response, sources.map(s => s.filename));

    // Update subject/topic
    if (!isFollowUp && !isClarification && currentIntent) {
      chatMemory.setSubject(sessionId, currentIntent.subject);
      chatMemory.setLastTopic(sessionId, currentIntent.originalQuestion.slice(0, 100));
    }

    return NextResponse.json({
      response,
      isFollowUp,
      isClarification,
      isAskingForClarifications: false,
      subject: currentIntent?.subject || null,
      action: currentIntent?.action || null,
      context: currentIntent?.context || [],
      sources: sources.slice(0, 3),
    });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Eroare la procesarea mesajului' },
      { status: 500 }
    );
  }
}
