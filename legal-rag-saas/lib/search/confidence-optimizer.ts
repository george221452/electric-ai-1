/**
 * Confidence Optimizer Module
 * 
 * Improves confidence scoring for practical/complex scenarios:
 * - Multi-concept queries (scenarios with multiple conditions)
 * - Context-aware confidence adjustment
 * - Semantic pattern matching for practical situations
 */

export interface ConfidenceContext {
  query: string;
  citations: Array<{
    text: string;
    score: number;
    pageNumber: number;
  }>;
  queryType: string;
}

export interface OptimizedConfidence {
  originalConfidence: number;
  optimizedConfidence: number;
  adjustmentReason: string;
  coverageScore: number;
  semanticMatchScore: number;
}

// Practical scenario patterns
const PRACTICAL_PATTERNS = {
  // Installation scenarios
  installation: [
    'montare', 'instalare', 'amplasare', 'poziționare', 'pozitionare',
    'cum se face', 'cum se montează', 'cum se monteaza', 'procedura',
  ],
  
  // Verification/testing scenarios
  verification: [
    'verificare', 'control', 'măsurătoare', 'masuratoare', 'testare',
    'măsurători', 'masuratori', 'verificări', 'verificari',
  ],
  
  // Multi-condition scenarios
  multiCondition: [
    'și', 'si', 'precum și', 'precum si', 'atât cât și', 'atat cat si',
    'atât...cât și', 'atat...cat si', 'pe de o parte', 'pe de altă parte',
  ],
  
  // Specific context scenarios
  specificContext: [
    'în cazul', 'in cazul', 'pentru cazul', 'în situația', 'in situatia',
    'la construcțiile', 'la constructiile', 'în clădirile', 'in cladirile',
    'în încăperile', 'in incaperile', 'în spațiile', 'in spatiile',
  ],
  
  // Comparison scenarios
  comparison: [
    'comparativ cu', 'față de', 'fata de', 'spre deosebire de',
    'versus', 'vs', 'în raport cu', 'in raport cu',
  ],
};

// Semantic concept patterns for electrical domain
const ELECTRICAL_CONCEPTS = {
  ddr: ['ddr', 'dispozitiv diferențial', 'dispozitiv diferential', '30ma', '300ma'],
  impamantare: ['împământare', 'impamantare', 'legare la pământ', 'legare la pamant', 'priză de pământ', 'priza de pamant'],
  prize: ['priză', 'priza', 'prize', 'prizelor', 'circuit de prize', 'circuite de prize'],
  iluminat: ['iluminat', 'lampă', 'lampa', 'lămpi', 'lampi', 'corpură de iluminat'],
  conductoare: ['conductor', 'conductoare', 'cabluri', 'cablu', 'fire', 'fir'],
  protectie: ['protecție', 'protectie', 'protecția', 'protectia', 'protecții', 'protectii'],
  tablou: ['tablou', 'tablouri', 'tabloul', 'tablourilor', 'siguranță', 'siguranta'],
};

/**
 * Detect if query is a practical/complex scenario
 */
export function detectPracticalScenario(query: string): {
  isPractical: boolean;
  scenarioType: string;
  complexity: number;
} {
  const queryLower = query.toLowerCase();
  let complexity = 0;
  let detectedTypes: string[] = [];
  
  // Check for practical patterns
  for (const [type, patterns] of Object.entries(PRACTICAL_PATTERNS)) {
    for (const pattern of patterns) {
      if (queryLower.includes(pattern)) {
        complexity += 1;
        if (!detectedTypes.includes(type)) {
          detectedTypes.push(type);
        }
        break;
      }
    }
  }
  
  // Check for multiple electrical concepts (indicates complex query)
  let conceptCount = 0;
  for (const [concept, patterns] of Object.entries(ELECTRICAL_CONCEPTS)) {
    for (const pattern of patterns) {
      if (queryLower.includes(pattern)) {
        conceptCount++;
        break;
      }
    }
  }
  
  if (conceptCount > 1) {
    complexity += conceptCount;
    detectedTypes.push('multi-concept');
  }
  
  // Check for question words that indicate practical scenarios
  const practicalQuestions = ['cum', 'cât', 'cat', 'ce', 'când', 'cand', 'unde', 'care'];
  for (const q of practicalQuestions) {
    if (queryLower.startsWith(q) || queryLower.includes(` ${q} `)) {
      complexity += 0.5;
    }
  }
  
  const isPractical = complexity >= 2 || detectedTypes.length >= 2;
  
  return {
    isPractical,
    scenarioType: detectedTypes.join(', ') || 'simple',
    complexity,
  };
}

