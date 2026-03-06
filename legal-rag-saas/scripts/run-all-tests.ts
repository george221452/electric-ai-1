/**
 * Test Suite Complet - 100 întrebări
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALL_QUESTIONS = [
  // Basic (1-20)
  "Ce este un DDR?",
  "Ce reprezintă valoarea de 30mA pentru DDR?",
  "La ce înălțime se montează prizele în baie?",
  "Ce secțiune de cablu trebuie folosită pentru prize?",
  "Câte prize pot fi pe un circuit?",
  "Ce este împământarea de protecție?",
  "Cum se realizează priza de pământ în fundație?",
  "Ce tip de DDR trebuie în locuințe?",
  "Ce înălțime minimă trebuie să aibă tabloul electric?",
  "Se pot îngropa cablurile în șapă?",
  "Ce protecție trebuie pentru prizele din exterior?",
  "Cât trebuie să fie rezistența de împământare?",
  "Ce este legarea echipotentială?",
  "Când e obligatorie legarea echipotentială suplimentară?",
  "Ce tip de siguranțe se folosesc pentru iluminat?",
  "Cum se dimensionează conductorul de protecție PE?",
  "Ce distanță minimă trebuie între prize și gaz?",
  "Se poate pune priză în zona 2 a băii?",
  "Ce protecție IP trebuie în baie?",
  "Cum se realizează selectivitatea între siguranțe?",
  
  // Tehnice (21-40)
  "Ce reprezintă impedanța buclei de defect Zs?",
  "Cum se calculează curentul de scurtcircuit?",
  "Ce este factorul de putere și cum se corectează?",
  "Cum se dimensionează cablul de alimentare pentru motor?",
  "Ce protecție trebuie pentru instalația de iluminat exterior?",
  "Cum se realizează protecția la supratensiune?",
  "Ce este descărcarea atmosferică și cum se protejează?",
  "Cum se face separarea circuitelor în tablou?",
  "Ce este coordonarea protecțiilor?",
  "Cum se dimensionează bateria de condensatoare?",
  "Ce tip de cablu trebuie pentru instalații subterane?",
  "Cum se protejează cablurile împotriva șocurilor mecanice?",
  "Ce este clasa de protecție a echipamentelor?",
  "Cum se realizează protecția la incendiu?",
  "Ce verificări se fac la recepția instalației?",
  "Cum se măsoară rezistența de izolație?",
  "Ce este continuitatea conductoarelor de protecție?",
  "Cum se testează funcționarea DDR?",
  "Ce înseamnă verificarea prin măsurare?",
  "Cum se face documentația tehnică a instalației?",
  
  // Interdicții (41-60)
  "Ce nu este permis în instalațiile electrice?",
  "Ce interdicții există pentru conductoarele neizolate?",
  "Ce nu se admite în zonele periculoase?",
  "Ce obligații au executanții de instalații?",
  "Ce nu trebuie folosit ca electrod de pământ?",
  "Ce interdicții există pentru prize în băi?",
  "Ce nu este admis la trecerea cablurilor prin pereți?",
  "Ce obligații există pentru tablourile electrice?",
  "Ce nu se permite la împărțirea circuitelor?",
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
  "Ce interdicții există pentru instalațiile în exterior?",
  
  // Referințe (61-80)
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
  
  // Practice (81-100)
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

async function runAllTests() {
  const results: TestResult[] = [];
  
  console.log(`=== RULARE TESTE COMPLETE: ${ALL_QUESTIONS.length} întrebări ===\n`);
  
  for (let i = 0; i < ALL_QUESTIONS.length; i++) {
    const question = ALL_QUESTIONS[i];
    const category = i < 20 ? 'basic' : 
                    i < 40 ? 'technical' : 
                    i < 60 ? 'prohibitions' : 
                    i < 80 ? 'references' : 'practical';
    
    const startTime = Date.now();
    
    process.stdout.write(`[${String(i + 1).padStart(3)}/100] ${question.substring(0, 55).padEnd(55)} `);
    
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
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      const issues: string[] = [];
      let score = 5;
      
      const citations = data.data.citations?.length || 0;
      const confidence = data.data.confidence || 0;
      const hasPageRefs = data.data.answer?.includes('[pag.') || false;
      const answer = data.data.answer || '';
      
      if (citations === 0) {
        issues.push('Fara citari');
        score -= 3;
      }
      if (!hasPageRefs) {
        issues.push('Fara [pag.]');
        score -= 2;
      }
      if (confidence < 40) {
        issues.push(`Confidence scazut (${confidence}%)`);
        score -= 1;
      }
      if (answer.length < 50) {
        issues.push('Raspuns prea scurt');
        score -= 1;
      }
      
      if (citations >= 2 && hasPageRefs && confidence >= 50) {
        score += 2;
      }
      
      score = Math.max(0, Math.min(10, score));
      
      results.push({
        question,
        category,
        answer: answer.substring(0, 150),
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
      const time = Date.now() - startTime;
      console.log(`❌ EROARE: ${error.message}`);
      results.push({
        question,
        category,
        answer: 'ERROR',
        citations: 0,
        confidence: 0,
        hasPageRefs: false,
        time,
        score: 0,
        issues: [error.message],
      });
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  return results;
}

function generateFullReport(results: TestResult[]) {
  console.log('\n\n' + '='.repeat(80));
  console.log('RAPORT COMPLET - TESTARE SISTEM RAG');
  console.log('='.repeat(80) + '\n');
  
  // Statistici generale
  const total = results.length;
  const excellent = results.filter(r => r.score >= 8).length;
  const good = results.filter(r => r.score >= 6 && r.score < 8).length;
  const poor = results.filter(r => r.score >= 4 && r.score < 6).length;
  const failed = results.filter(r => r.score < 4).length;
  
  const avgScore = results.reduce((a, b) => a + b.score, 0) / total;
  const avgConfidence = results.reduce((a, b) => a + b.confidence, 0) / total;
  const avgTime = results.reduce((a, b) => a + b.time, 0) / total;
  const withCitations = results.filter(r => r.citations > 0).length;
  const withPageRefs = results.filter(r => r.hasPageRefs).length;
  
  console.log('STATISTICI GENERALE');
  console.log('-'.repeat(80));
  console.log(`Total teste:                    ${total}`);
  console.log(`Scor mediu:                     ${avgScore.toFixed(2)}/10`);
  console.log(`Confidence mediu:               ${avgConfidence.toFixed(1)}%`);
  console.log(`Timp mediu răspuns:             ${avgTime.toFixed(0)}ms`);
  console.log(`Răspunsuri cu citări:           ${withCitations}/${total} (${(withCitations/total*100).toFixed(0)}%)`);
  console.log(`Răspunsuri cu [pag.]:           ${withPageRefs}/${total} (${(withPageRefs/total*100).toFixed(0)}%)`);
  console.log('');
  
  console.log('DISTRIBUȚIE SCORURI');
  console.log('-'.repeat(80));
  console.log(`Excelente (8-10):               ${excellent} (${(excellent/total*100).toFixed(1)}%)`);
  console.log(`Bune (6-7):                     ${good} (${(good/total*100).toFixed(1)}%)`);
  console.log(`Slabe (4-5):                    ${poor} (${(poor/total*100).toFixed(1)}%)`);
  console.log(`Eșuate (0-3):                   ${failed} (${(failed/total*100).toFixed(1)}%)`);
  console.log('');
  
  // Pe categorii
  console.log('ANALIZĂ PE CATEGORII');
  console.log('-'.repeat(80));
  const categories = ['basic', 'technical', 'prohibitions', 'references', 'practical'];
  const catNames: Record<string, string> = {
    basic: 'De bază (1-20)',
    technical: 'Tehnice (21-40)',
    prohibitions: 'Interdicții (41-60)',
    references: 'Referințe (61-80)',
    practical: 'Practice (81-100)',
  };
  
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catAvg = catResults.reduce((a, b) => a + b.score, 0) / catResults.length;
    const catPass = catResults.filter(r => r.score >= 6).length;
    const catConf = catResults.reduce((a, b) => a + b.confidence, 0) / catResults.length;
    
    console.log(`${catNames[cat].padEnd(30)} Medie: ${catAvg.toFixed(1)}/10 | Trecute: ${catPass}/${catResults.length} | Conf: ${catConf.toFixed(0)}%`);
  }
  console.log('');
  
  // Top 10 cele mai bune
  console.log('TOP 10 CELE MAI BUNE RĂSPUNSURI');
  console.log('-'.repeat(80));
  const best = [...results].sort((a, b) => b.score - a.score).slice(0, 10);
  best.forEach((r, i) => {
    console.log(`${String(i+1).padStart(2)}. [${r.score}/10] ${r.question.substring(0, 60)}...`);
  });
  console.log('');
  
  // Top 10 cele mai slabe
  console.log('TOP 10 CELE MAI SLABE RĂSPUNSURI');
  console.log('-'.repeat(80));
  const worst = [...results].sort((a, b) => a.score - b.score).slice(0, 10);
  worst.forEach((r, i) => {
    console.log(`${String(i+1).padStart(2)}. [${r.score}/10] ${r.question.substring(0, 50)}...`);
    console.log(`    Probleme: ${r.issues.join(', ')}`);
  });
  console.log('');
  
  // Probleme frecvente
  console.log('PROBLEME FRECVENTE');
  console.log('-'.repeat(80));
  const allIssues = results.flatMap(r => r.issues);
  const issueCounts: Record<string, number> = {};
  for (const issue of allIssues) {
    issueCounts[issue] = (issueCounts[issue] || 0) + 1;
  }
  const sortedIssues = Object.entries(issueCounts).sort((a, b) => b[1] - a[1]);
  for (const [issue, count] of sortedIssues.slice(0, 8)) {
    console.log(`  ${issue}: ${count} cazuri`);
  }
  console.log('');
  
  // Salvare JSON
  const fs = require('fs');
  fs.writeFileSync('./test-report-complete.json', JSON.stringify(results, null, 2));
  console.log('='.repeat(80));
  console.log('✅ Raport salvat în: test-report-complete.json');
  console.log('='.repeat(80));
}

runAllTests()
  .then(generateFullReport)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
