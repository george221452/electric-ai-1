/**
 * Test Normative with Dual Mode System
 * Tests both Quiz and Normal modes on normative questions
 */

import * as fs from 'fs';
import * as path from 'path';
import AdvancedQuizHandler from './lib/quiz/advanced-quiz-handler';
import { SmartAnswerRouter } from './lib/quiz/smart-answer-router';

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const API_URL = 'http://localhost:3000/api/rag/query';
const CONCURRENCY = 3;

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
  answerType: 'quiz' | 'normal';
  isNumericMatch: boolean;
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

async function testQuestion(router: SmartAnswerRouter, q: Question): Promise<TestResult> {
  const formatted = formatQuestionWithVariants(q);
  
  try {
    // Get search context
    const citations = await searchForContext(q.question);
    
    if (citations.length === 0) {
      return {
        questionId: q.id,
        question: q.question,
        expected: q.correct,
        actual: null,
        correct: false,
        confidence: 0,
        answerType: 'quiz',
        isNumericMatch: false,
        error: 'No citations found'
      };
    }
    
    // Use smart router
    const result = await router.generateAnswer(formatted, citations);
    
    // Parse answer letter from result
    const answerLetter = result.answer.toLowerCase().match(/^[abc]/)?.[0] || null;
    const isCorrect = answerLetter === q.correct;
    
    return {
      questionId: q.id,
      question: q.question,
      expected: q.correct,
      actual: answerLetter,
      correct: isCorrect,
      confidence: result.confidence,
      answerType: result.type,
      isNumericMatch: result.metadata.isNumericMatch || false
    };
    
  } catch (error) {
    return {
      questionId: q.id,
      question: q.question,
      expected: q.correct,
      actual: null,
      correct: false,
      confidence: 0,
      answerType: 'quiz',
      isNumericMatch: false,
      error: error instanceof Error ? error.message.slice(0, 50) : 'Error'
    };
  }
}

async function runTest(limit?: number) {
  const questions = loadQuestions();
  const testQuestions = limit ? questions.slice(0, limit) : questions;
  
  const router = new SmartAnswerRouter();
  
  console.log(`\n🧪 Testing ${testQuestions.length} questions with Dual Mode System\n`);
  
  const results: TestResult[] = [];
  const startTime = Date.now();
  
  for (let i = 0; i < testQuestions.length; i += CONCURRENCY) {
    const batch = testQuestions.slice(i, i + CONCURRENCY);
    process.stdout.write(`\r⏳ Progress: ${Math.min(i + CONCURRENCY, testQuestions.length)}/${testQuestions.length}`);
    
    const batchResults = await Promise.all(
      batch.map(q => testQuestion(router, q))
    );
    results.push(...batchResults);
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  const duration = Date.now() - startTime;
  
  // Calculate stats
  const correct = results.filter(r => r.correct).length;
  const numericMatches = results.filter(r => r.isNumericMatch).length;
  const errors = results.filter(r => r.error).length;
  const accuracy = (correct / results.length) * 100;
  
  return {
    total: results.length,
    correct,
    incorrect: results.length - correct,
    numericMatches,
    errors,
    accuracy,
    duration,
    results: results.sort((a, b) => a.questionId - b.questionId)
  };
}

function generateReport(report: any) {
  let md = '# 📊 Raport Test Dual Mode - Normative Tehnice\n\n';
  md += `**Data:** ${new Date().toLocaleString('ro-RO')}\n`;
  md += `**Durată:** ${(report.duration / 1000).toFixed(1)} secunde\n\n`;
  
  md += '## 📈 Rezultate\n\n';
  md += '| Metric | Valoare |\n';
  md += '|--------|---------|\n';
  md += `| Total întrebări | ${report.total} |\n`;
  md += `| Corecte ✅ | ${report.correct} (${(report.correct/report.total*100).toFixed(1)}%) |\n`;
  md += `| Incorecte ❌ | ${report.incorrect} (${(report.incorrect/report.total*100).toFixed(1)}%) |\n`;
  md += `| Match numeric 🔢 | ${report.numericMatches} |\n`;
  md += `| Erori ⚠️ | ${report.errors} |\n`;
  md += `| **Acuratețe** | **${report.accuracy.toFixed(1)}%** |\n\n`;
  
  md += '## 📋 Rezultate Detaliate\n\n';
  md += '| ID | Status | Răspuns | Așteptat | Conf | Type | Numeric |\n';
  md += '|----|--------|---------|----------|------|------|---------|\n';
  
  for (const r of report.results) {
    const status = r.correct ? '✅' : r.error ? '⚠️' : '❌';
    const actual = r.actual?.toUpperCase() || 'N/A';
    const numeric = r.isNumericMatch ? '🔢' : '';
    md += `| ${r.questionId} | ${status} | ${actual} | ${r.expected.toUpperCase()} | ${r.confidence.toFixed(0)}% | ${r.answerType} | ${numeric} |\n`;
  }
  
  md += '\n';
  
  // Incorrect answers
  const incorrect = report.results.filter((r: any) => !r.correct && !r.error);
  if (incorrect.length > 0) {
    md += '## ❌ Răspunsuri Incorecte\n\n';
    for (const r of incorrect.slice(0, 15)) {
      md += `### #${r.questionId}\n`;
      md += `- Q: ${r.question}\n`;
      md += `- Așteptat: **${r.expected.toUpperCase()}** | Primit: ${(r.actual || 'N/A').toUpperCase()}\n`;
      md += `- Confidence: ${r.confidence.toFixed(0)}%\n\n`;
    }
  }
  
  md += '\n---\n*Raport generat de sistemul Dual Mode*\n';
  
  return md;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--full') ? undefined : 20;
  
  console.log(limit ? `Running test on first ${limit} questions...` : 'Running FULL test (227 questions)...');
  
  const report = await runTest(limit);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const mdPath = path.join(process.cwd(), `DUAL_MODE_REPORT_${timestamp}.md`);
  
  fs.writeFileSync(mdPath, generateReport(report));
  
  console.log('\n\n✅ Test completed!');
  console.log(`📊 Accuracy: ${report.accuracy.toFixed(1)}%`);
  console.log(`✅ Correct: ${report.correct}/${report.total}`);
  console.log(`🔢 Numeric matches: ${report.numericMatches}`);
  console.log(`📁 Report: ${mdPath}`);
}

main().catch(console.error);
