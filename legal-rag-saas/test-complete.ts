/**
 * Test complet pentru toate întrebările din PDF
 */

import * as fs from 'fs';
import OpenAI from 'openai';
import { detectQuizQuestion, buildQuizPrompt, parseQuizAnswer } from './lib/quiz/quiz-handler';

// Încarcă întrebările
const testData = JSON.parse(fs.readFileSync('./INTREBARI_PENTRU_TEST.json', 'utf-8'));
const testQuestions = testData.questions;

interface TestResult {
  questionId: number;
  question: string;
  expectedAnswer: string;
  systemAnswer: string;
  isCorrect: boolean;
  confidence: number;
}

async function getSystemAnswer(questionData: any): Promise<{ answer: string; confidence: number }> {
  const query = `${questionData.question}\nA) ${questionData.varianta_a}\nB) ${questionData.varianta_b}\nC) ${questionData.varianta_c}`;
  
  const quiz = detectQuizQuestion(query);
  if (!quiz.isQuiz) {
    return { answer: 'UNKNOWN', confidence: 0 };
  }

  const mockCitations = [{
    text: "Text din normativul I7/2011",
    pageNumber: 1,
    documentName: "Normativ I7/2011"
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
      confidence: quizResult.confidence
    };
  } catch (error) {
    console.error(`Error Q${questionData.id}:`, error);
    return { answer: 'ERROR', confidence: 0 };
  }
}

async function runTest() {
  const results: TestResult[] = [];
  
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     TEST COMPLET - 120 ÎNTREBĂRI LEGISLAȚIE             ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  let correct = 0;
  let wrong = 0;
  
  for (let i = 0; i < testQuestions.length; i++) {
    const q = testQuestions[i];
    const response = await getSystemAnswer(q);
    
    const isCorrect = response.answer.toLowerCase() === q.correct.toLowerCase();
    if (isCorrect) correct++; else wrong++;
    
    results.push({
      questionId: q.id,
      question: q.question,
      expectedAnswer: q.correct.toUpperCase(),
      systemAnswer: response.answer,
      isCorrect,
      confidence: response.confidence
    });
    
    const status = isCorrect ? '✅' : '❌';
    process.stdout.write(`${status} Q${q.id}: ${q.question.substring(0, 50)}... `);
    console.log(`[Așteptat: ${q.correct.toUpperCase()}, Primit: ${response.answer}]`);
    
    // Progress every 10 questions
    if ((i + 1) % 10 === 0) {
      const pct = ((i + 1) / testQuestions.length * 100).toFixed(1);
      console.log(`\n>>> Progres: ${i + 1}/${testQuestions.length} (${pct}%) - Corecte: ${correct}, Greșite: ${wrong}\n`);
    }
  }
  
  // Raport final
  const accuracy = (correct / testQuestions.length * 100).toFixed(1);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 REZULTATE FINALE');
  console.log('='.repeat(60));
  console.log(`Total întrebări: ${testQuestions.length}`);
  console.log(`Răspunsuri corecte: ${correct}`);
  console.log(`Răspunsuri greșite: ${wrong}`);
  console.log(`Acuratețe: ${accuracy}%`);
  console.log('='.repeat(60));
  
  // Salvează rezultatele
  const report = {
    totalQuestions: testQuestions.length,
    correctAnswers: correct,
    incorrectAnswers: wrong,
    accuracy: parseFloat(accuracy),
    results,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync('test-complete-results.json', JSON.stringify(report, null, 2));
  
  // Generează raport detaliat cu întrebări greșite
  const wrongAnswers = results.filter(r => !r.isCorrect);
  if (wrongAnswers.length > 0) {
    console.log('\n❌ ÎNTREBĂRI CU RĂSPUNSURI GREȘITE:');
    console.log('-'.repeat(60));
    wrongAnswers.forEach(r => {
      console.log(`Q${r.questionId}: ${r.question}`);
      console.log(`   Așteptat: ${r.expectedAnswer} | Primit: ${r.systemAnswer}`);
      console.log();
    });
  }
  
  console.log('\n📁 Raport salvat în: test-complete-results.json');
}

runTest().catch(console.error);
