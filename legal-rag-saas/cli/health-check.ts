#!/usr/bin/env tsx
/**
 * Health Check - Verify all services are running
 */

import { PrismaClient } from '@prisma/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const CHECKS = {
  postgres: false,
  qdrant: false,
  redis: false,
  openai: false,
};

async function checkPostgres(): Promise<boolean> {
  try {
    const prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    return true;
  } catch {
    return false;
  }
}

async function checkQdrant(): Promise<boolean> {
  try {
    const qdrant = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });
    await qdrant.getCollections();
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
    await redis.ping();
    await redis.disconnect();
    return true;
  } catch {
    return false;
  }
}

async function checkOpenAI(): Promise<boolean> {
  return !!process.env.OPENAI_API_KEY;
}

function printStatus(name: string, status: boolean, details?: string): void {
  const icon = status ? '✅' : '❌';
  const statusText = status ? 'OK' : 'FAIL';
  console.log(`  ${icon} ${name.padEnd(15)} ${statusText}${details ? ` - ${details}` : ''}`);
}

async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('  🏥 HEALTH CHECK - Verificare servicii');
  console.log('═'.repeat(70) + '\n');

  console.log('Se verifică serviciile...\n');

  const [postgres, qdrant, redis, openai] = await Promise.all([
    checkPostgres(),
    checkQdrant(),
    checkRedis(),
    checkOpenAI(),
  ]);

  console.log('📊 REZULTATE:\n');
  
  printStatus('PostgreSQL', postgres, postgres ? 'Conectat' : 'Nu pot conecta');
  printStatus('Qdrant', qdrant, qdrant ? 'Conectat' : 'Nu pot conecta');
  printStatus('Redis', redis, redis ? 'Conectat' : 'Nu pot conecta');
  printStatus('OpenAI API', openai, openai ? 'Key configurat' : 'Key lipsă în .env');

  const allOk = postgres && qdrant && redis && openai;
  
  console.log('\n' + '─'.repeat(70));
  
  if (allOk) {
    console.log('  🎉 Toate serviciile sunt UP! Sistemul funcționează corect.\n');
    process.exit(0);
  } else {
    console.log('  ⚠️  Unele servicii sunt DOWN. Verifică configurația.\n');
    
    if (!postgres) {
      console.log('  💡 PostgreSQL: Verifică dacă rulează:');
      console.log('     docker ps | grep postgres');
    }
    if (!qdrant) {
      console.log('  💡 Qdrant: Verifică dacă rulează:');
      console.log('     docker ps | grep qdrant');
    }
    if (!redis) {
      console.log('  💡 Redis: Verifică dacă rulează:');
      console.log('     docker ps | grep redis');
    }
    if (!openai) {
      console.log('  💡 OpenAI: Adaugă OPENAI_API_KEY în .env.local');
    }
    console.log('');
    process.exit(1);
  }
}

main();
