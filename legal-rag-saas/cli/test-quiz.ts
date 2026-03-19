#!/usr/bin/env tsx
/**
 * Test Quiz Questions from normative
 * Tests the RAG system against real quiz questions
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddings } from '@langchain/openai';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID || '550e8400-e29b-41d4-a716-446655440000';

interface QuizQuestion {
  id: number;
  question: string;
  varianta_a: string;
  varianta_b: string;
  varianta_c: string;
  correct: string;
}

interface TestResult {
  id: number;
  question: string;
  foundRelevantInfo: boolean;
  topScore: number;
  topDocument: string;
  correctAnswer: string;
}

async function loadQuestions(): Promise<QuizQuestion[]> {
  const questionsPath = path.resolve('../test_questions.json');
  const questionsFullPath = path.resolve('../test_questions_full.json');
  
  if (fs.existsSync(questionsPath)) {
    return JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
  }
  if (fs.existsSync(questionsFullPath)) {
    return JSON.parse(fs.readFileSync(questionsFullPath, 'utf8'));
  }
  
  console.log('❌ Nu am găsit fișierele cu grile');
  console.log('   Căutat în: ../test_questions.json');
  return [];
}

async function searchForQuestion(
  qdrant: QdrantClient,
  embeddings: OpenAIEmbeddings,
  question: string
): Promise<{ score: number; document: string }[]> {
  try {
    const vector = await embeddings.embedQuery(question);
    
    const results = await qdrant.search('legal_paragraphs', {
      vector: vector,
      limit: 3,
      filter: {
        must: [
          { key: 'workspaceId', match: { value: WORKSPACE_ID } }
        ]
      }
    });

    return results.map(r => ({
      score: (r.score || 0) * 100,
      document: (r.payload?.filename as string) || 'Necunoscut'
    }));
  } catch (error) {
    return [];
  }
}

async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('  🧪 TEST GRILE NORMATIV');
  console.log('═'.repeat(70));

  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
  });
  
  const embeddings = new OpenAIEmbeddings({
    modelName: 'text-embedding-3-small',
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  // Check if we have indexed documents
  try {
    const collection = await qdrant.getCollection('legal_paragraphs');
    const vectorCount = collection.points_count || 0;
    console.log(`\n📚 Vectori în Qdrant: ${vectorCount}`);
    
    if (vectorCount === 0) {
      console.log('❌ Nu există documente indexate!');
      console.log('   Rulează mai întâi: ./index-essential\n');
      return;
    }
  } catch {
    console.log('❌ Nu pot conecta la Qdrant\n');
    return;
  }

  // Load questions
  let questions = await loadQuestions();
  if (questions.length === 0) return;
  
  // Limit to first 50 questions for faster testing
  const limit = process.argv[2] ? parseInt(process.argv[2]) : 50;
  questions = questions.slice(0, limit);

  console.log(`📝 Întrebări încărcate: ${questions.length} (din totalul disponibil)`);
  console.log(`   Pentru a testa mai multe/mai puține: ./test-quiz [număr]\n`);

  // Test each question
  const results: TestResult[] = [];
  let foundCount = 0;
  
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    process.stdout.write(`\r  Testez întrebarea ${i + 1}/${questions.length}...`);
    
    const searchResults = await searchForQuestion(qdrant, embeddings, q.question);
    
    const topResult = searchResults[0];
    const foundRelevant = topResult && topResult.score > 50;
    
    if (foundRelevant) foundCount++;
    
    results.push({
      id: q.id,
      question: q.question,
      foundRelevantInfo: foundRelevant,
      topScore: topResult?.score || 0,
      topDocument: topResult?.document || 'N/A',
      correctAnswer: q.correct.toUpperCase()
    });
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log('\r  ' + ' '.repeat(50) + '\r');

  // Display results
  console.log('\n' + '─'.repeat(70));
  console.log('  REZULTATE:');
  console.log('─'.repeat(70) + '\n');

  results.forEach(r => {
    const status = r.foundRelevantInfo ? '✅' : '❌';
    const score = r.topScore.toFixed(1);
    const doc = r.topDocument.length > 30 ? r.topDocument.slice(0, 30) + '...' : r.topDocument;
    console.log(`  ${status} #${r.id.toString().padStart(3)} [${score}%] ${doc}`);
    console.log(`     Întrebare: ${r.question.slice(0, 60)}...`);
    console.log(`     Răspuns corect: ${r.correctAnswer}\n`);
  });

  // Summary
  const accuracy = (foundCount / results.length) * 100;
  
  console.log('─'.repeat(70));
  console.log('  📊 STATISTICI:');
  console.log('─'.repeat(70));
  console.log(`  Total întrebări testate: ${results.length}`);
  console.log(`  Cu informații relevante găsite: ${foundCount}`);
  console.log(`  Fără informații: ${results.length - foundCount}`);
  console.log(`  Acuratețe estimată: ${accuracy.toFixed(1)}%`);
  console.log('─'.repeat(70) + '\n');

  // Recommendations
  if (accuracy < 50) {
    console.log('  ⚠️  Acuratețe scăzută. Recomandări:');
    console.log('     • Indexează mai multe documente (./index-essential)');
    console.log('     • Verifică dacă documentele conțin subiectele din grile');
  } else if (accuracy < 80) {
    console.log('  ⚡ Acuratețe medie. Se poate îmbunătăți cu mai multe documente.');
  } else {
    console.log('  🎉 Acuratețe bună! Sistemul găsește informații pentru majoritatea grilelor.');
  }
  console.log('');
}

main().catch(console.error);
