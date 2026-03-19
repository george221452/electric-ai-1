#!/usr/bin/env tsx
/**
 * Count Documents - Count PDFs in all download folders
 */

import * as fs from 'fs';
import * as path from 'path';

function countPDFs(dir: string): { count: number; size: number } {
  let count = 0;
  let size = 0;
  
  if (!fs.existsSync(dir)) {
    return { count, size };
  }

  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      const sub = countPDFs(fullPath);
      count += sub.count;
      size += sub.size;
    } else if (item.toLowerCase().endsWith('.pdf')) {
      count++;
      size += stat.size;
    }
  }
  
  return { count, size };
}

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  const mb = bytes / (1024 * 1024);
  
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  return `${mb.toFixed(2)} MB`;
}

async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('  📊 NUMĂRĂTOARE DOCUMENTE');
  console.log('═'.repeat(70) + '\n');

  const downloadsDir = path.resolve('./downloads');
  
  if (!fs.existsSync(downloadsDir)) {
    console.log('❌ Directorul downloads/ nu există!\n');
    return;
  }

  const folders = [
    { name: 'anre_super_complete', label: '📚 ANRE Super Complete' },
    { name: 'anre_toata_legislatia', label: '📖 ANRE Toată Legislația' },
    { name: 'anre_all_docs', label: '📄 ANRE All Docs' },
    { name: 'anre_nte', label: '⚡ ANRE Norme Tehnice (NTE)' },
    { name: 'anre_legislatie_complete', label: '🏛️ ANRE Legislație Completă' },
    { name: 'anre_complete', label: '📋 ANRE Complete' },
  ];

  let totalFiles = 0;
  let totalSize = 0;

  console.log('📂 DOCUMENTE DESCĂRCATE:\n');

  for (const { name, label } of folders) {
    const dir = path.join(downloadsDir, name);
    const { count, size } = countPDFs(dir);
    
    if (count > 0) {
      totalFiles += count;
      totalSize += size;
      const sizeStr = formatSize(size);
      console.log(`  ${label.padEnd(35)} ${count.toString().padStart(5)} PDF-uri  (${sizeStr})`);
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`  📊 TOTAL:                             ${totalFiles.toLocaleString().padStart(5)} PDF-uri  (${formatSize(totalSize)})\n`);
}

main();
