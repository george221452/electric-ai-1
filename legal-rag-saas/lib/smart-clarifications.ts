/**
 * Smart Clarifications
 * Asks for clarifications ONLY when actually needed
 */

export interface ClarificationNeed {
  needsClarification: boolean;
  reason: string;
  questions?: string[];
}

export class SmartClarifications {
  /**
   * Analyze if we really need clarifications
   */
  static analyzeNeed(
    question: string,
    subject: string,
    searchResults: any[]
  ): ClarificationNeed {
    const lowerQuestion = question.toLowerCase();
    const lowerSubject = subject.toLowerCase();
    
    // 1. Check if it's a universal concept - never ask for clarifications
    const universalConcepts = ['selectivitate', 'scurtcircuit', 'tensiune', 'protectie', 'normativ'];
    if (universalConcepts.some(c => lowerSubject.includes(c))) {
      // Check if question is general (not asking for specific sizing)
      const isGeneralQuestion = /cum se|principii|reguli|general/i.test(question);
      if (isGeneralQuestion) {
        return {
          needsClarification: false,
          reason: 'Concept universal - principiile sunt aceleași indiferent de detalii',
        };
      }
    }

    // 2. Check if we have good search results
    const hasGoodResults = searchResults.some(r => (r.score || 0) > 0.5);
    if (hasGoodResults) {
      return {
        needsClarification: false,
        reason: 'Am găsit informații relevante în documente',
      };
    }

    // 3. Check if question is ambiguous
    const ambiguousPatterns = [
      { pattern: /cat (costa|e|sunt)/, needsInfo: 'preț/cantitate specifică' },
      { pattern: /ce (model|tip|marcă)/, needsInfo: 'specificații tehnice detaliate' },
      { pattern: /cum (se monteaza|se instaleaza)/, needsInfo: 'tip instalație și condiții' },
    ];

    for (const { pattern, needsInfo } of ambiguousPatterns) {
      if (pattern.test(lowerQuestion)) {
        return {
          needsClarification: true,
          reason: `Întrebare ambiguă - necesită ${needsInfo}`,
          questions: [`Puteți specifica ${needsInfo}?`],
        };
      }
    }

    // 4. Check if question is too vague
    if (question.length < 20 && !lowerSubject) {
      return {
        needsClarification: true,
        reason: 'Întrebare prea vagă',
        questions: ['Puteți detalia ce anume doriți să aflați?'],
      };
    }

    // Default: don't ask for clarifications if we have any relevant info
    return {
      needsClarification: false,
      reason: 'Am suficiente informații pentru un răspuns util',
    };
  }

  /**
   * Check if AI's response is asking for unnecessary clarifications
   */
  static isAskingUnnecessaryClarifications(response: string): boolean {
    const lowerResponse = response.toLowerCase();
    
    // Check if AI is asking about material/location for universal concepts
    const unnecessaryPatterns = [
      'este vorba despre instalații interioare sau',
      'ce tip de conductor/cablu folosiți',
      'cupru sau aluminiu',
      'interior sau exterior',
      'linii electrice aeriene',
      'ce tensiune nominală este în cauză',
    ];
    
    // If asking about these for universal concepts, it's unnecessary
    const isAskingUniversalDetails = unnecessaryPatterns.some(pattern => 
      lowerResponse.includes(pattern)
    );
    
    if (isAskingUniversalDetails) {
      return true;
    }

    // Check if it's a legitimate request for specific technical details
    const legitimatePatterns = [
      'ce putere',
      'ce curent',
      'ce secțiune exactă',
      'ce distanță',
      'ce tip de sol',
    ];
    
    const isLegitimate = legitimatePatterns.some(pattern =>
      lowerResponse.includes(pattern)
    );
    
    return !isLegitimate && isAskingUniversalDetails;
  }

  /**
   * Build a response that doesn't ask for unnecessary clarifications
   */
  static buildDirectResponse(
    subject: string,
    action: string,
    searchResults: any[]
  ): string {
    // For universal concepts, give direct answer
    const universalResponses: Record<string, string> = {
      'selectivitate': `**Selectivitatea** se realizează după principii generale valabile pentru orice instalație:

### Principii fundamentale:
1. **Raportul curenților 1:3** - dispozitivele din aval au curenți mai mici
2. **Temporizarea** - dispozitivele din amonte au timp de răspuns mai lung
3. **Tipuri de dispozitive** - DDR tip S (selective) în amonte, tip general în aval

### Exemplu practic pentru 3 tablouri:
- **Tablou principal**: DDR 300mA, tip S (150-500ms)
- **Tablou etaj**: DDR 100mA, tip S (150-500ms)  
- **Tablou final**: DDR 30mA, tip general (40-300ms)

**Notă:** Aceste principii sunt identice indiferent dacă folosiți conductoare de cupru sau aluminiu, instalații interioare sau exterioare. Doar dimensionările specifice (secțiuni, curenți) diferă în funcție de materiale și condiții.`,

      'scurtcircuit': `**Calculul curentului de scurtcircuit** urmărește aceeași metodologie indiferent de detalii:

### Formula de bază:
**Isc = Un / Z**

Unde:
- Un = tensiunea nominală
- Z = impedanța totală de scurtcircuit

### Pași:
1. Determină impedanța sursei
2. Adaugă impedanțele conductoarelor  
3. Calculează curentul în punctul de defect

Materialul conductorului (cupru/aluminiu) influențează doar valoarea rezistivității, nu metodologia de calcul.`,

      'tensiune': `**Categoriile de tensiune** sunt definite standardizat:

- **Tensiune foarte joasă (TFJ)**: U ≤ 50V CA sau 120V CC
- **Tensiune joasă (TJ)**: 50V < U ≤ 1000V CA sau 120V < U ≤ 1500V CC
- **Tensiune medie (TM)**: 1kV < U ≤ 35kV
- **Tensiune înaltă (TI)**: 35kV < U ≤ 220kV

Aceste definiții sunt aceleași pentru toate instalațiile electrice.`,
    };

    const key = Object.keys(universalResponses).find(k => 
      subject.toLowerCase().includes(k)
    );

    if (key) {
      return universalResponses[key];
    }

    // Default: return null to trigger AI generation
    // Don't return raw content for unknown subjects - let AI handle it
    return '';
  }
}
