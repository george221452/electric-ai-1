#!/usr/bin/env tsx
/**
 * ANRE Tree Scraper - Navigare recursivă completă
 * Parcurge TOATE sub-paginile și descarcă TOATE documentele
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const CONFIG = {
  outputDir: process.argv[2] || './downloads/anre_legislatie_complete',
  startUrl: 'https://arhiva.anre.ro/ro/energie-electrica/legislatie',
  maxPages: 200, // Limită de siguranță
  delay: 500, // ms între requesturi
};

interface DocumentInfo {
  url: string;
  filename: string;
  title: string;
  categoryPath: string[];
}

interface PageNode {
  url: string;
  title: string;
  depth: number;
  parent?: string;
}

const colors = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m', 
  red: '\x1b[31m', blue: '\x1b[34m', cyan: '\x1b[36m', magenta: '\x1b[35m'
};

function log(msg: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    return execSync(`curl -sL -k --max-time 30 "${url}" 2>/dev/null`, {
      encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024,
    });
  } catch { return null; }
}

/**
 * Extrage toate link-urile de navigare dintr-o pagină
 */
function extractNavigationLinks(html: string, baseUrl: string, depth: number): PageNode[] {
  const links: PageNode[] = [];
  const seen = new Set<string>();
  
  // Găsește meniul de navigare (structura arborescentă)
  // Pattern pentru link-uri din meniu
  const menuPattern = /<a[^>]*href=["'](\/ro\/energie-electrica\/legislatie[^"']*)["'][^>]*>([^<]+)<\/a>/gi;
  
  let match;
  while ((match = menuPattern.exec(html)) !== null) {
    const urlPath = match[1];
    const title = match[2].trim();
    const fullUrl = urlPath.startsWith('http') ? urlPath : `https://arhiva.anre.ro${urlPath}`;
    
    if (seen.has(fullUrl) || fullUrl.includes('download.php')) continue;
    seen.add(fullUrl);
    
    links.push({ url: fullUrl, title, depth });
  }
  
  return links;
}

/**
 * Extrage documente din pagina curentă
 */
function extractDocuments(html: string, categoryPath: string[]): DocumentInfo[] {
  const docs: DocumentInfo[] = [];
  const seen = new Set<string>();
  
  // Pattern 1: Link-uri de download cu title
  const pattern1 = /<a[^>]*href=["']([^"']*download\.php[^"']*)["'][^>]*title=["']([^"']+)["'][^>]*>/gi;
  let match;
  
  while ((match = pattern1.exec(html)) !== null) {
    const url = match[1].startsWith('http') ? match[1] : `https://arhiva.anre.ro${match[1]}`;
    const title = match[2].trim();
    
    if (seen.has(url)) continue;
    seen.add(url);
    
    // Generează filename curat
    let filename = title
      .replace(/[^a-zA-Z0-9ăîșțâĂÎȘȚÂ\-_.\s]/gi, '')
      .replace(/\s+/g, '_')
      .substring(0, 100);
    
    if (!filename.match(/\.(pdf|doc|docx|zip)$/i)) {
      filename += '.pdf';
    }
    
    docs.push({ url, filename, title, categoryPath: [...categoryPath] });
  }
  
  // Pattern 2: Link-uri din liste (fără title explicit)
  const listPattern = /<li[^>]*>.*?<a[^>]*href=["']([^"']*download\.php[^"']*)["'][^>]*>([^<]+)<\/a>.*?<\/li>/gi;
  while ((match = listPattern.exec(html)) !== null) {
    const url = match[1].startsWith('http') ? match[1] : `https://arhiva.anre.ro${match[1]}`;
    const title = match[2].trim();
    
    if (seen.has(url) || title.length < 5) continue;
    seen.add(url);
    
    let filename = title.replace(/[^a-zA-Z0-9ăîșțâ\-_.\s]/gi, '').replace(/\s+/g, '_').substring(0, 100);
    if (!filename.match(/\.(pdf|doc|zip)$/i)) filename += '.pdf';
    
    docs.push({ url, filename, title, categoryPath: [...categoryPath] });
  }
  
  return docs;
}

/**
 * Funcție recursivă pentru parcurgerea arborelui
 */
async function crawlTree(
  node: PageNode, 
  visited: Set<string>, 
  allDocs: DocumentInfo[],
  categoryStack: string[]
): Promise<void> {
  if (visited.size >= CONFIG.maxPages) return;
  if (visited.has(node.url)) return;
  
  visited.add(node.url);
  
  // Adaugă titlul curent în stiva de categorii
  categoryStack.push(node.title);
  
  log(`[${visited.size.toString().padStart(3)}] [Depth ${node.depth}] ${node.title.substring(0, 50)}`, 'blue');
  
  // Descarcă pagina
  const html = await fetchPage(node.url);
  if (!html) {
    categoryStack.pop();
    return;
  }
  
  // Extrage documente din pagina curentă
  const docs = extractDocuments(html, categoryStack);
  if (docs.length > 0) {
    log(`    📄 ${docs.length} documente găsite`, 'green');
    allDocs.push(...docs);
  }
  
  // Extrage sub-pagini și navighează recursiv
  const subPages = extractNavigationLinks(html, node.url, node.depth + 1);
  const newPages = subPages.filter(p => !visited.has(p.url));
  
  if (newPages.length > 0) {
    log(`    🔗 ${newPages.length} sub-pagini`, 'yellow');
    
    for (const subPage of newPages) {
      await new Promise(r => setTimeout(r, CONFIG.delay));
      await crawlTree(subPage, visited, allDocs, categoryStack);
    }
  }
  
  // Elimină titlul curent din stivă (backtracking)
  categoryStack.pop();
}

