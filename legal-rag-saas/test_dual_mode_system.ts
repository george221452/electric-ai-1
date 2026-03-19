/**
 * Test Dual Mode System (Quiz + Normal)
 * Verifies both modes work correctly
 */

import * as fs from 'fs';
import * as path from 'path';
import AdvancedQuizHandler from './lib/quiz/advanced-quiz-handler';
import { SmartAnswerRouter } from './lib/quiz/smart-answer-router';

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
  detection: {
    isQuiz: boolean;
    confidence: number;
  };
  answerType: 'quiz' | 'normal';
  confidence: number;
  error?: string;
}

function loadQuestions(): Question[] {
  const filePath = path.join(process.cwd(), 'normative_2023_gradul_3a.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return data.questions.slice(0, 20); // Test first 20
}

function formatQuestionWithVariants(q: Question): string {
  return `${q.question}
a) ${q.varianta_a}
b) ${q.varianta_b}
c) ${q.varianta_c}`;
}

async function searchForContext(query: string) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        workspaceId: WORKSPACE_ID,
        options: { maxParagraphs: 5, getContextOnly: true }
      })
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.data?.citations || [];
  } catch {
    return [];
  }
}

async function testDetection() {
  const questions = loadQuestions();
  
  console.log('\n🔍 Testing Quiz Detection Accuracy\n');
  console.log('ID  | Expected | Detected | Confidence | Status');
  console.log('----|----------|----------|------------|--------');
  
  let correctDetection = 0;
  
  for (const q of questions) {
    const formatted = formatQuestionWithVariants(q);
    const detection = AdvancedQuizHandler.detectQuiz(formatted);
    
    const status = detection.isQuiz ? '✅ QUIZ' : '❌ NORMAL';
    console.log(`${q.id.toString().padStart(3)} | QUIZ     | ${detection.isQuiz ? 'QUIZ    ' : 'NORMAL  '} | ${(detection.confidence * 100).toFixed(0).padStart(3)}%       | ${status}`);
    
    if (detection.isQuiz) correctDetection++;
  }
  
  console.log(`\nDetection Rate: ${correctDetection}/${questions.length} (${(correctDetection/questions.length*100).toFixed(1)}%)`);
}

async function testNumericalVerification() {
  const questions = loadQuestions();
  
  console.log('\n🔢 Testing Numerical Verification\n');
  
  // Find questions with numerical values
  const numericQuestions = questions.filter(q => {
    const text = `${q.varianta_a} ${q.varianta_b} ${q.varianta_c}`;
    return /\d+\s*(?:mm[²2]|A|V|kVA|Ω|s|m)/i.test(text);
  });
  
  console.log(`Found ${numericQuestions.length} questions with numerical values\n`);
  
  for (const q of numericQuestions.slice(0, 5)) {
    const formatted = formatQuestionWithVariants(q);
    const detection = AdvancedQuizHandler.detectQuiz(formatted);
    
    console.log(`\nQuestion #${q.id}: ${q.question.substring(0, 60)}...`);
    console.log(`Numerical values found: ${detection.numericalValues.length}`);
    
    for (const val of detection.numericalValues) {
      console.log(`  - ${val.value} ${val.unit} in option ${val.option.toUpperCase()}`);
    }
  }
}

async function testDualModeRouter() {
  const router = new SmartAnswerRouter();
  const questions = loadQuestions();
  
  console.log('\n🧪 Testing Dual Mode Router\n');
  console.log('Testing 5 questions in each mode...\n');
  
  // Test 5 quiz questions
  console.log('--- QUIZ MODE TESTS ---');
  for (const q of questions.slice(0, 5)) {
    const formatted = formatQuestionWithVariants(q);
    
    process.stdout.write(`Q${q.id}: Testing... `);
    
    try {
      const citations = await searchForContext(q.question);
      const result = await router.generateAnswer(formatted, citations);
      
      const isCorrect = result.type === 'quiz' && 
                       result.answer.toLowerCase().includes(q.correct.toLowerCase());
      
      console.log(`${isCorrect ? '✅' : '❌'} Type=${result.type} Answer=${result.answer} Expected=${q.correct.toUpperCase()}`);
    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message.slice(0, 30) : 'Unknown'}`);
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Test 5 normal questions (rephrase as open-ended)
  console.log('\n--- NORMAL MODE TESTS ---');
  const normalQuestions = [
    'Explică ce este zona de protecție pentru un post de transformare',
    'Cum se calculează curentul de scurtcircuit într-o rețea electrică?',
    'Ce măsuri de siguranță se iau pentru LEA 110 kV?',
    'Descrie procedura de împământare a instalațiilor electrice',
    'Care sunt cerințele pentru conductoarele de fază în circuite pentru prize?'
  ];
  
  for (let i = 0; i < normalQuestions.length; i++) {
    const query = normalQuestions[i];
    
    process.stdout.write(`NQ${i + 1}: Testing... `);
    
    try {
      const citations = await searchForContext(query);
      const result = await router.generateAnswer(query, citations);
      
      const hasAnswer = result.answer.length > 50;
      const isNormal = result.type === 'normal';
      
      console.log(`${hasAnswer && isNormal ? '✅' : '⚠️'} Type=${result.type} Length=${result.answer.length} chars Confidence=${result.confidence}%`);
    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message.slice(0, 30) : 'Unknown'}`);
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--detection')) {
    await testDetection();
  } else if (args.includes('--numeric')) {
    await testNumericalVerification();
  } else if (args.includes('--router')) {
    await testDualModeRouter();
  } else {
    console.log('\n🧪 Dual Mode System Test Suite\n');
    console.log('Usage: npx tsx test_dual_mode_system.ts [option]');
    console.log('\nOptions:');
    console.log('  --detection  Test quiz detection accuracy');
    console.log('  --numeric    Test numerical value extraction');
    console.log('  --router     Test dual mode router');
    console.log('  (none)       Show this help\n');
  }
}

main().catch(console.error);
