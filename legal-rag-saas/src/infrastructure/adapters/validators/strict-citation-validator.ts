import { ICitationValidator, ValidationResult, ValidationMethod } from '@/core/services/citation-validator';
import { Paragraph } from '@/core/entities/paragraph';

export class StrictCitationValidator implements ICitationValidator {
  private readonly EXACT_MATCH_THRESHOLD = 1.0;
  private readonly NORMALIZED_MATCH_THRESHOLD = 0.98;
  private readonly SUBSET_MATCH_THRESHOLD = 0.90;
  private readonly LEVENSHTEIN_THRESHOLD = 0.95;

  async validate(
    citedText: string, 
    sourceParagraph: Paragraph, 
    queryText?: string
  ): Promise<ValidationResult> {
    const original = sourceParagraph.content.trim();
    const cited = citedText.trim();

    // Calculate relevance to query if provided
    const relevanceScore = queryText 
      ? this.calculateRelevanceScore(queryText, original)
      : 1.0;

    // 1. Match exact
    if (original === cited) {
      return {
        isValid: true,
        confidence: 100,
        relevanceScore,
        method: 'EXACT_MATCH',
      };
    }

    // 2. Normalizare și comparare
    const normalizedOriginal = this.normalize(original);
    const normalizedCited = this.normalize(cited);

    if (normalizedOriginal === normalizedCited) {
      return {
        isValid: true,
        confidence: 98,
        relevanceScore,
        method: 'NORMALIZED_MATCH',
      };
    }

    // 3. Verificare subset (citatul e parte din original)
    if (normalizedOriginal.includes(normalizedCited)) {
      const ratio = normalizedCited.length / normalizedOriginal.length;
      if (ratio >= 0.8) {
        return {
          isValid: true,
          confidence: Math.round(90 + ratio * 10),
          relevanceScore,
          method: 'SUBSET_MATCH',
          details: `Citatul reprezintă ${Math.round(ratio * 100)}% din paragraful original`,
        };
      }
      // Fragment prea mic - posibil out of context
      return {
        isValid: false,
        confidence: Math.round(ratio * 100),
        relevanceScore,
        method: 'SUBSET_MATCH',
        details: `Citatul prea scurt (${Math.round(ratio * 100)}% din original) - risc de out-of-context`,
      };
    }

    // 4. Similaritate Levenshtein (pentru erori OCR mici)
    const similarity = this.calculateSimilarity(normalizedOriginal, normalizedCited);
    if (similarity >= this.LEVENSHTEIN_THRESHOLD) {
      return {
        isValid: true,
        confidence: Math.round(similarity * 100),
        relevanceScore,
        method: 'LEVENSHTEIN_SIMILAR',
        details: `Similaritate ${Math.round(similarity * 100)}% - posibile mici variații OCR`,
      };
    }

    // 5. Similaritate semantică (fallback)
    const semanticSimilarity = await this.calculateSemanticSimilarity(original, cited);
    if (semanticSimilarity >= 0.90) {
      return {
        isValid: true,
        confidence: Math.round(semanticSimilarity * 100),
        relevanceScore,
        method: 'SEMANTIC_SIMILAR',
        details: 'Similaritate semantică înaltă - formulare diferită, același sens',
      };
    }

    // 6. Nu se potrivește
    return {
      isValid: false,
      confidence: Math.round(similarity * 100),
      relevanceScore,
      method: 'VALIDATION_FAILED',
      details: `Textul citat nu corespunde cu sursa (similaritate: ${Math.round(similarity * 100)}%)`,
    };
  }

  verifyFactualAccuracy(extractedText: string, originalText: string, queryText?: string): ValidationResult {
    const normalizedExtract = this.normalize(extractedText);
    const normalizedOriginal = this.normalize(originalText);

    // Calculate relevance to query if provided
    const relevanceScore = queryText 
      ? this.calculateRelevanceScore(queryText, originalText)
      : 1.0;

    // Verificare modificări de sens prin compararea cuvintelor cheie
    const extractKeywords = this.extractKeyTerms(normalizedExtract);
    const originalKeywords = this.extractKeyTerms(normalizedOriginal);

    const missingKeywords = originalKeywords.filter(kw => !extractKeywords.includes(kw));
    const addedKeywords = extractKeywords.filter(kw => !originalKeywords.includes(kw));

    if (missingKeywords.length === 0 && addedKeywords.length === 0) {
      return {
        isValid: true,
        confidence: 100,
        relevanceScore,
        method: 'EXACT_MATCH',
      };
    }

    if (missingKeywords.length > 2 || addedKeywords.length > 2) {
      return {
        isValid: false,
        confidence: Math.max(0, 100 - (missingKeywords.length + addedKeywords.length) * 10),
        relevanceScore,
        method: 'VALIDATION_FAILED',
        details: `Modificări detectate: ${missingKeywords.length} cuvinte lipsă, ${addedKeywords.length} adăugate`,
      };
    }

    return {
      isValid: true,
      confidence: 90 - (missingKeywords.length + addedKeywords.length) * 5,
      relevanceScore,
      method: 'LEVENSHTEIN_SIMILAR',
      details: `Mici variații: ${missingKeywords.length} omisiuni, ${addedKeywords.length} adăugiri`,
    };
  }

  async validateBatch(
    citations: Array<{ text: string; paragraphId: string }>,
    paragraphs: Map<string, Paragraph>
  ): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();

    for (const citation of citations) {
      const paragraph = paragraphs.get(citation.paragraphId);
      if (!paragraph) {
        results.set(citation.paragraphId, {
          isValid: false,
          confidence: 0,
          relevanceScore: 0,
          method: 'VALIDATION_FAILED',
          details: 'Paragraf negăsit',
        });
        continue;
      }

      const result = await this.validate(citation.text, paragraph);
      results.set(citation.paragraphId, result);
    }

