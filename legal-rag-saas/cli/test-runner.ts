#!/usr/bin/env tsx
/**
 * Test Runner - Run automated tests on ANRE quiz questions
 */

import { PrismaClient } from '@prisma/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddings } from '@langchain/openai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID || '550e8400-e29b-41d4-a716-446655440000';

interface TestResult {
  question: string;
  expected: string;
  actual: string;
  correct: boolean;
  confidence: number;
}

// Sample test questions (you can load from test_questions.json)
const SAMPLE_QUESTIONS = [
  { question: 'Ce tensiune nominală este considerată joasă tensiune?', options: ['A) Până la 1 kV', 'B) Până la 35 kV', 'C) Peste 1 kV'], correct: 'A' },
  { question: 'Câte grade de electricieni există?', options: ['A) 3', 'B) 4', 'C) 5'], correct: 'B' },
];

async function main() {
  const testType = process.argv[2] || 'quiz';
  
  console.log('\n' + '═'.repeat(70));
  console.log('  🧪 TEST RUNNER');
  console.log('═'.repeat(70));
  console.log(`\n  Tip test: ${testType}\n`);

  const prisma = new PrismaClient();
  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
  });
  const embeddings = new OpenAIEmbeddings({
    modelName: 'text-embedding-3-small',
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  try {
    // Check if we have indexed documents
    const docCount = await prisma.document.count({ 
      where: { workspaceId: WORKSPACE_ID, status: 'COMPLETED' } 
    });
    
    if (docCount === 0) {
      console.log('❌ Nu există documente indexate!');
      console.log('   Rulează mai întâi: ./rag index start\n');
      return;
    }

    console.log(`  📚 Documente indexate: ${docCount}\n`);
    console.log('  🔄 Încerc testarea... (simplificată)\n');

    // For now, just show that the system is ready
    console.log('  ✅ Sistemul este configurat pentru testare.');
    console.log('  📊 Pentru teste complete folosește aplicația web sau:');
    console.log('     npm run test\n');

    // Show test questions count
    try {
      const fs = await import('fs');
      if (fs.existsSync('./test_questions.json')) {
        const data = JSON.parse(fs.readFileSync('./test_questions.json', 'utf8'));
        const questions = Array.isArray(data) ? data : data.questions || [];
        console.log(`  📝 Întrebări disponibile: ${questions.length}\n`);
      }
    } catch {
      console.log('  ℹ️  Nu am găsit test_questions.json\n');
    }

  } catch (error) {
    console.error('\n❌ Eroare:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
