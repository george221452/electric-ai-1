#!/usr/bin/env tsx
/**
 * Search - Search in indexed documents
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddings } from '@langchain/openai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID || '550e8400-e29b-41d4-a716-446655440000';

async function main() {
  const query = process.argv.slice(2).join(' ');
  
  if (!query) {
    console.log('\n❌ Trebuie să specifici un text de căutat.');
    console.log('   Exemplu: ./rag search "tensiune nominală"\n');
    return;
  }

  console.log('\n' + '═'.repeat(70));
  console.log('  🔍 CĂUTARE ÎN DOCUMENTE');
  console.log('═'.repeat(70));
  console.log(`\n  Query: "${query}"\n`);

  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
  });
  const embeddings = new OpenAIEmbeddings({
    modelName: 'text-embedding-3-small',
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  try {
    console.log('  🔄 Generez embedding și caut...\n');
    
    const vector = await embeddings.embedQuery(query);
    
    const results = await qdrant.search('legal_paragraphs', {
      vector: vector,
      limit: 10,
      filter: {
        must: [
          { key: 'workspaceId', match: { value: WORKSPACE_ID } }
        ]
      }
    });

    if (results.length === 0) {
      console.log('  ❌ Nu am găsit rezultate.');
      console.log('      Asigură-te că ai documente indexate.\n');
      return;
    }

    console.log(`  ✅ ${results.length} rezultate găsite:\n`);

    results.forEach((result, i) => {
      const payload = result.payload as any;
      const score = ((result.score || 0) * 100).toFixed(1);
      const content = (payload.content || '').slice(0, 250);
      const source = payload.filename || 'Necunoscut';
      const category = payload.category || 'General';
      
      console.log(`  ${'─'.repeat(68)}`);
      console.log(`  #${i + 1}  📄 ${source}`);
      console.log(`      📂 ${category} | Relevanță: ${score}%`);
      console.log(`      📝 ${content}...\n`);
    });

  } catch (error) {
    console.error('\n❌ Eroare:', error);
  }
}

main();
