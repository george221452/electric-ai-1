// Scraper țintit pentru pagini specifice NTE
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const TARGET_URLS = [
  'https://arhiva.anre.ro/ro/energie-electrica/legislatie/norme-tehnice',
  'https://arhiva.anre.ro/ro/energie-electrica/legislatie/norme-tehnice/normative-tehnice-energetice-nte',
  'https://arhiva.anre.ro/ro/energie-electrica/legislatie/reglementari-tehnice',
  'https://arhiva.anre.ro/ro/energie-electrica/legislatie/proceduri',
];

const OUTPUT_DIR = './downloads/anre_all_docs';

interface Doc {
  url: string;
  title: string;
  filename: string;
}

function fetchPage(url: string): string {
  try {
    return execSync(`curl -sL -k --max-time 30 "${url}" 2>/dev/null || echo ""`, { encoding: 'utf-8' });
  } catch { return ''; }
}

function extractDocs(html: string): Doc[] {
  const docs: Doc[] = [];
  const seen = new Set<string>();
  
  // Găsește toate link-urile de download
  const pattern = /<a[^>]*href=["']([^"']*download\.php[^"']*)["'][^>]*title=["']([^"']+)["']/gi;
  let match;
  
  while ((match = pattern.exec(html)) !== null) {
    const url = match[1].startsWith('http') ? match[1] : `https://arhiva.anre.ro${match[1]}`;
    const title = match[2].trim();
    
    if (seen.has(url)) continue;
    seen.add(url);
    
    let filename = title.replace(/[^a-zA-Z0-9\-_.]/g, '_').substring(0, 100);
    if (!filename.match(/\.(pdf|doc|zip)$/i)) filename += '.pdf';
    
    docs.push({ url, title, filename });
  }
  
  return docs;
}

function downloadDoc(doc: Doc, index: number, total: number): boolean {
  const outputPath = path.join(OUTPUT_DIR, doc.filename);
  
  if (fs.existsSync(outputPath)) {
    console.log(`  [${index}/${total}] ⏭️  ${doc.filename.substring(0, 50)}`);
    return true;
  }
  
  process.stdout.write(`  [${index}/${total}] ${doc.filename.substring(0, 50)}... `);
  
  try {
    execSync(`curl -sL -k --max-time 60 "${doc.url}" -o "${outputPath}"`, { timeout: 65000 });
    const size = fs.statSync(outputPath).size;
    if (size > 100) {
      console.log(`✅ ${(size / 1024 / 1024).toFixed(2)} MB`);
      return true;
    } else {
      fs.unlinkSync(outputPath);
      console.log(`❌ Prea mic`);
      return false;
    }
  } catch {
    console.log(`❌ Eroare`);
    return false;
  }
}

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║     🎯 ANRE Targeted Scraper                           ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const allDocs: Doc[] = [];

// Scanează fiecare URL țintă
for (const url of TARGET_URLS) {
  console.log(`🔍 Scan: ${url.substring(40)}...`);
  const html = fetchPage(url);
  const docs = extractDocs(html);
  console.log(`   ✅ ${docs.length} documente\n`);
  allDocs.push(...docs);
}

// Elimină duplicate
const uniqueDocs = allDocs.filter((d, i, self) => i === self.findIndex(t => t.url === d.url));

console.log(`📊 Total documente unice: ${uniqueDocs.length}\n`);

if (uniqueDocs.length === 0) {
  console.log('⚠️  Nu s-au găsit documente');
  process.exit(0);
}

// Descarcă
console.log('⬇️  Descărcare...\n');
let success = 0, failed = 0;

for (let i = 0; i < uniqueDocs.length; i++) {
  if (downloadDoc(uniqueDocs[i], i + 1, uniqueDocs.length)) {
    success++;
  } else {
    failed++;
  }
  
  // Delay
  if (i < uniqueDocs.length - 1) {
    execSync('sleep 0.5');
  }
}

console.log(`\n╔════════════════════════════════════════════════════════╗`);
console.log(`║  ✅ Succes: ${success.toString().padStart(3)}  ❌ Eșuate: ${failed.toString().padStart(3)}                    ║`);
console.log(`╚════════════════════════════════════════════════════════╝`);
console.log(`📁 Folder: ${OUTPUT_DIR}`);
