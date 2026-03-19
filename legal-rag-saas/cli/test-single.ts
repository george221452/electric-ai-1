#!/usr/bin/env tsx
/**
 * Test Single Question - Test one question and show detailed results
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddings } from '@langchain/openai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID || '550e8400-e29b-41d4-a716-446655440000';

async function main() {
  const question = process.argv.slice(2).join(' ');
  
  if (!question) {
    console.log('\n❌ Trebuie să specifici o întrebare.');
    console.log('   Exemplu: ./rag test-single "Care este tensiunea nominală?"\n');
    return;
  }

  console.log('\n' + '═'.repeat(70));
  console.log('  🧪 TEST SINGLE QUESTION');
  console.log('═'.repeat(70));
  console.log(`\n  ❓ Întrebare: ${question}\n`);

  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
  });
  const embeddings = new OpenAIEmbeddings({
    modelName: 'text-embedding-3-small',
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  try {
    console.log('  🔍 Caut în documente...\n');
    
    // Generate embedding for the question
    const vector = await embeddings.embedQuery(question);
    
    // Search in Qdrant
    const results = await qdrant.search('legal_paragraphs', {
      vector: vector,
      limit: 5,
      filter: {
        must: [
          { key: 'workspaceId', match: { value: WORKSPACE_ID } }
        ]
      }
    });

    if (results.length === 0) {
      console.log('  ❌ Nu am găsit rezultate relevante.');
      console.log('      Asigură-te că ai documente indexate.\n');
      return;
    }

    console.log(`  ✅ Am găsit ${results.length} rezultate:\n`);

    results.forEach((result, i) => {
      const payload = result.payload as any;
      const score = ((result.score || 0) * 100).toFixed(1);
      const content = (payload.content || '').slice(0, 200);
      const source = payload.filename || 'Necunoscut';
      
      console.log(`  ${i + 1}. 📄 ${source} (scor: ${score}%)`);
      console.log(`     ${content}...\n`);
    });

    // Detect if it's a quiz question
    const isQuiz = /[ABC][).]?\s|[abc][).]?\s/.test(question) || 
                   /varianta|a\)|b\)|c\)/i.test(question);
    
    if (isQuiz) {
      console.log('  📝 Detectat: Întrebare cu variante de răspuns\n');
    }

    console.log('  💡 Pentru răspuns complet folosește aplicația web.\n');

  } catch (error) {
    console.error('\n❌ Eroare:', error);
  }
}

main();
