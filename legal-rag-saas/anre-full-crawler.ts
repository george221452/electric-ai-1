#!/usr/bin/env tsx
/**
 * ANRE Full Crawler - Descarcă TOATĂ legislația
 * Pornește de la pagina principală și urmărește TOATE sub-paginile
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const CONFIG = {
  outputDir: process.argv[2] || './downloads/anre_toata_legislatia',
  maxPages: 500,
  delay: 800,
};

interface Document {
  url: string;
  filename: string;
  title: string;
  sourceUrl: string;
}

const colors = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m', 
  red: '\x1b[31m', blue: '\x1b[34m', cyan: '\x1b[36m', magenta: '\x1b[35m'
};

function log(msg: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

async function fetchHtml(url: string): Promise<string> {
  try {
    return execSync(`curl -sL -k --max-time 30 "${url}" 2>/dev/null || echo ""`, {
      encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024,
    });
  } catch { return ''; }
}

/**
 * Extrage TOATE link-urile de sub-pagini
 */
function extractSubPages(html: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  
  // Pattern pentru link-uri de legislație
  const pattern = /href="(https:\/\/arhiva\.anre\.ro\/ro\/energie-electrica\/legislatie[^"]*)"/g;
  
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const url = match[1];
    if (seen.has(url)) continue;
    if (url.includes('print?')) continue;
    if (url.includes('twitter.com')) continue;
    if (url.includes('facebook.com')) continue;
    if (url.includes('/www.anre.ro/')) continue;
    
    seen.add(url);
    links.push(url);
  }
  
  return Array.from(new Set(links));
}

/**
 * Extrage documente din pagină
 */
function extractDocuments(html: string, sourceUrl: string): Document[] {
  const docs: Document[] = [];
  const seen = new Set<string>();
  
  // Pattern pentru link-uri de download
  const patterns = [
    /<a[^>]*href="([^"]*download\.php[^"]*)"[^>]*title="([^"]*)"[^>]*>/gi,
    /<a[^>]*title="([^"]*)"[^>]*href="([^"]*download\.php[^"]*)"[^>]*>/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const isFirstPattern = match[1].includes('download.php');
      const url = isFirstPattern ? match[1] : match[2];
      const title = isFirstPattern ? match[2] : match[1];
      
      const fullUrl = url.startsWith('http') ? url : `https://arhiva.anre.ro${url}`;
      if (seen.has(fullUrl)) continue;
      seen.add(fullUrl);
      
      // Curăță titlul
      const cleanTitle = title
        .replace(/<[^>]+>/g, '')
        .replace(/&[^;]+;/g, ' ')
        .trim();
      
      // Generează filename
      let filename = cleanTitle
        .replace(/[^a-zA-Z0-9ăîșțâĂÎȘȚÂ\-_.\s]/gi, '')
        .replace(/\s+/g, '_')
        .substring(0, 120);
      
      if (!filename.match(/\.(pdf|doc|docx|zip|rar)$/i)) {
        filename += '.pdf';
      }
      
      docs.push({
        url: fullUrl,
        filename,
        title: cleanTitle,
        sourceUrl
      });
    }
  }
  
  return docs;
}

