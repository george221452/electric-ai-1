/**
 * Advanced Quiz Handler - Dual Mode System
 * Handles both quiz questions (A/B/C) and normal questions with detailed answers
 */

import { SearchResult } from '@/core/value-objects/search-result';

interface QuizDetectionResult {
  isQuiz: boolean;
  confidence: number;
  options: {
    a: string;
    b: string;
    c: string;
  } | null;
  questionText: string;
  hasNumericalValues: boolean;
  numericalValues: Array<{
    value: string;
    unit: string;
    option: 'a' | 'b' | 'c';
  }>;
}

interface QuizAnswerResult {
  answer: 'a' | 'b' | 'c' | null;
  confidence: number;
  reasoning: string;
  citations: string[];
  isNumericMatch: boolean;
  numericVerification?: {
    expectedValue: string;
    foundInText: boolean;
    matchingOption: 'a' | 'b' | 'c' | null;
  };
}

interface NormalAnswerResult {
  answer: string;
  needsClarification: boolean;
  clarificationQuestions?: string[];
  citations: string[];
  confidence: number;
}

export type AnswerResult = 
  | { type: 'quiz'; result: QuizAnswerResult }
  | { type: 'normal'; result: NormalAnswerResult };

export class AdvancedQuizHandler {
  /**
   * Detect if the query is a quiz question with high accuracy
   */
  static detectQuiz(query: string): QuizDetectionResult {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Pattern 1: Explicit variant markers (a), b), c) or a., b., c.)
    const variantPattern1 = /\n\s*[abc][).]\s*.+/gi;
    const variantPattern2 = /\n\s*varianta?\s*[abc][).:]\s*.+/gi;
    
    // Pattern 2: Romanian specific patterns
    const roVariantPattern = /\n\s*(?:varianta?|var\.)?\s*[abc][).:]?\s*.+/gi;
    
    // Pattern 3: Check for all three options
    const hasOptionA = /\n\s*(?:a[).]|varianta?\s*a[).:])/i.test(query);
    const hasOptionB = /\n\s*(?:b[).]|varianta?\s*b[).:])/i.test(query);
    const hasOptionC = /\n\s*(?:c[).]|varianta?\s*c[).:])/i.test(query);
    
    // Extract options
    const options = this.extractOptions(query);
    
    // Check for numerical values in options (e.g., "35 A/mm²", "10 mm²")
    const numericalValues = this.extractNumericalValues(query, options);
    
    // Calculate confidence
    let confidence = 0;
    if (hasOptionA) confidence += 0.25;
    if (hasOptionB) confidence += 0.25;
    if (hasOptionC) confidence += 0.25;
    if (options !== null) confidence += 0.25;
    
    // Additional checks for quiz-specific keywords
    const quizKeywords = [
      'care dintre', 'care din', 'alegeți', 'selectați', 'răspunsul corect',
      'varianta corectă', 'este:', 'sunt:', 'reprezintă:'
    ];
    
    for (const keyword of quizKeywords) {
      if (normalizedQuery.includes(keyword)) {
        confidence = Math.min(confidence + 0.1, 1.0);
        break;
      }
    }
    
    // Check if it looks like a question ending with ? or:
    const endsWithQuestion = /[?:]\s*$/.test(query.trim());
    if (endsWithQuestion && confidence > 0.5) {
      confidence = Math.min(confidence + 0.1, 1.0);
    }
    
    // Determine if it's a quiz (high threshold for accuracy)
    const isQuiz = confidence >= 0.75 && hasOptionA && hasOptionB && hasOptionC;
    
    // Extract clean question text (without options)
    const questionText = this.extractQuestionText(query, options);
    
    return {
      isQuiz,
      confidence,
      options,
      questionText,
      hasNumericalValues: numericalValues.length > 0,
      numericalValues
    };
  }

  /**
   * Extract options A, B, C from the query
   */
  private static extractOptions(query: string): { a: string; b: string; c: string } | null {
    const lines = query.split('\n');
    let optionA = '';
    let optionB = '';
    let optionC = '';
    
    let currentOption: 'a' | 'b' | 'c' | null = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check for option A start
      if (/^(?:a[).]|varianta?\s*a[).:])/i.test(trimmed)) {
        currentOption = 'a';
        optionA = trimmed.replace(/^(?:a[).]|varianta?\s*a[).:])\s*/i, '');
      }
      // Check for option B start
      else if (/^(?:b[).]|varianta?\s*b[).:])/i.test(trimmed)) {
        currentOption = 'b';
        optionB = trimmed.replace(/^(?:b[).]|varianta?\s*b[).:])\s*/i, '');
      }
      // Check for option C start
      else if (/^(?:c[).]|varianta?\s*c[).:])/i.test(trimmed)) {
        currentOption = 'c';
        optionC = trimmed.replace(/^(?:c[).]|varianta?\s*c[).:])\s*/i, '');
      }
      // Continue previous option
      else if (currentOption && trimmed) {
        if (currentOption === 'a') optionA += ' ' + trimmed;
        else if (currentOption === 'b') optionB += ' ' + trimmed;
        else if (currentOption === 'c') optionC += ' ' + trimmed;
      }
    }
    
    if (optionA && optionB && optionC) {
      return { a: optionA.trim(), b: optionB.trim(), c: optionC.trim() };
    }
    
    return null;
  }

  /**
   * Extract question text without options
   */
  private static extractQuestionText(query: string, options: { a: string; b: string; c: string } | null): string {
    if (!options) return query.trim();
    
    let text = query;
    
    // Remove each option
    text = text.replace(new RegExp(`\\n\\s*(?:a[).]|varianta?\\s*a[).:])\\s*${this.escapeRegExp(options.a)}`, 'i'), '');
    text = text.replace(new RegExp(`\\n\\s*(?:b[).]|varianta?\\s*b[).:])\\s*${this.escapeRegExp(options.b)}`, 'i'), '');
    text = text.replace(new RegExp(`\\n\\s*(?:c[).]|varianta?\\s*c[).:])\\s*${this.escapeRegExp(options.c)}`, 'i'), '');
    
    return text.trim();
  }

  /**
   * Extract numerical values with units from options
   */
  private static extractNumericalValues(
    query: string, 
    options: { a: string; b: string; c: string } | null
  ): Array<{ value: string; unit: string; option: 'a' | 'b' | 'c' }> {
    const values: Array<{ value: string; unit: string; option: 'a' | 'b' | 'c' }> = [];
    
    if (!options) return values;
    
    // Pattern for numerical values with units
    const patterns = [
      { regex: /(\d+(?:[.,]\d+)?)\s*(mm[²2]|mm\^2)/gi, unit: 'mm²' },
      { regex: /(\d+(?:[.,]\d+)?)\s*(A\s*\/\s*mm[²2]|A\/mm\^2)/gi, unit: 'A/mm²' },
      { regex: /(\d+(?:[.,]\d+)?)\s*(kVA|kva)/gi, unit: 'kVA' },
      { regex: /(\d+(?:[.,]\d+)?)\s*(kV|kv)/gi, unit: 'kV' },
      { regex: /(\d+(?:[.,]\d+)?)\s*(V|v)(?![a-z])/gi, unit: 'V' },
      { regex: /(\d+(?:[.,]\d+)?)\s*(A|a)(?![a-z])/gi, unit: 'A' },
      { regex: /(\d+(?:[.,]\d+)?)\s*(Ω|ohmi?)/gi, unit: 'Ω' },
      { regex: /(\d+(?:[.,]\d+)?)\s*(s|sec)/gi, unit: 's' },
      { regex: /(\d+(?:[.,]\d+)?)\s*(m|metri?)(?![a-z²2])/gi, unit: 'm' },
    ];
    
    for (const [key, text] of Object.entries(options)) {
      const option = key as 'a' | 'b' | 'c';
      
      for (const { regex, unit } of patterns) {
        const matches = text.matchAll(regex);
        for (const match of Array.from(matches)) {
          values.push({
            value: match[1].replace(',', '.'),
            unit,
            option
          });
        }
      }
    }
    
    return values;
  }

  /**
   * Verify numerical answer against source text
   */
  static verifyNumericalAnswer(
    quiz: QuizDetectionResult,
    searchResults: SearchResult[] | any[]
  ): QuizAnswerResult | null {
    if (!quiz.hasNumericalValues || !quiz.options) return null;
    if (!searchResults || searchResults.length === 0) return null;
    
    const sourceText = searchResults.map(r => r.content || r.text || '').join(' ');
    const sourceLower = sourceText.toLowerCase();
    
    for (const numVal of quiz.numericalValues) {
      // Try different formats
      const valueFormats = [
        numVal.value,
        numVal.value.replace('.', ','),
        parseFloat(numVal.value).toString(),
        Math.round(parseFloat(numVal.value)).toString()
      ];
      
      const unitPatterns = this.getUnitPatterns(numVal.unit);
      
      for (const format of valueFormats) {
        for (const pattern of unitPatterns) {
          const regex = new RegExp(pattern.replace('{{VALUE}}', format.replace('.', '\\.?')), 'i');
          if (regex.test(sourceLower)) {
            return {
              answer: numVal.option,
              confidence: 95,
              reasoning: `Valoarea numerică ${numVal.value} ${numVal.unit} găsită în textul sursă`,
              citations: searchResults.slice(0, 2).map(r => r.content.substring(0, 150)),
              isNumericMatch: true,
              numericVerification: {
                expectedValue: `${numVal.value} ${numVal.unit}`,
                foundInText: true,
                matchingOption: numVal.option
              }
            };
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Get regex patterns for different units
   */
  private static getUnitPatterns(unit: string): string[] {
    const patterns: Record<string, string[]> = {
      'mm²': ['{{VALUE}}\\s*mm[²2^]', '{{VALUE}}\\s*mm\\s*sup', '{{VALUE}}\\s*mm\^2'],
      'A/mm²': ['{{VALUE}}\\s*A\\s*/\\s*mm[²2^]', '{{VALUE}}\\s*A/mm'],
      'kVA': ['{{VALUE}}\\s*kVA', '{{VALUE}}\\s*kva'],
      'kV': ['{{VALUE}}\\s*kV', '{{VALUE}}\\s*kv'],
      'V': ['{{VALUE}}\\s*V(?!\\w)', '{{VALUE}}\\s*v(?!\\w)'],
      'A': ['{{VALUE}}\\s*A(?!\\w)', '{{VALUE}}\\s*a(?!\\w)'],
      'Ω': ['{{VALUE}}\\s*[ΩΩ]', '{{VALUE}}\\s*ohmi?', '{{VALUE}}\\s*ohms?'],
      's': ['{{VALUE}}\\s*s(?!\\w)', '{{VALUE}}\\s*sec'],
      'm': ['{{VALUE}}\\s*m(?!\\w)', '{{VALUE}}\\s*metri?']
    };
    
    return patterns[unit] || [`{{VALUE}}\\s*${unit}`];
  }

  /**
   * Build specialized prompt for quiz questions
   */
  static buildQuizPrompt(quiz: QuizDetectionResult, searchResults: SearchResult[] | any[]): string {
    if (!quiz.options) throw new Error('Quiz options not detected');
    if (!searchResults || searchResults.length === 0) throw new Error('No search results');
    
    const context = searchResults.map((r, i) => {
      const text = r.content || r.text || '';
      return `[${i + 1}] ${text.substring(0, 300)}...`;
    }).join('\n\n');
    
    return `Ești un expert în normative electrice românești (I7/2011, NTE, etc.).

ÎNTREBARE CU VARIANTE DE RĂSPUNS:
${quiz.questionText}

VARIANTE:
a) ${quiz.options.a}
b) ${quiz.options.b}
c) ${quiz.options.c}

CONTEX DIN NORMATIVE:
${context}

INSTRUCȚIUNI STRICTE:
1. Analizează fiecare variantă comparativ cu textul din normative
2. CAUTĂ VALORI NUMERICE exacte în text (mm², A, V, kVA, Ω, s, m)
3. Respinge varianta dacă:
   - Folosește "numai" dar normativul nu specifică exclusivitate
   - Contrazice explicit textul din normativ
   - Conține o valoare numerică diferită de cea din normativ
4. Selectează varianta care:
   - Corespunde EXACT cu prevederile normativului
   - Conține valorile numerice corecte (dacă există)
   - Folosește terminologia exactă din normativ

RĂSPUNSUL TĂU TREBUIE SĂ FIE ÎN FORMATUL EXACT:
RĂSPUNS: [a/b/c]
JUSTIFICARE: [2-3 propoziții cu citate din normativ]
CONFIDENȚĂ: [%]`;
  }

  /**
   * Parse AI response for quiz answer
   */
  static parseQuizAnswer(response: string): { answer: 'a' | 'b' | 'c' | null; confidence: number } {
    const normalized = response.toLowerCase();
    
    // Look for explicit answer pattern
    const answerMatch = normalized.match(/răspuns:\s*([abc])/i);
    if (answerMatch) {
      const answer = answerMatch[1] as 'a' | 'b' | 'c';
      
      // Extract confidence
      const confidenceMatch = normalized.match(/confidență:\s*(\d+)/i);
      const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 70;
      
      return { answer, confidence };
    }
    
    // Fallback patterns
    const patterns = [
      /(?:răspuns\s*(?:corect|final)?[\s:)*]+)?([abc])\s*[).]/i,
      /variant[aă]\s*([abc])/i,
      /opțiunea\s*([abc])/i,
      /([abc])\s*(?:este\s*)?(?:răspunsul\s*)?(?:corect)/i,
    ];
    
    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match) {
        return { answer: match[1] as 'a' | 'b' | 'c', confidence: 60 };
      }
    }
    
    return { answer: null, confidence: 0 };
  }

  /**
   * Build prompt for normal questions
   */
  static buildNormalPrompt(query: string, searchResults: SearchResult[] | any[]): string {
    const context = searchResults.map((r, i) => {
      const text = r.content || r.text || '';
      return `[${i + 1}] ${text.substring(0, 400)}...`;
    }).join('\n\n');
    
    return `Ești un expert în normative electrice românești.

ÎNTREBARE:
${query}

CONTEX DIN NORMATIVE:
${context}

INSTRUCȚIUNI:
1. Răspunde clar și comprehensiv
2. Folosește citate exacte din normative
3. Dacă informația este incompletă, spune explicit ce lipsește
4. Oferă recomandări concrete bazate pe textul normativ
5. Dacă este necesar, solicită clarificări suplimentare

RĂSPUNS:`;
  }

  /**
   * Check if answer needs clarification
   * MODIFIED: Always return false to avoid annoying clarification questions
   * Let the system answer with available information
   */
  static needsClarification(query: string, searchResults: SearchResult[] | any[]): boolean {
    // Only ask for clarification if absolutely no results found
    return searchResults.length === 0;
  }

  /**
   * Generate clarification questions
   * MODIFIED: Return empty array - no more annoying questions
   */
  static generateClarificationQuestions(query: string): string[] {
    // Return empty - let the system try to answer with available info
    return [];
  }

  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export default AdvancedQuizHandler;
