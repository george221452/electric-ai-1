/**
 * Test Enhanced System v2.0
 * Testează îmbunătățirile pentru acuratețe >80%
 */

import * as fs from 'fs';
import * as path from 'path';
import EnhancedQuizHandler from './lib/quiz/enhanced-quiz-handler';
import { EnhancedSmartRouter } from './lib/quiz/enhanced-smart-router';

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const API_URL = 'http://localhost:3000/api/rag/query';
const CONCURRENCY = 2;

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
  method: string;
  verificationSteps: string[];
  error?: string;
}

function loadQuestions(): Question[] {
  const filePath = path.join(process.cwd(), 'normative_2023_gradul_3a.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return data.questions;
}

function formatQuestionWithVariants(q: Question): string {
  return `${q.question}\na) ${q.varianta_a}\nb) ${q.varianta_b}\nc) ${q.varianta_c}`;
}

async function searchForContext(query: string) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        workspaceId: WORKSPACE_ID,
        options: { maxParagraphs: 5 }
      })
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    if (!data.success) return [];
    
    const citations = data.data?.citations || [];
    return citations.map((c: any) => ({
      paragraphId: c.paragraphId || c.index,
      documentId: c.documentId,
      content: c.text,
      score: c.score || (c.confidence / 100),
      confidence: c.confidence,
      metadata: {
        pageNumber: c.pageNumber,
        articleNumber: c.articleNumber,
        paragraphLetter: c.paragraphLetter,
      }
    }));
  } catch {
    return [];
  }
}

async function testQuestion(router: EnhancedSmartRouter, q: Question): Promise<TestResult> {
  const formatted = formatQuestionWithVariants(q);
  
  try {
    const citations = await searchForContext(q.question);
    
    if (citations.length === 0) {
      return {
        questionId: q.id,
        question: q.question,
        expected: q.correct,
        actual: null,
        correct: false,
        confidence: 0,
        method: 'none',
        verificationSteps: ['no_citations'],
        error: 'No citations'
      };
    }
    
    const result = await router.generateAnswer(formatted, citations);
    const answerLetter = result.answer.toLowerCase().match(/^[abc]/)?.[0] || null;
    const isCorrect = answerLetter === q.correct;
    
    return {
      questionId: q.id,
      question: q.question,
      expected: q.correct,
      actual: answerLetter,
      correct: isCorrect,
      confidence: result.confidence,
      method: result.method,
      verificationSteps: result.metadata.verificationSteps
    };
    
  } catch (error) {
    return {
      questionId: q.id,
      question: q.question,
      expected: q.correct,
      actual: null,
      correct: false,
      confidence: 0,
      method: 'error',
      verificationSteps: [],
      error: error instanceof Error ? error.message.slice(0, 50) : 'Error'
    };
  }
}

async function runTest(limit?: number) {
  const questions = loadQuestions();
  const testQuestions = limit ? questions.slice(0, limit) : questions;
  
  const router = new EnhancedSmartRouter();
  
  console.log(`\n🚀 Testing ENHANCED System v2.0`);
  console.log(`   ${testQuestions.length} questions\n`);
  
  const results: TestResult[] = [];
  const startTime = Date.now();
  
  for (let i = 0; i < testQuestions.length; i += CONCURRENCY) {
    const batch = testQuestions.slice(i, i + CONCURRENCY);
    process.stdout.write(`\r⏳ ${Math.min(i + CONCURRENCY, testQuestions.length)}/${testQuestions.length}`);
    
    const batchResults = await Promise.all(
      batch.map(q => testQuestion(router, q))
    );
    results.push(...batchResults);
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  const duration = Date.now() - startTime;
  
  // Stats
  const correct = results.filter(r => r.correct).length;
  const byMethod: Record<string, number> = {};
  
  for (const r of results) {
    byMethod[r.method] = (byMethod[r.method] || 0) + 1;
  }
  
  return {
    total: results.length,
    correct,
    incorrect: results.length - correct,
    accuracy: (correct / results.length) * 100,
    duration,
    byMethod,
    results: results.sort((a, b) => a.questionId - b.questionId)
  };
}

function generateReport(report: any) {
  let md = '# 📊 Raport Test ENHANCED System v2.0\n\n';
  md += `**Data:** ${new Date().toLocaleString('ro-RO')}\n`;
  md += `**Durată:** ${(report.duration / 1000).toFixed(1)} sec\n\n`;
  
  md += '## 📈 Rezultate\n\n';
  md += '| Metric | Valoare |\n';
  md += '|--------|---------|\n';
  md += `| Total | ${report.total} |\n`;
  md += `| Corecte ✅ | ${report.correct} (${(report.correct/report.total*100).toFixed(1)}%) |\n`;
  md += `| Incorecte ❌ | ${report.incorrect} (${(report.incorrect/report.total*100).toFixed(1)}%) |\n`;
  md += `| **Acuratețe** | **${report.accuracy.toFixed(1)}%** |\n\n`;
  
  md += '## 🔧 Metode utilizate\n\n';
  md += '| Metodă | Count |\n';
  md += '|--------|-------|\n';
  for (const [method, count] of Object.entries(report.byMethod)) {
    md += `| ${method} | ${count} |\n`;
  }
  md += '\n';
  
  md += '## 📋 Rezultate complete\n\n';
  md += '| ID | Status | Așteptat | Primit | Conf | Metodă |\n';
  md += '|----|--------|----------|--------|------|--------|\n';
  
  for (const r of report.results) {
    const status = r.correct ? '✅' : r.error ? '⚠️' : '❌';
    const actual = r.actual?.toUpperCase() || 'N/A';
    md += `| ${r.questionId} | ${status} | ${r.expected.toUpperCase()} | ${actual} | ${r.confidence.toFixed(0)}% | ${r.method} |\n`;
  }
  
  // Erori
  const incorrect = report.results.filter((r: any) => !r.correct);
  if (incorrect.length > 0) {
    md += '\n## ❌ Răspunsuri incorecte\n\n';
    for (const r of incorrect.slice(0, 20)) {
      md += `### #${r.questionId}\n`;
      md += `- Q: ${r.question.substring(0, 100)}...\n`;
      md += `- Așteptat: **${r.expected.toUpperCase()}** | Primit: ${(r.actual || 'N/A').toUpperCase()}\n`;
      md += `- Metodă: ${r.method}, Confidence: ${r.confidence.toFixed(0)}%\n\n`;
    }
  }
  
  md += '\n---\n*Enhanced System v2.0*\n';
  return md;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--full') ? undefined : 20;
  
  const report = await runTest(limit);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const mdPath = path.join(process.cwd(), `ENHANCED_REPORT_${timestamp}.md`);
  
  fs.writeFileSync(mdPath, generateReport(report));
  
  console.log('\n\n✅ Test complet!');
  console.log(`🎯 Acuratețe: ${report.accuracy.toFixed(1)}%`);
  console.log(`✅ Corecte: ${report.correct}/${report.total}`);
  console.log(`📁 Raport: ${mdPath}`);
}

main().catch(console.error);
