#!/bin/bash
# Indexează documentele noi NTE

echo "🚀 Indexare documente NTE în Qdrant..."
echo ""

# Crează documente în baza de date și generează embeddings
npx tsx -e "
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const UPLOAD_DIR = './uploads/' + WORKSPACE_ID;

async function main() {
  const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.endsWith('.pdf'));
  console.log('Found', files.length, 'PDF files');
  
  for (const file of files) {
    const existing = await prisma.document.findFirst({
      where: { name: file, workspaceId: WORKSPACE_ID }
    });
    
    if (!existing) {
      console.log('Creating document entry:', file);
      await prisma.document.create({
        data: {
          name: file,
          type: 'application/pdf',
          size: fs.statSync(path.join(UPLOAD_DIR, file)).size,
          workspaceId: WORKSPACE_ID,
          status: 'pending',
          filePath: path.join(UPLOAD_DIR, file),
        }
      });
    } else {
      console.log('Document exists:', file);
    }
  }
}

main().catch(console.error).finally(() => prisma.\$disconnect());
"

echo ""
echo "✅ Documente înregistrate în bază. Acum rulează worker-ul de embeddings..."
