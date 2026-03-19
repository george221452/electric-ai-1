import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Delete processing documents that might be stuck
  const deleted = await prisma.document.deleteMany({
    where: { status: 'PROCESSING' }
  });
  console.log('Deleted ' + deleted.count + ' processing documents');
}

main().then(() => prisma.$disconnect());
