#!/usr/bin/env tsx
/**
 * ANRE Quick Scraper - Non-interactiv
 * Descarcă rapid toate documentele
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const CONFIG = {
  outputDir: process.argv[2] || './downloads/anre_complete',
  maxDepth: parseInt(process.argv[3]) || 3,
  startUrl: 'https://arhiva.anre.ro/ro/energie-electrica/legislatie',
};

interface DocumentInfo {
  url: string;
  filename: string;
  title: string;
  category: string;
}

const colors = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', blue: '\x1b[34m', cyan: '\x1b[36m', magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    return execSync(`curl -sL -k --max-time 30 "${url}" 2>/dev/null || echo ""`, {
      encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024,
    });
  } catch { return null; }
}

function extractDownloadLinks(html: string, category: string): DocumentInfo[] {
  const documents: DocumentInfo[] = [];
  const seen = new Set<string>();
  
  // Pattern pentru link-uri de download
  const patterns = [
    /<a[^>]*href=["']([^"']*download\.php[^"']*)["'][^>]*title=["']([^"']+)["'][^>]*>/gi,
    /<a[^>]*title=["']([^"']+)["'][^>]*href=["']([^"']*download\.php[^"']*)["'][^>]*>/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = match[1].includes('download.php') ? match[1] : match[2];
      const title = match[1].includes('download.php') ? match[2] : match[1];
      
      const fullUrl = url.startsWith('http') ? url : `https://arhiva.anre.ro${url}`;
      if (seen.has(fullUrl)) continue;
      seen.add(fullUrl);
      
      let filename = title.replace(/[^a-zA-Z0-9ăîșțâĂÎȘȚÂ\-_.\s]/gi, '').replace(/\s+/g, '_').substring(0, 80);
      if (!filename.match(/\.(pdf|doc|zip)$/i)) filename += '.pdf';
      
      documents.push({ url: fullUrl, filename, title: title.trim(), category });
    }
  }
  
  return documents;
}

function extractSubPages(html: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  
  const pattern = /href=["'](\/ro\/energie-electrica\/legislatie[^"']*)["']/gi;
  let match;
  
  while ((match = pattern.exec(html)) !== null) {
    const url = `https://arhiva.anre.ro${match[1]}`;
    if (!seen.has(url) && !url.includes('download.php')) {
      seen.add(url);
      links.push(url);
    }
  }
  
  return links;
}

async function main() {
  log('╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║     🌐 ANRE Quick Scraper                              ║', 'cyan');
  log(`║     Folder: ${CONFIG.outputDir.substring(0, 30).padEnd(30)}  ║`, 'cyan');
  log(`║     Depth: ${CONFIG.maxDepth.toString().padEnd(31)}  ║`, 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');
  
  // Crează folderul
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  
  const visited = new Set<string>();
  const toVisit = [CONFIG.startUrl];
  const allDocs: DocumentInfo[] = [];
  
  // Faza 1: Scanare
  log('\n🔍 FAZA 1: Scanare pagini...', 'blue');
  
  while (toVisit.length > 0 && visited.size < 50) { // Limită de siguranță
    const url = toVisit.shift()!;
    if (visited.has(url)) continue;
    
    visited.add(url);
    log(`[${visited.size}] Scan: ${url.substring(40, 80)}...`, 'yellow');
    
    const html = await fetchPage(url);
    if (!html) continue;
    
    // Extrage documente
    const category = url.replace(/https:\/\/arhiva\.anre\.ro\/ro\//, '').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const docs = extractDownloadLinks(html, category);
    allDocs.push(...docs);
    
    // Extrage sub-pagini
    if (visited.size < CONFIG.maxDepth * 10) {
      const subPages = extractSubPages(html);
      toVisit.push(...subPages.filter(p => !visited.has(p)));
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Elimină duplicate
  const uniqueDocs = allDocs.filter((d, i, self) => i === self.findIndex(t => t.url === d.url));
  
  log(`\n📊 REZULTATE SCANARE:`, 'magenta');
  log(`   Pagini scanate: ${visited.size}`, 'cyan');
  log(`   Documente unice: ${uniqueDocs.length}`, 'green');
  
  if (uniqueDocs.length === 0) {
    log('⚠️  Nu s-au găsit documente', 'yellow');
    return;
  }
  
  // Afișează primele 10
  log('\n📋 Primele documente găsite:', 'blue');
  uniqueDocs.slice(0, 10).forEach((d, i) => {
    log(`  ${i + 1}. ${d.filename.substring(0, 50)}`, 'cyan');
  });
  if (uniqueDocs.length > 10) log(`  ... și încă ${uniqueDocs.length - 10}`, 'cyan');
  
  // Faza 2: Descărcare
  log('\n⬇️  FAZA 2: Descărcare documente...', 'blue');
  
  let success = 0, failed = 0;
  
  for (let i = 0; i < uniqueDocs.length; i++) {
    const doc = uniqueDocs[i];
    const catDir = path.join(CONFIG.outputDir, doc.category);
    if (!fs.existsSync(catDir)) fs.mkdirSync(catDir, { recursive: true });
    
    const outputPath = path.join(catDir, doc.filename);
    
    if (fs.existsSync(outputPath)) {
      log(`  [${i + 1}/${uniqueDocs.length}] ⏭️  ${doc.filename.substring(0, 40)}`, 'yellow');
      success++;
      continue;
    }
    
    process.stdout.write(`  [${i + 1}/${uniqueDocs.length}] ${doc.filename.substring(0, 40)}... `);
    
    try {
      execSync(`curl -sL -k --max-time 60 "${doc.url}" -o "${outputPath}"`, { timeout: 65000 });
      const size = fs.statSync(outputPath).size;
      if (size > 100) {
        console.log(`✅ ${(size / 1024 / 1024).toFixed(2)} MB`);
        success++;
      } else {
        console.log(`❌ Prea mic`);
        fs.unlinkSync(outputPath);
        failed++;
      }
    } catch {
      console.log(`❌ Eroare`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 800));
  }
  
  // Raport
  log(`\n╔════════════════════════════════════════════════════════╗`, 'magenta');
  log(`║  ✅ Succes: ${success.toString().padStart(3)}  ❌ Eșuate: ${failed.toString().padStart(3)}                    ║`, success > failed ? 'green' : 'yellow');
  log(`╚════════════════════════════════════════════════════════╝`, 'magenta');
  log(`📁 Folder: ${CONFIG.outputDir}`, 'cyan');
}

main().catch(console.error);
