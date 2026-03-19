#!/usr/bin/env tsx
/**
 * Manual Document Indexer with Progress Bar
 * Indexes ALL documents from downloads folder with real-time progress tracking
 * 
 * Usage:
 *   npm run index:start        - Start indexing all documents
 *   npm run index:status       - Check current indexing status
 *   npm run index:clear        - Clear all indexed documents (for reindexing)
 */

import { PrismaClient } from '@prisma/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddings } from '@langchain/openai';
import * as fs from 'fs';
import * as path from 'path';
import pdf from 'pdf-parse';
import dotenv from 'dotenv';

// Load environment variables
const envPath = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: envPath });

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  // Source directory with downloaded documents
  SOURCE_DIR: process.env.SOURCE_DIR ? path.resolve(process.cwd(), process.env.SOURCE_DIR) : path.resolve(process.cwd(), './downloads/essential_for_quiz'),
  
  // Workspace ID (default development workspace)
  WORKSPACE_ID: process.env.DEFAULT_WORKSPACE_ID || '550e8400-e29b-41d4-a716-446655440000',
  
  // Chunking settings (same as web upload)
  CHUNK_SIZE: 1000,
  CHUNK_OVERLAP: 200,
  MAX_CHUNK_SIZE: 2000,
  
  // Batch settings
  BATCH_SIZE: 50,           // Documents per batch
  EMBEDDING_BATCH_SIZE: 10, // Chunks per embedding batch
  QDRANT_BATCH_SIZE: 100,   // Points per Qdrant upsert
  
  // Rate limiting
  DELAY_BETWEEN_DOCS: 100,     // ms between documents
  DELAY_BETWEEN_BATCHES: 500,  // ms between batches
};

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS BAR CLASS
// ─────────────────────────────────────────────────────────────────────────────

class ProgressBar {
  private startTime: number;
  private current: number;
  private total: number;
  private width: number = 50;
  private lastUpdate: number = 0;
  private updateInterval: number = 100; // ms

  constructor(total: number) {
    this.total = total;
    this.current = 0;
    this.startTime = Date.now();
  }

  update(current: number, message?: string): void {
    this.current = current;
    const now = Date.now();
    
    // Throttle updates
    if (now - this.lastUpdate < this.updateInterval && current < this.total) {
      return;
    }
    this.lastUpdate = now;

    const percent = this.current / this.total;
    const filled = Math.floor(this.width * percent);
    const empty = this.width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    const elapsed = (now - this.startTime) / 1000;
    const rate = this.current / elapsed;
    const remaining = this.total - this.current;
    const eta = remaining / rate;
    
    const percentStr = (percent * 100).toFixed(1);
    const etaStr = this.formatTime(eta);
    const elapsedStr = this.formatTime(elapsed);
    const rateStr = rate.toFixed(1);
    
    // Clear line and move cursor to start
    process.stdout.write('\r\x1b[K');
    
    const line = `[${bar}] ${percentStr}% | ${this.current}/${this.total} | ⏱️  ${elapsedStr} | ⏳ ETA: ${etaStr} | ⚡ ${rateStr} docs/s`;
    process.stdout.write(line);
    
    if (message) {
      process.stdout.write(`\n📄 ${message}`);
      process.stdout.write(`\r\x1b[1A`); // Move up
    }
    
    if (this.current >= this.total) {
      process.stdout.write('\n');
    }
  }

