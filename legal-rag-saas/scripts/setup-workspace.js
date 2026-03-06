const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
  const userId = 'demo-user';
  
  try {
    // Create demo user first
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: 'demo@legalrag.com',
        name: 'Demo User',
      },
    });
    console.log('✅ User creat:', userId);
    
    // Create or update workspace
    const workspace = await prisma.workspace.upsert({
      where: { id: workspaceId },
      update: {},
      create: {
        id: workspaceId,
        name: 'Demo Workspace',
        slug: 'demo-workspace',
        ownerId: userId,
        ragConfigId: 'generic-document',
        isPublic: true,
        settings: {},
      },
    });
    
    console.log('✅ Workspace creat:', workspace.id);
    
    // Create test file
    const fs = require('fs');
    const testContent = `Art. 4.2.1 - Se interzice utilizarea conductoarelor neizolate în instalațiile electrice fără protecție adecvată conform normelor în vigoare.

Art. 4.2.2 - Instalațiile electrice trebuie să fie echipate cu dispozitive de protecție împotriva supracurentului și a curenților de defect.

Art. 4.2.3 - Împământarea instalațiilor electrice trebuie realizată conform normelor tehnice în vigoare, utilizând conductoare de secțiune adecvată.`;

    const testFilePath = '/tmp/test-normativ.txt';
    fs.writeFileSync(testFilePath, testContent);
    
    console.log('✅ Fișier test creat:', testFilePath);
    console.log('\n📤 Acum poți încărca acest fișier prin UI:');
    console.log('http://localhost:3000/dashboard');
    
  } catch (error) {
    console.error('❌ Eroare:', error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
