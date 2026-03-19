#!/usr/bin/env tsx
/**
 * ANRE Super Downloader - Cu Progress Bar
 * Descarcă TOATE documentele de legislație de pe ANRE
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const CONFIG = {
  outputDir: process.argv[2] || './downloads/anre_super_complete',
  maxPages: 500,
  delay: 600,
};

interface Document {
  url: string;
  filename: string;
  title: string;
}

// Progress bar vizual
function printProgressBar(current: number, total: number, width: number = 40): string {
  const percent = Math.min(100, Math.round((current / total) * 100));
  const filled = Math.round((width * current) / total);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  return `[${bar}] ${percent}% (${current}/${total})`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function fetchHtml(url: string): Promise<string> {
  try {
    return execSync(`curl -sL -k --max-time 30 "${url}" 2>/dev/null || echo ""`, {
      encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024,
    });
  } catch { return ''; }
}

function extractLinks(html: string): string[] {
  const links: string[] = [];
  const pattern = /href="(https:\/\/arhiva\.anre\.ro\/ro\/energie-electrica\/legislatie[^"]*)"/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const url = match[1];
    if (!url.includes('print?') && !url.includes('twitter') && !url.includes('facebook') && !url.includes('/www.anre.ro/')) {
      links.push(url);
    }
  }
  return Array.from(new Set(links));
}

function extractDocs(html: string): Document[] {
  const docs: Document[] = [];
  const seen = new Set<string>();
  
  const pattern = /<a[^>]*href="([^"]*download\.php[^"]*)"[^>]*title="([^"]*)"[^>]*>/gi;
  let match;
  
  while ((match = pattern.exec(html)) !== null) {
    const url = match[1].startsWith('http') ? match[1] : `https://arhiva.anre.ro${match[1]}`;
    const title = match[2].trim();
    
    if (seen.has(url)) continue;
    seen.add(url);
    
    let filename = title.replace(/[^a-zA-Z0-9ăîșțâĂÎȘȚÂ\-_.\s]/gi, '').replace(/\s+/g, '_').substring(0, 120);
    if (!filename.match(/\.(pdf|doc|zip)$/i)) filename += '.pdf';
    
    docs.push({ url, filename, title });
  }
  
  return docs;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 ANRE SUPER DOWNLOADER - Toată Legislația                  ║');
  console.log('║  Cu Progress Bar și Statistici în Timp Real                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log();
  
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  
  console.log(`📁 Folder: ${CONFIG.outputDir}`);
  console.log(`🌐 Start: https://arhiva.anre.ro/ro/energie-electrica/legislatie`);
  console.log(`⚡ Max pagini: ${CONFIG.maxPages}`);
  console.log();
  
  // FAZA 1: SCANARE
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  FAZA 1/2: SCANARE - Colectare URL-uri documente              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log();
  
  const toVisit = ['https://arhiva.anre.ro/ro/energie-electrica/legislatie'];
  const visited = new Set<string>();
  const allDocs: Document[] = [];
  
  while (toVisit.length > 0 && visited.size < CONFIG.maxPages) {
    const url = toVisit.shift()!;
    if (visited.has(url)) continue;
    
    visited.add(url);
    
    // Afișează progress
    process.stdout.write(`\r📄 ${printProgressBar(visited.size, CONFIG.maxPages)} | Pagini rămase: ${toVisit.length.toString().padStart(3)} | Doc găsite: ${allDocs.length.toString().padStart(4)}`);
    
    const html = await fetchHtml(url);
    if (!html) continue;
    
    const docs = extractDocs(html);
    allDocs.push(...docs);
    
    const links = extractLinks(html);
    for (const link of links) {
      if (!visited.has(link) && !toVisit.includes(link)) {
        toVisit.push(link);
      }
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ SCANARE COMPLETĂ                                          ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Pagini scanate:      ${visited.size.toString().padStart(3)}                                      ║`);
  console.log(`║  Documente unice:     ${allDocs.length.toString().padStart(4)}                                     ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log();
  
  if (allDocs.length === 0) {
    console.log('⚠️  Nu s-au găsit documente!');
    return;
  }
  
  // FAZA 2: DESCĂRCARE
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  FAZA 2/2: DESCĂRCARE - Download toate documentele            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log();
  
  let success = 0, skipped = 0, failed = 0;
  let totalBytes = 0;
  const startTime = Date.now();
  
  for (let i = 0; i < allDocs.length; i++) {
    const doc = allDocs[i];
    const outputPath = path.join(CONFIG.outputDir, doc.filename);
    
    // Calculează statistici
    const elapsed = (Date.now() - startTime) / 1000;
    const docsPerSec = (i / elapsed).toFixed(1);
    const eta = Math.round((allDocs.length - i) / parseFloat(docsPerSec));
    
    // Afișează progress bar mare
    console.clear();
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  ⬇️  DESCĂRCARE ÎN DESFĂȘURARE                                ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║  ${printProgressBar(i, allDocs.length, 50)}                 ║`);
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║  📄 Procesat:     ${i.toString().padStart(4)} / ${allDocs.length.toString().padStart(4)}                            ║`);
    console.log(`║  ✅ Succes:       ${success.toString().padStart(4)}                                     ║`);
    console.log(`║  ⏭️  Exista:      ${skipped.toString().padStart(4)}                                     ║`);
    console.log(`║  ❌ Eșuate:       ${failed.toString().padStart(4)}                                     ║`);
    console.log(`║  💾 Spațiu:       ${formatBytes(totalBytes).padStart(10)}                              ║`);
    console.log(`║  ⚡ Viteză:       ${docsPerSec} doc/sec                            ║`);
    console.log(`║  ⏱️  Timp:         ${Math.round(elapsed)}s | ETA: ${eta}s                    ║`);
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║  📝 ${doc.filename.substring(0, 55).padEnd(55)}         ║`);
    console.log('╚════════════════════════════════════════════════════════════════╝');
    
    // Verifică dacă există
    if (fs.existsSync(outputPath)) {
      skipped++;
      const stats = fs.statSync(outputPath);
      totalBytes += stats.size;
      continue;
    }
    
    // Descarcă
    try {
      execSync(`curl -sL -k --max-time 60 "${doc.url}" -o "${outputPath}"`, { timeout: 65000 });
      
      const stats = fs.statSync(outputPath);
      if (stats.size > 100) {
        success++;
        totalBytes += stats.size;
      } else {
        fs.unlinkSync(outputPath);
        failed++;
      }
    } catch {
      failed++;
    }
    
    await new Promise(r => setTimeout(r, CONFIG.delay));
  }
  
  // RAPORT FINAL
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ DESCĂRCARE COMPLETĂ!                                      ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  ${printProgressBar(allDocs.length, allDocs.length, 50)}                 ║`);
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  📄 Total documente:  ${allDocs.length.toString().padStart(4)}                                     ║`);
  console.log(`║  ✅ Descărcate:       ${success.toString().padStart(4)}                                     ║`);
  console.log(`║  ⏭️  Existente:       ${skipped.toString().padStart(4)}                                     ║`);
  console.log(`║  ❌ Eșuate:           ${failed.toString().padStart(4)}                                     ║`);
  console.log(`║  💾 Spațiu total:     ${formatBytes(totalBytes).padStart(10)}                              ║`);
  console.log(`║  ⏱️  Timp total:      ${Math.round((Date.now() - startTime) / 1000)}s                                     ║`);
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  📁 Locație: ${CONFIG.outputDir.padEnd(53)}   ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  // Listează primele 10 fișiere
  console.log();
  console.log('📂 Primele 10 fișiere descărcate:');
  const files = fs.readdirSync(CONFIG.outputDir)
    .map(f => ({ name: f, size: fs.statSync(path.join(CONFIG.outputDir, f)).size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);
  
  files.forEach((f, i) => {
    console.log(`   ${i + 1}. ${f.name.substring(0, 50)} (${formatBytes(f.size)})`);
  });
}

main().catch(console.error);
