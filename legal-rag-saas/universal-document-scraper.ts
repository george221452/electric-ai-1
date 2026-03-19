#!/usr/bin/env tsx
/**
 * Universal Document Scraper
 * Descarcă toate documentele (PDF, DOC, etc.) de pe o pagină web
 * 
 * Utilizare: npx tsx universal-document-scraper.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

interface DocumentLink {
  url: string;
  filename: string;
  extension: string;
}

/**
 * Extrage toate link-urile de documente din HTML
 */
function extractDocumentLinks(html: string, baseUrl: string): DocumentLink[] {
  const links: DocumentLink[] = [];
  const seen = new Set<string>();
  
  // Pattern-uri pentru documente
  const docExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar'];
  
  // Pattern 1: href="..."
  const hrefPattern = /href=["']([^"']+)["']/gi;
  let match;
  
  while ((match = hrefPattern.exec(html)) !== null) {
    const url = match[1];
    
    // Verifică dacă e document
    const isDocument = docExtensions.some(ext => 
      url.toLowerCase().includes(ext)
    );
    
    if (isDocument && !seen.has(url)) {
      seen.add(url);
      
      // Construiește URL complet
      let fullUrl = url;
      if (url.startsWith('/')) {
        const base = new URL(baseUrl);
        fullUrl = `${base.protocol}//${base.host}${url}`;
      } else if (!url.startsWith('http')) {
        fullUrl = new URL(url, baseUrl).href;
      }
      
      // Extrage filename
      const urlObj = new URL(fullUrl);
      let filename = path.basename(urlObj.pathname);
      
      // Dacă nu are extensie sau e generic, generează un nume
      if (!filename || filename === 'download' || filename === 'file') {
        const ext = docExtensions.find(e => fullUrl.toLowerCase().includes(e)) || '.pdf';
        filename = `document_${links.length + 1}${ext}`;
      }
      
      // Curăță filename
      filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      
      const extension = path.extname(filename).toLowerCase();
      
      links.push({ url: fullUrl, filename, extension });
    }
  }
  
  return links;
}

/**
 * Extrage link-uri din text (pentru URL-uri în text)
 */
function extractUrlsFromText(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s"<>]+/g;
  return text.match(urlPattern) || [];
}

/**
 * Descarcă un document
 */
async function downloadDocument(
  url: string, 
  outputPath: string,
  index: number,
  total: number
): Promise<boolean> {
  try {
    process.stdout.write(`  [${index}/${total}] Descarc: ${path.basename(outputPath)}... `);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.log(`❌ Eroare HTTP ${response.status}`);
      return false;
    }
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    
    const size = (buffer.byteLength / 1024).toFixed(1);
    console.log(`✅ ${size} KB`);
    
    return true;
  } catch (error) {
    console.log(`❌ ${error instanceof Error ? error.message : 'Eroare necunoscută'}`);
    return false;
  }
}

/**
 * Funcția principală
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     🌐 Universal Document Scraper v1.0                 ║');
  console.log('║     Descarcă toate documentele de pe o pagină web      ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log();
  
  try {
    // Pas 1: Întreabă folderul de destinație
    let outputDir = await question('📁 Folder unde să salvez documentele (ex: ./downloads/nte): ');
    
    // Normalizează calea
    outputDir = path.resolve(outputDir);
    
    // Crează folderul dacă nu există
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📂 Folder creat: ${outputDir}`);
    } else {
      console.log(`📂 Folosesc folder existent: ${outputDir}`);
    }
    
    // Pas 2: Întreabă URL-ul
    const url = await question('🌐 URL pagină web de scanat: ');
    
    if (!url.startsWith('http')) {
      console.error('❌ URL invalid. Trebuie să înceapă cu http:// sau https://');
      process.exit(1);
    }
    
    console.log('\n🔍 Scanare pagină...');
    
    // Pas 3: Descarcă pagina
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log(`📄 Pagină descărcată: ${html.length} caractere`);
    
    // Pas 4: Extrage link-uri
    const links = extractDocumentLinks(html, url);
    
    // Elimină duplicatele
    const uniqueLinks = links.filter((link, index, self) => 
      index === self.findIndex(l => l.url === link.url)
    );
    
    console.log(`\n📊 Găsite ${uniqueLinks.length} documente:`);
    
    // Grupează după extensie
    const byExtension: Record<string, number> = {};
    for (const link of uniqueLinks) {
      byExtension[link.extension] = (byExtension[link.extension] || 0) + 1;
    }
    
    for (const [ext, count] of Object.entries(byExtension)) {
      console.log(`   ${ext}: ${count}`);
    }
    
    if (uniqueLinks.length === 0) {
      console.log('\n⚠️ Nu s-au găsit documente pe această pagină.');
      console.log('💡 Posibile cauze:');
      console.log('   - Pagina necesită JavaScript pentru încărcare');
      console.log('   - Documentele sunt pe altă pagină/subdomeniu');
      console.log('   - Link-urile sunt generate dinamic');
      process.exit(0);
    }
    
    // Afișează primele 5 link-uri
    console.log('\n📋 Primele documente găsite:');
    uniqueLinks.slice(0, 5).forEach((link, i) => {
      console.log(`   ${i + 1}. ${link.filename}`);
      console.log(`      URL: ${link.url.substring(0, 70)}...`);
    });
    
    if (uniqueLinks.length > 5) {
      console.log(`   ... și încă ${uniqueLinks.length - 5}`);
    }
    
    // Pas 5: Confirmare
    const confirm = await question(`\n⬇️  Vrei să descarci toate cele ${uniqueLinks.length} documente? (da/nu): `);
    
    if (confirm.toLowerCase() !== 'da' && confirm.toLowerCase() !== 'd') {
      console.log('❌ Descărcare anulată.');
      process.exit(0);
    }
    
    // Pas 6: Descarcă documentele
    console.log('\n⬇️  Descărcare documente...\n');
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < uniqueLinks.length; i++) {
      const link = uniqueLinks[i];
      const outputPath = path.join(outputDir, link.filename);
      
      // Verifică dacă există deja
      if (fs.existsSync(outputPath)) {
        console.log(`  [${i + 1}/${uniqueLinks.length}] ⏭️  Există deja: ${link.filename}`);
        successCount++;
        continue;
      }
      
      const success = await downloadDocument(link.url, outputPath, i + 1, uniqueLinks.length);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Delay mic între descărcări
      if (i < uniqueLinks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Raport final
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║              📊 RAPORT FINAL                           ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║  ✅ Descărcate cu succes: ${successCount.toString().padStart(3)}                    ║`);
    console.log(`║  ❌ Eșuate:               ${failCount.toString().padStart(3)}                    ║`);
    console.log(`║  📁 Folder: ${outputDir.substring(0, 40).padEnd(40)}  ║`);
    console.log('╚════════════════════════════════════════════════════════╝');
    
    // Listează fișierele descărcate
    const files = fs.readdirSync(outputDir).filter(f => 
      ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip'].some(ext => 
        f.toLowerCase().endsWith(ext)
      )
    );
    
    console.log(`\n📂 Fișiere în folder (${files.length}):`);
    files.forEach((f, i) => {
      const stats = fs.statSync(path.join(outputDir, f));
      const size = (stats.size / 1024).toFixed(1);
      console.log(`   ${i + 1}. ${f} (${size} KB)`);
    });
    
  } catch (error) {
    console.error('\n❌ Eroare:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Rulează
main();
