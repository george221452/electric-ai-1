/**
 * Synonym Expansion Module
 * 
 * Expands search queries with synonyms to improve recall.
 * Specifically tailored for Romanian electrical terminology.
 */

// Romanian electrical synonyms
export const ELECTRICAL_SYNONYMS: Record<string, string[]> = {
  // Basic terms
  'priză': ['priza', 'prize', 'punct de utilizare', 'punct utilizare', 'soclu', 'socket'],
  'priza': ['priză', 'prize', 'punct de utilizare', 'punct utilizare', 'soclu', 'socket'],
  'prize': ['priză', 'priza', 'puncte de utilizare', 'puncte utilizare', 'socluri', 'socketuri'],
  
  // DDR
  'ddr': ['dispozitiv diferențial', 'dispozitiv diferential', 'dispozitiv de protecție', 'dispozitiv de protectie', 'protectie diferentiala'],
  'dispozitiv diferențial': ['ddr', 'dispozitiv diferential', 'dispozitiv de protecție', 'dispozitiv de protectie'],
  
  // Grounding
  'împământare': ['impamantare', 'legare la pământ', 'legare la pamant', 'priză de pământ', 'priza de pamant', 'priza pamantului'],
  'impamantare': ['împământare', 'legare la pământ', 'legare la pamant', 'priză de pământ', 'priza de pamant'],
  'legare echipotentiala': ['legare echipotențială', 'legare echipotentiala suplimentara', 'legare echipotențială suplimentară', 'legare la pamant'],
  'legare echipotențială': ['legare echipotentiala', 'legare echipotentiala suplimentara', 'legare echipotențială suplimentară'],
  
  // Cables
  'cablu': ['cabluri', 'conductor', 'conductori', 'fir', 'fire'],
  'cabluri': ['cablu', 'conductori', 'conductor', 'fire', 'fir'],
  'conductor': ['conductori', 'cablu', 'cabluri', 'fir', 'fire'],
  'secțiune': ['sectiune', 'diametru', 'sectiunea', 'secțiunea', 'suprafata', 'suprafață'],
  'sectiune': ['secțiune', 'diametru', 'sectiunea', 'secțiunea', 'suprafata', 'suprafață'],
  
  // Protection
  'protecție': ['protectie', 'siguranta', 'siguranță', 'siguranță electrică', 'siguranta electrica'],
  'protectie': ['protecție', 'siguranta', 'siguranță', 'siguranță electrică', 'siguranta electrica'],
  'siguranță': ['siguranta', 'protecție', 'protectie', 'disjunctor', 'siguranta fuzibila'],
  'siguranta': ['siguranță', 'protecție', 'protectie', 'disjunctor', 'siguranta fuzibila'],
  
  // Panels
  'tablou': ['tablouri', 'tablou electric', 'tablou de distributie', 'tablou distribuție', 'panou electric'],
  'tablou electric': ['tablou', 'tablouri', 'tablou de distributie', 'tablou distribuție', 'panou electric'],
  
  // Circuits
  'circuit': ['circuite', 'circuit electric', 'instalatie', 'instalație'],
  'circuite': ['circuit', 'instalatii', 'instalații', 'circuite electrice'],
  
  // Height/Measurements
  'înălțime': ['inaltime', 'inaltimea', 'înălțimea', 'la inaltime', 'la înălțime', 'nivel'],
  'inaltime': ['înălțime', 'inaltimea', 'înălțimea', 'la inaltime', 'la înălțime'],
  'distanță': ['distanta', 'distanța', 'spatiu', 'spațiu', 'lungime'],
  'distanta': ['distanță', 'distanța', 'spatiu', 'spațiu'],
  
  // Installation
  'montare': ['montaj', 'instalare', 'instalat', 'montat', 'amplasare', 'poziționare', 'pozitionare'],
  'montaj': ['montare', 'instalare', 'instalat', 'montat', 'amplasare'],
  'instalare': ['instalat', 'montare', 'montaj', 'amplasare', 'poziționare'],
  
  // Rooms/Locations
  'baie': ['baia', 'grup sanitar', 'toaletă', 'toaleta', 'dus', 'duș'],
  'bucătărie': ['bucatarie', 'bucataria', 'spațiu de gătit', 'spatiu de gatit'],
  'exterior': ['afara', 'afară', ' exterior', 'în aer liber', 'in aer liber'],
  
  // Current/Voltage
  'curent': ['curent electric', 'amperaj', 'intensitate', 'intensitatea', 'a'],
  'tensiune': ['tensiune electrica', 'tensiunea', 'voltaj', 'voltajul', 'volti', 'v'],
  
  // Verification
  'verificare': ['control', 'verificat', 'testare', 'testat', 'măsurătoare', 'masuratoare', 'măsurători', 'masuratori'],
  'măsurare': ['masurare', 'masuratoare', 'măsurătoare', 'verificare', 'testare'],
};

