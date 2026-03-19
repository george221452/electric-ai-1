import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface UnderstoodQuery {
  original: string;
  mainConcept: string;
  technicalTerms: string[];
  searchQueries: string[]; // Multiple variante de căutare
  expectedValues: string[]; // Ce valori caută userul (numere, măsurători)
  domain: 'electrical' | 'safety' | 'measurement' | 'general';
  isComparison: boolean;
  isLookup: boolean; // Caută o valoare specifică
}

/**
 * Analizează întrebarea utilizatorului și generează căutări optimizate pentru RAG
 */
export async function understandQuery(userMessage: string): Promise<UnderstoodQuery> {
  const systemPrompt = `Ești un expert în normative electrice românești (ANRE, I7, PE 109, etc.).
Analizează întrebarea utilizatorului și extrage:
1. Conceptul principal căutat
2. Termeni tehnici specifici
3. Valori numerice sau măsurători menționate sau implicate
4. Generează multiple variante de căutare pentru a găsi informația corectă

Exemple:
- "de ce nu zice nimic de valoare de 4 ohmi" → caută "rezistență împământare 4 ohm rezidențial", "rezistență priză pământ 4Ω", "normativ I7 rezistență împământare"
- "ce cablu folosesc pentru priză" → caută "secțiune conductor priză", "cabluz alimentare priză", "2.5 mm² priză"
- "cât e tensiunea nominală" → caută "tensiune nominală", "230V", "400V", "tensiune de alimentare"

Răspunde în format JSON:`;

  const userPrompt = `Analizează această întrebare: "${userMessage}"

Generează un obiect JSON cu:
- mainConcept: conceptul principal (ex: "rezistență împământare", "secțiune cablu")
- technicalTerms: array de termeni tehnici
- searchQueries: array cu 3-5 variante de căutare diferite (include prescurtări, simboluri, sinonime)
- expectedValues: ce valori numerice caută (ex: ["4 ohm", "10 ohm", "1 ohm"]) sau []
- domain: domeniul (electrical/safety/measurement/general)
- isComparison: dacă compară valori
- isLookup: true dacă caută o valoare specifică

JSON:`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      original: userMessage,
      mainConcept: parsed.mainConcept || userMessage,
      technicalTerms: parsed.technicalTerms || [],
      searchQueries: parsed.searchQueries || [userMessage],
      expectedValues: parsed.expectedValues || [],
      domain: parsed.domain || 'general',
      isComparison: parsed.isComparison || false,
      isLookup: parsed.isLookup || false,
    };
  } catch (error) {
    console.error('[QueryUnderstanding] Error:', error);
    // Fallback la query original
    return {
      original: userMessage,
      mainConcept: userMessage,
      technicalTerms: [],
      searchQueries: [userMessage],
      expectedValues: [],
      domain: 'general',
      isComparison: false,
      isLookup: false,
    };
  }
}

/**
 * Combină rezultatele din multiple căutări și elimină duplicatele
 */
export function mergeSearchResults(results: any[][]): any[] {
  const seen = new Set<string>();
  const merged: any[] = [];

  for (const resultSet of results) {
    for (const result of resultSet) {
      const key = `${result.payload?.filename}-${result.payload?.content?.slice(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(result);
      }
    }
  }

  // Sortează după scor (descrescător)
  return merged.sort((a, b) => (b.score || 0) - (a.score || 0));
}

/**
 * Verifică dacă rezultatele conțin informația căutată
 */
export function validateResults(
  results: any[], 
  understood: UnderstoodQuery
): { isRelevant: boolean; missingInfo: string[] } {
  const missingInfo: string[] = [];
  
  // Dacă caută valori specifice, verifică dacă apar în rezultate
  if (understood.isLookup && understood.expectedValues.length > 0) {
    const contentLower = results
      .map(r => (r.payload?.content as string || '').toLowerCase())
      .join(' ');
    
    for (const value of understood.expectedValues) {
      const valueVariants = [
        value.toLowerCase(),
        value.replace(' ', '').toLowerCase(),
        value.replace('ohmi', 'Ω').toLowerCase(),
        value.replace('Ω', 'ohmi').toLowerCase(),
      ];
      
      const found = valueVariants.some(v => contentLower.includes(v));
      if (!found) {
        missingInfo.push(value);
      }
    }
  }

  return {
    isRelevant: missingInfo.length === 0 || results[0]?.score > 0.7,
    missingInfo
  };
}