/**
 * Calculate coverage score - how well citations cover the query concepts
 */
export function calculateCoverageScore(
  query: string,
  citations: Array<{ text: string }>
): number {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter(w => !['care', 'ceea', 'pentru', 'despre', 'sunt', 'este', 'trebuie'].includes(w));
  
  if (queryWords.length === 0) return 0.5;
  
  let coveredWords = 0;
  const coveredSet = new Set<string>();
  
  for (const word of queryWords) {
    for (const citation of citations) {
      if (citation.text.toLowerCase().includes(word)) {
        if (!coveredSet.has(word)) {
          coveredWords++;
          coveredSet.add(word);
        }
        break;
      }
    }
  }
  
  return coveredWords / queryWords.length;
}

/**
 * Calculate semantic match score for practical scenarios
 */
export function calculateSemanticMatchScore(
  query: string,
  citations: Array<{ text: string }>
): number {
  const queryLower = query.toLowerCase();
  let totalScore = 0;
  let conceptMatches = 0;
  
  for (const [concept, patterns] of Object.entries(ELECTRICAL_CONCEPTS)) {
    let queryHasConcept = false;
    let citationHasConcept = false;
    
    // Check if query contains this concept
    for (const pattern of patterns) {
      if (queryLower.includes(pattern)) {
        queryHasConcept = true;
        break;
      }
    }
    
    if (queryHasConcept) {
      // Check if any citation contains this concept
      for (const citation of citations) {
        for (const pattern of patterns) {
          if (citation.text.toLowerCase().includes(pattern)) {
            citationHasConcept = true;
            break;
          }
        }
        if (citationHasConcept) break;
      }
      
      if (citationHasConcept) {
        totalScore += 1;
      } else {
        totalScore -= 0.3; // Penalty for missing concept
      }
      conceptMatches++;
    }
  }
  
  if (conceptMatches === 0) return 0.5;
  
  // Normalize score between 0 and 1
  return Math.max(0, Math.min(1, (totalScore / conceptMatches + 1) / 2));
}

/**
 * Optimize confidence for practical scenarios
 */
export function optimizeConfidence(
  context: ConfidenceContext
): OptimizedConfidence {
  const { query, citations, queryType } = context;
  const originalConfidence = Math.round(
    citations.reduce((sum, c) => sum + c.score, 0) / citations.length * 100
  );
  
  // Detect if this is a practical scenario
  const scenario = detectPracticalScenario(query);
  
  if (!scenario.isPractical) {
    return {
      originalConfidence,
      optimizedConfidence: originalConfidence,
      adjustmentReason: 'Simple query - no adjustment needed',
      coverageScore: 0,
      semanticMatchScore: 0,
    };
  }
  
  // Calculate coverage and semantic scores
  const coverageScore = calculateCoverageScore(query, citations);
  const semanticMatchScore = calculateSemanticMatchScore(query, citations);
  
  // For practical scenarios, use a weighted formula
  // Vector similarity is less important than concept coverage
  const weightedConfidence = Math.round(
    originalConfidence * 0.4 + // Original vector similarity
    coverageScore * 30 +       // Concept coverage (0-30 points)
    semanticMatchScore * 30    // Semantic match (0-30 points)
  );
  
  // Boost confidence slightly for well-covered practical scenarios
  let boost = 0;
  if (coverageScore > 0.7) boost += 5;
  if (semanticMatchScore > 0.7) boost += 5;
  if (scenario.complexity > 3) boost += 3; // Complexity bonus
  
  const optimizedConfidence = Math.min(100, weightedConfidence + boost);
  
  let adjustmentReason = `Practical scenario (${scenario.scenarioType}): `;
  if (coverageScore > 0.7) {
    adjustmentReason += 'good concept coverage; ';
  }
  if (semanticMatchScore > 0.7) {
    adjustmentReason += 'strong semantic match; ';
  }
  adjustmentReason += `complexity ${scenario.complexity.toFixed(1)}`;
  
  return {
    originalConfidence,
    optimizedConfidence,
    adjustmentReason,
    coverageScore: Math.round(coverageScore * 100),
    semanticMatchScore: Math.round(semanticMatchScore * 100),
  };
}

