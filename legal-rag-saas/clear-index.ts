#!/usr/bin/env tsx
/**
 * Clear All Indexed Documents
 * Deletes all documents from Prisma and Qdrant for fresh reindexing
 * 
 * Usage:
 *   npm run index:clear           - Clear all indexed documents (with confirmation)
 *   npm run index:clear -- --force - Skip confirmation (DANGEROUS)
 */

import { PrismaClient } from '@prisma/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment variables
const envPath = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: envPath });

const WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID || '550e8400-e29b-41d4-a716-446655440000';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise(resolve => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function confirmDangerousAction(docCount: number, vectorCount: number): Promise<boolean> {
  console.log('\n' + '⚠️'.repeat(40));
  console.log('⚠️  DANGER ZONE - IRREVERSIBLE ACTION  ⚠️');
  console.log('⚠️'.repeat(40) + '\n');
  
  console.log(`You are about to DELETE:\n`);
  console.log(`  📚 ${docCount} documents from PostgreSQL (Prisma)`);
  console.log(`  📝 Associated paragraphs`);
  console.log(`  🧠 ${vectorCount} vectors from Qdrant`);
  console.log(`\n  Workspace ID: ${WORKSPACE_ID}\n`);
  
  console.log('⚠️  This action CANNOT be undone!');
  console.log('⚠️  You will need to reindex all documents from scratch.\n');
  
  const answer = await askQuestion('Type "DELETE" to confirm: ');
  return answer.trim().toUpperCase() === 'DELETE';
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEAR FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

async function clearPrismaDocuments(prisma: PrismaClient): Promise<number> {
  console.log('🗑️  Clearing documents from PostgreSQL...');
  
  // Delete in correct order (paragraphs first due to foreign key)
  const paragraphsResult = await prisma.paragraph.deleteMany({
    where: { document: { workspaceId: WORKSPACE_ID } }
  });
  
  const documentsResult = await prisma.document.deleteMany({
    where: { workspaceId: WORKSPACE_ID }
  });
  
  console.log(`   ✅ Deleted ${documentsResult.count} documents`);
  console.log(`   ✅ Deleted ${paragraphsResult.count} paragraphs`);
  
  return documentsResult.count;
}

async function clearQdrantVectors(qdrant: QdrantClient): Promise<number> {
  console.log('🗑️  Clearing vectors from Qdrant...');
  
  try {
    // Try to delete by filter (payload filter)
    await qdrant.delete('legal_paragraphs', {
      filter: {
        must: [
          { key: 'workspaceId', match: { value: WORKSPACE_ID } }
        ]
      }
    });
    
    // Get count after deletion
    const collection = await qdrant.getCollection('legal_paragraphs');
    const remaining = collection.points_count || 0;
    
    console.log(`   ✅ Vectors deleted`);
    console.log(`   📊 Remaining vectors in collection: ${remaining}`);
    
    return remaining;
  } catch (error) {
    console.log('   ⚠️  Could not determine exact vector count (deleted by filter)');
    return 0;
  }
}

async function resetQdrantCollection(qdrant: QdrantClient): Promise<void> {
  console.log('\n🔧 Resetting Qdrant collection...');
  
  try {
    // Delete and recreate collection
    await qdrant.deleteCollection('legal_paragraphs');
    
    await qdrant.createCollection('legal_paragraphs', {
      vectors: {
        size: 1536,
        distance: 'Cosine',
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 1,
    });
    
    console.log('   ✅ Collection reset complete');
  } catch (error) {
    console.error('   ❌ Failed to reset collection:', error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🗑️  CLEAR ALL INDEXED DOCUMENTS');
  console.log('='.repeat(80));
  
  const prisma = new PrismaClient();
  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
  });
  
  try {
    // Get current counts
    const docCount = await prisma.document.count({
      where: { workspaceId: WORKSPACE_ID }
    });
    
    const paragraphCount = await prisma.paragraph.count({
      where: { document: { workspaceId: WORKSPACE_ID } }
    });
    
    let vectorCount = 0;
    try {
      const collection = await qdrant.getCollection('legal_paragraphs');
      vectorCount = collection.points_count || 0;
    } catch (e) {
      console.log('⚠️  Could not connect to Qdrant for vector count');
    }
    
    console.log('\n📊 Current Index Status:');
    console.log(`   Documents: ${docCount}`);
    console.log(`   Paragraphs: ${paragraphCount}`);
    console.log(`   Vectors: ${vectorCount}`);
    
    if (docCount === 0 && paragraphCount === 0 && vectorCount === 0) {
      console.log('\n✅ Database is already empty! Nothing to clear.\n');
      await prisma.$disconnect();
      return;
    }
    
    // Check for --force flag
    const forceFlag = process.argv.includes('--force') || process.argv.includes('-f');
    
    if (!forceFlag) {
      const confirmed = await confirmDangerousAction(docCount, vectorCount);
      if (!confirmed) {
        console.log('\n❌ Operation cancelled. No data was deleted.\n');
        await prisma.$disconnect();
        return;
      }
    } else {
      console.log('\n⚠️  Force flag detected, skipping confirmation...');
    }
    
    // Perform deletion
    console.log('\n' + '-'.repeat(80));
    console.log('🗑️  DELETING DATA...');
    console.log('-'.repeat(80) + '\n');
    
    const startTime = Date.now();
    
    // Clear Prisma
    await clearPrismaDocuments(prisma);
    
    // Clear Qdrant
    await clearQdrantVectors(qdrant);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ CLEAR COMPLETE');
    console.log('='.repeat(80));
    console.log(`\n🗑️  All indexed data has been deleted.`);
    console.log(`⏱️  Operation completed in ${duration}s\n`);
    console.log('💡 You can now run: npm run index:start\n');
    
  } catch (error) {
    console.error('\n❌ Error during clearing:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle --reset flag for full collection reset
async function resetCollection() {
  if (process.argv.includes('--reset')) {
    console.log('\n🔧 FULL RESET MODE');
    console.log('   This will delete and recreate the entire Qdrant collection.\n');
    
    const qdrant = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });
    
    const confirmed = await askQuestion('Type "RESET" to confirm full collection reset: ');
    
    if (confirmed.trim().toUpperCase() === 'RESET') {
      await resetQdrantCollection(qdrant);
      console.log('\n✅ Collection reset complete!\n');
    } else {
      console.log('\n❌ Reset cancelled.\n');
    }
    
    process.exit(0);
  }
}

// Check for reset flag first
if (process.argv.includes('--reset')) {
  resetCollection();
} else {
  main();
}
