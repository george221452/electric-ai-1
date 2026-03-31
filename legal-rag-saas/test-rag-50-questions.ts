/**
 * Comprehensive RAG Test Suite - 50 Questions
 * Tests both HYBRID and LEGACY architectures
 */

import fs from 'fs';
import path from 'path';

interface TestQuestion {
  id: number;
  question: string;
  expectedKeywords: string[];
  category: string;
}

interface TestResult {
  questionId: number;
  question: string;
  architecture: 'HYBRID' | 'LEGACY';
  answer: string;
  citations: any[];
  confidence: number;
  resultsCount: number;
  hasCitations: boolean;
  keywordsFound: string[];
  keywordsMissing: string[];
  score: number; // 0-100
  responseTime: number;
  error?: string;
}

const TEST_FILE = path.join(process.cwd(), 'test-rag-comprehensive.json');
const OUTPUT_FILE = path.join(process.cwd(), 'test-rag-results.json');

async function testRAG(question: string, architecture: 'HYBRID' | 'LEGACY'): Promise<any> {
  const startTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:3000/api/rag/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'demo-user'
      },
      body: JSON.stringify({
        query: question,
        workspaceId: '550e8400-e29b-41d4-a716-446655440000'
      })
    });
    
    const responseTime = Date.now() - startTime;
    const data = await response.json();
    
    return {
      success: data.success,
      answer: data.data?.answer || '',
      citations: data.data?.citations || [],
      confidence: data.data?.confidence || 0,
      resultsCount: data.data?.resultsCount || 0,
      answerType: data.data?.answerType,
      responseTime,
      error: data.error
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    };
  }
}

function analyzeAnswer(answer: string, expectedKeywords: string[]): { found: string[]; missing: string[]; score: number } {
  const answerLower = answer.toLowerCase();
  const found: string[] = [];
  const missing: string[] = [];
  
  for (const keyword of expectedKeywords) {
    const keywordLower = keyword.toLowerCase();
    // Check for exact match or partial match
    if (answerLower.includes(keywordLower) || 
        keywordLower.split(/\s+/).some(part => answerLower.includes(part))) {
      found.push(keyword);
    } else {
      missing.push(keyword);
    }
  }
  
  const score = expectedKeywords.length > 0 
    ? Math.round((found.length / expectedKeywords.length) * 100)
    : 0;
  
  return { found, missing, score };
}

async function runTests(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RAG COMPREHENSIVE TEST - 50 Questions');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Load test questions
  const testData = JSON.parse(fs.readFileSync(TEST_FILE, 'utf-8'));
  const questions: TestQuestion[] = testData.testQuestions;
  
  console.log(`Loaded ${questions.length} test questions\n`);
  
  const results: TestResult[] = [];
  
  // Test each question with default architecture first
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`[${i + 1}/${questions.length}] Testing: ${q.question.substring(0, 60)}...`);
    
    const ragResult = await testRAG(q.question, 'HYBRID');
    
    if (!ragResult.success) {
      console.log(`  ❌ ERROR: ${ragResult.error}`);
      results.push({
        questionId: q.id,
        question: q.question,
        architecture: 'HYBRID',
        answer: '',
        citations: [],
        confidence: 0,
        resultsCount: 0,
        hasCitations: false,
        keywordsFound: [],
        keywordsMissing: q.expectedKeywords,
        score: 0,
        responseTime: ragResult.responseTime,
        error: ragResult.error
      });
      continue;
    }
    
    const analysis = analyzeAnswer(ragResult.answer, q.expectedKeywords);
    
    const result: TestResult = {
      questionId: q.id,
      question: q.question,
      architecture: 'HYBRID',
      answer: ragResult.answer,
      citations: ragResult.citations,
      confidence: ragResult.confidence,
      resultsCount: ragResult.resultsCount,
      hasCitations: ragResult.citations.length > 0,
      keywordsFound: analysis.found,
      keywordsMissing: analysis.missing,
      score: analysis.score,
      responseTime: ragResult.responseTime
    };
    
    results.push(result);
    
    // Print summary
    const status = result.score >= 60 ? '✅' : result.score >= 30 ? '⚠️' : '❌';
    console.log(`  ${status} Score: ${result.score}% | Keywords: ${analysis.found.length}/${q.expectedKeywords.length} | Citations: ${ragResult.citations.length} | Time: ${ragResult.responseTime}ms`);
    
    // Print answer preview
    const answerPreview = ragResult.answer.substring(0, 150).replace(/\n/g, ' ');
    console.log(`     "${answerPreview}..."\n`);
    
    // Small delay to not overwhelm the API
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Calculate statistics
  const totalTests = results.length;
  const passedTests = results.filter(r => r.score >= 60).length;
  const partialTests = results.filter(r => r.score >= 30 && r.score < 60).length;
  const failedTests = results.filter(r => r.score < 30).length;
  const avgScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / totalTests);
  const avgResponseTime = Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / totalTests);
  const avgConfidence = Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / totalTests);
  
  // Print final report
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  TEST RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total Tests:     ${totalTests}`);
  console.log(`✅ Passed (≥60%): ${passedTests} (${Math.round(passedTests/totalTests*100)}%)`);
  console.log(`⚠️  Partial (30-59%): ${partialTests} (${Math.round(partialTests/totalTests*100)}%)`);
  console.log(`❌ Failed (<30%): ${failedTests} (${Math.round(failedTests/totalTests*100)}%)`);
  console.log(`─────────────────────────────────────────────────────────`);
  console.log(`Average Score:      ${avgScore}%`);
  console.log(`Average Confidence: ${avgConfidence}%`);
  console.log(`Average Response:   ${avgResponseTime}ms`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Category breakdown
  console.log('Results by Category:');
  const categories = [...new Set(questions.map(q => q.category))];
  for (const cat of categories) {
    const catResults = results.filter(r => questions.find(q => q.id === r.questionId)?.category === cat);
    const catAvg = Math.round(catResults.reduce((sum, r) => sum + r.score, 0) / catResults.length);
    console.log(`  ${cat.padEnd(15)}: ${catAvg}% avg (${catResults.length} tests)`);
  }
  
  // Save results
  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests,
      passedTests,
      partialTests,
      failedTests,
      avgScore,
      avgConfidence,
      avgResponseTime
    },
    results
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✓ Results saved to: ${OUTPUT_FILE}`);
  
  // Return exit code based on results
  if (avgScore < 60) {
    console.log('\n⚠️  WARNING: Average score below 60%. RAG needs improvement.\n');
    process.exit(1);
  } else {
    console.log('\n✅ SUCCESS: Average score above 60%.\n');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
