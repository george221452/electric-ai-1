/**
 * Test RAG System - Normative Full (227 questions)
 * Optimized for parallel processing
 */

import * as fs from 'fs';
import * as path from 'path';

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const API_URL = 'http://localhost:3000/api/rag/query';
const CONCURRENCY = 5;

interface Question {
  id: number;
  question: string;
  varianta_a: string;
  varianta_b: string;
  varianta_c: string;
  correct: 'a' | 'b' | 'c';
}

interface TestResult {
  questionId: number;
  question: string;
  expected: string;
  actual: string | null;
  correct: boolean;
  confidence: number;
  citationsCount: number;
  needsClarification: boolean;
  error?: string;
}

interface TestReport {
  total: number;
  correct: number;
  incorrect: number;
  noAnswer: number;
  accuracy: number;
  results: TestResult[];
  timestamp: string;
  duration: number;
}

function loadQuestions(): Question[] {
  const filePath = path.join(process.cwd(), 'normative_2023_gradul_3a.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return data.questions;
}

function formatQuestionWithVariants(q: Question): string {
  return q.question + '\na) ' + q.varianta_a + '\nb) ' + q.varianta_b + '\nc) ' + q.varianta_c;
}

function parseQuizAnswer(answer: string | null): string | null {
  if (!answer) return null;
  
  const patterns = [
    /(?:răspuns\s*(?:corect|final)?[\s:)*]+)?([abc])\s*[).]/i,
    /variant[aă]\s*([abc])/i,
    /^\s*([abc])\s*$/im,
    /opțiunea\s*([abc])/i,
    /([abc])\s*(?:este\s*)?(?:răspunsul\s*)?(?:corect)/i,
  ];
  
  for (const pattern of patterns) {
    const match = answer.match(pattern);
    if (match) return match[1].toLowerCase();
  }
  
  const lines = answer.split('\n');
  for (const line of lines) {
    const cleanLine = line.trim().toLowerCase();
    if (cleanLine === 'a' || cleanLine === 'b' || cleanLine === 'c') {
      return cleanLine;
    }
  }
  
  return null;
}

async function testSingleQuestion(q: Question): Promise<TestResult> {
  const formattedQuestion = formatQuestionWithVariants(q);
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: formattedQuestion,
        workspaceId: WORKSPACE_ID,
        options: { maxParagraphs: 5 }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        questionId: q.id, question: q.question, expected: q.correct,
        actual: null, correct: false, confidence: 0,
        citationsCount: 0, needsClarification: false, error: 'HTTP ' + response.status
      };
    }

    const data = await response.json();
    
    if (!data.success) {
      return {
        questionId: q.id, question: q.question, expected: q.correct,
        actual: null, correct: false, confidence: 0,
        citationsCount: 0, needsClarification: false, error: data.error || 'API error'
      };
    }

    const answerData = data.data;
    const parsedAnswer = parseQuizAnswer(answerData.answer);
    const isCorrect = parsedAnswer === q.correct;
    
    return {
      questionId: q.id, question: q.question, expected: q.correct,
      actual: parsedAnswer, correct: isCorrect,
      confidence: answerData.confidence || 0,
      citationsCount: answerData.citations?.length || 0,
      needsClarification: answerData.needsClarification || false
    };
    
  } catch (error) {
    return {
      questionId: q.id, question: q.question, expected: q.correct,
      actual: null, correct: false, confidence: 0,
      citationsCount: 0, needsClarification: false,
      error: error instanceof Error ? error.message.slice(0, 50) : 'Error'
    };
  }
}

async function processBatch(questions: Question[]): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  for (let i = 0; i < questions.length; i += CONCURRENCY) {
    const batch = questions.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(q => testSingleQuestion(q)));
    results.push(...batchResults);
    
    process.stdout.write('\r⏳ Progress: ' + Math.min(i + CONCURRENCY, questions.length) + '/' + questions.length + 
      ' (' + ((Math.min(i + CONCURRENCY, questions.length) / questions.length) * 100).toFixed(0) + '%)');
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

