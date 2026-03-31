import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function debug() {
  console.log("🔍 DEBUG AUTENTIFICARE\n");
  
  // 1. Verifică structura bazei de date
  console.log("1. Verificare tabel User...");
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@example.com' }
    });
    
    if (!user) {
      console.log("   ❌ Userul admin@example.com NU EXISTĂ!");
      console.log("   → Creăm userul...");
      
      const hashed = await bcrypt.hash('admin123', 10);
      const newUser = await prisma.user.create({
        data: {
          email: 'admin@example.com',
          name: 'Administrator',
          password: hashed,
          isAdmin: true,
          emailVerified: new Date(),
        }
      });
      console.log(`   ✅ User creat cu ID: ${newUser.id}`);
    } else {
      console.log("   ✅ User găsit:");
      console.log(`      ID: ${user.id}`);
      console.log(`      Email: ${user.email}`);
      console.log(`      Name: ${user.name}`);
      console.log(`      isAdmin: ${user.isAdmin}`);
      console.log(`      Has password: ${!!user.password}`);
      console.log(`      Password length: ${user.password?.length || 0}`);
      
      // 2. Testează parola
      console.log("\n2. Testare parolă 'admin123'...");
      if (user.password) {
        const isValid = await bcrypt.compare('admin123', user.password);
        console.log(`   Rezultat: ${isValid ? '✅ VALIDĂ' : '❌ INVALIDĂ'}`);
        
        if (!isValid) {
          console.log("   → Resetez parola...");
          const newHash = await bcrypt.hash('admin123', 10);
          await prisma.user.update({
            where: { email: 'admin@example.com' },
            data: { password: newHash, isAdmin: true }
          });
          console.log("   ✅ Parolă resetată");
        }
      } else {
        console.log("   ❌ Nu are parolă! Setez...");
        const newHash = await bcrypt.hash('admin123', 10);
        await prisma.user.update({
          where: { email: 'admin@example.com' },
          data: { password: newHash, isAdmin: true }
        });
        console.log("   ✅ Parolă setată");
      }
    }
  } catch (error: any) {
    console.error("   ❌ EROARE:", error.message);
    if (error.message.includes('password')) {
      console.log("   → Coloana 'password' lipsește din tabel!");
      console.log("   → Rulează: npx prisma migrate dev");
    }
  }
  
  console.log("\n═══════════════════════════════════════════");
  console.log("✅ VERIFICARE COMPLETĂ");
  console.log("═══════════════════════════════════════════");
  console.log("Încearcă să te loghezi cu:");
  console.log("  Email: admin@example.com");
  console.log("  Parolă: admin123");
  console.log("═══════════════════════════════════════════");
  
  await prisma.$disconnect();
}

debug();
