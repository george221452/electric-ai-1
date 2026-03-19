/**
 * Enhanced Smart Router v2.0
 * Router îmbunătățit cu multiple verificări pentru acuratețe >80%
 */

import OpenAI from 'openai';
import EnhancedQuizHandler from './enhanced-quiz-handler';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RouterConfig {
  enableNumericVerification: boolean;
  enableKeywordScoring: boolean;
  enableRestrictionCheck: boolean;
  minNumericConfidence: number;
  minKeywordConfidence: number;
  maxRetries: number;
}

const DEFAULT_CONFIG: RouterConfig = {
  enableNumericVerification: true,
  enableKeywordScoring: true,
  enableRestrictionCheck: true,
  minNumericConfidence: 95,
  minKeywordConfidence: 75,
  maxRetries: 2
};

export interface SmartAnswer {
  answer: string;
  type: 'quiz' | 'normal';
  confidence: number;
  method: 'numeric' | 'keyword' | 'ai' | 'fallback';
  citations: string[];
  metadata: {
    detectionConfidence: number;
    verificationSteps: string[];
  };
}

export class EnhancedSmartRouter {
  private config: RouterConfig;

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Entry point principal
   */
  async generateAnswer(
    query: string,
    searchResults: any[]
  ): Promise<SmartAnswer> {
    // Pas 1: Detectează dacă e grilă
    const detection = this.detectQuiz(query);
    
    if (detection.isQuiz) {
      return this.handleQuiz(query, searchResults);
    } else {
      return this.handleNormal(query, searchResults);
    }
  }

