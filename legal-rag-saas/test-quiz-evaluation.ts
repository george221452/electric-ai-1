/**
 * Script de evaluare a sistemului RAG pe baza întrebărilor din PDF
 * Testează capacitatea sistemului de a răspunde corect la grile
 */

import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { detectQuizQuestion, buildQuizPrompt, parseQuizAnswer, formatQuizResponse } from './lib/quiz/quiz-handler';

// Încarcă întrebările de test
const testQuestions = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test_questions.json'), 'utf-8'));

interface TestResult {
  questionId: number;
  question: string;
  expectedAnswer: string;
  systemAnswer: string;
  isCorrect: boolean;
  confidence: number;
  explanation: string;
}

interface TestReport {
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracy: number;
  results: TestResult[];
  timestamp: string;
}

/**
 * Simulează răspunsul sistemului pentru o întrebare cu variante
 */
async function getSystemAnswer(questionData: any): Promise<{ answer: string; confidence: number; explanation: string }> {
  // Construiește formatul întrebării
  const query = `${questionData.question}
A) ${questionData.varianta_a}
B) ${questionData.varianta_b}
C) ${questionData.varianta_c}`;

  // Detectează formatul de grilă
  const quiz = detectQuizQuestion(query);
  
  if (!quiz.isQuiz) {
    return {
      answer: 'UNKNOWN',
      confidence: 0,
      explanation: 'Could not detect quiz format'
    };
  }

  console.log(`\n[Question ${questionData.id}] ${quiz.question.substring(0, 80)}...`);
  console.log(`Options: ${quiz.options.map(o => o.letter).join(', ')}`);

  // Construim promptul pentru AI
  // Fără citări din normativ (test de bază) - doar testăm înțelegerea întrebării
  const mockCitations = [{
    text: "Text din normativul I7/2011 despre " + quiz.question.substring(0, 50),
    pageNumber: 1,
    documentName: "Normativ I7/2011"
  }];

  const { systemPrompt, userPrompt } = buildQuizPrompt(quiz, mockCitations);

  // Apelăm OpenAI pentru răspuns
  try {
    const openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 800,
      temperature: 0.1,
    });

    const aiResponse = completion.choices[0]?.message?.content?.trim() || '';
    
    // Parsăm răspunsul
    const quizResult = parseQuizAnswer(aiResponse, quiz, mockCitations);
    
    return {
      answer: quizResult.correctOption,
      confidence: quizResult.confidence,
      explanation: quizResult.explanation
    };
  } catch (error) {
    console.error(`Error getting answer for question ${questionData.id}:`, error);
    return {
      answer: 'ERROR',
      confidence: 0,
      explanation: String(error)
    };
  }
}

/**
 * Rulează testul complet
 */
