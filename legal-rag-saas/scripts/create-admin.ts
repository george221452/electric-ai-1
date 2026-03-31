/**
 * Script rapid pentru crearea userului admin
 * 
 * Usage: npx tsx scripts/create-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  const email = 'admin@example.com';
  const password = 'admin123';
  
  console.log('🔧 Creare admin user...\n');

  // Verifică dacă există deja
  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    console.log('ℹ️  Userul admin există deja!');
    console.log(`   Email: ${existing.email}`);
    console.log(`   isAdmin: ${existing.isAdmin}`);
    console.log(`   Has password: ${!!existing.password}`);
    
    // Resetăm parola
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { email },
      data: { 
        password: hashed,
        isAdmin: true 
      }
    });
    console.log('\n✅ Parola a fost resetată la: admin123');
  } else {
    // Creează user nou
    const hashed = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Administrator',
        password: hashed,
        isAdmin: true,
        emailVerified: new Date(),
      }
    });

    console.log('✅ Admin user creat cu succes!');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   isAdmin: ${user.isAdmin}`);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('🔑 POȚI SĂ TE LOGHEZI CU:');
  console.log('═══════════════════════════════════════════');
  console.log('   Email: admin@example.com');
  console.log('   Parolă: admin123');
  console.log('═══════════════════════════════════════════');
}

createAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
