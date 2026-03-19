import * as fs from 'fs';
import * as path from 'path';
import AdvancedQuizHandler from './lib/quiz/advanced-quiz-handler';

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

function loadQuestions(): Question[] {
  const filePath = path.join(process.cwd(), 'normative_2023_gradul_3a.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return data.questions.slice(0, 3);
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
    
    if (!response.ok) {
      console.log('Search error:', response.status);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.success) {
      console.log('Search not successful:', data.error);
      return [];
    }
    
    // Map citations to expected format
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
  } catch (error) {
    console.log('Search exception:', error instanceof Error ? error.message : 'Unknown');
    return [];
  }
}

async function testQuizWithContext() {
  const questions = loadQuestions();
  
  console.log('\n🧪 Testing Quiz Mode with Real Context\n');
  
  for (const q of questions) {
    const formatted = formatQuestionWithVariants(q);
    
    console.log(`\n--- Question #${q.id} ---`);
    console.log(`Q: ${q.question.substring(0, 60)}...`);
    
    // Step 1: Detect quiz
    const detection = AdvancedQuizHandler.detectQuiz(formatted);
    console.log(`Detection: isQuiz=${detection.isQuiz}, confidence=${(detection.confidence * 100).toFixed(0)}%`);
    
    if (detection.numericalValues.length > 0) {
      console.log(`Numerical values found: ${detection.numericalValues.length}`);
      for (const val of detection.numericalValues) {
        console.log(`  - ${val.value} ${val.unit} in option ${val.option.toUpperCase()}`);
      }
    }
    
    // Step 2: Get context
    process.stdout.write('Searching context... ');
    const citations = await searchForContext(q.question);
    console.log(`found ${citations.length} citations`);
    
    if (citations.length > 0) {
      console.log(`Top citation score: ${(citations[0].score * 100).toFixed(0)}%`);
      
      // Step 3: Try numerical verification
      if (detection.hasNumericalValues) {
        const numericResult = AdvancedQuizHandler.verifyNumericalAnswer(detection, citations);
        if (numericResult && numericResult.isNumericMatch) {
          console.log(`✅ NUMERIC MATCH: ${numericResult.answer?.toUpperCase()} (confidence: ${numericResult.confidence}%)`);
          console.log(`   Expected: ${q.correct.toUpperCase()}`);
          continue;
        }
      }
      
      // Step 4: Build quiz prompt
      try {
        const prompt = AdvancedQuizHandler.buildQuizPrompt(detection, citations);
        console.log('✅ Prompt built successfully');
        console.log(`   Prompt length: ${prompt.length} chars`);
      } catch (e) {
        console.log('❌ Error building prompt:', e instanceof Error ? e.message : 'Unknown');
      }
    }
    
    console.log(`Expected answer: ${q.correct.toUpperCase()}`);
    
    await new Promise(r => setTimeout(r, 500));
  }
}

testQuizWithContext().catch(console.error);