    return results;
  }

  public calculateSimilarity(text1: string, text2: string): number {
    const normalized1 = this.normalize(text1);
    const normalized2 = this.normalize(text2);

    if (normalized1 === normalized2) return 1.0;

    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    
    if (maxLength === 0) return 1.0;
    
    return 1 - (distance / maxLength);
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      // Remove Romanian diacritics for better matching
      .replace(/[ăâ]/g, 'a')  // ă, â -> a
      .replace(/[î]/g, 'i')   // î -> i  
      .replace(/[șş]/g, 's')  // ș, ş -> s
      .replace(/[țţ]/g, 't')  // ț, ţ -> t
      .replace(/[.,;:!?()"'"''\-\[\]{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b(a|an|the|si|sau|de|la|in|pe)\b/g, '')
      .trim();
  }

  private extractKeyTerms(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'de', 'și', 'sau', 'la', 'în', 'pe', 'cu', 'fără', 'prin', 'pentru'
    ]);

    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
      .sort();
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private async calculateSemanticSimilarity(text1: string, text2: string): Promise<number> {
    // În producție, folosești embeddings pentru similaritate semantică
    // Pentru simplitate, folosim Jaccard similarity pe termeni
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
    const union = new Set([...Array.from(words1), ...Array.from(words2)]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
  }

  /**
   * Calculate relevance score between query and content
   * Returns 0-1 score based on keyword matching and semantic overlap
   */
  public calculateRelevanceScore(query: string, content: string): number {
    const normalizedQuery = this.normalize(query);
    const normalizedContent = this.normalize(content);
    
    // Extract keywords from query (focusing on technical/legal terms)
    const queryTerms = this.extractKeyTerms(normalizedQuery);
    const contentTerms = new Set(this.extractKeyTerms(normalizedContent));
    
    if (queryTerms.length === 0) return 0.5; // Default if no meaningful terms
    
    // Count how many query terms appear in content
    const matchedTerms = queryTerms.filter(term => 
      contentTerms.has(term) || normalizedContent.includes(term)
    );
    
    // Base relevance on term matching
    const termMatchRatio = matchedTerms.length / queryTerms.length;
    
    // Boost for exact phrase matches
    const phraseMatchBonus = normalizedContent.includes(normalizedQuery) ? 0.3 : 0;
    
    // Check for related legal/technical concepts (synonym matching)
    const relatedConcepts = this.findRelatedConcepts(normalizedQuery, normalizedContent);
    
    // Combine scores: term matching (70%) + related concepts (30%)
    let relevanceScore = (termMatchRatio * 0.7) + (relatedConcepts * 0.3) + phraseMatchBonus;
    
    // Cap at 1.0
    return Math.min(1.0, relevanceScore);
  }
  
  /**
   * Find related concepts between query and content
   * Uses semantic similarity for related terms
   */
  private findRelatedConcepts(query: string, content: string): number {
    // Define related term groups for legal/technical domain - Romanian electrical
    const conceptGroups = [
      // Grounding / Earthing
      ['impamantare', 'impamantarea', 'priza', 'priza de pamant', 'electrod', 'rezistenta', 'ohm', 'legare la pamant', 'priza pamant', 'impamantarea priza'],
      // Cables and conductors
      ['conductoare', 'cabluri', 'fire', 'conductoare neizolate', 'izolatie', 'conductoare electrice', 'sectiune', 'sectiunea', 'milimetru', 'mmp', 'cupru', 'aluminiu'],
      // Protection and safety
      ['protectie', 'siguranta', 'securitate', 'dispozitive protectie', 'supracurent', 'scurtcircuit', 'siguranta electrica', 'protectie electrica', 'sistem protectie', 'protejare', 'protejat'],
      // Electrical installations
      ['instalatii electrice', 'retele electrice', 'tablouri', 'prize', 'intrerupatoare', 'tablou electric', 'circuit', 'circuite', 'alimentare', 'alimentarea'],
      // Measurement and testing
      ['masurare', 'verificare', 'control', 'testare', 'monitorizare', 'masuratoare', 'masura', 'verificat', 'controlat', 'testat'],
      // Installation
      ['montare', 'instalare', 'montaj', 'fixare', 'conectare', 'executie', 'executia', 'pozare', 'pozarea'],
      // Electric shock and current
      ['soc', 'soc electric', 'electrocutare', 'curent electric', 'tensiune', 'tensiunea', 'voltaj', 'amperaj', 'ampere'],
      // Equipment
      ['echipament', 'echipamente', 'echipament electric', 'aparate', 'receptoare', 'consumator', 'consumatori'],
      // Hazards
      ['pericol', 'pericole', 'risc', 'riscuri', 'periculos', 'defect', 'defectiune', 'avarie'],
    ];
    
    const queryWords = new Set(query.split(/\s+/));
    const contentWords = new Set(content.split(/\s+/));
    
    let maxGroupScore = 0;
    
    for (const group of conceptGroups) {
      const queryInGroup = group.some(term => 
        queryWords.has(term) || query.includes(term)
      );
      const contentInGroup = group.some(term => 
        contentWords.has(term) || content.includes(term)
      );
      
      if (queryInGroup && contentInGroup) {
        // Calculate overlap within this concept group
        const queryMatches = group.filter(term => queryWords.has(term) || query.includes(term)).length;
        const contentMatches = group.filter(term => contentWords.has(term) || content.includes(term)).length;
        const groupScore = Math.min(queryMatches, contentMatches) / Math.max(queryMatches, contentMatches);
        maxGroupScore = Math.max(maxGroupScore, groupScore);
      }
    }
    
    return maxGroupScore;
  }
}
