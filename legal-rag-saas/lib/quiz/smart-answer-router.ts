/**
 * Smart Answer Router
 * Routes queries to either Quiz Mode or Normal Mode based on detection
 */

import { SearchResult } from '@/core/value-objects/search-result';
import AdvancedQuizHandler, { AnswerResult } from './advanced-quiz-handler';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RouterConfig {
  minConfidenceQuiz: number;
  minConfidenceNormal: number;
  enableNumericVerification: boolean;
  maxRetries: number;
}

const DEFAULT_CONFIG: RouterConfig = {
  minConfidenceQuiz: 0.75,
  minConfidenceNormal: 0.5,
  enableNumericVerification: true,
  maxRetries: 2
};

export interface SmartAnswer {
  answer: string;
  type: 'quiz' | 'normal';
  confidence: number;
  citations: string[];
  metadata: {
    detectionConfidence: number;
    isNumericMatch?: boolean;
    needsClarification?: boolean;
    clarificationQuestions?: string[];
  };
}

export class SmartAnswerRouter {
  private config: RouterConfig;

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main entry point - analyze query and route to appropriate handler
   */
  async generateAnswer(
    query: string,
    searchResults: SearchResult[] | any[]
  ): Promise<SmartAnswer> {
    // Ensure searchResults is an array
    if (!searchResults || !Array.isArray(searchResults)) {
      searchResults = [];
    }
    
    // Step 1: Detect if this is a quiz question
    const detection = AdvancedQuizHandler.detectQuiz(query);
    
    console.log(`[SmartRouter] Detection: isQuiz=${detection.isQuiz}, confidence=${detection.confidence.toFixed(2)}`);
    
    // Step 2: Route based on detection
    if (detection.isQuiz && detection.options) {
      return this.handleQuizMode(query, detection, searchResults);
    } else {
      return this.handleNormalMode(query, searchResults, detection.confidence);
    }
  }