async function main() {
  log('╔══════════════════════════════════════════════════════════╗', 'cyan');
  log('║     🕸️  ANRE FULL CRAWLER - Toată Legislația             ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════╝', 'cyan');
  
  // Crează folderul
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  
  // URL-uri de start
  const startUrls = [
    'https://arhiva.anre.ro/ro/energie-electrica/legislatie',
    'https://arhiva.anre.ro/ro/gaze-naturale/legislatie',
  ];
  
  const toVisit = [...startUrls];
  const visited = new Set<string>();
  const allDocs: Document[] = [];
  
  log(`\n🚀 ÎNCEP CRAWLING...`, 'magenta');
  log(`   Max ${CONFIG.maxPages} pagini`, 'cyan');
  
  // Faza 1: Descoperă toate paginile și documentele
  while (toVisit.length > 0 && visited.size < CONFIG.maxPages) {
    const url = toVisit.shift()!;
    if (visited.has(url)) continue;
    
    visited.add(url);
    process.stdout.write(`\r[${visited.size.toString().padStart(3)}] Scan: ${url.substring(40, 85)}...`);
    
    const html = await fetchHtml(url);
    if (!html) continue;
    
    // Extrage documente
    const docs = extractDocuments(html, url);
    if (docs.length > 0) {
      allDocs.push(...docs);
      process.stdout.write(` (+${docs.length} doc)`);
    }
    
    // Extrage sub-pagini
    const subPages = extractSubPages(html);
    for (const page of subPages) {
      if (!visited.has(page) && !toVisit.includes(page)) {
        toVisit.push(page);
      }
    }
    
    await new Promise(r => setTimeout(r, CONFIG.delay));
  }
  
  console.log('\n');
  
  // Elimină duplicate
  const uniqueDocs = allDocs.filter((d, i, self) => 
    i === self.findIndex(t => t.url === d.url)
  );
  
  log(`╔══════════════════════════════════════════════════════════╗`, 'magenta');
  log(`║              📊 STATISTICĂ CRAWLING                      ║`, 'magenta');
  log(`╠══════════════════════════════════════════════════════════╣`, 'magenta');
  log(`║  Pagini scanate:      ${visited.size.toString().padStart(3)}                              ║`, 'cyan');
  log(`║  Documente găsite:    ${uniqueDocs.length.toString().padStart(3)}                              ║`, 'cyan');
  log(`╚══════════════════════════════════════════════════════════╝`, 'magenta');
  
  if (uniqueDocs.length === 0) {
    log('⚠️  Nu s-au găsit documente!', 'yellow');
    return;
  }
  
  // Afișează distribuția după sursă
  const bySource: Record<string, number> = {};
  for (const d of uniqueDocs) {
    const shortSource = d.sourceUrl.replace('https://arhiva.anre.ro/ro/', '');
    bySource[shortSource] = (bySource[shortSource] || 0) + 1;
  }
  
  log(`\n📂 Distribuție pe surse:`, 'blue');
  Object.entries(bySource)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([src, count]) => {
      log(`  • ${src.substring(0, 50).padEnd(50)}: ${count}`, 'cyan');
    });
  
  // Faza 2: Descărcare
  log(`\n⬇️  ÎNCEP DESCĂRCAREA ${uniqueDocs.length} DOCUMENTE...`, 'magenta');
  
  let success = 0, skipped = 0, failed = 0;
  
  for (let i = 0; i < uniqueDocs.length; i++) {
    const doc = uniqueDocs[i];
    const outputPath = path.join(CONFIG.outputDir, doc.filename);
    
    // Verifică dacă există
    if (fs.existsSync(outputPath)) {
      skipped++;
      continue;
    }
    
    process.stdout.write(`\r[${(i + 1).toString().padStart(4)}/${uniqueDocs.length}] ${doc.filename.substring(0, 50).padEnd(50)}`);
    
    try {
      execSync(`curl -sL -k --max-time 60 "${doc.url}" -o "${outputPath}"`, { timeout: 65000 });
      
      const size = fs.statSync(outputPath).size;
      if (size > 100) {
        success++;
      } else {
        fs.unlinkSync(outputPath);
        failed++;
      }
    } catch {
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n');
  
  // Raport final
  log(`╔══════════════════════════════════════════════════════════╗`, 'green');
  log(`║              ✅ DESCĂRCARE COMPLETĂ                      ║`, 'green');
  log(`╠══════════════════════════════════════════════════════════╣`, 'green');
  log(`║  ✅ Noi descărcate:   ${success.toString().padStart(4)}                              ║`, 'green');
  log(`║  ⏭️  Existau deja:    ${skipped.toString().padStart(4)}                              ║`, 'yellow');
  log(`║  ❌ Eșuate:           ${failed.toString().padStart(4)}                              ║`, failed > 0 ? 'red' : 'green');
  log(`║  📁 TOTAL:            ${(success + skipped).toString().padStart(4)}                              ║`, 'cyan');
  log(`╚══════════════════════════════════════════════════════════╝`, 'green');
  
  log(`\n📂 Locație: ${path.resolve(CONFIG.outputDir)}`, 'cyan');
  
  // Calculează spațiul total
  const files = fs.readdirSync(CONFIG.outputDir);
  let totalSize = 0;
  for (const f of files) {
    try {
      totalSize += fs.statSync(path.join(CONFIG.outputDir, f)).size;
    } catch {}
  }
  log(`💾 Spațiu total: ${(totalSize / 1024 / 1024).toFixed(2)} MB`, 'cyan');
}

main().catch(console.error);
