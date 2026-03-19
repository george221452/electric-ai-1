#!/usr/bin/env tsx
/**
 * Script automat: Indexează documentele NTE și rulează teste
 * 
 * Utilizare: npx tsx auto-index-and-test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddingService } from './src/infrastructure/adapters/embedding/embedding-service';
import pdfParse from 'pdf-parse';

const prisma = new PrismaClient();
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL || 'http://localhost:6333' });
const embeddingService = new OpenAIEmbeddingService();

const CONFIG = {
  sourceDir: './downloads/anre_nte/extracted',
  uploadDir: './uploads/550e8400-e29b-41d4-a716-446655440000',
  workspaceId: '550e8400-e29b-41d4-a716-446655440000',
  userId: '', // Vom găsi automat
  ragConfigId: '', // Vom găsi automat
  chunkSize: 1000,
  chunkOverlap: 200,
};

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * PAS 1: Găsește User și RAG Config
 */
async function initializeConfig() {
  log('\n🔧 Inițializare configurație...', 'blue');
  
  const user = await prisma.user.findFirst();
  if (!user) {
    throw new Error('Nu s-a găsit niciun utilizator în sistem');
  }
  CONFIG.userId = user.id;
  log(`✅ Utilizator găsit: ${user.email}`, 'green');
  
  // Folosește RAG Config ID default
  CONFIG.ragConfigId = '550e8400-e29b-41d4-a716-446655440001';
  log(`⚠️  Folosesc RAG Config ID default`, 'yellow');
}

/**
 * PAS 2: Găsește toate PDF-urile din sursă
 */
function findSourceDocuments(): string[] {
  log('\n📂 Căutare documente sursă...', 'blue');
  
  const documents: string[] = [];
  
  function scanDir(dir: string) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (item.toLowerCase().endsWith('.pdf')) {
        documents.push(fullPath);
      }
    }
  }
  
  scanDir(CONFIG.sourceDir);
  log(`📄 Găsite ${documents.length} documente PDF`, 'cyan');
  
  // Afișează documentele găsite
  documents.forEach((doc, i) => {
    const relativePath = path.relative(CONFIG.sourceDir, doc);
    const size = (fs.statSync(doc).size / (1024 * 1024)).toFixed(1);
    log(`  ${i + 1}. ${relativePath} (${size} MB)`, 'yellow');
  });
  
  return documents;
}

/**
 * PAS 3: Copiază documentele în folderul de upload
 */
function copyToUpload(documents: string[]): string[] {
  log('\n📋 Copiere documente în sistem...', 'blue');
  
  const uploadedPaths: string[] = [];
  
  for (const doc of documents) {
    const filename = path.basename(doc);
    const destPath = path.join(CONFIG.uploadDir, filename);
    
    // Verifică dacă există deja
    if (fs.existsSync(destPath)) {
      log(`  ⏭️  Există deja: ${filename}`, 'yellow');
      uploadedPaths.push(destPath);
      continue;
    }
    
    fs.copyFileSync(doc, destPath);
    log(`  ✅ Copiat: ${filename}`, 'green');
    uploadedPaths.push(destPath);
  }
  
  return uploadedPaths;
}

/**
 * PAS 4: Înregistrează documentele în baza de date
 */
async function registerInDatabase(filePaths: string[]) {
  log('\n🗄️  Înregistrare în baza de date...', 'blue');
  
  const documentIds: string[] = [];
  
  for (const filePath of filePaths) {
    const filename = path.basename(filePath);
    const size = fs.statSync(filePath).size;
    
    // Verifică dacă există deja
    const existing = await prisma.document.findFirst({
      where: { name: filename, workspaceId: CONFIG.workspaceId }
    });
    
    if (existing) {
      log(`  ⏭️  Există în DB: ${filename}`, 'yellow');
      documentIds.push(existing.id);
      continue;
    }
    
    // Creează intrare nouă
    const doc = await prisma.document.create({
      data: {
        name: filename,
        fileType: 'pdf',
        fileSize: size,
        workspaceId: CONFIG.workspaceId,
        userId: CONFIG.userId,
        ragConfigId: CONFIG.ragConfigId,
        status: 'PROCESSING',
        storageKey: filePath,
        metadata: {
          source: 'auto-index-script',
          originalPath: filePath,
        },
      }
    });
    
    log(`  ✅ Înregistrat: ${filename} (ID: ${doc.id.substring(0, 8)}...)`, 'green');
    documentIds.push(doc.id);
  }
  
  return documentIds;
}

/**
 * PAS 5: Extrage text din PDF
 */
async function extractPdfText(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * PAS 6: Împarte text în paragrafe/chunks
 */
function splitIntoChunks(text: string): Array<{ content: string; pageNumber: number }> {
  const chunks: Array<{ content: string; pageNumber: number }> = [];
  
  // Împarte în paragrafe (aproximativ 1000 caractere fiecare)
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';
  let pageNumber = 1;
  let charCount = 0;
  const charsPerPage = 3000; // Estimare aproximativă
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > CONFIG.chunkSize) {
      chunks.push({
        content: currentChunk.trim(),
        pageNumber: Math.floor(charCount / charsPerPage) + 1
      });
      
      // Păstrează overlap
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(CONFIG.chunkOverlap / 5));
      currentChunk = overlapWords.join(' ') + ' ' + sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
    
    charCount += sentence.length;
  }
  
  // Adaugă ultimul chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      pageNumber: Math.floor(charCount / charsPerPage) + 1
    });
  }
  
  return chunks;
}