  /**
   * Handle quiz questions with 100% accuracy goal
   */
  private async handleQuizMode(
    originalQuery: string,
    detection: ReturnType<typeof AdvancedQuizHandler.detectQuiz>,
    searchResults: SearchResult[] | any[]
  ): Promise<SmartAnswer> {
    console.log('[SmartRouter] Using QUIZ mode');
    
    // Ensure searchResults is valid
    if (!searchResults || searchResults.length === 0) {
      return {
        answer: 'N/A (Nu s-au găsit documente relevante)',
        type: 'quiz',
        confidence: 0,
        citations: [],
        metadata: {
          detectionConfidence: detection.confidence,
          isNumericMatch: false
        }
      };
    }
    
    // Step 1: Try numerical verification first (100% accuracy for numeric questions)
    if (this.config.enableNumericVerification && detection.hasNumericalValues) {
      const numericResult = AdvancedQuizHandler.verifyNumericalAnswer(detection, searchResults);
      
      if (numericResult && numericResult.isNumericMatch) {
        console.log(`[SmartRouter] Numeric match found: ${numericResult.answer}`);
        return {
          answer: numericResult.answer!.toUpperCase(),
          type: 'quiz',
          confidence: numericResult.confidence,
          citations: numericResult.citations,
          metadata: {
            detectionConfidence: detection.confidence,
            isNumericMatch: true
          }
        };
      }
    }
    
    // Step 2: Use AI with specialized quiz prompt
    const prompt = AdvancedQuizHandler.buildQuizPrompt(detection, searchResults);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'Ești un expert în normative electrice românești. Răspunde EXACT cu litera corectă (A, B sau C) și oferă citate din normativ.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1, // Very low temperature for consistency
      max_tokens: 500
    });

    const aiResponse = response.choices[0]?.message?.content || '';
    const parsed = AdvancedQuizHandler.parseQuizAnswer(aiResponse);
    
    // Step 3: Verification retry if confidence is low
    let finalAnswer = parsed.answer;
    let finalConfidence = parsed.confidence;
    
    if (finalConfidence < 70 && this.config.maxRetries > 0) {
      console.log('[SmartRouter] Low confidence, retrying with stricter prompt...');
      
      const retryPrompt = this.buildStrictVerificationPrompt(detection, searchResults, aiResponse);
      
      const retryResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Verifică răspunsul anterior. Confirmă sau corectează cu argumente din normativ.' 
          },
          { role: 'user', content: retryPrompt }
        ],
        temperature: 0.0,
        max_tokens: 300
      });
      
      const retryParsed = AdvancedQuizHandler.parseQuizAnswer(retryResponse.choices[0]?.message?.content || '');
      
      if (retryParsed.confidence > finalConfidence) {
        finalAnswer = retryParsed.answer;
        finalConfidence = retryParsed.confidence;
      }
    }
    
    // Step 4: Fallback if still no answer
    if (!finalAnswer) {
      console.log('[SmartRouter] No answer found, using fallback analysis');
      finalAnswer = this.fallbackQuizAnalysis(detection, searchResults);
      finalConfidence = 40;
    }
    
    return {
      answer: (finalAnswer || 'N/A').toUpperCase(),
      type: 'quiz',
      confidence: finalConfidence,
      citations: searchResults.slice(0, 3).map(r => r.content.substring(0, 200)),
      metadata: {
        detectionConfidence: detection.confidence,
        isNumericMatch: false
      }
    };
  }

  /**
   * Handle normal questions with detailed answers
   */
  private async handleNormalMode(
    query: string,
    searchResults: SearchResult[] | any[],
    detectionConfidence: number
  ): Promise<SmartAnswer> {
    console.log('[SmartRouter] Using NORMAL mode');
    
    // Ensure searchResults is valid
    if (!searchResults) {
      searchResults = [];
    }
    
    // Check if we need clarification
    const needsClarification = AdvancedQuizHandler.needsClarification(query, searchResults);
    
    if (needsClarification) {
      const clarificationQuestions = AdvancedQuizHandler.generateClarificationQuestions(query);
      
      return {
        answer: `Pentru a vă oferi un răspuns precis, am nevoie de câteva clarificări:\n\n${clarificationQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
        type: 'normal',
        confidence: 30,
        citations: [],
        metadata: {
          detectionConfidence,
          needsClarification: true,
          clarificationQuestions
        }
      };
    }
    
    // Generate detailed answer
    const prompt = AdvancedQuizHandler.buildNormalPrompt(query, searchResults);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'Ești un expert în normative electrice românești. Oferă răspunsuri detaliate, cu citate din normativ.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const answer = response.choices[0]?.message?.content || 'Nu am putut genera un răspuns.';
    
    // Calculate confidence based on search results quality
    const confidence = searchResults.length > 0 
      ? Math.min(Math.round(searchResults[0].score * 100), 95)
      : 30;
    
    return {
      answer,
      type: 'normal',
      confidence,
      citations: searchResults.slice(0, 3).map(r => r.content.substring(0, 300)),
      metadata: {
        detectionConfidence,
        needsClarification: false
      }
    };
  }

  /**
   * Build strict verification prompt for retry
   */
  private buildStrictVerificationPrompt(
    detection: ReturnType<typeof AdvancedQuizHandler.detectQuiz>,
    searchResults: SearchResult[],
    previousResponse: string
  ): string {
    return `Analizează din nou răspunsul anterior și confirmă sau corectează.

Răspuns anterior: ${previousResponse}

Context din normativ:
${searchResults.slice(0, 2).map(r => r.content.substring(0, 300)).join('\n')}

Reguli:
1. Verifică dacă valorile numerice din variantă apar în text
2. Respinge varianta care contrazice normativul
3. Confirmă varianta care are suport textual direct

Răspunde cu: RĂSPUNS: [a/b/c] + JUSTIFICARE scurtă`;
  }

  /**
   * Fallback analysis when AI fails to give clear answer
   */
  private fallbackQuizAnalysis(
    detection: ReturnType<typeof AdvancedQuizHandler.detectQuiz>,
    searchResults: SearchResult[]
  ): 'a' | 'b' | 'c' | null {
    if (!detection.options) return null;
    
    const sourceText = searchResults.map(r => r.content.toLowerCase()).join(' ');
    const scores = { a: 0, b: 0, c: 0 };
    
    // Score each option by keyword matching
    for (const [key, text] of Object.entries(detection.options)) {
      const option = key as 'a' | 'b' | 'c';
      const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      
      for (const word of words) {
        if (sourceText.includes(word)) {
          scores[option] += 1;
        }
      }
    }
    
    // Return option with highest score
    const entries = Object.entries(scores) as [('a' | 'b' | 'c'), number][];
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    
    if (sorted[0][1] > 0) {
      return sorted[0][0];
    }
    
    return null;
  }

  /**
   * Batch process multiple questions
   */
  async batchProcess(
    queries: Array<{ id: string; query: string }>,
    searchFn: (query: string) => Promise<SearchResult[]>
  ): Promise<Array<{ id: string; result: SmartAnswer }>> {
    const results: Array<{ id: string; result: SmartAnswer }> = [];
    
    for (const { id, query } of queries) {
      try {
        const searchResults = await searchFn(query);
        const result = await this.generateAnswer(query, searchResults);
        results.push({ id, result });
      } catch (error) {
        console.error(`[SmartRouter] Error processing query ${id}:`, error);
        results.push({
          id,
          result: {
            answer: 'Eroare la procesare',
            type: 'normal',
            confidence: 0,
            citations: [],
            metadata: { detectionConfidence: 0 }
          }
        });
      }
    }
    
    return results;
  }
}

export default SmartAnswerRouter;
