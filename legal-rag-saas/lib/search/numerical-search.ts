/**
 * Numerical Search Enhancement Module
 * 
 * Improves search for numerical values in normative documents:
 * - Measurements (mm, cm, m)
 * - Electrical values (A, V, Ω)
 * - Distances and clearances
 * - Percentages and ratios
 */

export interface NumericalMatch {
  value: number;
  unit: string;
  context: string;
  pageNumber: number;
  paragraphId?: string;
  score: number;
}

export interface NumericalQuery {
  targetValue?: number;
  minValue?: number;
  maxValue?: number;
  unit?: string;
  tolerance?: number; // Percentage tolerance for matching
}

// Common units in electrical normatives
const UNIT_PATTERNS = {
  // Length
  mm: /\b\d+[\s,.]?\d*\s*(?:mm|milimetri)\b/gi,
  cm: /\b\d+[\s,.]?\d*\s*(?:cm|centimetri)\b/gi,
  m: /\b\d+[\s,.]?\d*\s*(?:m|metri)(?!m)\b/gi, // m but not mm
  
  // Electrical
  A: /\b\d+[\s,.]?\d*\s*(?:A|amperi|amper)\b/gi,
  V: /\b\d+[\s,.]?\d*\s*(?:V|volti|volt)\b/gi,
  ohm: /\b\d+[\s,.]?\d*\s*(?:Ω|ohmi|ohm)\b/gi,
  kW: /\b\d+[\s,.]?\d*\s*(?:kW|kilowatti)\b/gi,
  
  // Time
  s: /\b\d+[\s,.]?\d*\s*(?:s|secunde|sec)\b/gi,
  min: /\b\d+[\s,.]?\d*\s*(?:min|minute)\b/gi,
  h: /\b\d+[\s,.]?\d*\s*(?:h|ore)\b/gi,
  
  // Percentage
  percent: /\b\d+[\s,.]?\d*\s*(?:%|la\s*sută|la\s*suta)\b/gi,
  
  // Temperature
  C: /\b\d+[\s,.]?\d*\s*(?:°C|grade\s*Celsius)\b/gi,
};

// Patterns for specific electrical terms
const ELECTRICAL_PATTERNS = {
  // Protection ratings
  ipRating: /\bIP\s*\d{2}\b/gi,
  
  // Cable sections
  cableSection: /\b\d+\s*(?:mm²|mm2|mm\s*pătrați)\b/gi,
  
  // Distances
  distance: /\b(?:distanţa|distanta|spaţiul|spatiul)\s+(?:de|minimă|minima|de\s+siguranţă)\s+\d+/gi,
  
  // Heights
  height: /\b(?:înălţimea|inaltimea|la\s+înălţimea|la\s+inaltimea)\s+(?:de\s+)?\d+/gi,
};

/**
 * Parse numerical query from natural language
 */
export function parseNumericalQuery(query: string): NumericalQuery | null {
  const queryLower = query.toLowerCase();
  
  // Extract number patterns
  const numberPattern = /(\d+[\s,.]?\d*)\s*(mm|cm|m|A|V|Ω|kW|%|grade|°C)?/i;
  const match = query.match(numberPattern);
  
  if (!match) return null;
  
  const value = parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
  const unit = match[2]?.toLowerCase();
  
  // Check for range indicators
  const hasMin = queryLower.includes('minim') || queryLower.includes('cel puțin') || queryLower.includes('≥');
  const hasMax = queryLower.includes('maxim') || queryLower.includes('cel mult') || queryLower.includes('≤');
  const hasRange = queryLower.includes('între') || queryLower.includes('intre') || query.includes('-');
  
  if (hasRange) {
    // Try to extract two numbers
    const numbers = query.match(/\d+[\s,.]?\d*/g);
    if (numbers && numbers.length >= 2) {
      return {
        minValue: parseFloat(numbers[0]),
        maxValue: parseFloat(numbers[1]),
        unit,
        tolerance: 0,
      };
    }
  }
  
  if (hasMin) {
    return {
      minValue: value,
      unit,
      tolerance: 5, // 5% tolerance for minimum values
    };
  }
  
  if (hasMax) {
    return {
      maxValue: value,
      unit,
      tolerance: 5,
    };
  }
  
  // Exact value search with tolerance
  return {
    targetValue: value,
    unit,
    tolerance: 10, // 10% tolerance for exact matches
  };
}

/**
 * Find numerical values in text
 */
export function findNumericalValues(
  text: string,
  pageNumber: number,
  paragraphId?: string
): NumericalMatch[] {
  const matches: NumericalMatch[] = [];
  
  // Find all numerical patterns with units
  const patterns = [
    { regex: /(\d+[\s,.]?\d*)\s*(mm|milimetri)/gi, unit: 'mm' },
    { regex: /(\d+[\s,.]?\d*)\s*(cm|centimetri)/gi, unit: 'cm' },
    { regex: /(\d+[\s,.]?\d*)\s*(m|metri)(?!m)/gi, unit: 'm' },
    { regex: /(\d+[\s,.]?\d*)\s*(A|amperi)/gi, unit: 'A' },
    { regex: /(\d+[\s,.]?\d*)\s*(V|volti)/gi, unit: 'V' },
    { regex: /(\d+[\s,.]?\d*)\s*(Ω|ohmi)/gi, unit: 'Ω' },
    { regex: /(\d+[\s,.]?\d*)\s*(kW|kilowatti)/gi, unit: 'kW' },
    { regex: /(\d+[\s,.]?\d*)\s*(mm²|mm2)/gi, unit: 'mm²' },
    { regex: /(\d+[\s,.]?\d*)\s*%/gi, unit: '%' },
    { regex: /(\d+[\s,.]?\d*)\s*(°C|grade\s*Celsius)/gi, unit: '°C' },
    { regex: /IP\s*(\d{2})/gi, unit: 'IP' },
  ];
  
  for (const { regex, unit } of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const value = parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      const context = text.substring(start, end).trim();
      
      matches.push({
        value,
        unit,
        context,
        pageNumber,
        paragraphId,
        score: 1.0,
      });
    }
  }
  
  return matches;
}