  /**
   * Detectează tipul întrebării
   */
  private detectQuiz(query: string): { isQuiz: boolean; confidence: number } {
    const hasA = /\n\s*a[).]/i.test(query);
    const hasB = /\n\s*b[).]/i.test(query);
    const hasC = /\n\s*c[).]/i.test(query);
    
    const confidence = (hasA ? 0.33 : 0) + (hasB ? 0.33 : 0) + (hasC ? 0.34 : 0);
    
    return { isQuiz: confidence >= 0.9, confidence };
  }

  /**
   * Handler pentru grile cu multiple verificări
   */
  private async handleQuiz(query: string, searchResults: any[]): Promise<SmartAnswer> {
    console.log('[EnhancedRouter] Handling QUIZ question');
    
    const verificationSteps: string[] = [];
    
    // Pas 1: Parsează opțiunile
    const options = EnhancedQuizHandler.parseOptions(query);
    console.log(`[EnhancedRouter] Parsed ${options.length} options`);
    
    if (options.length === 0) {
      return this.fallbackResponse('Could not parse options');
    }

    // Pas 2: Verificare numerică ÎMBUNĂTĂȚITĂ (cu context)
    if (this.config.enableNumericVerification) {
      const numericResult = EnhancedQuizHandler.verifyNumericalWithContext(options, searchResults);
      
      if (numericResult && numericResult.confidence >= this.config.minNumericConfidence) {
        console.log(`[EnhancedRouter] ✅ NUMERIC MATCH: ${numericResult.answer?.toUpperCase()}`);
        verificationSteps.push(`numeric:${numericResult.answer}`);
        
        return {
          answer: numericResult.answer!.toUpperCase(),
          type: 'quiz',
          confidence: numericResult.confidence,
          method: 'numeric',
          citations: numericResult.citations,
          metadata: {
            detectionConfidence: 1,
            verificationSteps
          }
        };
      }
    }
    
    // Pas 3: Keyword scoring
    if (this.config.enableKeywordScoring) {
      const keywordResult = EnhancedQuizHandler.keywordScoring(options, searchResults);
      
      if (keywordResult && keywordResult.confidence >= this.config.minKeywordConfidence) {
        console.log(`[EnhancedRouter] ✅ KEYWORD MATCH: ${keywordResult.answer?.toUpperCase()}`);
        verificationSteps.push(`keyword:${keywordResult.answer}`);
        
        return {
          answer: keywordResult.answer!.toUpperCase(),
          type: 'quiz',
          confidence: keywordResult.confidence,
          method: 'keyword',
          citations: keywordResult.citations,
          metadata: {
            detectionConfidence: 1,
            verificationSteps
          }
        };
      }
    }
    
    // Pas 4: AI cu prompt îmbunătățit
    console.log('[EnhancedRouter] Using AI analysis...');
    const aiResult = await this.callAIForQuiz(query, options, searchResults);
    verificationSteps.push(`ai:${aiResult.answer}`);
    
    return {
      answer: (aiResult.answer || 'N/A').toUpperCase(),
      type: 'quiz',
      confidence: aiResult.confidence,
      method: 'ai',
      citations: searchResults.slice(0, 2).map(r => (r.content || r.text || '').substring(0, 200)),
      metadata: {
        detectionConfidence: 1,
        verificationSteps
      }
    };
  }

  /**
   * Call AI with enhanced prompt
   */
  private async callAIForQuiz(
    query: string,
    options: any[],
    searchResults: any[]
  ): Promise<{ answer: 'a' | 'b' | 'c' | null; confidence: number }> {
    
    const { system, user } = EnhancedQuizHandler.buildEnhancedPrompt(query, options, searchResults);
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.05, // Foarte strict
        max_tokens: 600
      });
      
      const aiResponse = response.choices[0]?.message?.content || '';
      const parsed = EnhancedQuizHandler.parseEnhancedAnswer(aiResponse);
      
      // Retry dacă confidence e scăzut
      if (parsed.confidence < 70 && this.config.maxRetries > 0) {
        console.log('[EnhancedRouter] Low confidence, retrying...');
        
        const retryPrompt = `${user}\n\n⚠️ Analizează din mai atent. Verifică valorile numerice și restricțiile "numai". Fii 100% sigur înainte să răspunzi.`;
        
        const retryResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: system + '\n\nREZOLVĂ ORICE NEOBIETATE. FII 100% PRECIS.' },
            { role: 'user', content: retryPrompt }
          ],
          temperature: 0.0,
          max_tokens: 400
        });
        
        const retryParsed = EnhancedQuizHandler.parseEnhancedAnswer(
          retryResponse.choices[0]?.message?.content || ''
        );
        
        if (retryParsed.confidence > parsed.confidence) {
          return retryParsed;
        }
      }
      
      return parsed;
      
    } catch (error) {
      console.error('[EnhancedRouter] AI error:', error);
      return { answer: null, confidence: 0 };
    }
  }

  /**
   * Handler pentru întrebări normale
   */
  private async handleNormal(query: string, searchResults: any[]): Promise<SmartAnswer> {
    console.log('[EnhancedRouter] Handling NORMAL question');
    
    if (!searchResults || searchResults.length === 0) {
      return {
        answer: 'Nu am găsit informații suficiente în documentele disponibile. Vă recomand să încărcați documente normative relevante (I7/2011, PE 116/1995, etc.).',
        type: 'normal',
        confidence: 0,
        method: 'fallback',
        citations: [],
        metadata: {
          detectionConfidence: 0,
          verificationSteps: ['no_results']
        }
      };
    }
    
    const context = searchResults.slice(0, 4).map((r, i) => {
      const text = r.content || r.text || '';
      return `[${i + 1}] ${text.substring(0, 500)}`;
    }).join('\n\n');
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Ești un expert în normative electrice românești. Oferă răspunsuri clare, detaliate, cu citate din normativ. Menționează paginile [pag. X].'
          },
          {
            role: 'user',
            content: `Întrebare: ${query}\n\nContext din normative:\n${context}\n\nRăspunde detaliat cu citate din normativ.`
          }
        ],
        temperature: 0.3,
        max_tokens: 800
      });
      
      const answer = response.choices[0]?.message?.content || '';
      const confidence = searchResults[0]?.score 
        ? Math.round(searchResults[0].score * 100)
        : 50;
      
      return {
        answer,
        type: 'normal',
        confidence,
        method: 'ai',
        citations: searchResults.slice(0, 3).map(r => (r.content || r.text || '').substring(0, 300)),
        metadata: {
          detectionConfidence: 0,
          verificationSteps: ['normal_mode']
        }
      };
      
    } catch (error) {
      console.error('[EnhancedRouter] Normal mode error:', error);
      return this.fallbackResponse('AI processing error');
    }
  }

  /**
   * Fallback response
   */
  private fallbackResponse(reason: string): SmartAnswer {
    return {
      answer: 'N/A',
      type: 'quiz',
      confidence: 0,
      method: 'fallback',
      citations: [],
      metadata: {
        detectionConfidence: 0,
        verificationSteps: [`fallback:${reason}`]
      }
    };
  }
}

export default EnhancedSmartRouter;
