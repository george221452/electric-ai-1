const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const paragraphs = await prisma.paragraph.findMany({
    where: { documentId: '3a529be2-749e-4f00-87db-b4c9d039f20d' },
  });
  
  console.log('Paragrafe găsite:', paragraphs.length);
  paragraphs.forEach((p, i) => {
    console.log(`\n--- Paragraf ${i + 1} ---`);
    console.log('ID:', p.id);
    console.log('Conținut:', p.content.substring(0, 200));
  });
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