/**
 * Expand query with synonyms
 */
export function expandQueryWithSynonyms(query: string): string {
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/);
  const expandedTerms: string[] = [query]; // Keep original query

  for (const word of words) {
    // Clean the word of punctuation
    const cleanWord = word.replace(/[?.,!;:]$/, '');
    
    if (ELECTRICAL_SYNONYMS[cleanWord]) {
      // Add synonyms for this word
      const synonyms = ELECTRICAL_SYNONYMS[cleanWord];
      
      // Create expanded queries by replacing this word with its synonyms
      for (const synonym of synonyms) {
        const expandedQuery = queryLower.replace(
          new RegExp(`\\b${cleanWord}\\b`, 'gi'),
          synonym
        );
        if (!expandedTerms.includes(expandedQuery)) {
          expandedTerms.push(expandedQuery);
        }
      }
    }
  }

  // If no expansions were made, return original query
  if (expandedTerms.length === 1) {
    return query;
  }

  // Return expanded query by joining unique terms
  // Limit to prevent too long queries
  return expandedTerms.slice(0, 5).join(' | ');
}

/**
 * Get synonyms for a specific word
 */
export function getSynonyms(word: string): string[] {
  const cleanWord = word.toLowerCase().replace(/[?.,!;:]$/, '');
  return ELECTRICAL_SYNONYMS[cleanWord] || [];
}

/**
 * Check if query contains electrical terms that could be expanded
 */
export function hasExpandableTerms(query: string): boolean {
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/);

  for (const word of words) {
    const cleanWord = word.replace(/[?.,!;:]$/, '');
    if (ELECTRICAL_SYNONYMS[cleanWord]) {
      return true;
    }
  }

  return false;
}

/**
 * Get all electrical terms in a query
 */
export function getElectricalTerms(query: string): string[] {
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/);
  const terms: string[] = [];

  for (const word of words) {
    const cleanWord = word.replace(/[?.,!;:]$/, '');
    if (ELECTRICAL_SYNONYMS[cleanWord] && !terms.includes(cleanWord)) {
      terms.push(cleanWord);
    }
  }

  return terms;
}

/**
 * Enhanced search with synonym expansion
 * This function creates multiple search queries from the original
 */
export function createSearchVariants(query: string): string[] {
  const variants: string[] = [query]; // Original query is always first
  const queryLower = query.toLowerCase();
  
  // Get all electrical terms in the query
  const terms = getElectricalTerms(query);
  
  if (terms.length === 0) {
    return variants;
  }

  // Create variants by replacing each term with its synonyms
  for (const term of terms) {
    const synonyms = ELECTRICAL_SYNONYMS[term];
    if (synonyms && synonyms.length > 0) {
      // Add up to 2 synonyms for each term
      for (let i = 0; i < Math.min(2, synonyms.length); i++) {
        const variant = queryLower.replace(
          new RegExp(`\\b${term}\\b`, 'gi'),
          synonyms[i]
        );
        if (!variants.includes(variant)) {
          variants.push(variant);
        }
      }
    }
  }

  // Limit variants to prevent too many searches
  return variants.slice(0, 6);
}

/**
 * Highlight matched synonyms in text
 */
export function highlightSynonyms(text: string, query: string): string {
  const terms = getElectricalTerms(query);
  let highlightedText = text;

  for (const term of terms) {
    const synonyms = ELECTRICAL_SYNONYMS[term];
    if (synonyms) {
      // Highlight both the term and its synonyms
      const allTerms = [term, ...synonyms];
      for (const t of allTerms) {
        const regex = new RegExp(`\\b(${t})\\b`, 'gi');
        highlightedText = highlightedText.replace(regex, '**$1**');
      }
    }
  }

  return highlightedText;
}
