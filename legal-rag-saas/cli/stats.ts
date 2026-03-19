#!/usr/bin/env tsx
/**
 * Statistics - Detailed system statistics
 */

import { PrismaClient } from '@prisma/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID || '550e8400-e29b-41d4-a716-446655440000';

async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('  📈 STATISTICI DETALIATE');
  console.log('═'.repeat(70));

  const prisma = new PrismaClient();
  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
  });

  try {
    // Document statistics
    const docs = await prisma.document.findMany({
      where: { workspaceId: WORKSPACE_ID },
      include: { _count: { select: { paragraphs: true } } },
    });

    const completed = docs.filter(d => d.status === 'COMPLETED');
    const totalParagraphs = docs.reduce((sum, d) => sum + d._count.paragraphs, 0);
    
    // File sizes
    const totalSize = completed.reduce((sum, d) => sum + (Number(d.fileSize) || 0), 0);
    const avgSize = completed.length > 0 ? totalSize / completed.length : 0;

    console.log('\n📊 DOCUMENTE:');
    console.log(`   Total documente:      ${docs.length.toLocaleString()}`);
    console.log(`   Completate:           ${completed.length.toLocaleString()}`);
    console.log(`   Eșuate:               ${docs.filter(d => d.status === 'FAILED').length.toLocaleString()}`);
    console.log(`   În așteptare:         ${docs.filter(d => d.status === 'PENDING').length.toLocaleString()}`);
    
    console.log('\n📝 PARAGRafe:');
    console.log(`   Total paragrafe:      ${totalParagraphs.toLocaleString()}`);
    console.log(`   Medie per document:   ${completed.length > 0 ? (totalParagraphs / completed.length).toFixed(1) : 'N/A'}`);

    console.log('\n💾 DIMENSIUNI:');
    console.log(`   Spațiu total:         ${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`);
    console.log(`   Medie per document:   ${(avgSize / (1024 * 1024)).toFixed(2)} MB`);

    // Recent activity
    console.log('\n🕐 ACTIVITATE RECENTĂ:');
    const recent = await prisma.document.findMany({
      where: { workspaceId: WORKSPACE_ID },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { name: true, status: true, updatedAt: true },
    });

    recent.forEach(doc => {
      const date = doc.updatedAt.toLocaleString('ro-RO');
      const status = doc.status === 'COMPLETED' ? '✅' : doc.status === 'FAILED' ? '❌' : '⏳';
      console.log(`   ${status} ${(doc.name || '').slice(0, 40).padEnd(42)} ${date}`);
    });

    // Qdrant stats
    console.log('\n🧠 QDRANT:');
    try {
      const collection = await qdrant.getCollection('legal_paragraphs');
      const vectorsCount = collection.points_count || 0;
      console.log(`   Vectori:              ${vectorsCount.toLocaleString()}`);
      console.log(`   Segmente:             ${collection.config?.optimizer_config?.default_segment_number || 'N/A'}`);
      
      if (totalParagraphs > 0) {
        const ratio = ((vectorsCount / totalParagraphs) * 100).toFixed(1);
        console.log(`   Sincronizare:         ${ratio}%`);
      }
    } catch {
      console.log('   ⚠️  Nu pot citi Qdrant');
    }

    // Categories
    console.log('\n📂 TOP CATEGORII:');
    const categories = await prisma.document.groupBy({
      by: ['name'],
      where: { workspaceId: WORKSPACE_ID, status: 'COMPLETED' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const nameStats = completed.reduce((acc, doc) => {
      const key = doc.name?.split('_')[0] || 'Necategorizat';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(nameStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([key, count]) => {
        const pct = completed.length > 0 ? ((count / completed.length) * 100).toFixed(1) : '0.0';
        console.log(`   ${key.padEnd(30)} ${count.toString().padStart(4)} (${pct}%)`);
      });

    console.log('\n' + '═'.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Eroare:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
