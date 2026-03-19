/**
 * Test RAG System - Normative Only (227 questions)
 * Tests only the normative_2023_gradul_3a.json file
 */

import * as fs from 'fs';
import * as path from 'path';

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const API_URL = 'http://localhost:3000/api/rag/query';

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
  return `${q.question}
a) ${q.varianta_a}
b) ${q.varianta_b}
c) ${q.varianta_c}`;
}

function parseQuizAnswer(answer: string | null): string | null {
  if (!answer) return null;
  
  // Look for explicit answer patterns
  const patterns = [
    /(?:răspuns\s*(?:corect|final)?[\s:)*]+)?([abc])\s*[).]/i,
    /variant[aă]\s*([abc])/i,
    /^\s*([abc])\s*$/im,
    /opțiunea\s*([abc])/i,
    /([abc])\s*(?:este\s*)?(?:răspunsul\s*)?(?:corect)/i,
  ];
  
  for (const pattern of patterns) {
    const match = answer.match(pattern);
    if (match) {
      return match[1].toLowerCase() as 'a' | 'b' | 'c';
    }
  }
  
  // Fallback: look for standalone a, b, c in the text
  const lines = answer.split('\n');
  for (const line of lines) {
    const cleanLine = line.trim().toLowerCase();
    if (cleanLine === 'a' || cleanLine === 'b' || cleanLine === 'c') {
      return cleanLine as 'a' | 'b' | 'c';
    }
  }
  
  return null;
}

