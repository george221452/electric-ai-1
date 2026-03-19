#!/usr/bin/env tsx
/**
 * ANRE Full Scraper - Recursiv
 * Descarcă toate documentele de pe arhiva.anre.ro/legislatie
 * 
 * Utilizare: npx tsx anre-full-scraper.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { execSync } from 'child_process';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

interface DocumentInfo {
  url: string;
  filename: string;
  title: string;
  sourcePage: string;
}

interface PageLink {
  url: string;
  title: string;
  depth: number;
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Descarcă HTML de la o pagină folosind curl
 */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const result = execSync(`curl -sL -k --max-time 30 "${url}" 2>/dev/null || echo ""`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    return result;
  } catch {
    return null;
  }
}

/**
 * Extrage link-uri către sub-pagini de legislație
 */
function extractPageLinks(html: string, baseUrl: string, currentDepth: number): PageLink[] {
  const links: PageLink[] = [];
  const seen = new Set<string>();
  
  // Pattern pentru link-uri interne ANRE
  const patterns = [
    /href=["'](\/ro\/energie-electrica\/legislatie[^"']*)["']/gi,
    /href=["'](https:\/\/arhiva\.anre\.ro\/ro\/energie-electrica\/legislatie[^"']*)["']/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      let url = match[1];
      
      // Normalizează URL
      if (url.startsWith('/')) {
        url = `https://arhiva.anre.ro${url}`;
      }
      
      // Evită duplicate și pagini deja procesate
      if (seen.has(url) || url.includes('download.php')) continue;
      seen.add(url);
      
      // Extrage titlul dacă e disponibil
      const titleMatch = html.substring(Math.max(0, match.index - 200), match.index)
        .match(/>([^<]{10,100})</);
      const title = titleMatch ? titleMatch[1].trim() : 'Pagină legislație';
      
      links.push({ url, title, depth: currentDepth + 1 });
    }
  }
  
  return links;
}

/**
 * Extrage link-uri de download din pagină
 */
function extractDownloadLinks(html: string, pageUrl: string): DocumentInfo[] {
  const documents: DocumentInfo[] = [];
  const seen = new Set<string>();
  
  // Găsește toate link-urile cu title (documente)
  const linkPattern = /<a[^>]*href=["']([^"']*download\.php[^"']*)["'][^>]*title=["']([^"']+)["'][^>]*>/gi;
  
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1].startsWith('http') ? match[1] : `https://arhiva.anre.ro${match[1]}`;
    const title = match[2].trim();
    
    if (seen.has(url)) continue;
    seen.add(url);
    
    // Generează filename din title
    let filename = title
      .replace(/[^a-zA-Z0-9ăîșțâĂÎȘȚÂ\-_.\s]/gi, '')
      .replace(/\s+/g, '_')
      .substring(0, 100);
    
    // Adaugă extensie dacă lipsește
    if (!filename.match(/\.(pdf|doc|docx|zip|rar)$/i)) {
      filename += '.pdf';
    }
    
    documents.push({ url, filename, title, sourcePage: pageUrl });
  }
  
  return documents;
}

/**
 * Verifică dacă un URL este pagină de listare (nu download direct)
 */
function isListingPage(url: string): boolean {
  return !url.includes('download.php') && 
         (url.includes('/ro/energie-electrica/legislatie') ||
          url.includes('/ro/gaze-naturale/legislatie'));
}

/**
 * Funcția principală de crawling
 */
