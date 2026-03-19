/**
 * Script de testare RAG - testează sistemul cu întrebări din normative
 * Usage: npx tsx test-rag-questions.ts [număr întrebări] [fișier JSON]
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestQuestion {
  id: number;
  question: string;
  varianta_a?: string;
  varianta_b?: string;
  varianta_c?: string;
  correct?: string;
  answer?: string;
}

interface TestResult {
  id: number;
  question: string;
  aiAnswer: string;
  expectedAnswer?: string;
  citations: any[];
  confidence: number;
  responseTime: number;
  error?: string;
}

const API_URL = process.env.API_URL || 'http://localhost:3000/api/rag/query';
const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';

async function testQuestion(question: TestQuestion): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: question.question,
        workspaceId: WORKSPACE_ID,
        options: { maxParagraphs: 5 }
      })
    });

    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        id: question.id,
        question: question.question,
        aiAnswer: '',
        expectedAnswer: question.correct || question.answer,
        citations: [],
        confidence: 0,
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();
    
    return {
      id: question.id,
      question: question.question,
      aiAnswer: data.data?.answer || data.data?.question || 'Fără răspuns',
      expectedAnswer: question.correct || question.answer,
      citations: data.data?.citations || [],
      confidence: data.data?.confidence || 0,
      responseTime
    };
  } catch (error) {
    return {
      id: question.id,
      question: question.question,
      aiAnswer: '',
      expectedAnswer: question.correct || question.answer,
      citations: [],
      confidence: 0,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function runTests() {
  const numQuestions = parseInt(process.argv[2]) || 5;
  const jsonFile = process.argv[3] || 'legislatie_anre_150_intrebari.json';
  
  console.log(`🧪 Testare RAG cu ${numQuestions} întrebări din ${jsonFile}`);
  console.log('=' .repeat(80));
  
  // Încarcă întrebările
  const filePath = path.join(__dirname, jsonFile);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Fișierul nu există: ${filePath}`);
    console.log('Fișiere disponibile:');
    console.log('  - legislatie_anre_150_intrebari.json');
    console.log('  - normative_2023_gradul_3a.json');
    console.log('  - INTREBARI_PENTRU_TEST.json');
    process.exit(1);
  }
  
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const questions: TestQuestion[] = content.questions || content;
  
  // Selectează random întrebări
  const selectedQuestions = questions
    .sort(() => Math.random() - 0.5)
    .slice(0, numQuestions);
  
  console.log(`📋 Întrebări selectate: ${selectedQuestions.length} din ${questions.length}`);
  console.log('');
  
  const results: TestResult[] = [];
  
  for (let i = 0; i < selectedQuestions.length; i++) {
    const q = selectedQuestions[i];
    console.log(`\n📝 [${i + 1}/${selectedQuestions.length}] ${q.question.substring(0, 80)}...`);
    
    const result = await testQuestion(q);
    results.push(result);
    
    // Afișare rapidă
    if (result.error) {
      console.log(`   ❌ EROARE: ${result.error}`);
    } else {
      console.log(`   ⏱️  ${result.responseTime}ms | 📊 ${result.confidence}% confidence`);
      console.log(`   📚 ${result.citations.length} surse citate`);
      console.log(`   💡 Răspuns: ${result.aiAnswer.substring(0, 100)}...`);
      if (result.expectedAnswer) {
        console.log(`   ✅ Răspuns așteptat: ${result.expectedAnswer}`);
      }
    }
  }
  
  // Raport final
  console.log('\n');
  console.log('=' .repeat(80));
  console.log('📊 RAPORT FINAL');
  console.log('=' .repeat(80));
  
  const successful = results.filter(r => !r.error).length;
  const withCitations = results.filter(r => r.citations.length > 0).length;
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  
  console.log(`✅ Teste reușite: ${successful}/${results.length}`);
  console.log(`📚 Cu citări: ${withCitations}/${results.length}`);
  console.log(`📊 Confidence mediu: ${avgConfidence.toFixed(1)}%`);
  console.log(`⏱️  Timp mediu răspuns: ${avgResponseTime.toFixed(0)}ms`);
  
  // Salvează rezultatele
  const outputFile = `test-rag-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(outputFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    config: { numQuestions, jsonFile, apiUrl: API_URL },
    summary: {
      total: results.length,
      successful,
      withCitations,
      avgConfidence,
      avgResponseTime
    },
    results
  }, null, 2));
  
  console.log(`\n💾 Rezultate salvate în: ${outputFile}`);
}

runTests().catch(console.error);
