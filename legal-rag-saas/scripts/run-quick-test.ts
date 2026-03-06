/**
 * Test rapid - 20 întrebări
 */

const TEST_QUESTIONS = [
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
];

interface TestResult {
  question: string;
  answer: string;
  citations: number;
  confidence: number;
  hasPageRefs: boolean;
  time: number;
  error?: string;
}

async function runQuickTest() {
  const results: TestResult[] = [];
  
  console.log('=== TEST RAPID - 20 ÎNTREBĂRI ===\n');
  
  for (let i = 0; i < TEST_QUESTIONS.length; i++) {
    const question = TEST_QUESTIONS[i];
    const startTime = Date.now();
    
    console.log(`[${i + 1}/20] ${question}`);
    
    try {
      const response = await fetch('http://localhost:3000/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: question,
          workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const time = Date.now() - startTime;
      
      const result: TestResult = {
        question,
        answer: data.data.answer?.substring(0, 200) || 'NO ANSWER',
        citations: data.data.citations?.length || 0,
        confidence: data.data.confidence || 0,
        hasPageRefs: data.data.answer?.includes('[pag.') || false,
        time,
      };
      
      results.push(result);
      
      // Afișează rezumat rapid
      const status = result.citations > 0 && result.hasPageRefs ? '✅' : '⚠️';
      console.log(`    ${status} ${result.citations} citări, ${result.confidence}% confidence, ${time}ms`);
      
    } catch (error: any) {
      console.error(`    ❌ Eroare: ${error.message}`);
      results.push({
        question,
        answer: 'ERROR',
        citations: 0,
        confidence: 0,
        hasPageRefs: false,
        time: Date.now() - startTime,
        error: error.message,
      });
    }
    
    // Pauză de 300ms între cereri
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Raport final
  console.log('\n\n=== RAPORT FINAL ===\n');
  
  const total = results.length;
  const withCitations = results.filter(r => r.citations > 0).length;
  const withPageRefs = results.filter(r => r.hasPageRefs).length;
  const avgConfidence = results.reduce((a, b) => a + b.confidence, 0) / total;
  const avgTime = results.reduce((a, b) => a + b.time, 0) / total;
  
  console.log(`Total teste: ${total}`);
  console.log(`Cu citări: ${withCitations}/${total} (${(withCitations/total*100).toFixed(0)}%)`);
  console.log(`Cu referințe [pag.]: ${withPageRefs}/${total} (${(withPageRefs/total*100).toFixed(0)}%)`);
  console.log(`Confidence mediu: ${avgConfidence.toFixed(1)}%`);
  console.log(`Timp mediu răspuns: ${avgTime.toFixed(0)}ms`);
  
  // Detalii
  console.log('\n=== DETALII ===\n');
  results.forEach((r, i) => {
    const icon = r.citations > 0 && r.hasPageRefs ? '✅' : r.citations > 0 ? '⚠️' : '❌';
    console.log(`${icon} [${i+1}] ${r.question.substring(0, 50)}...`);
    console.log(`    Citări: ${r.citations}, Confidence: ${r.confidence}%, Timp: ${r.time}ms`);
    if (r.answer !== 'ERROR' && r.answer !== 'NO ANSWER') {
      console.log(`    Răspuns: ${r.answer.substring(0, 100)}...`);
    }
    if (r.error) {
      console.log(`    Eroare: ${r.error}`);
    }
    console.log('');
  });
}

runQuickTest().catch(console.error);