async function crawlLegislation(
  startUrl: string,
  outputDir: string,
  maxDepth: number = 3
): Promise<void> {
  const visitedPages = new Set<string>();
  const downloadedDocs = new Set<string>();
  const pagesToVisit: PageLink[] = [{ url: startUrl, title: 'Pagina principală', depth: 0 }];
  const allDocuments: DocumentInfo[] = [];
  
  log(`\n🕷️  START CRAWLING`, 'magenta');
  log(`   URL: ${startUrl}`, 'cyan');
  log(`   Max depth: ${maxDepth}`, 'cyan');
  log(`   Output: ${outputDir}\n`, 'cyan');
  
  while (pagesToVisit.length > 0) {
    const current = pagesToVisit.shift()!;
    
    if (visitedPages.has(current.url)) continue;
    if (current.depth > maxDepth) continue;
    
    visitedPages.add(current.url);
    
    log(`[Depth ${current.depth}] 🔍 ${current.title.substring(0, 60)}`, 'blue');
    
    // Descarcă pagina
    const html = await fetchPage(current.url);
    if (!html) {
      log(`   ❌ Nu pot accesa pagina`, 'red');
      continue;
    }
    
    // Extrage documente din pagina curentă
    const docs = extractDownloadLinks(html, current.url);
    if (docs.length > 0) {
      log(`   📄 ${docs.length} documente găsite`, 'green');
      allDocuments.push(...docs);
    }
    
    // Extrage link-uri către sub-pagini
    if (current.depth < maxDepth) {
      const subPages = extractPageLinks(html, current.url, current.depth);
      const newPages = subPages.filter(p => !visitedPages.has(p.url));
      pagesToVisit.push(...newPages);
      
      if (newPages.length > 0) {
        log(`   🔗 ${newPages.length} sub-pagini noi`, 'yellow');
      }
    }
    
    // Delay pentru a nu suprasolicita serverul
    await new Promise(r => setTimeout(r, 500));
  }
  
  log(`\n📊 REZULTATE CRAWLING:`, 'magenta');
  log(`   Pagini scanate: ${visitedPages.size}`, 'cyan');
  log(`   Documente totale: ${allDocuments.length}`, 'cyan');
  
  // Elimină duplicatele
  const uniqueDocs = allDocuments.filter((doc, index, self) => 
    index === self.findIndex(d => d.url === doc.url)
  );
  
  log(`   Documente unice: ${uniqueDocs.length}`, 'green');
  
  // Descarcă documentele
  if (uniqueDocs.length === 0) {
    log(`\n⚠️  Nu s-au găsit documente de descărcat`, 'yellow');
    return;
  }
  
  // Confirmare
  log(`\n⬇️  Pregătire descărcare ${uniqueDocs.length} documente...`, 'blue');
  const confirm = await question(`\nVrei să descarci toate documentele? (da/nu): `);
  
  if (confirm.toLowerCase() !== 'da' && confirm.toLowerCase() !== 'd') {
    log(`❌ Descărcare anulată`, 'red');
    return;
  }
  
  // Organizează pe foldere după sursă
  log(`\n📂 Organizare documente pe foldere...`, 'blue');
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < uniqueDocs.length; i++) {
    const doc = uniqueDocs[i];
    
    // Creează subfolder bazat pe pagina sursă
    const folderName = doc.sourcePage
      .replace(/^https:\/\/arhiva\.anre\.ro\/ro\//, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50) || 'general';
    
    const docDir = path.join(outputDir, folderName);
    if (!fs.existsSync(docDir)) {
      fs.mkdirSync(docDir, { recursive: true });
    }
    
    const outputPath = path.join(docDir, doc.filename);
    
    // Skip dacă există
    if (fs.existsSync(outputPath)) {
      log(`  [${i + 1}/${uniqueDocs.length}] ⏭️  Există: ${doc.filename.substring(0, 50)}`, 'yellow');
      successCount++;
      continue;
    }
    
    process.stdout.write(`  [${i + 1}/${uniqueDocs.length}] Descarc ${doc.filename.substring(0, 40)}... `);
    
    try {
      execSync(`curl -sL -k --max-time 60 "${doc.url}" -o "${outputPath}"`, {
        timeout: 65000,
      });
      
      const size = fs.statSync(outputPath).size;
      if (size > 100) { // Minim 100 bytes pentru a fi valid
        const sizeMB = (size / (1024 * 1024)).toFixed(2);
        console.log(`✅ ${sizeMB} MB`);
        successCount++;
      } else {
        console.log(`❌ Fișier prea mic (${size} bytes)`);
        fs.unlinkSync(outputPath);
        failCount++;
      }
    } catch (error) {
      console.log(`❌ Eroare`);
      failCount++;
    }
    
    // Delay între descărcări
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Raport final
  log(`\n╔════════════════════════════════════════════════════════╗`, 'magenta');
  log(`║              📊 RAPORT FINAL                           ║`, 'magenta');
  log(`╠════════════════════════════════════════════════════════╣`, 'magenta');
  log(`║  ✅ Descărcate: ${successCount.toString().padStart(3)}                              ║`, 'green');
  log(`║  ❌ Eșuate:    ${failCount.toString().padStart(3)}                              ║`, failCount > 0 ? 'red' : 'green');
  log(`║  📁 Total foldere: ${fs.readdirSync(outputDir).filter(f => fs.statSync(path.join(outputDir, f)).isDirectory()).length.toString().padStart(2)}                          ║`, 'cyan');
  log(`╚════════════════════════════════════════════════════════╝`, 'magenta');
}

/**
 * Funcția principală
 */
async function main() {
  log('╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║     🌐 ANRE Full Legislation Scraper                   ║', 'cyan');
  log('║     Descarcă toate documentele de legislație          ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');
  
  try {
    // URL default
    const defaultUrl = 'https://arhiva.anre.ro/ro/energie-electrica/legislatie';
    
    // Întreabă folderul
    let outputDir = await question(`\n📁 Folder destinație (default: ./downloads/anre_legislatie): `);
    outputDir = outputDir || './downloads/anre_legislatie';
    outputDir = path.resolve(outputDir);
    
    // Crează folderul
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      log(`📂 Folder creat: ${outputDir}`, 'green');
    }
    
    // Întreabă adâncimea
    const depthStr = await question(`🔍 Adâncime maximă de crawling (1-5, default: 3): `);
    const maxDepth = parseInt(depthStr) || 3;
    
    // Întreabă URL-ul
    const url = await question(`🌐 URL start (default: ${defaultUrl}): `) || defaultUrl;
    
    // Pornește crawling
    await crawlLegislation(url, outputDir, maxDepth);
    
    log(`\n✅ Proces complet finalizat!`, 'green');
    log(`📁 Documentele sunt în: ${outputDir}`, 'cyan');
    
  } catch (error) {
    log(`\n❌ Eroare: ${error instanceof Error ? error.message : error}`, 'red');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Rulează
main();