/**
 * Score how well a numerical match fits the query
 */
export function scoreNumericalMatch(
  match: NumericalMatch,
  query: NumericalQuery
): number {
  let score = 0;
  
  // Unit match is important
  if (query.unit && match.unit.toLowerCase() === query.unit.toLowerCase()) {
    score += 30;
  }
  
  // Value matching
  if (query.targetValue !== undefined && query.tolerance !== undefined) {
    const toleranceRange = query.targetValue * (query.tolerance / 100);
    const diff = Math.abs(match.value - query.targetValue);
    
    if (diff <= toleranceRange) {
      // Within tolerance - higher score for closer matches
      score += 50 * (1 - diff / toleranceRange);
    }
  }
  
  if (query.minValue !== undefined) {
    if (match.value >= query.minValue) {
      score += 40;
      // Bonus for being close to minimum
      const diff = match.value - query.minValue;
      if (diff < query.minValue * 0.2) {
        score += 10;
      }
    }
  }
  
  if (query.maxValue !== undefined) {
    if (match.value <= query.maxValue) {
      score += 40;
      // Bonus for being close to maximum
      const diff = query.maxValue - match.value;
      if (diff < query.maxValue * 0.2) {
        score += 10;
      }
    }
  }
  
  return score;
}

/**
 * Enhance search results with numerical context
 */
export function enhanceWithNumericalContext(
  paragraphs: Array<{ text: string; pageNumber: number; paragraphId?: string }>,
  query: string
): Array<{
  paragraph: { text: string; pageNumber: number; paragraphId?: string };
  numericalMatches: NumericalMatch[];
  relevanceScore: number;
}> {
  const numericalQuery = parseNumericalQuery(query);
  
  if (!numericalQuery) {
    // No numerical query - return original ordering
    return paragraphs.map(p => ({
      paragraph: p,
      numericalMatches: [],
      relevanceScore: 0,
    }));
  }
  
  const results = paragraphs.map(p => {
    const matches = findNumericalValues(p.text, p.pageNumber, p.paragraphId);
    let totalScore = 0;
    
    for (const match of matches) {
      totalScore += scoreNumericalMatch(match, numericalQuery);
    }
    
    return {
      paragraph: p,
      numericalMatches: matches,
      relevanceScore: totalScore,
    };
  });
  
  // Sort by relevance score
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return results;
}

/**
 * Extract specific measurements mentioned in query
 */
export function extractMeasurementIntent(query: string): {
  type: string;
  value?: number;
  unit?: string;
} | null {
  const queryLower = query.toLowerCase();
  
  // Distance/clearance queries
  if (queryLower.includes('distanță') || queryLower.includes('distant') || 
      queryLower.includes('spațiu') || queryLower.includes('spatiu') ||
      queryLower.includes('de la') || queryLower.includes('între') || queryLower.includes('intre')) {
    const numQuery = parseNumericalQuery(query);
    return {
      type: 'distance',
      value: numQuery?.targetValue,
      unit: numQuery?.unit,
    };
  }
  
  // Height queries
  if (queryLower.includes('înălțime') || queryLower.includes('inaltime') || 
      queryLower.includes('la înălțime') || queryLower.includes('la inaltime')) {
    const numQuery = parseNumericalQuery(query);
    return {
      type: 'height',
      value: numQuery?.targetValue,
      unit: numQuery?.unit,
    };
  }
  
  // Section/area queries
  if (queryLower.includes('secțiune') || queryLower.includes('sectiune') || 
      queryLower.includes('suprafață') || queryLower.includes('suprafata') ||
      queryLower.includes('mm²') || queryLower.includes('mm2')) {
    const numQuery = parseNumericalQuery(query);
    return {
      type: 'section',
      value: numQuery?.targetValue,
      unit: numQuery?.unit || 'mm²',
    };
  }
  
  // Current queries
  if (queryLower.includes('curent') || queryLower.includes('amper') || 
      queryLower.includes('intensitate')) {
    const numQuery = parseNumericalQuery(query);
    return {
      type: 'current',
      value: numQuery?.targetValue,
      unit: numQuery?.unit || 'A',
    };
  }
  
  // Voltage queries
  if (queryLower.includes('tensiune') || queryLower.includes('volt') || 
      queryLower.includes('V ')) {
    const numQuery = parseNumericalQuery(query);
    return {
      type: 'voltage',
      value: numQuery?.targetValue,
      unit: numQuery?.unit || 'V',
    };
  }
  
  return null;
}

/**
 * Format numerical matches for display
 */
export function formatNumericalMatches(matches: NumericalMatch[]): string {
  if (matches.length === 0) return '';
  
  const uniqueMatches = matches
    .filter((m, i, arr) => 
      arr.findIndex(t => t.value === m.value && t.unit === m.unit) === i
    )
    .slice(0, 5);
  
  return uniqueMatches
    .map(m => `**${m.value} ${m.unit}** (${m.context.substring(0, 80)}...)`)
    .join('\n');
}