async function runTest(): Promise<TestReport> {
  const results: TestResult[] = [];
  
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     TEST EVALUARE RAG - LEGISLAȚIE ELECTRICĂ            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\nTotal întrebări de test: ${testQuestions.length}\n`);

  for (const questionData of testQuestions) {
    const systemResponse = await getSystemAnswer(questionData);
    
    const isCorrect = systemResponse.answer.toLowerCase() === questionData.correct.toLowerCase();
    
    const result: TestResult = {
      questionId: questionData.id,
      question: questionData.question,
      expectedAnswer: questionData.correct.toUpperCase(),
      systemAnswer: systemResponse.answer,
      isCorrect,
      confidence: systemResponse.confidence,
      explanation: systemResponse.explanation
    };
    
    results.push(result);
    
    // Afișare rezultat
    const status = isCorrect ? '✅ CORECT' : '❌ GREȘIT';
    console.log(`Result: ${status} (Așteptat: ${questionData.correct.toUpperCase()}, Primit: ${systemResponse.answer})`);
    console.log(`Confidence: ${systemResponse.confidence}%`);
  }

  // Calculează statistici
  const correctCount = results.filter(r => r.isCorrect).length;
  const accuracy = (correctCount / results.length) * 100;

  const report: TestReport = {
    totalQuestions: results.length,
    correctAnswers: correctCount,
    incorrectAnswers: results.length - correctCount,
    accuracy,
    results,
    timestamp: new Date().toISOString()
  };

  return report;
}

/**
 * Generează raport HTML
 */
function generateHTMLReport(report: TestReport): string {
  const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Raport Test RAG - Legislație Electrică</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      text-align: center;
    }
    .header h1 { font-size: 2em; margin-bottom: 10px; }
    .stats { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      padding: 25px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-card.correct { border-top: 4px solid #10b981; }
    .stat-card.incorrect { border-top: 4px solid #ef4444; }
    .stat-card.accuracy { border-top: 4px solid #3b82f6; }
    .stat-value { font-size: 2.5em; font-weight: bold; color: #1f2937; }
    .stat-label { color: #6b7280; margin-top: 5px; }
    .results-table {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    table { width: 100%; border-collapse: collapse; }
    th { 
      background: #374151; 
      color: white; 
      padding: 15px;
      text-align: left;
      font-weight: 600;
    }
    td { padding: 15px; border-bottom: 1px solid #e5e7eb; }
    tr:hover { background: #f9fafb; }
    .status-correct { color: #10b981; font-weight: bold; }
    .status-incorrect { color: #ef4444; font-weight: bold; }
    .question-text { max-width: 400px; font-size: 0.9em; }
    .timestamp { text-align: center; color: #6b7280; margin-top: 20px; font-size: 0.9em; }
    .progress-bar {
      width: 100%;
      height: 20px;
      background: #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
      margin: 10px 0;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #059669);
      transition: width 0.3s ease;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Raport Evaluare Sistem RAG</h1>
      <p>Test pe baza grilelor din PDF-ul de legislație electrică</p>
    </div>
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${report.totalQuestions}</div>
        <div class="stat-label">Întrebări Totale</div>
      </div>
      <div class="stat-card correct">
        <div class="stat-value">${report.correctAnswers}</div>
        <div class="stat-label">Răspunsuri Corecte</div>
      </div>
      <div class="stat-card incorrect">
        <div class="stat-value">${report.incorrectAnswers}</div>
        <div class="stat-label">Răspunsuri Greșite</div>
      </div>
      <div class="stat-card accuracy">
        <div class="stat-value">${report.accuracy.toFixed(1)}%</div>
        <div class="stat-label">Acuratețe Globală</div>
      </div>
    </div>
    
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${report.accuracy}%"></div>
    </div>
    
    <div class="results-table">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Întrebare</th>
            <th>Răspuns Așteptat</th>
            <th>Răspuns Sistem</th>
            <th>Rezultat</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          ${report.results.map(r => `
            <tr>
              <td>${r.questionId}</td>
              <td class="question-text">${r.question}</td>
              <td><strong>${r.expectedAnswer}</strong></td>
              <td>${r.systemAnswer}</td>
              <td class="${r.isCorrect ? 'status-correct' : 'status-incorrect'}">
                ${r.isCorrect ? '✅ Corect' : '❌ Greșit'}
              </td>
              <td>${r.confidence}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <p class="timestamp">Generat la: ${new Date(report.timestamp).toLocaleString('ro-RO')}</p>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Generează raport Markdown
 */
function generateMarkdownReport(report: TestReport): string {
  let md = `# Raport Evaluare Sistem RAG - Legislație Electrică

## Sumar

| Metrică | Valoare |
|---------|---------|
| Întrebări Totale | ${report.totalQuestions} |
| Răspunsuri Corecte | ${report.correctAnswers} |
| Răspunsuri Greșite | ${report.incorrectAnswers} |
| **Acuratețe** | **${report.accuracy.toFixed(1)}%** |

## Rezultate Detaliate

| # | Întrebare | Așteptat | Sistem | Rezultat | Confidence |
|---|-----------|----------|--------|----------|------------|
`;

  for (const r of report.results) {
    const status = r.isCorrect ? '✅' : '❌';
    const shortQuestion = r.question.length > 50 ? r.question.substring(0, 50) + '...' : r.question;
    md += `| ${r.questionId} | ${shortQuestion} | ${r.expectedAnswer} | ${r.systemAnswer} | ${status} | ${r.confidence}% |\n`;
  }

  md += `

## Analiză

`;

  if (report.accuracy >= 80) {
    md += `🎉 **Excelent!** Sistemul are o acuratețe foarte bună (${report.accuracy.toFixed(1)}%).\n`;
  } else if (report.accuracy >= 60) {
    md += `⚠️ **Acceptabil.** Sistemul are o acuratețe moderată (${report.accuracy.toFixed(1)}%). Există loc de îmbunătățiri.\n`;
  } else {
    md += `🔴 **Necesită îmbunătățiri.** Sistemul are o acuratețe scăzută (${report.accuracy.toFixed(1)}%).\n`;
  }

  // Analizează tipurile de greșeli
  const wrongAnswers = report.results.filter(r => !r.isCorrect);
  if (wrongAnswers.length > 0) {
    md += `\n### Întrebări cu răspunsuri greșite\n\n`;
    for (const r of wrongAnswers) {
      md += `- **Q${r.questionId}**: Așteptat **${r.expectedAnswer}**, primit **${r.systemAnswer}** - ${r.question}\n`;
    }
  }

  md += `\n---\n*Generat la: ${new Date(report.timestamp).toLocaleString('ro-RO')}*\n`;

  return md;
}

// Rulează testul
async function main() {
  try {
    const report = await runTest();
    
    // Salvează raport JSON
    fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
    
    // Generează și salvează raport HTML
    const htmlReport = generateHTMLReport(report);
    fs.writeFileSync('test-report.html', htmlReport);
    
    // Generează și salvează raport Markdown
    const mdReport = generateMarkdownReport(report);
    fs.writeFileSync('RAPORT_TEST_EVALUARE.md', mdReport);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 REZULTATE FINALE');
    console.log('='.repeat(60));
    console.log(`Total întrebări: ${report.totalQuestions}`);
    console.log(`Răspunsuri corecte: ${report.correctAnswers}`);
    console.log(`Răspunsuri greșite: ${report.incorrectAnswers}`);
    console.log(`Acuratețe: ${report.accuracy.toFixed(1)}%`);
    console.log('='.repeat(60));
    console.log('\n📁 Rapoarte salvate:');
    console.log('  - test-report.json (date brute)');
    console.log('  - test-report.html (raport vizual)');
    console.log('  - RAPORT_TEST_EVALUARE.md (raport text)');
    
  } catch (error) {
    console.error('Eroare la rularea testului:', error);
    process.exit(1);
  }
}

main();