/**
 * Select best citations for practical scenarios
 */
export function selectOptimalCitations(
  query: string,
  allCitations: Array<{
    text: string;
    score: number;
    pageNumber: number;
    [key: string]: any;
  }>,
  maxCitations: number = 5
): Array<{
  text: string;
  score: number;
  pageNumber: number;
  relevanceReason: string;
  [key: string]: any;
}> {
  const scenario = detectPracticalScenario(query);
  
  if (!scenario.isPractical) {
    // For simple queries, just return top by score
    return allCitations
      .slice(0, maxCitations)
      .map(c => ({ ...c, relevanceReason: 'Vector similarity' }));
  }
  
  // For practical scenarios, score each citation by concept coverage
  const scoredCitations = allCitations.map(citation => {
    const coverage = calculateCoverageScore(query, [citation]);
    const semantic = calculateSemanticMatchScore(query, [citation]);
    
    // Combined score: balance vector similarity with semantic coverage
    const combinedScore = citation.score * 0.5 + coverage * 0.3 + semantic * 0.2;
    
    let relevanceReason = '';
    if (coverage > 0.5 && semantic > 0.5) {
      relevanceReason = 'Strong concept & semantic match';
    } else if (coverage > 0.5) {
      relevanceReason = 'Good concept coverage';
    } else if (semantic > 0.5) {
      relevanceReason = 'Good semantic match';
    } else {
      relevanceReason = 'Vector similarity';
    }
    
    return {
      ...citation,
      combinedScore,
      relevanceReason,
    };
  });
  
  // Sort by combined score
  scoredCitations.sort((a, b) => b.combinedScore - a.combinedScore);
  
  return scoredCitations.slice(0, maxCitations);
}

/**
 * Generate context-aware response guidance for practical scenarios
 */
export function generateResponseGuidance(
  query: string,
  scenario: { isPractical: boolean; scenarioType: string; complexity: number }
): string {
  if (!scenario.isPractical) {
    return 'Provide a direct answer based on the citations.';
  }
  
  const guidance: string[] = [];
  
  guidance.push('This is a practical scenario query. Structure the response to:');
  
  if (scenario.scenarioType.includes('installation')) {
    guidance.push('- Identify the installation requirements and conditions');
    guidance.push('- Mention specific measurements or values if present');
  }
  
  if (scenario.scenarioType.includes('multi-concept')) {
    guidance.push('- Address each concept mentioned in the query');
    guidance.push('- Show how the concepts relate to each other');
  }
  
  if (scenario.scenarioType.includes('specificContext')) {
    guidance.push('- Note the specific context or conditions mentioned');
    guidance.push('- Indicate if the answer depends on specific circumstances');
  }
  
  if (scenario.complexity > 3) {
    guidance.push('- Acknowledge the complexity of the scenario');
    guidance.push('- If information is incomplete, state what is covered and what may need additional verification');
  }
  
  return guidance.join('\n');
}