/**
 * PAS 7: Procesează documentele și generează embeddings
 */
async function processAndIndexDocuments(documentIds: string[]) {
  log('\n⚙️  Procesare și indexare documente...', 'blue');
  
  for (const docId of documentIds) {
    const doc = await prisma.document.findUnique({ where: { id: docId } });
    if (!doc) continue;
    
    log(`\n  📄 Procesez: ${doc.name}`, 'cyan');
    
    try {
      // Extrage text
      log(`     Extrag text...`, 'yellow');
      const text = await extractPdfText(doc.storageKey);
      log(`     Text extras: ${text.length} caractere`, 'green');
      
      // Împarte în chunks
      log(`     Împart în chunks...`, 'yellow');
      const chunks = splitIntoChunks(text);
      log(`     Chunks create: ${chunks.length}`, 'green');
      
      // Salvează paragrafele în PostgreSQL
      log(`     Salvez paragrafe în DB...`, 'yellow');
      const paragraphRecords = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const wordCount = chunk.content.split(/\s+/).length;
        const charCount = chunk.content.length;
        
        const paragraph = await prisma.paragraph.create({
          data: {
            documentId: docId,
            content: chunk.content,
            pageNumber: chunk.pageNumber,
            paragraphNumber: i + 1,
            wordCount: wordCount,
            charCount: charCount,
            keywords: [],
            metadata: {
              totalChunks: chunks.length,
              chunkIndex: i,
            },
          }
        });
        paragraphRecords.push({
          id: paragraph.id,
          content: chunk.content,
          pageNumber: chunk.pageNumber,
          paragraphNumber: i + 1,
        });
      }
      
      // Generează embeddings în batch-uri
      log(`     Generez embeddings (${paragraphRecords.length} chunks)...`, 'yellow');
      const batchSize = 20;
      
      for (let i = 0; i < paragraphRecords.length; i += batchSize) {
        const batch = paragraphRecords.slice(i, i + batchSize);
        const contents = batch.map(p => p.content);
        
        log(`       Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(paragraphRecords.length / batchSize)}...`, 'yellow');
        
        // Generează embeddings
        const embeddings = await embeddingService.embedBatch(contents);
        
        // Indexează în Qdrant
        await qdrant.upsert('legal_paragraphs', {
          points: batch.map((paragraph, idx) => ({
            id: paragraph.id,
            vector: embeddings[idx],
            payload: {
              documentId: docId,
              workspaceId: CONFIG.workspaceId,
              content: paragraph.content,
              pageNumber: paragraph.pageNumber,
              paragraphNumber: paragraph.paragraphNumber,
              documentName: doc.name,
            },
          })),
        });
      }
      
      // Actualizează status document
      await prisma.document.update({
        where: { id: docId },
        data: {
          status: 'COMPLETED',
          pageCount: Math.max(...chunks.map(c => c.pageNumber)),
        }
      });
      
      log(`     ✅ Indexat complet: ${paragraphRecords.length} paragrafe`, 'green');
      
    } catch (error) {
      log(`     ❌ Eroare: ${error instanceof Error ? error.message : 'Unknown'}`, 'red');
      await prisma.document.update({
        where: { id: docId },
        data: {
          status: 'FAILED',
          processingError: error instanceof Error ? error.message : 'Unknown error',
        }
      });
    }
  }
}

/**
 * PAS 8: Verifică indexarea
 */
async function verifyIndexing() {
  log('\n🔍 Verificare indexare...', 'blue');
  
  const collectionInfo = await qdrant.getCollection('legal_paragraphs');
  log(`📊 Puncte în Qdrant: ${collectionInfo.points_count}`, 'cyan');
  
  const docsInDb = await prisma.document.count({
    where: { workspaceId: CONFIG.workspaceId }
  });
  log(`📊 Documente în DB: ${docsInDb}`, 'cyan');
  
  const paragraphsInDb = await prisma.paragraph.count({
    where: {
      document: { workspaceId: CONFIG.workspaceId }
    }
  });
  log(`📊 Paragrafe în DB: ${paragraphsInDb}`, 'cyan');
}

/**
 * PAS 9: Rulează testul
 */
async function runTest() {
  log('\n🧪 Rulare test pe normative...', 'blue');
  
  try {
    // Rulează testul existent
    execSync('npx tsx test_enhanced_system.ts', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch (error) {
    log('Testul a rulat cu erori sau rezultate mixte', 'yellow');
  }
}

/**
 * Funcția principală
 */
async function main() {
  log('╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║     🤖 Auto Index & Test - NTE Documents              ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');
  
  try {
    // PAS 1: Inițializare
    await initializeConfig();
    
    // PAS 2-3: Găsește și copiază documentele
    const sourceDocs = findSourceDocuments();
    if (sourceDocs.length === 0) {
      log('❌ Nu s-au găsit documente de procesat', 'red');
      return;
    }
    
    const uploadedPaths = copyToUpload(sourceDocs);
    
    // PAS 4: Înregistrează în DB
    const documentIds = await registerInDatabase(uploadedPaths);
    
    // PAS 5-7: Procesează și indexează
    await processAndIndexDocuments(documentIds);
    
    // PAS 8: Verifică
    await verifyIndexing();
    
    // PAS 9: Rulează testul
    await runTest();
    
    log('\n✅ Proces complet finalizat!', 'green');
    
  } catch (error) {
    log(`\n❌ Eroare fatală: ${error instanceof Error ? error.message : error}`, 'red');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Rulează
main();