async function main() {
  log('╔══════════════════════════════════════════════════════════╗', 'cyan');
  log('║     🌲 ANRE Tree Scraper - Navigare Completă             ║', 'cyan');
  log('║     Parcurge toate ramurile și descarcă tot              ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════╝', 'cyan');
  
  // Crează folderul
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  
  log(`\n📁 Folder: ${CONFIG.outputDir}`, 'cyan');
  log(`🌐 Start: ${CONFIG.startUrl}`, 'cyan');
  log(`📊 Max pages: ${CONFIG.maxPages}\n`, 'cyan');
  
  // Start crawling
  const visited = new Set<string>();
  const allDocs: DocumentInfo[] = [];
  
  const rootNode: PageNode = {
    url: CONFIG.startUrl,
    title: 'Legislație',
    depth: 0
  };
  
  await crawlTree(rootNode, visited, allDocs, []);
  
  // Raport scanare
  log(`\n╔══════════════════════════════════════════════════════════╗`, 'magenta');
  log(`║              📊 REZULTATE SCANARE                        ║`, 'magenta');
  log(`╠══════════════════════════════════════════════════════════╣`, 'magenta');
  log(`║  Pagini parcurse: ${visited.size.toString().padStart(3)}                                 ║`, 'cyan');
  log(`║  Documente totale: ${allDocs.length.toString().padStart(3)}                                ║`, 'cyan');
  log(`╚══════════════════════════════════════════════════════════╝`, 'magenta');
  
  if (allDocs.length === 0) {
    log('\n⚠️  Nu s-au găsit documente', 'yellow');
    return;
  }
  
  // Grupează după categorie
  const byCategory: Record<string, DocumentInfo[]> = {};
  for (const doc of allDocs) {
    const cat = doc.categoryPath.join(' > ') || 'General';
    byCategory[cat] = byCategory[cat] || [];
    byCategory[cat].push(doc);
  }
  
  log(`\n📂 Categorii găsite:`, 'blue');
  Object.entries(byCategory).slice(0, 10).forEach(([cat, docs]) => {
    log(`  • ${cat.substring(0, 50)}: ${docs.length} doc`, 'cyan');
  });
  
  // Descărcare
  log(`\n⬇️  ÎNCEP DESCĂRCAREA...`, 'magenta');
  
  let success = 0, failed = 0, skipped = 0;
  
  for (let i = 0; i < allDocs.length; i++) {
    const doc = allDocs[i];
    
    // Creează path-ul de categorie
    const safeCatPath = doc.categoryPath.map(p => 
      p.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
    ).join('/');
    
    const docDir = path.join(CONFIG.outputDir, safeCatPath || 'general');
    if (!fs.existsSync(docDir)) {
      fs.mkdirSync(docDir, { recursive: true });
    }
    
    const outputPath = path.join(docDir, doc.filename);
    
    // Skip dacă există
    if (fs.existsSync(outputPath)) {
      process.stdout.write(`\r[${i + 1}/${allDocs.length}] ⏭️  SKIP: ${doc.filename.substring(0, 40).padEnd(40)}`);
      skipped++;
      continue;
    }
    
    process.stdout.write(`\r[${i + 1}/${allDocs.length}] ⬇️  ${doc.filename.substring(0, 40).padEnd(40)}`);
    
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
    
    await new Promise(r => setTimeout(r, 600));
  }
  
  console.log('\n');
  
  // Raport final
  log(`╔══════════════════════════════════════════════════════════╗`, 'magenta');
  log(`║              ✅ DESCĂRCARE COMPLETĂ                      ║`, 'magenta');
  log(`╠══════════════════════════════════════════════════════════╣`, 'magenta');
  log(`║  ✅ Noi:      ${success.toString().padStart(3)}                                          ║`, 'green');
  log(`║  ⏭️  Exista:  ${skipped.toString().padStart(3)}                                          ║`, 'yellow');
  log(`║  ❌ Eșuate:   ${failed.toString().padStart(3)}                                          ║`, failed > 0 ? 'red' : 'green');
  log(`║  📁 Total:    ${(success + skipped).toString().padStart(3)}                                          ║`, 'cyan');
  log(`╚══════════════════════════════════════════════════════════╝`, 'magenta');
  
  log(`\n📂 Locație: ${CONFIG.outputDir}`, 'cyan');
  
  // Listează folderele create
  const countFiles = (dir: string): number => {
    let count = 0;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        count += countFiles(fullPath);
      } else if (item.endsWith('.pdf') || item.endsWith('.doc')) {
        count++;
      }
    }
    return count;
  };
  
  const totalFiles = countFiles(CONFIG.outputDir);
  log(`📊 Total fișiere în folder: ${totalFiles}`, 'cyan');
}

main().catch(console.error);
