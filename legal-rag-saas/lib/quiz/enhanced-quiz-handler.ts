/**
 * Enhanced Quiz Handler v2.0
 * Îmbunătățiri pentru acuratețe >80%
 */

import { SearchResult } from '@/core/value-objects/search-result';

interface EnhancedQuizResult {
  answer: 'a' | 'b' | 'c' | null;
  confidence: number;
  method: 'numeric' | 'keyword' | 'context' | 'ai' | 'fallback';
  reasoning: string;
  citations: string[];
}

interface QuizOption {
  letter: 'a' | 'b' | 'c';
  text: string;
  keywords: string[];
  numericalValues: Array<{ value: string; unit: string }>;
  hasRestriction: boolean; // "numai", "doar", "exclusiv"
}

export class EnhancedQuizHandler {
  
  /**
   * Parsează opțiunile cu analiză profundă
   */
  static parseOptions(query: string): QuizOption[] {
    const lines = query.split('\n');
    const options: QuizOption[] = [];
    let currentOption: QuizOption | null = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Detectează început de opțiune
      const matchA = /^(?:a[).]|varianta?\s*a[).:])/i.test(trimmed);
      const matchB = /^(?:b[).]|varianta?\s*b[).:])/i.test(trimmed);
      const matchC = /^(?:c[).]|varianta?\s*c[).:])/i.test(trimmed);
      
      if (matchA || matchB || matchC) {
        if (currentOption) options.push(currentOption);
        
        const letter = matchA ? 'a' : matchB ? 'b' : 'c';
        const text = trimmed.replace(/^(?:[abc][).]|varianta?\s*[abc][).:])\s*/i, '');
        
        currentOption = {
          letter,
          text,
          keywords: this.extractKeywords(text),
          numericalValues: this.extractNumericalValues(text),
          hasRestriction: this.hasRestriction(text)
        };
      } else if (currentOption && trimmed) {
        currentOption.text += ' ' + trimmed;
        currentOption.keywords = [...currentOption.keywords, ...this.extractKeywords(trimmed)];
        currentOption.numericalValues = [...currentOption.numericalValues, ...this.extractNumericalValues(trimmed)];
      }
    }
    
    if (currentOption) options.push(currentOption);
    return options;
  }

  /**
   * Extrage cuvinte cheie relevante - ÎMBUNĂTĂȚIT
   */
  private static extractKeywords(text: string): string[] {
    const keywords: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Categorii de termeni tehnici pentru matching flexibil (fără diacritice)
    const normalizedText = lowerText.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    const keywordCategories = [
      // Zone și spații
      { terms: ['zona protectie', 'zona siguranta', 'protectie', 'siguranta'], category: 'zone' },
      { terms: ['post transformare', 'post de transformare', 'pt ', 'statie'], category: 'pt' },
      { terms: ['linie electrica', 'lea', 'linie aeriana', 'conductoare', 'conductor'], category: 'lea' },
      
      // Măsurători și protecții
      { terms: ['rezistenta izolatie', 'rezistenta de izolatie', 'megaohm', 'mohm', 'mω'], category: 'izolatie' },
      { terms: ['impamantare', 'legare la pamant', 'priza de pamant', 'electrod'], category: 'impamantare' },
      { terms: ['paratrasnet', 'trasnet', 'descarcare atmosferica'], category: 'paratrasnet' },
      { terms: ['supratensiune', 'protectie supratensiune', 'descarcator'], category: 'supratensiune' },
      { terms: ['ddr', 'dispozitiv diferential', 'protectie diferentiala', '30ma', '30 ma'], category: 'ddr' },
      { terms: ['curent de scurtcircuit', 'scurtcircuit', 'ik', 'current de defect'], category: 'scurtcircuit' },
      
      // Componente
      { terms: ['conductor', 'cabluri', 'conductoare', 'faza', 'nul'], category: 'conductoare' },
      { terms: ['tablou', 'tablou electric', 'tablou distributie'], category: 'tablou' },
      { terms: ['siguranta', 'siguranta automata', 'disjunctor', 'intrerupator'], category: 'siguranta' },
      { terms: ['priza', 'prize', 'circuit priza'], category: 'priza' },
      
      // Materiale și dimensiuni
      { terms: ['cupru', 'aluminiu', 'al-ol', 'cupal', 'sectiune'], category: 'material' },
      { terms: ['mm2', 'mm²', 'diametru', 'latime', 'lungime'], category: 'sectiune' },
      { terms: ['distanta', 'inaltime', 'adancime', 'verticala', 'orizontala'], category: 'dimensiuni' },
      
      // Instalații
      { terms: ['instalatie interioara', 'instalatie electrica', 'circuite'], category: 'instalatie' },
      { terms: ['iluminat', 'corp de iluminat', 'lampa', 'temperatura'], category: 'iluminat' },
      { terms: ['incendiu', 'foc', 'praf', 'fibre'], category: 'incendiu' },
      
      // Construcții
      { terms: ['funda', 'fundatie', 'beton', 'armatura'], category: 'funda' },
      { terms: ['vertical', 'orizontal', 'inclinat'], category: 'orientare' },
      { terms: ['izolator', 'izolatoare', 'tija', 'capa'], category: 'izolator' },
      
      // Acțiuni și concepte
      { terms: ['limitare', 'accident', 'terti', 'persoane'], category: 'protectie' },
      { terms: ['vecinatate', 'pericol', 'exploatare', 'functionare'], category: 'siguranta' },
      { terms: ['circulatie', 'acces', 'securitate', 'interzis'], category: 'acces' },
    ];
    
    for (const category of keywordCategories) {
      for (const term of category.terms) {
        if (normalizedText.includes(term)) {
          keywords.push(category.category + ':' + term);
        }
      }
    }
    
    // Extrage și cuvinte individuale semnificative (min 5 litere)
    const words = normalizedText.split(/\s+/).filter(w => w.length >= 5 && /^[a-z]+$/.test(w));
    
    const significantWords = ['protectie', 'siguranta', 'limitare', 'accident', 'terti', 
      'vecinatate', 'pericol', 'exploatare', 'circulatie', 'securitate', 'post', 'transformare',
      'vertical', 'orizontal', 'impamantare', 'izolatie', 'conductoare', 'supratensiune'];
    
    for (const word of words) {
      if (significantWords.includes(word)) {
        keywords.push('word:' + word);
      }
    }
    
    return Array.from(new Set(keywords));
  }

  /**
   * Extrage valori numerice cu unități
   */
  private static extractNumericalValues(text: string): Array<{ value: string; unit: string }> {
    const values: Array<{ value: string; unit: string }> = [];
    
    // Pattern-uri îmbunătățite pentru valori numerice
    const patterns = [
      // mm² - secțiune conductoare
      { regex: /(\d+(?:[.,]\d+)?)\s*(?:mm[²2]|mm\^2|mm\s*p\s*atrat)/gi, unit: 'mm²' },
      // A/mm² - densitate curent
      { regex: /(\d+(?:[.,]\d+)?)\s*(?:A\s*\/\s*mm[²2]|A\/mm\^2|A\s*pe\s*mm)/gi, unit: 'A/mm²' },
      // kVA - putere aparentă
      { regex: /(\d+(?:[.,]\d+)?)\s*(?:kVA|kva|KVA)/gi, unit: 'kVA' },
      // kV - tensiune medie
      { regex: /(\d+(?:[.,]\d+)?)\s*(?:kV|kv|KV)(?!A)/gi, unit: 'kV' },
      // V - tensiune joasă
      { regex: /(\d+(?:[.,]\d+)?)\s*(?:V|v)(?!\w|A|l)/gi, unit: 'V' },
      // A - curent (nu la final de propoziție)
      { regex: /(\d+(?:[.,]\d+)?)\s*(?:A)(?!\w|l|n|m|s|\.)/gi, unit: 'A' },
      // Ω - rezistență electrică
      { regex: /(\d+(?:[.,]\d+)?)\s*(?:[ΩΩ]|ohmi?|ohms?)/gi, unit: 'Ω' },
      // s - timp
      { regex: /(\d+(?:[.,]\d+)?)\s*(?:s)(?!\w|e|i|t|a)/gi, unit: 's' },
      // m - metri (fără mm)
      { regex: /(?<!\d)(\d+(?:[.,]\d+)?)\s*(?:m|metri?)(?![a-z²2])/gi, unit: 'm' },
      // °C - temperatură
      { regex: /(\d+(?:[.,]\d+)?)\s*(?:°C|grade\s*C)/gi, unit: '°C' },
      // MΩ - megaohmi (rezistență izolație)
      { regex: /(\d+(?:[.,]\d+)?)\s*(?:M[ΩΩ]|Mohm|megaohmi?)/gi, unit: 'MΩ' },
    ];
    
    for (const { regex, unit } of patterns) {
      const matches = text.matchAll(regex);
      for (const match of Array.from(matches)) {
        values.push({
          value: match[1].replace(',', '.'),
          unit
        });
      }
    }
    
    return values;
  }

  /**
   * Verifică dacă textul conține restricții (capcană logică)
   */
  private static hasRestriction(text: string): boolean {
    const restrictionWords = ['numai', 'doar', 'exclusiv', 'strict', 'obligatoriu', 'interzis', 'nu se admite'];
    const lowerText = text.toLowerCase();
    return restrictionWords.some(word => lowerText.includes(word));
  }

  /**
   * Verificare numerică ÎMBUNĂTĂȚITĂ - caută în contextul propoziției
   */
  static verifyNumericalWithContext(
    options: QuizOption[],
    searchResults: SearchResult[] | any[]
  ): EnhancedQuizResult | null {
    
    for (const option of options) {
      if (option.numericalValues.length === 0) continue;
      
      for (const numVal of option.numericalValues) {
        // Caută valoarea în fiecare paragraf
        for (const result of searchResults) {
          const text = (result.content || result.text || '').toLowerCase();
          const sentences = text.split(/[.!?]+/);
          
          for (const sentence of sentences) {
            // Verifică dacă valoarea apare în propoziție
            const valuePattern = this.buildValuePattern(numVal.value);
            const unitPattern = this.buildUnitPattern(numVal.unit);
            
            if (valuePattern.test(sentence) && unitPattern.test(sentence)) {
              // Verifică și contextul (cuvinte cheie din opțiune)
              const contextMatch = option.keywords.some(kw => 
                sentence.includes(kw.toLowerCase())
              );
              
              if (contextMatch) {
                return {
                  answer: option.letter,
                  confidence: 98,
                  method: 'numeric',
                  reasoning: `Valoarea ${numVal.value} ${numVal.unit} găsită în contextul: "${sentence.substring(0, 100)}..."`,
                  citations: [result.content?.substring(0, 200) || result.text?.substring(0, 200)]
                };
              }
            }
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Verificare "numai" / restricții - capcană logică
   */
  static verifyRestrictions(
    options: QuizOption[],
    searchResults: SearchResult[] | any[]
  ): EnhancedQuizResult | null {
    const sourceText = searchResults.map(r => (r.content || r.text || '').toLowerCase()).join(' ');
    
    for (const option of options) {
      if (!option.hasRestriction) continue;
      
      // Dacă opțiunea conține "numai", verifică dacă normativul folosește același cuvânt
      const lowerOption = option.text.toLowerCase();
      
      // Extrage conceptul principal (ce e după "numai")
      const numaiMatch = lowerOption.match(/numai\s+(.+?)(?:\.|,|;|$)/);
      if (numaiMatch) {
        const concept = numaiMatch[1].trim();
        
        // Caută în normativ dacă se folosește "numai" în același context
        const normativRestriction = sourceText.includes(`numai ${concept}`) ||
                                   sourceText.includes(`doar ${concept}`) ||
                                   sourceText.includes(`exclusiv ${concept}`);
        
        if (!normativRestriction) {
          // Dacă normativul nu folosește "numai", varianta cu "numai" este probabil greșită
          // Dar nu returnăm încă, doar marcăm pentru analiză ulterioară
          console.log(`[Quiz] Warning: Option ${option.letter} has "numai" but normativ doesn't`);
        }
      }
    }
    
    return null;
  }

  /**
   * Keyword scoring - compară cuvinte cheie cu sursa
   */
  static keywordScoring(
    options: QuizOption[],
    searchResults: SearchResult[] | any[]
  ): EnhancedQuizResult | null {
    const sourceText = searchResults.map(r => (r.content || r.text || '').toLowerCase()).join(' ');
    const scores: Record<string, number> = { a: 0, b: 0, c: 0 };
    
    for (const option of options) {
      let score = 0;
      
      for (const keyword of option.keywords) {
        // Score exact match
        if (sourceText.includes(keyword.toLowerCase())) {
          score += 2;
        }
        
        // Score partial match (pentru cuvinte compuse)
        const parts = keyword.split(' ');
        for (const part of parts) {
          if (part.length > 4 && sourceText.includes(part.toLowerCase())) {
            score += 0.5;
          }
        }
      }
      
      // Bonus pentru valori numerice găsite
      for (const numVal of option.numericalValues) {
        const valuePattern = this.buildValuePattern(numVal.value);
        if (valuePattern.test(sourceText)) {
          score += 3;
        }
      }
      
      scores[option.letter] = score;
    }
    
    // Găsește cel mai bun scor
    const entries = Object.entries(scores) as [string, number][];
    entries.sort((a, b) => b[1] - a[1]);
    
    const [bestLetter, bestScore] = entries[0];
    const secondScore = entries[1][1];
    
    // Returnează doar dacă diferența e semnificativă
    if (bestScore > 0 && (bestScore - secondScore) >= 2) {
      return {
        answer: bestLetter as 'a' | 'b' | 'c',
        confidence: Math.min(60 + (bestScore - secondScore) * 5, 90),
        method: 'keyword',
        reasoning: `Scor keyword: A=${scores.a}, B=${scores.b}, C=${scores.c}`,
        citations: []
      };
    }
    
    return null;
  }

  /**
   * Build regex pattern for value matching
   */
  private static buildValuePattern(value: string): RegExp {
    // Normalizează valoarea (înlocuiește punct cu opțional)
    const normalized = value.replace('.', '\\.?');
    return new RegExp(`\\b${normalized}\\b`, 'i');
  }

  /**
   * Build regex pattern for unit matching
   */
  private static buildUnitPattern(unit: string): RegExp {
    const unitPatterns: Record<string, string[]> = {
      'mm²': ['mm[²2^]', 'mm\\s*p\\s*atrat', 'mm\\^2'],
      'A/mm²': ['A\\s*/\\s*mm', 'A/pe\\s*mm'],
      'kVA': ['kVA', 'kva'],
      'kV': ['kV(?!A)', 'kv(?!a)'],
      'V': ['V(?!\\w)', 'v(?!\\w)'],
      'A': ['A(?!\\w|l|m|s)', 'amperi'],
      'Ω': ['[ΩΩ]', 'ohmi?', 'ohms?'],
      'MΩ': ['M[ΩΩ]', 'Mohm', 'megaohmi?'],
      's': ['s(?!\\w|e|i)', 'sec'],
      'm': ['\\bm\\b', 'metri?'],
      '°C': ['°C', 'grade\\s*C', 'celsius']
    };
    
    const patterns = unitPatterns[unit] || [unit];
    return new RegExp(`(${patterns.join('|')})`, 'i');
  }

  /**
   * Generează prompt îmbunătățit pentru AI
   */
  static buildEnhancedPrompt(
    question: string,
    options: QuizOption[],
    searchResults: SearchResult[] | any[]
  ): { system: string; user: string } {
    
    const context = searchResults.slice(0, 5).map((r, i) => {
      const text = r.content || r.text || '';
      const metadata = r.metadata || {};
      return `[${i + 1}] Pagina ${metadata.pageNumber || '?'}:\n${text.substring(0, 400)}`;
    }).join('\n\n---\n\n');
    
    // Analizează opțiunile pentru a identifica diferențele
    const optionAnalysis = options.map(opt => {
      const hasNum = opt.numericalValues.length > 0 ? ` [NUMERIC: ${opt.numericalValues.map(v => v.value + v.unit).join(', ')}]` : '';
      const hasRestrict = opt.hasRestriction ? ' [RESTRICȚIE: "numai"/"doar"]' : '';
      return `${opt.letter}) ${opt.text}${hasNum}${hasRestrict}`;
    }).join('\n');
    
    const system = `Ești un expert în normative electrice românești (I7/2011, PE 116/1995, NTE).

REGULI STRICTE pentru răspuns:
1. Analizează FIECARE variantă în parte comparativ cu textul normativ
2. Compară valorile numerice EXACT (mm², A, V, kVA, Ω, m, s)
3. ATENȚIE la capcanele "numai" / "doar" / "exclusiv" - verifică dacă normativul folosește aceleași cuvinte
4. Respinge varianta dacă:
   - Conține "numai" dar normativul nu specifică exclusivitate
   - Valoarea numerică diferă de cea din normativ
   - Contrazice explicit o prevedere din normativ
5. Selectează varianta care:
   - Are suport textual direct în normativ
   - Conține valorile numerice exacte
   - Folosește aceeași terminologie ca normativul

FORMAT RĂSPUNS OBLIGATORIU:
RĂSPUNS: [A/B/C]
ANALIZĂ: [Compară fiecare variantă în 1-2 propoziții]
JUSTIFICARE: [De ce varianta selectată este corectă conform normativului]
CONFIDENȚĂ: [%]`;

    const user = `ÎNTREBARE:
${question}

VARIANTE:
${optionAnalysis}

CONTEX DIN NORMATIVE:
${context}

ANALIZEAZĂ METODIC:
1. Identifică conceptele cheie din întrebare
2. Compară fiecare variantă cu textul normativ
3. Verifică valorile numerice (dacă există)
4. Verifică restricțiile "numai"/"doar"
5. Selectează varianta cu cel mai puternic suport textual

RĂSPUNS:`;

    return { system, user };
  }

  /**
   * Parse răspuns AI îmbunătățit - ROBUST
   */
  static parseEnhancedAnswer(response: string): { answer: 'a' | 'b' | 'c' | null; confidence: number; reasoning: string } {
    const normalized = response.toLowerCase();
    
    // Multiple pattern-uri pentru răspuns
    const answerPatterns = [
      /răspuns\s*[:\-]?\s*([abc])\b/i,
      /\b([abc])\s*(?:este\s*)?(?:răspunsul\s*)?corect/i,
      /varianta\s*([abc])\b/i,
      /opțiunea\s*([abc])\b/i,
      /\b([abc])\s*[.\)]/i,
      /^\s*([abc])\s*$/m
    ];
    
    let answer: 'a' | 'b' | 'c' | null = null;
    for (const pattern of answerPatterns) {
      const match = response.match(pattern);
      if (match) {
        answer = match[1].toLowerCase() as 'a' | 'b' | 'c';
        break;
      }
    }
    
    // Multiple pattern-uri pentru confidence
    const confidencePatterns = [
      /confiden[ațt][aă]\s*[:\-]?\s*(\d+)%?/i,
      /(\d+)%\s*confiden/i,
      /confidence\s*[:\-]?\s*(\d+)%?/i,
      /siguran[ațt][aă]\s*[:\-]?\s*(\d+)%?/i
    ];
    
    let confidence = 50; // default
    for (const pattern of confidencePatterns) {
      const match = response.match(pattern);
      if (match) {
        confidence = parseInt(match[1]);
        break;
      }
    }
    
    // Extrage justificarea
    const justificationMatch = response.match(/justificare\s*[:\-]?\s*([\s\S]+?)(?=\n(?:confiden|sursa|nota)|$)/i);
    const reasoning = justificationMatch ? justificationMatch[1].trim().substring(0, 200) : '';
    
    // Dacă nu am găsit răspuns, caut litera izolată la început de linie
    if (!answer) {
      const isolatedMatch = response.match(/^\s*([abc])\s*[.\)]?\s*$/mi);
      if (isolatedMatch) {
        answer = isolatedMatch[1].toLowerCase() as 'a' | 'b' | 'c';
      }
    }
    
    return { answer, confidence, reasoning };
  }
}

export default EnhancedQuizHandler;
