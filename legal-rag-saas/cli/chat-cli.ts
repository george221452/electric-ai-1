#!/usr/bin/env tsx
/**
 * Interactive Chat CLI with Memory
 * Tests the conversation memory system
 */

import * as readline from 'readline';
import { chatMemory } from '../lib/chat-memory';

const SESSION_ID = 'cli-session-' + Date.now();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║  💬 CHAT INTERACTIV CU MEMORIE                                  ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('Sesiune:', SESSION_ID);
console.log('Comenzi: /clear (șterge istoric), /history (arată istoric), /exit (ieșire)');
console.log('');

function askQuestion() {
  rl.question('Tu: ', async (message) => {
    const trimmed = message.trim();
    
    if (trimmed === '/exit') {
      console.log('\n👋 La revedere!');
      rl.close();
      return;
    }
    
    if (trimmed === '/clear') {
      chatMemory.clearSession(SESSION_ID);
      console.log('🗑️  Istoricul conversației a fost șters.\n');
      askQuestion();
      return;
    }
    
    if (trimmed === '/history') {
      const context = chatMemory.getContext(SESSION_ID);
      console.log('\n📜 ISTORIC CONVERSAȚIE:');
      console.log('Subiect:', context.subject || 'Niciunul');
      console.log('Ultimul subiect:', context.lastTopic || 'Niciunul');
      console.log('Mesaje:', context.messages.length);
      console.log('');
      context.messages.forEach((m, i) => {
        const role = m.role === 'user' ? 'Tu' : 'Asistent';
        console.log(`${i + 1}. ${role}: ${m.content.slice(0, 100)}...`);
      });
      console.log('');
      askQuestion();
      return;
    }
    
    if (!trimmed) {
      askQuestion();
      return;
    }

    // Check if it's a follow-up
    const isFollowUp = chatMemory.isFollowUp(SESSION_ID, trimmed);
    const enhancedQuery = chatMemory.getEnhancedQuery(SESSION_ID, trimmed);
    
    if (isFollowUp) {
      console.log('📝 [Detectat follow-up, adaug context...]');
    }
    
    console.log('');
    console.log('🔍 Caut în documente...');
    
    try {
      // Call the API
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          sessionId: SESSION_ID,
        }),
      });

      if (!response.ok) {
        console.log('❌ Eroare: Serverul nu răspunde. Asigură-te că ai pornit aplicația:');
        console.log('   npm run dev');
        console.log('');
        askQuestion();
        return;
      }

      const data = await response.json();
      
      console.log('');
      console.log('Asistent:', data.response);
      console.log('');
      
      if (data.context?.subject) {
        console.log('📌 Subiect:', data.context.subject);
      }
      console.log('');
      
    } catch (error) {
      console.log('❌ Eroare la comunicarea cu serverul:');
      console.log('   Asigură-te că ai pornit aplicația: npm run dev');
      console.log('');
    }
    
    askQuestion();
  });
}

askQuestion();