async function testSingleQuestion(q: Question): Promise<TestResult> {
  const formattedQuestion = formatQuestionWithVariants(q);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: formattedQuestion,
        workspaceId: WORKSPACE_ID,
        options: { maxParagraphs: 5 }
      })
    });

    if (!response.ok) {
      return {
        questionId: q.id,
        question: q.question,
        expected: q.correct,
        actual: null,
        correct: false,
        confidence: 0,
        citationsCount: 0,
        needsClarification: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();
    
    if (!data.success) {
      return {
        questionId: q.id,
        question: q.question,
        expected: q.correct,
        actual: null,
        correct: false,
        confidence: 0,
        citationsCount: 0,
        needsClarification: false,
        error: data.error || 'API returned unsuccessful response'
      };
    }

    const answerData = data.data;
    const parsedAnswer = parseQuizAnswer(answerData.answer);
    const isCorrect = parsedAnswer === q.correct;
    
    return {
      questionId: q.id,
      question: q.question,
      expected: q.correct,
      actual: parsedAnswer,
      correct: isCorrect,
      confidence: answerData.confidence || 0,
      citationsCount: answerData.citations?.length || 0,
      needsClarification: answerData.needsClarification || false
    };
    
  } catch (error) {
    return {
      questionId: q.id,
      question: q.question,
      expected: q.correct,
      actual: null,
      correct: false,
      confidence: 0,
      citationsCount: 0,
      needsClarification: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function runTest(limit?: number): Promise<TestReport> {
  const questions = loadQuestions();
  const testQuestions = limit ? questions.slice(0, limit) : questions;
  
  console.log(`\n🧪 Starting Normative RAG Test`);
  console.log(`📊 Total questions: ${testQuestions.length}`);
  console.log(`⏱️  Started at: ${new Date().toISOString()}\n`);
  
  const results: TestResult[] = [];
  const startTime = Date.now();
  
  for (let i = 0; i < testQuestions.length; i++) {
    const q = testQuestions[i];
    process.stdout.write(`\r⏳ Testing ${i + 1}/${testQuestions.length} (ID: ${q.id})... `);
    
    const result = await testSingleQuestion(q);
    results.push(result);
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const duration = Date.now() - startTime;
  
  const correct = results.filter(r => r.correct).length;
  const noAnswer = results.filter(r => r.actual === null).length;
  const incorrect = results.length - correct - noAnswer;
  const accuracy = (correct / results.length) * 100;
  
  const report: TestReport = {
    total: results.length,
    correct,
    incorrect,
    noAnswer,
    accuracy,
    results,
    timestamp: new Date().toISOString(),
    duration
  };
  
  return report;
}

function generateMarkdownReport(report: TestReport): string {
  const lines: string[] = [];
  
  lines.push('# 📊 Raport Test RAG - Normative Tehnice 2023 (Gradul III-A)');
  lines.push('');
  lines.push(`**Data testului:** ${new Date(report.timestamp).toLocaleString('ro-RO')}`);
  lines.push(`**Durata:** ${(report.duration / 1000).toFixed(1)} secunde`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 📈 Rezultate Generale');
  lines.push('');
  lines.push(`| Metric | Valoare |`);
  lines.push(`|--------|---------|`);
  lines.push(`| **Total întrebări** | ${report.total} |`);
  lines.push(`| **Corecte** ✅ | ${report.correct} (${(report.correct/report.total*100).toFixed(1)}%) |`);
  lines.push(`| **Incorecte** ❌ | ${report.incorrect} (${(report.incorrect/report.total*100).toFixed(1)}%) |`);
  lines.push(`| **Fără răspuns** ⚠️ | ${report.noAnswer} (${(report.noAnswer/report.total*100).toFixed(1)}%) |`);
  lines.push(`| **Acuratețe** 🎯 | **${report.accuracy.toFixed(1)}%** |`);
  lines.push('');
  
  // Show all results
  lines.push('## 📋 Toate Rezultatele');
  lines.push('');
  lines.push('| ID | Status | Așteptat | Primit | Confidence | Citări | Clarificare |');
  lines.push('|----|--------|----------|--------|------------|--------|-------------|');
  
  for (const r of report.results) {
    const status = r.correct ? '✅' : r.actual === null ? '⚠️' : '❌';
    const actual = r.actual ?? (r.error ? `Eroare: ${r.error.slice(0, 30)}...` : 'N/A');
    lines.push(`| ${r.questionId} | ${status} | ${r.expected.toUpperCase()} | ${actual.toUpperCase()} | ${r.confidence.toFixed(0)}% | ${r.citationsCount} | ${r.needsClarification ? 'Da' : 'Nu'} |`);
  }
  
  lines.push('');
  
  // Detailed incorrect answers
  const incorrectResults = report.results.filter(r => !r.correct && r.actual !== null);
  if (incorrectResults.length > 0) {
    lines.push('## ❌ Răspunsuri Incorecte (Detalii)');
    lines.push('');
    
    for (const r of incorrectResults) {
      lines.push(`### Întrebare #${r.questionId}`);
      lines.push(`**Întrebare:** ${r.question}`);
      lines.push(`**Așteptat:** ${r.expected.toUpperCase()}`);
      lines.push(`**Primit:** ${(r.actual ?? 'N/A').toUpperCase()}`);
      lines.push(`**Confidence:** ${r.confidence.toFixed(0)}%`);
      lines.push('');
    }
  }
  
  // No answer questions
  const noAnswerResults = report.results.filter(r => r.actual === null);
  if (noAnswerResults.length > 0) {
    lines.push('## ⚠️ Întrebări fără răspuns (Necesită documente)');
    lines.push('');
    
    for (const r of noAnswerResults.slice(0, 20)) { // Limit to first 20
      lines.push(`- **#${r.questionId}:** ${r.question.slice(0, 80)}...`);
      if (r.error) lines.push(`  - Eroare: ${r.error}`);
    }
    
    if (noAnswerResults.length > 20) {
      lines.push(`- ... și încă ${noAnswerResults.length - 20} întrebări`);
    }
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  lines.push('*Raport generat automat de test_rag_system*');
  
  return lines.join('\n');
}

function generateHTMLReport(report: TestReport): string {
  const correctPercent = (report.correct / report.total * 100).toFixed(1);
  const incorrectPercent = (report.incorrect / report.total * 100).toFixed(1);
  const noAnswerPercent = (report.noAnswer / report.total * 100).toFixed(1);
  
  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Raport Test RAG - Normative Tehnice</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    .meta { color: #888; margin-bottom: 20px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 2em; font-weight: bold; color: #333; }
    .stat-label { color: #666; margin-top: 5px; }
    .stat-card.correct { background: #d4edda; }
    .stat-card.incorrect { background: #f8d7da; }
    .stat-card.noanswer { background: #fff3cd; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; font-weight: 600; }
    tr:hover { background: #f8f9fa; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge-success { background: #28a745; color: white; }
    .badge-error { background: #dc3545; color: white; }
    .badge-warning { background: #ffc107; color: #333; }
    .question-text { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .detail-section { margin-top: 30px; }
    .detail-item { background: #f8f9fa; padding: 15px; margin-bottom: 10px; border-radius: 8px; border-left: 4px solid #dc3545; }
    .detail-item.warning { border-left-color: #ffc107; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Raport Test RAG - Normative Tehnice 2023 (Gradul III-A)</h1>
    <p class="meta">
      Data: ${new Date(report.timestamp).toLocaleString('ro-RO')} | 
      Durata: ${(report.duration / 1000).toFixed(1)} secunde
    </p>
    
    <h2>📈 Statistici Generale</h2>
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${report.total}</div>
        <div class="stat-label">Total Întrebări</div>
      </div>
      <div class="stat-card correct">
        <div class="stat-value">${report.correct}</div>
        <div class="stat-label">Corecte (${correctPercent}%)</div>
      </div>
      <div class="stat-card incorrect">
        <div class="stat-value">${report.incorrect}</div>
        <div class="stat-label">Incorecte (${incorrectPercent}%)</div>
      </div>
      <div class="stat-card noanswer">
        <div class="stat-value">${report.noAnswer}</div>
        <div class="stat-label">Fără Răspuns (${noAnswerPercent}%)</div>
      </div>
    </div>
    
    <h2>📋 Toate Rezultatele</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Status</th>
          <th>Așteptat</th>
          <th>Primit</th>
          <th>Confidence</th>
          <th>Citări</th>
        </tr>
      </thead>
      <tbody>
        ${report.results.map(r => {
          const status = r.correct ? '<span class="badge badge-success">✅</span>' : 
                        r.actual === null ? '<span class="badge badge-warning">⚠️</span>' : 
                        '<span class="badge badge-error">❌</span>';
          return `<tr>
            <td>${r.questionId}</td>
            <td>${status}</td>
            <td>${r.expected.toUpperCase()}</td>
            <td>${(r.actual ?? 'N/A').toUpperCase()}</td>
            <td>${r.confidence.toFixed(0)}%</td>
            <td>${r.citationsCount}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    
    ${report.results.filter(r => !r.correct).length > 0 ? `
    <div class="detail-section">
      <h2>❌ Detalii Răspunsuri Incorecte/Fără Răspuns</h2>
      ${report.results.filter(r => !r.correct).map(r => `
        <div class="detail-item ${r.actual === null ? 'warning' : ''}">
          <strong>Întrebare #${r.questionId}</strong><br>
          ${r.question}<br>
          <strong>Așteptat:</strong> ${r.expected.toUpperCase()} | 
          <strong>Primit:</strong> ${(r.actual ?? 'N/A').toUpperCase()} |
          <strong>Confidence:</strong> ${r.confidence.toFixed(0)}%
          ${r.error ? `<br><em>Eroare: ${r.error}</em>` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}
  </div>
</body>
</html>`;
}

async function main() {
  // Check if we should run full test or sample
  const args = process.argv.slice(2);
  const limit = args.includes('--full') ? undefined : 
                args.includes('--sample') ? 10 : 
                5; // Default: test first 5 questions
  
  if (limit === undefined) {
    console.log('🚀 Running FULL test on all 227 questions (this may take ~20-30 minutes)...');
  } else {
    console.log(`🚀 Running SAMPLE test on first ${limit} questions...`);
    console.log('💡 Use --full flag to run complete test');
  }
  
  const report = await runTest(limit);
  
  // Save reports
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const mdPath = path.join(process.cwd(), `test_report_normative_${timestamp}.md`);
  const htmlPath = path.join(process.cwd(), `test_report_normative_${timestamp}.html`);
  const jsonPath = path.join(process.cwd(), `test_report_normative_${timestamp}.json`);
  
  fs.writeFileSync(mdPath, generateMarkdownReport(report));
  fs.writeFileSync(htmlPath, generateHTMLReport(report));
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  
  console.log('\n');
  console.log('✅ Test completed!');
  console.log(`📊 Accuracy: ${report.accuracy.toFixed(1)}%`);
  console.log(`📁 Reports saved:`);
  console.log(`   - Markdown: ${mdPath}`);
  console.log(`   - HTML: ${htmlPath}`);
  console.log(`   - JSON: ${jsonPath}`);
  
  // Print summary to console
  console.log('\n📋 Summary:');
  console.log(`   Total: ${report.total}`);
  console.log(`   ✅ Correct: ${report.correct}`);
  console.log(`   ❌ Incorrect: ${report.incorrect}`);
  console.log(`   ⚠️  No answer: ${report.noAnswer}`);
}

main().catch(console.error);
