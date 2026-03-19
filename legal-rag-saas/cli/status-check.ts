#!/usr/bin/env tsx
/**
 * Status Check - Shows complete system status
 */

import { PrismaClient } from '@prisma/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID || '550e8400-e29b-41d4-a716-446655440000';

async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('  📊 STATUS SISTEM RAG');
  console.log('═'.repeat(70));

  const prisma = new PrismaClient();
  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
  });

  try {
    // Database Stats
    console.log('\n📚 BAZA DE DATE (PostgreSQL):');
    const [totalDocs, completed, processing, failed, paragraphs] = await Promise.all([
      prisma.document.count({ where: { workspaceId: WORKSPACE_ID } }),
      prisma.document.count({ where: { workspaceId: WORKSPACE_ID, status: 'COMPLETED' } }),
      prisma.document.count({ where: { workspaceId: WORKSPACE_ID, status: 'PROCESSING' } }),
      prisma.document.count({ where: { workspaceId: WORKSPACE_ID, status: 'FAILED' } }),
      prisma.paragraph.count({ where: { document: { workspaceId: WORKSPACE_ID } } }),
    ]);

    console.log(`   Documente totale:    ${totalDocs.toLocaleString()}`);
    console.log(`   ✅ Completate:       ${completed.toLocaleString()}`);
    console.log(`   ⏳ În procesare:     ${processing.toLocaleString()}`);
    console.log(`   ❌ Eșuate:           ${failed.toLocaleString()}`);
    console.log(`   📝 Paragrafe:        ${paragraphs.toLocaleString()}`);

    // Qdrant Stats
    console.log('\n🧠 VECTOR STORE (Qdrant):');
    try {
      const collection = await qdrant.getCollection('legal_paragraphs');
      console.log(`   Vectori:            ${(collection.points_count || 0).toLocaleString()}`);
      console.log(`   Dimensiune:         ${collection.config?.params?.vectors?.size || 1536}`);
      console.log(`   Distanță:           ${collection.config?.params?.vectors?.distance || 'Cosine'}`);
    } catch {
      console.log('   ⚠️  Nu m-am putut conecta la Qdrant');
    }

    // File System Stats
    console.log('\n📁 SISTEM DE FIȘIERE:');
    const downloadsDir = path.resolve('./downloads');
    if (fs.existsSync(downloadsDir)) {
      const folders = ['anre_super_complete', 'anre_nte', 'anre_toata_legislatia', 'anre_all_docs'];
      let totalFiles = 0;
      
      for (const folder of folders) {
        const dir = path.join(downloadsDir, folder);
        if (fs.existsSync(dir)) {
          const files = countPDFs(dir);
          totalFiles += files;
          console.log(`   📂 ${folder.padEnd(25)} ${files.toString().padStart(5)} PDF-uri`);
        }
      }
      console.log(`   ─────────────────────────────────────`);
      console.log(`   📊 Total fișiere:     ${totalFiles.toLocaleString()} PDF-uri`);
    }

    // Progress calculation
    console.log('\n📈 PROGRES INDEXARE:');
    const downloadsPath = path.resolve('./downloads/anre_super_complete');
    const totalDownloaded = fs.existsSync(downloadsPath) ? countPDFs(downloadsPath) : 0;
    const percent = totalDownloaded > 0 ? ((completed / totalDownloaded) * 100).toFixed(1) : '0.0';
    
    console.log(`   ${completed.toLocaleString()} / ${totalDownloaded.toLocaleString()} documente (${percent}%)`);
    
    const barWidth = 40;
    const filled = Math.floor((completed / totalDownloaded) * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    console.log(`   [${bar}]`);

    if (completed < totalDownloaded) {
      const remaining = totalDownloaded - completed;
      const etaHours = Math.ceil((remaining * 2) / 60);
      console.log(`   ⏳ Rămase: ${remaining} | ETA: ~${etaHours} ore`);
    } else if (completed > 0) {
      console.log('   ✅ Indexare completă!');
    }

    // Categories breakdown
    console.log('\n📂 DOCUMENTE PE CATEGORII:');
    const docsByCategory = await prisma.document.findMany({
      where: { workspaceId: WORKSPACE_ID, status: 'COMPLETED' },
      select: { name: true },
    });
    
    const categoryCounts = docsByCategory.reduce((acc, doc) => {
      const cat = doc.name || 'Necategorizat';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([cat, count]) => {
        const name = cat.padEnd(30);
        console.log(`   ${name} ${count.toString().padStart(4)} doc`);
      });

    console.log('\n' + '═'.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Eroare:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function countPDFs(dir: string): number {
  let count = 0;
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      count += countPDFs(fullPath);
    } else if (item.toLowerCase().endsWith('.pdf')) {
      count++;
    }
  }
  
  return count;
}

main();
