import * as fs from 'fs';
import OpenAI from 'openai';
import { detectQuizQuestion, buildQuizPrompt, parseQuizAnswer } from './lib/quiz/quiz-handler';

// Încarcă toate întrebările
const testData = JSON.parse(fs.readFileSync('./INTREBARI_PENTRU_TEST.json', 'utf-8'));
const testQuestions = testData.questions;

interface TestResult {
  questionId: number;
  question: string;
  expectedAnswer: string;
  systemAnswer: string;
  isCorrect: boolean;
  confidence: number;
  explanation: string;
}

async function getSystemAnswer(questionData: any): Promise<{ answer: string; confidence: number; explanation: string }> {
  const query = `${questionData.question}
A) ${questionData.varianta_a}
B) ${questionData.varianta_b}
C) ${questionData.varianta_c}`;

  const quiz = detectQuizQuestion(query);
  
  if (!quiz.isQuiz) {
    return { answer: 'UNKNOWN', confidence: 0, explanation: 'Format grilă nedetectat' };
  }

  const mockCitations = [{
    text: "Text din normativul I7/2011 sau Legea 123/2012",
    pageNumber: 1,
    documentName: "Normativ"
  }];

  const { systemPrompt, userPrompt } = buildQuizPrompt(quiz, mockCitations);

  try {
    const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    const quizResult = parseQuizAnswer(aiResponse, quiz, mockCitations);
    
    return {
      answer: quizResult.correctOption,
      confidence: quizResult.confidence,
      explanation: quizResult.explanation.substring(0, 200) + '...'
    };
  } catch (error) {
    return { answer: 'ERROR', confidence: 0, explanation: String(error) };
  }
}

async function runTest() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     TEST COMPLET - 61 ÎNTREBĂRI LEGISLAȚIE              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  const results: TestResult[] = [];
  let correct = 0;
  let wrong = 0;

  for (let i = 0; i < testQuestions.length; i++) {
    const q = testQuestions[i];
    console.log(`[${i+1}/${testQuestions.length}] Q${q.id}: ${q.question.substring(0, 50)}...`);
    
    const response = await getSystemAnswer(q);
    const isCorrect = response.answer.toLowerCase() === q.correct.toLowerCase();
    
    if (isCorrect) correct++; else wrong++;
    
    results.push({
      questionId: q.id,
      question: q.question,
      expectedAnswer: q.correct.toUpperCase(),
      systemAnswer: response.answer,
      isCorrect,
      confidence: response.confidence,
      explanation: response.explanation
    });

    const status = isCorrect ? '✅' : '❌';
    console.log(`    ${status} Așteptat: ${q.correct.toUpperCase()} | Primit: ${response.answer} | ${isCorrect ? 'CORECT' : 'GREȘIT'}`);
  }

  const accuracy = (correct / testQuestions.length) * 100;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 REZULTATE FINALE');
  console.log('='.repeat(60));
  console.log(`Total întrebări: ${testQuestions.length}`);
  console.log(`✅ Corecte: ${correct}`);
  console.log(`❌ Greșite: ${wrong}`);
  console.log(`📈 Acuratețe: ${accuracy.toFixed(1)}%`);
  console.log('='.repeat(60));

  // Salvează rezultatele
  const report = {
    totalQuestions: testQuestions.length,
    correctAnswers: correct,
    incorrectAnswers: wrong,
    accuracy: accuracy,
    results: results,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync('test-report-full.json', JSON.stringify(report, null, 2));
  
  // Generează raport Markdown
  let md = `# Raport Test Complet - 61 Întrebări\n\n`;
  md += `## Sumar\n\n| Metrică | Valoare |\n|---------|---------|\n`;
  md += `| Total | ${testQuestions.length} |\n`;
  md += `| Corecte | ${correct} |\n`;
  md += `| Greșite | ${wrong} |\n`;
  md += `| **Acuratețe** | **${accuracy.toFixed(1)}%** |\n\n`;
  
  md += `## Rezultate Detaliate\n\n| # | Întrebare | Corect | Sistem | Status |\n|---|-----------|--------|--------|--------|\n`;
  for (const r of results) {
    const shortQ = r.question.length > 40 ? r.question.substring(0, 40) + '...' : r.question;
    md += `| ${r.questionId} | ${shortQ} | ${r.expectedAnswer} | ${r.systemAnswer} | ${r.isCorrect ? '✅' : '❌'} |\n`;
  }
  
  md += `\n## Greșeli\n\n`;
  const wrongAnswers = results.filter(r => !r.isCorrect);
  if (wrongAnswers.length === 0) {
    md += `*Nicio greșeală!*\n`;
  } else {
    for (const r of wrongAnswers) {
      md += `- **Q${r.questionId}**: Așteptat **${r.expectedAnswer}**, primit **${r.systemAnswer}**\n`;
    }
  }
  
  fs.writeFileSync('RAPORT_TEST_COMPLET.md', md);
  
  console.log('\n📁 Fișiere salvate:');
  console.log('  - test-report-full.json');
  console.log('  - RAPORT_TEST_COMPLET.md');
}

runTest();