async function runTest(): Promise<TestReport> {
  const questions = loadQuestions();
  
  console.log('\n🧪 Starting FULL Normative RAG Test');
  console.log('📊 Total questions: ' + questions.length);
  console.log('⏱️  Started at: ' + new Date().toISOString());
  console.log('🔄 Concurrency: ' + CONCURRENCY + '\n');
  
  const startTime = Date.now();
  const results = await processBatch(questions);
  const duration = Date.now() - startTime;
  
  const correct = results.filter(r => r.correct).length;
  const noAnswer = results.filter(r => r.actual === null).length;
  const incorrect = results.length - correct - noAnswer;
  const accuracy = (correct / results.length) * 100;
  
  return {
    total: results.length, correct, incorrect, noAnswer, accuracy,
    results: results.sort((a, b) => a.questionId - b.questionId),
    timestamp: new Date().toISOString(), duration
  };
}

function generateMarkdownReport(report: TestReport): string {
  let md = '# 📊 Raport Test Complet RAG - Normative Tehnice 2023 (Gradul III-A)\n\n';
  md += '**Data testului:** ' + new Date(report.timestamp).toLocaleString('ro-RO') + '\n';
  md += '**Durata:** ' + (report.duration / 1000).toFixed(1) + ' secunde\n\n';
  md += '---\n\n';
  md += '## 📈 Rezultate Generale\n\n';
  md += '| Metric | Valoare |\n|--------|---------|\n';
  md += '| **Total întrebări** | ' + report.total + ' |\n';
  md += '| **Corecte** | ' + report.correct + ' (' + (report.correct/report.total*100).toFixed(1) + '%) |\n';
  md += '| **Incorecte** | ' + report.incorrect + ' (' + (report.incorrect/report.total*100).toFixed(1) + '%) |\n';
  md += '| **Fără răspuns** | ' + report.noAnswer + ' (' + (report.noAnswer/report.total*100).toFixed(1) + '%) |\n';
  md += '| **Acuratețe** | **' + report.accuracy.toFixed(1) + '%** |\n\n';
  
  md += '## 📋 Rezultate Complete\n\n';
  md += '| ID | Status | Așteptat | Primit | Conf | Citări |\n';
  md += '|----|--------|----------|--------|------|--------|\n';
  
  for (const r of report.results) {
    const status = r.correct ? '✅' : r.actual === null ? '⚠️' : '❌';
    const actual = r.actual ?? 'N/A';
    md += '| ' + r.questionId + ' | ' + status + ' | ' + r.expected.toUpperCase() + ' | ' + actual.toUpperCase() + ' | ' + r.confidence.toFixed(0) + '% | ' + r.citationsCount + ' |\n';
  }
  
  md += '\n';
  
  const incorrectResults = report.results.filter(r => !r.correct && r.actual !== null);
  if (incorrectResults.length > 0) {
    md += '## ❌ Răspunsuri Incorecte (Top 20)\n\n';
    for (const r of incorrectResults.slice(0, 20)) {
      md += '### #' + r.questionId + '\n';
      md += '- **Întrebare:** ' + r.question + '\n';
      md += '- **Așteptat:** ' + r.expected.toUpperCase() + ' | **Primit:** ' + (r.actual ?? 'N/A').toUpperCase() + '\n';
      md += '- **Confidence:** ' + r.confidence.toFixed(0) + '%\n\n';
    }
  }
  
  md += '---\n\n*Raport generat automat*';
  return md;
}

async function main() {
  const report = await runTest();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const mdPath = path.join(process.cwd(), 'REPORT_NORMATIVE_FULL_' + timestamp + '.md');
  const jsonPath = path.join(process.cwd(), 'REPORT_NORMATIVE_FULL_' + timestamp + '.json');
  
  fs.writeFileSync(mdPath, generateMarkdownReport(report));
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  
  console.log('\n\n✅ Test completed!');
  console.log('📊 Accuracy: ' + report.accuracy.toFixed(1) + '%');
  console.log('✅ Correct: ' + report.correct + '/' + report.total);
  console.log('❌ Incorrect: ' + report.incorrect);
  console.log('⚠️  No answer: ' + report.noAnswer);
  console.log('\n📁 Reports saved:');
  console.log('   - Markdown: ' + mdPath);
  console.log('   - JSON: ' + jsonPath);
}

main().catch(console.error);