  private formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '--:--:--';
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  finish(): void {
    this.update(this.total);
    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(`\n✅ Completed in ${totalTime}s`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INDEXING SERVICE
// ─────────────────────────────────────────────────────────────────────────────

class ManualIndexer {
  private prisma: PrismaClient;
  private qdrant: QdrantClient;
  private embeddings: OpenAIEmbeddings;
  private stats = {
    totalFiles: 0,
    processed: 0,
    skipped: 0,
    failed: 0,
    paragraphsCreated: 0,
    vectorsUpserted: 0,
  };

  constructor() {
    this.prisma = new PrismaClient();
    this.qdrant = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MAIN ENTRY POINT
  // ───────────────────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('📚 MANUAL DOCUMENT INDEXER');
    console.log('='.repeat(80));
    console.log(`\n📁 Source: ${CONFIG.SOURCE_DIR}`);
    console.log(`🔑 Workspace: ${CONFIG.WORKSPACE_ID}`);
    
    // Get all PDF files
    const files = this.getAllPDFFiles(CONFIG.SOURCE_DIR);
    this.stats.totalFiles = files.length;
    
    console.log(`📊 Total documents to index: ${files.length}`);
    console.log(`⚙️  Chunk size: ${CONFIG.CHUNK_SIZE} chars, Overlap: ${CONFIG.CHUNK_OVERLAP}`);
    console.log(`🚀 Batch size: ${CONFIG.BATCH_SIZE} docs\n`);
    
    if (files.length === 0) {
      console.log('❌ No PDF files found in source directory!');
      return;
    }

    // Confirm before starting
    console.log('⚠️  This will process all documents and create embeddings.');
    console.log('   Press Ctrl+C within 5 seconds to cancel...\n');
    await this.sleep(5000);

    const progressBar = new ProgressBar(files.length);
    const startTime = Date.now();

    // Process in batches
    for (let i = 0; i < files.length; i += CONFIG.BATCH_SIZE) {
      const batch = files.slice(i, i + CONFIG.BATCH_SIZE);
      
      for (const filePath of batch) {
        const filename = path.basename(filePath);
        progressBar.update(this.stats.processed + this.stats.skipped + this.stats.failed, filename);
        
        try {
          await this.processDocument(filePath);
          this.stats.processed++;
        } catch (error) {
          this.stats.failed++;
          console.error(`\n❌ Failed: ${filename} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Rate limiting
        await this.sleep(CONFIG.DELAY_BETWEEN_DOCS);
      }
      
      // Pause between batches
      if (i + CONFIG.BATCH_SIZE < files.length) {
        await this.sleep(CONFIG.DELAY_BETWEEN_BATCHES);
      }
    }

    progressBar.finish();
    this.printFinalStats(startTime);
    await this.prisma.$disconnect();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DOCUMENT PROCESSING
  // ───────────────────────────────────────────────────────────────────────────

  private async processDocument(filePath: string): Promise<void> {
    const filename = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;
    const storageKey = `manual/${filename}`;

    // Check if already indexed
    const existing = await this.prisma.document.findFirst({
      where: { 
        workspaceId: CONFIG.WORKSPACE_ID,
        storageKey: storageKey 
      }
    });

    if (existing) {
      this.stats.skipped++;
      throw new Error('Already indexed (skipped)');
    }

    // Extract text from PDF
    const buffer = fs.readFileSync(filePath);
    const pdfData = await pdf(buffer);
    const text = pdfData.text;

    if (!text || text.trim().length < 50) {
      throw new Error('Insufficient text content');
    }

    // Detect document category
    const category = this.detectCategory(filename, text);

    // Create document record
    const document = await this.prisma.document.create({
      data: {
        workspaceId: CONFIG.WORKSPACE_ID,
        userId: 'demo-user', // Use existing demo user
        name: filename,
        fileType: 'application/pdf',
        fileSize: fileSize,
        storageKey: storageKey,
        ragConfigId: 'generic-document',
        status: 'PROCESSING',
        metadata: {
          pages: pdfData.numpages,
          info: pdfData.info,
          indexedAt: new Date().toISOString(),
          indexedBy: 'manual-indexer',
        },
      },
    });

    try {
      // Split into chunks
      const chunks = this.splitIntoChunks(text);
      
      // Process chunks in batches
      const paragraphs: any[] = [];
      const qdrantPoints: any[] = [];
      
      for (let i = 0; i < chunks.length; i += CONFIG.EMBEDDING_BATCH_SIZE) {
        const batchChunks = chunks.slice(i, i + CONFIG.EMBEDDING_BATCH_SIZE);
        
        // Generate embeddings
        const vectors = await this.embeddings.embedDocuments(batchChunks);
        
        for (let j = 0; j < batchChunks.length; j++) {
          const chunkIndex = i + j;
          const chunkText = batchChunks[j];
          const vector = vectors[j];
          
          // Create paragraph record
          const paragraph = await this.prisma.paragraph.create({
            data: {
              documentId: document.id,
              content: chunkText,
              pageNumber: 1, // Default since we don't have page info from pdf-parse
              paragraphNumber: chunkIndex,
              wordCount: chunkText.split(/\s+/).length,
              charCount: chunkText.length,
              metadata: {
                chunkIndex: chunkIndex,
              },
            },
          });
          
          paragraphs.push(paragraph);
          
          // Prepare Qdrant point
          qdrantPoints.push({
            id: paragraph.id,
            vector: vector,
            payload: {
              paragraphId: paragraph.id,
              documentId: document.id,
              workspaceId: CONFIG.WORKSPACE_ID,
              content: chunkText,
              name: filename,
              filename: filename,
              chunkIndex: chunkIndex,
              storageKey: storageKey,
            },
          });
        }
      }

      // Upsert to Qdrant in batches
      for (let i = 0; i < qdrantPoints.length; i += CONFIG.QDRANT_BATCH_SIZE) {
        const batch = qdrantPoints.slice(i, i + CONFIG.QDRANT_BATCH_SIZE);
        await this.qdrant.upsert('legal_paragraphs', {
          wait: true,
          points: batch,
        });
        this.stats.vectorsUpserted += batch.length;
      }

      // Update document status
      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: 'COMPLETED',
          metadata: {
            ...document.metadata as any,
            chunks: chunks.length,
            paragraphs: paragraphs.length,
            charCount: text.length,
            wordCount: text.split(/\s+/).length,
          },
        },
      });

      this.stats.paragraphsCreated += paragraphs.length;

    } catch (error) {
      // Mark as failed
      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: 'FAILED',
          processingError: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error',
        },
      });
      throw error;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ───────────────────────────────────────────────────────────────────────────

  private getAllPDFFiles(dir: string): string[] {
    const files: string[] = [];
    
    if (!fs.existsSync(dir)) {
      console.error(`❌ Directory does not exist: ${dir}`);
      return files;
    }

    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...this.getAllPDFFiles(fullPath));
      } else if (item.toLowerCase().endsWith('.pdf')) {
        files.push(fullPath);
      }
    }
    
    return files.sort();
  }

  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let currentChunk = '';
    
    for (const para of paragraphs) {
      const cleanPara = para.replace(/\s+/g, ' ').trim();
      
      if (cleanPara.length > CONFIG.MAX_CHUNK_SIZE) {
        // Paragraph too long, split by sentences
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        const sentences = cleanPara.match(/[^.!?]+[.!?]+/g) || [cleanPara];
        let sentenceChunk = '';
        
        for (const sentence of sentences) {
          if ((sentenceChunk + sentence).length > CONFIG.CHUNK_SIZE) {
            if (sentenceChunk) chunks.push(sentenceChunk.trim());
            sentenceChunk = sentence;
          } else {
            sentenceChunk += ' ' + sentence;
          }
        }
        
        if (sentenceChunk) {
          currentChunk = sentenceChunk;
        }
      } else if ((currentChunk + ' ' + cleanPara).length > CONFIG.CHUNK_SIZE) {
        chunks.push(currentChunk.trim());
        currentChunk = cleanPara;
      } else {
        currentChunk += '\n\n' + cleanPara;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Add overlap
    return chunks.map((chunk, i) => {
      if (i === 0) return chunk;
      const prevChunk = chunks[i - 1];
      const overlap = prevChunk.slice(-CONFIG.CHUNK_OVERLAP);
      return overlap + '\n\n' + chunk;
    });
  }

  private detectCategory(filename: string, text: string): string {
    const nameLower = filename.toLowerCase();
    const textLower = text.toLowerCase;
    
    if (nameLower.includes('nte')) return 'Norme Tehnice ANRE (NTE)';
    if (nameLower.includes('pe') || nameLower.includes('proiect')) return 'Proiecte de Reglementare (PE)';
    if (nameLower.includes('lege')) return 'Legislație Primară';
    if (nameLower.includes('hot') || nameLower.includes('hg')) return 'Hotărâri de Guvern';
    if (nameLower.includes('ordin') || nameLower.includes('ord')) return 'Ordine ANRE';
    if (nameLower.includes('regulament')) return 'Regulamente ANRE';
    if (nameLower.includes('decizie')) return 'Decizii ANRE';
    if (nameLower.includes('indrumar') || nameLower.includes('ghid')) return 'Ghiduri și Îndrumări';
    
    return 'Legislație ANRE';
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private printFinalStats(startTime: number): void {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 INDEXING COMPLETE');
    console.log('='.repeat(80));
    console.log(`
✅ Successfully indexed: ${this.stats.processed} documents
⏭️  Skipped (already indexed): ${this.stats.skipped} documents
❌ Failed: ${this.stats.failed} documents
📄 Paragraphs created: ${this.stats.paragraphsCreated}
🧠 Vectors upserted to Qdrant: ${this.stats.vectorsUpserted}
⏱️  Total time: ${duration}s

Average speed: ${(this.stats.processed / (parseFloat(duration) / 60)).toFixed(1)} docs/minute
`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CHECKER
// ─────────────────────────────────────────────────────────────────────────────

async function checkStatus(): Promise<void> {
  const prisma = new PrismaClient();
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 INDEXING STATUS');
  console.log('='.repeat(80));
  
  const workspaceId = CONFIG.WORKSPACE_ID;
  
  const [total, completed, processing, failed] = await Promise.all([
    prisma.document.count({ where: { workspaceId } }),
    prisma.document.count({ where: { workspaceId, status: 'COMPLETED' } }),
    prisma.document.count({ where: { workspaceId, status: 'PROCESSING' } }),
    prisma.document.count({ where: { workspaceId, status: 'FAILED' } }),
  ]);
  
  const paragraphs = await prisma.paragraph.count({
    where: { document: { workspaceId } }
  });
  
  const totalFiles = total + (await countFiles(CONFIG.SOURCE_DIR));
  
  console.log(`
📁 Source files found: ${await countFiles(CONFIG.SOURCE_DIR)}
📚 Documents in database: ${total}
   ✅ Completed: ${completed}
   ⏳ Processing: ${processing}
   ❌ Failed: ${failed}

📝 Total paragraphs: ${paragraphs}
📊 Average paragraphs per doc: ${total > 0 ? (paragraphs / total).toFixed(1) : 'N/A'}
`);
  
  if (completed < totalFiles) {
    const remaining = totalFiles - completed;
    const etaMinutes = (remaining * 2); // ~2 minutes per doc
    console.log(`⏳ Remaining to index: ${remaining} documents`);
    console.log(`⏱️  Estimated time: ~${Math.ceil(etaMinutes / 60)} hours ${etaMinutes % 60} minutes\n`);
  } else {
    console.log('✅ All documents indexed!\n');
  }
  
  await prisma.$disconnect();
}

async function countFiles(dir: string): Promise<number> {
  if (!fs.existsSync(dir)) return 0;
  
  let count = 0;
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      count += await countFiles(fullPath);
    } else if (item.toLowerCase().endsWith('.pdf')) {
      count++;
    }
  }
  
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const command = process.argv[2] || 'start';
  
  switch (command) {
    case 'start':
      const indexer = new ManualIndexer();
      await indexer.start();
      break;
      
    case 'status':
      await checkStatus();
      break;
      
    default:
      console.log(`
📚 Manual Document Indexer

Usage:
  npx tsx manual-index.ts [command]

Commands:
  start   - Start indexing all documents (default)
  status  - Check current indexing status

Examples:
  npm run index:start    - Start full indexing
  npm run index:status   - Check status
`);
  }
}

main().catch(console.error);
