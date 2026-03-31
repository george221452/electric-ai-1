/**
 * Prisma Seed Script
 * 
 * Creează userul admin default și setările RAG inițiale
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Creează Admin User
  // ═══════════════════════════════════════════════════════════════════════════
  
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Administrator',
        password: hashedPassword,
        isAdmin: true,
        emailVerified: new Date(),
      }
    });

    console.log('✅ Admin user created:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   ID: ${admin.id}\n`);
  } else {
    console.log('ℹ️  Admin user already exists\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Creează Setări RAG Default
  // ═══════════════════════════════════════════════════════════════════════════
  
  const existingSettings = await prisma.ragArchitectureSettings.findUnique({
    where: { id: 'global' }
  });

  if (!existingSettings) {
    await prisma.ragArchitectureSettings.create({
      data: {
        id: 'global',
        activeArchitecture: 'legacy',
        
        // Chunking
        chunkMaxSize: 1500,
        chunkMinSize: 200,
        chunkOverlap: 100,
        preserveParagraphBoundaries: true,
        preserveSentenceBoundaries: true,
        cleanDiacritics: true,
        removeExtraWhitespace: true,
        fixHyphenatedWords: true,
        
        // Embeddings
        embeddingModel: 'text-embedding-3-small',
        embeddingDimensions: 1536,
        embeddingBatchSize: 100,
        
        // Legacy
        legacyUseKeywordSearch: true,
        legacyUseVectorSearch: true,
        legacyMinScoreThreshold: 0.40,
        legacyMaxResults: 10,
        legacyFinalResults: 3,
        legacyOpenaiModel: 'gpt-4o-mini',
        legacyMaxTokens: 500,
        legacyTemperature: 0.2,
        legacySystemPrompt: 'Esti un asistent specializat in normative electrice romanesti.',
        legacyPromptTemplate: 'standard',
        legacyIncludeCitations: true,
        legacyRequireCitations: true,
        
        // Hybrid
        hybridUseKeywordSearch: true,
        hybridUseVectorSearch: true,
        hybridUseSynonymExpansion: false,
        hybridUseNumericalBoost: false,
        hybridUseSmartRouter: false,
        hybridUseConfidenceOptimizer: false,
        hybridMinScoreThreshold: 0.40,
        hybridMaxResults: 10,
        hybridFinalResults: 3,
        hybridOpenaiModel: 'gpt-4o-mini',
        hybridMaxTokens: 600,
        hybridTemperature: 0.2,
        hybridSystemPrompt: 'Esti un asistent specializat in normative electrice romanesti.',
        hybridPromptTemplate: 'adaptive',
        hybridIncludeCitations: true,
        hybridRequireCitations: true,
        hybridQuizEnabled: true,
        hybridQuizStrictMode: false,
        hybridQuizConfidenceThreshold: 70,
        
        // General
        enableQueryCache: true,
        cacheTtlSeconds: 3600,
        showDebugInfo: false,
        logQueries: true,
        
        // Formatting
        answerFormat: 'markdown',
        includeSources: true,
        includeConfidenceScore: true,
        addDocumentBanner: false,
        
        // Fallback
        fallbackOnLowConfidence: true,
        fallbackConfidenceThreshold: 40,
        showClarificationOnNoResults: true,
      }
    });

    console.log('✅ RAG Architecture Settings created with defaults\n');
  } else {
    console.log('ℹ️  RAG Architecture Settings already exist\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Creează Workspace Default pentru Admin
  // ═══════════════════════════════════════════════════════════════════════════
  
  const adminUser = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (adminUser) {
    const existingWorkspace = await prisma.workspace.findFirst({
      where: { ownerId: adminUser.id }
    });

    if (!existingWorkspace) {
      const workspace = await prisma.workspace.create({
        data: {
          name: 'Default Workspace',
          slug: 'default-workspace',
          ownerId: adminUser.id,
          isPublic: false,
        }
      });

      console.log('✅ Default Workspace created:');
      console.log(`   Name: ${workspace.name}`);
      console.log(`   ID: ${workspace.id}\n`);
    } else {
      console.log('ℹ️  Default Workspace already exists\n');
    }
  }

  console.log('🎉 Seeding completed!\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔑 LOGIN CREDENTIALS:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   Email:    ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log('═══════════════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
