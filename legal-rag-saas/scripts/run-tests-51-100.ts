/**
 * Teste 51-100
 */

const QUESTIONS_51_100 = [
  "Ce interdicții există pentru instalațiile în spații cu risc de incendiu?",
  "Ce nu este permis la racordarea echipamentelor?",
  "Ce obligații există pentru etichetarea circuitelor?",
  "Ce nu se admite la folosirea conductorilor de protecție?",
  "Ce interdicții există pentru instalațiile temporare?",
  "Ce obligații are proprietarul la exploatarea instalației?",
  "Ce nu este permis la modificarea instalației?",
  "Ce interdicții există pentru cablurile în șanțuri?",
  "Ce obligații există pentru verificările periodice?",
  "Ce nu se permite la montarea aparatelor de măsură?",
  "Ce spune articolul 4.1.5 despre DDR?",
  "Ce conține tabelul 4.1 din normativ?",
  "Ce prevede articolul 5.5.3 despre conductoare?",
  "Ce spune tabelul 5.18 despre secțiuni?",
  "Ce conține articolul 7.2 despre prize?",
  "Ce prevede tabelul 6.21 despre electrozi?",
  "Ce spune articolul 4.3.6 despre protecții?",
  "Ce conține tabelul 4.2 despre clase de protecție?",
  "Ce prevede articolul 6.3 despre băi?",
  "Ce spune tabelul 6.5 despre conductoare de legare?",
  "Ce conține articolul 5.6 despre cabluri?",
  "Ce prevede tabelul 4.3 despre tensiuni?",
  "Ce spune articolul 7.4 despre iluminat?",
  "Ce conține tabelul 5.1 despre moduri de pozare?",
  "Ce prevede articolul 4.1.4 despre protecția la defect?",
  "Ce spune tabelul 4.6 despre supratensiuni?",
  "Ce conține articolul 5.2 despre conductoare?",
  "Ce prevede tabelul 3.1 despre distanțe?",
  "Ce spune articolul 7.21 despre condensatoare?",
  "Ce conține tabelul 5.11 despre curenți admisibili?",
  "Cum instalez priza pentru mașina de spălat în baie?",
  "Ce trebuie să fac pentru împământarea casei noi?",
  "Cum protejez instalația de descărcări atmosferice?",
  "Ce cablu folosesc pentru tabloul electric exterior?",
  "Cum realizez iluminatul în grădină conform normativului?",
  "Ce trebuie pentru instalația electrică în garaj?",
  "Cum montez corect un tablou electric încastrat?",
  "Ce protecții trebuie pentru pompă de căldură?",
  "Cum fac separarea circuitelor într-o casă modernă?",
  "Ce verificări fac înainte de recepție?",
  "Cum dimensionez cablul pentru plită electrică?",
  "Ce trebuie pentru instalație în beci cu umiditate?",
  "Cum protejez circuitele sensibile cu UPS?",
  "Ce fac pentru instalație fotovoltaică conectată la rețea?",
  "Cum montez corpuri de iluminat în tavan fals?",
  "Ce trebuie pentru priza de rulotă în curte?",
  "Cum realizez împământarea pentru antenă TV?",
  "Ce protecții trebuie pentru centrală termică?",
  "Cum fac trecerea cablurilor prin fundație?",
  "Ce documente trebuie la finalizarea instalației?",
];

interface TestResult {
  question: string;
  category: string;
  answer: string;
  citations: number;
  confidence: number;
  hasPageRefs: boolean;
  time: number;
  score: number;
  issues: string[];
}

async function runTests() {
  const results: TestResult[] = [];
  
  console.log('=== TESTE 51-100 ===\n');
  
  for (let i = 0; i < QUESTIONS_51_100.length; i++) {
    const question = QUESTIONS_51_100[i];
    const num = i + 51;
    const category = num <= 60 ? 'prohibitions' : 
                    num <= 80 ? 'references' : 'practical';
    
    const startTime = Date.now();
    
    process.stdout.write(`[${String(num).padStart(3)}/100] ${question.substring(0, 55).padEnd(55)} `);
    
    try {
      const response = await fetch('http://localhost:3000/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: question,
          workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });
      
      const time = Date.now() - startTime;
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      const issues: string[] = [];
      let score = 5;
      
      const citations = data.data.citations?.length || 0;
      const confidence = data.data.confidence || 0;
      const hasPageRefs = data.data.answer?.includes('[pag.') || false;
      
      if (citations === 0) { issues.push('Fara citari'); score -= 3; }
      if (!hasPageRefs) { issues.push('Fara [pag.]'); score -= 2; }
      if (confidence < 40) { issues.push(`Conf scazut`); score -= 1; }
      
      if (citations >= 2 && hasPageRefs && confidence >= 50) score += 2;
      score = Math.max(0, Math.min(10, score));
      
      results.push({
        question,
        category,
        answer: data.data.answer?.substring(0, 150) || 'NO ANSWER',
        citations,
        confidence,
        hasPageRefs,
        time,
        score,
        issues,
      });
      
      const icon = score >= 7 ? '✅' : score >= 5 ? '⚠️' : '❌';
      console.log(`${icon} ${citations}c ${confidence.toString().padStart(2)}% ${time.toString().padStart(4)}ms`);
      
    } catch (error: any) {
      console.log(`❌ EROARE: ${error.message}`);
      results.push({
        question,
        category,
        answer: 'ERROR',
        citations: 0,
        confidence: 0,
        hasPageRefs: false,
        time: Date.now() - startTime,
        score: 0,
        issues: [error.message],
      });
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Statistici
  console.log('\n\n=== REZULTATE 51-100 ===\n');
  const total = results.length;
  const avgScore = results.reduce((a, b) => a + b.score, 0) / total;
  const avgConf = results.reduce((a, b) => a + b.confidence, 0) / total;
  const withCitations = results.filter(r => r.citations > 0).length;
  const withPageRefs = results.filter(r => r.hasPageRefs).length;
  
  console.log(`Total: ${total}`);
  console.log(`Scor mediu: ${avgScore.toFixed(2)}/10`);
  console.log(`Confidence mediu: ${avgConf.toFixed(1)}%`);
  console.log(`Cu citări: ${withCitations}/${total}`);
  console.log(`Cu [pag.]: ${withPageRefs}/${total}`);
  
  // Salvează
  const fs = require('fs');
  fs.writeFileSync('./test-results-51-100.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Salvat în: test-results-51-100.json');
}

runTests().catch(console.error);
