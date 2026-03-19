#!/usr/bin/env tsx
/**
 * ANRE RAG CLI - Command Line Interface for Legal RAG System
 * 
 * Usage: ./rag [command] [options]
 *        npx tsx cli/index.ts [command] [options]
 * 
 * Help: ./rag help
 *       ./rag --help
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

interface Command {
  name: string;
  alias?: string;
  description: string;
  usage: string;
  examples: string[];
  script?: string;
  args?: string;
}

const COMMANDS: Command[] = [
  // INDEXING COMMANDS
  {
    name: 'index',
    alias: 'i',
    description: 'Indexează TOATE documentele PDF din downloads/',
    usage: 'rag index [start|status]',
    examples: [
      'rag index start      # Începe indexarea completă',
      'rag index status     # Vezi progresul curent',
    ],
    script: 'manual-index.ts',
    args: 'start',
  },
  {
    name: 'reindex',
    alias: 'ri',
    description: 'Șterge TOT și reindexează de la zero (ATENȚIE!)',
    usage: 'rag reindex [--force]',
    examples: [
      'rag reindex          # Cu confirmare',
      'rag reindex --force  # Fără confirmare',
    ],
  },
  {
    name: 'clear',
    alias: 'c',
    description: 'Șterge TOATE documentele indexate din DB și Qdrant',
    usage: 'rag clear [--force]',
    examples: [
      'rag clear            # Cu confirmare (scrie DELETE)',
      'rag clear --force    # Fără confirmare (PERICULOS)',
    ],
    script: 'clear-index.ts',
  },
  {
    name: 'reset-qdrant',
    alias: 'rq',
    description: 'Resetează complet colecția Qdrant (șterge și recreează)',
    usage: 'rag reset-qdrant',
    examples: ['rag reset-qdrant     # Reset complet Qdrant'],
    script: 'clear-index.ts',
    args: '--reset',
  },

  // TESTING COMMANDS
  {
    name: 'test',
    alias: 't',
    description: 'Rulează testele automate pe grilele ANRE',
    usage: 'rag test [quiz|full|accuracy]',
    examples: [
      'rag test quiz        # Testează doar grilele',
      'rag test full        # Test complet cu toate întrebările',
      'rag test accuracy    # Calculează precizia sistemului',
    ],
  },
  {
    name: 'test-single',
    alias: 'ts',
    description: 'Testează O singură întrebare și vezi rezultatul',
    usage: 'rag test-single "întrebarea ta aici"',
    examples: [
      'rag test-single "Care este tensiunea nominală în joasă tensiune?"',
    ],
  },

  // SYSTEM COMMANDS
  {
    name: 'status',
    alias: 's',
    description: 'Arată statusul complet al sistemului (DB, Qdrant, vectori)',
    usage: 'rag status',
    examples: ['rag status           # Status complet sistem'],
    script: 'cli/status-check.ts',
  },
  {
    name: 'check',
    alias: 'chk',
    description: 'Verifică dacă toate serviciile rulează (PostgreSQL, Qdrant, Redis)',
    usage: 'rag check',
    examples: ['rag check            # Verifică health sistem'],
    script: 'cli/health-check.ts',
  },
  {
    name: 'stats',
    alias: 'st',
    description: 'Statistici despre documente indexate și performanță',
    usage: 'rag stats',
    examples: ['rag stats            # Vezi statistici complete'],
    script: 'cli/stats.ts',
  },

  // DOWNLOAD COMMANDS
  {
    name: 'download',
    alias: 'd',
    description: 'Descarcă documente noi de pe arhiva.anre.ro',
    usage: 'rag download [all|nte|pe|legislatie]',
    examples: [
      'rag download all     # Toată legislația',
      'rag download nte     # Doar normele tehnice',
      'rag download pe      # Doar proiectele de reglementare',
    ],
    script: 'anre-super-downloader.ts',
  },
  {
    name: 'count',
    alias: 'cnt',
    description: 'Numără documentele PDF din fiecare categorie',
    usage: 'rag count',
    examples: ['rag count            # Numără toate documentele'],
    script: 'cli/count-docs.ts',
  },

  // DATABASE COMMANDS
  {
    name: 'db-reset',
    alias: 'dr',
    description: 'Resetează baza de date Prisma (șterge tot!)',
    usage: 'rag db-reset [--force]',
    examples: [
      'rag db-reset         # Reset DB cu confirmare',
      'rag db-reset --force # Reset fără confirmare',
    ],
  },
  {
    name: 'db-studio',
    alias: 'studio',
    description: 'Deschide Prisma Studio (interfață web pentru DB)',
    usage: 'rag db-studio',
    examples: ['rag db-studio        # Deschide Prisma Studio'],
  },

  // UTILITY COMMANDS
  {
    name: 'search',
    alias: 'find',
    description: 'Caută în documentele indexate după text',
    usage: 'rag search "text de căutat"',
    examples: [
      'rag search "tensiune nominală"',
      'rag search "NTE 001"',
    ],
    script: 'cli/search.ts',
  },
  {
    name: 'export',
    alias: 'exp',
    description: 'Exportează rezultate testelor în JSON/CSV',
    usage: 'rag export [json|csv]',
    examples: [
      'rag export json      # Exportă în JSON',
      'rag export csv       # Exportă în CSV',
    ],
  },
  {
    name: 'logs',
    alias: 'l',
    description: 'Arată ultimele log-uri din sistem',
    usage: 'rag logs [lines]',
    examples: [
      'rag logs             # Ultimele 50 linii',
      'rag logs 100         # Ultimele 100 linii',
    ],
  },
  {
    name: 'update',
    alias: 'u',
    description: 'Verifică și actualizează documentele modificate',
    usage: 'rag update',
    examples: ['rag update           # Actualizează documente modificate'],
  },

  // HELP
  {
    name: 'help',
    alias: 'h',
    description: 'Arată acest mesaj de ajutor',
    usage: 'rag help [command]',
    examples: [
      'rag help             # Ajutor general',
      'rag help index       # Detalii despre comanda index',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELP DISPLAY
// ─────────────────────────────────────────────────────────────────────────────

function showHelp(specificCommand?: string): void {
  if (specificCommand) {
    const cmd = COMMANDS.find(c => c.name === specificCommand || c.alias === specificCommand);
    if (cmd) {
      console.log('\n' + '═'.repeat(70));
      console.log(`  📖 COMANDA: ${cmd.name}${cmd.alias ? ` (alias: ${cmd.alias})` : ''}`);
      console.log('═'.repeat(70));
      console.log(`\n  📝 Descriere: ${cmd.description}`);
      console.log(`\n  💡 Utilizare: ${cmd.usage}`);
      console.log(`\n  📌 Exemple:`);
      cmd.examples.forEach(ex => console.log(`     $ ${ex}`));
      console.log('');
    } else {
      console.log(`\n❌ Comanda "${specificCommand}" nu există.`);
      console.log('   Folosește: ./rag help\n');
    }
    return;
  }

  // General help
  console.log('\n' + '╔'.repeat(70));
  console.log('║' + ' '.repeat(20) + '🚀 ANRE RAG CLI - HELPER' + ' '.repeat(25) + '║');
  console.log('╚'.repeat(70));
  
  console.log(`
  📂 Proiect: legal-rag-saas
  🎯 Scop: Management sistem RAG pentru legislația ANRE

  ════════════════════════════════════════════════════════════════════
  📚 INDEXARE DOCUMENTE
  ════════════════════════════════════════════════════════════════════
`);

  printCommand('index', 'i', 'Indexează TOATE documentele PDF');
  printCommand('reindex', 'ri', 'Șterge tot și reindexează (ATENȚIE!)');
  printCommand('clear', 'c', 'Șterge documentele indexate');
  printCommand('reset-qdrant', 'rq', 'Reset complet Qdrant');

  console.log(`
  ════════════════════════════════════════════════════════════════════
  🧪 TESTARE ȘI VERIFICARE
  ════════════════════════════════════════════════════════════════════
`);

  printCommand('test', 't', 'Rulează teste pe grile ANRE');
  printCommand('test-single', 'ts', 'Testează o singură întrebare');
  printCommand('status', 's', 'Status complet sistem');
  printCommand('check', 'chk', 'Verifică serviciile (DB, Qdrant, Redis)');
  printCommand('stats', 'st', 'Statistici detaliate');

  console.log(`
  ════════════════════════════════════════════════════════════════════
  ⬇️  DESCĂRCARE DOCUMENTE
  ════════════════════════════════════════════════════════════════════
`);

  printCommand('download', 'd', 'Descarcă de pe arhiva.anre.ro');
  printCommand('count', 'cnt', 'Numără documentele PDF');

  console.log(`
  ════════════════════════════════════════════════════════════════════
  🗄️  BAZA DE DATE
  ════════════════════════════════════════════════════════════════════
`);

  printCommand('db-reset', 'dr', 'Resetează baza de date (PERICULOS!)');
  printCommand('db-studio', 'studio', 'Deschide Prisma Studio');

  console.log(`
  ════════════════════════════════════════════════════════════════════
  🔧 UTILITARE
  ════════════════════════════════════════════════════════════════════
`);

  printCommand('search', 'find', 'Caută în documente');
  printCommand('export', 'exp', 'Exportă rezultate teste');
  printCommand('logs', 'l', 'Vezi log-uri sistem');
  printCommand('update', 'u', 'Actualizează documente modificate');

  console.log(`
  ════════════════════════════════════════════════════════════════════
  ℹ️  AJUTOR
  ════════════════════════════════════════════════════════════════════
`);

  printCommand('help', 'h', 'Arată acest mesaj');

  console.log(`
  ════════════════════════════════════════════════════════════════════
  💡 EXEMPLE RAPIDE
  ════════════════════════════════════════════════════════════════════

  $ ./rag index start              # Începe indexarea
  $ ./rag status                   # Vezi statusul
  $ ./rag test quiz                # Testează grilele
  $ ./rag search "NTE 001"         # Caută NTE 001

  ════════════════════════════════════════════════════════════════════
  ⚠️  COMENZI PERICULOASE (necesită confirmare)
  ════════════════════════════════════════════════════════════════════

  • reindex  - Șterge TOATE datele și reindexează
  • clear    - Șterge doar indexul
  • db-reset - Resetează complet PostgreSQL

  ════════════════════════════════════════════════════════════════════
`);

  console.log('  Pentru detalii despre o comandă: ./rag help <comanda>');
  console.log('  Exemplu: ./rag help index\n');
}

function printCommand(name: string, alias: string, description: string): void {
  const nameStr = name.padEnd(15);
  const aliasStr = alias.padEnd(6);
  console.log(`  ./rag ${nameStr} (alias: ${aliasStr}) - ${description}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

function executeScript(scriptPath: string, args: string[] = []): void {
  const fullPath = path.resolve(__dirname, '..', scriptPath);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`\n❌ Scriptul nu există: ${scriptPath}`);
    console.log('   Creez scriptul necesar...\n');
    return;
  }

  // Use node with tsx to avoid path resolution issues with spaces
  const child = spawn('node', ['--import', 'tsx', fullPath, ...args], {
    stdio: 'inherit',
    shell: false,
    cwd: path.resolve(__dirname, '..'),
  });

  child.on('error', (err) => {
    console.error(`\n❌ Eroare la executare: ${err.message}`);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

function executeCommand(cmd: string, args: string[]): void {
  switch (cmd) {
    // INDEXING
    case 'index':
    case 'i':
      const subcmd = args[0] || 'start';
      if (subcmd === 'start') {
        executeScript('manual-index.ts', ['start']);
      } else if (subcmd === 'status') {
        executeScript('manual-index.ts', ['status']);
      } else {
        console.log('\n❌ Subcomandă necunoscută. Folosește: start sau status\n');
      }
      break;

    case 'reindex':
    case 'ri':
      console.log('\n⚠️  REINDEXARE COMPLETĂ');
      console.log('   Această comandă va ȘTERGE toate datele și va reindexa totul.\n');
      
      if (args.includes('--force')) {
        executeScript('clear-index.ts', ['--force']);
      } else {
        executeScript('clear-index.ts', []);
      }
      break;

    case 'clear':
    case 'c':
      if (args.includes('--force')) {
        executeScript('clear-index.ts', ['--force']);
      } else {
        executeScript('clear-index.ts', []);
      }
      break;

    case 'reset-qdrant':
    case 'rq':
      executeScript('clear-index.ts', ['--reset']);
      break;

    // TESTING
    case 'test':
    case 't':
      const testType = args[0] || 'quiz';
      executeScript('cli/test-runner.ts', [testType]);
      break;

    case 'test-single':
    case 'ts':
      const question = args.join(' ');
      if (!question) {
        console.log('\n❌ Trebuie să specifici o întrebare.');
        console.log('   Exemplu: ./rag test-single "Care este tensiunea nominală?"\n');
        return;
      }
      executeScript('cli/test-single.ts', [question]);
      break;

    // SYSTEM
    case 'status':
    case 's':
      executeScript('cli/status-check.ts', []);
      break;

    case 'check':
    case 'chk':
      executeScript('cli/health-check.ts', []);
      break;

    case 'stats':
    case 'st':
      executeScript('cli/stats.ts', []);
      break;

    // DOWNLOAD
    case 'download':
    case 'd':
      const category = args[0] || 'all';
      executeScript('anre-super-downloader.ts', [category]);
      break;

    case 'count':
    case 'cnt':
      executeScript('cli/count-docs.ts', []);
      break;

    // DATABASE
    case 'db-reset':
    case 'dr':
      if (args.includes('--force')) {
        executeScript('cli/db-reset.ts', ['--force']);
      } else {
        executeScript('cli/db-reset.ts', []);
      }
      break;

    case 'db-studio':
    case 'studio':
      const studio = spawn('npx', ['prisma', 'studio'], {
        stdio: 'inherit',
        shell: true,
        cwd: path.resolve(__dirname, '..'),
      });
      studio.on('exit', (code) => process.exit(code || 0));
      break;

    // UTILITY
    case 'search':
    case 'find':
      const query = args.join(' ');
      if (!query) {
        console.log('\n❌ Trebuie să specifici un text de căutat.');
        console.log('   Exemplu: ./rag search "tensiune nominală"\n');
        return;
      }
      executeScript('cli/search.ts', [query]);
      break;

    case 'export':
    case 'exp':
      const format = args[0] || 'json';
      executeScript('cli/export.ts', [format]);
      break;

    case 'logs':
    case 'l':
      const lines = args[0] || '50';
      const logs = spawn('tail', ['-n', lines, 'logs/app.log'], {
        stdio: 'inherit',
        shell: true,
        cwd: path.resolve(__dirname, '..'),
      });
      logs.on('error', () => {
        console.log('\n⚠️  Nu am găsit fișierul de log.\n');
      });
      break;

    case 'update':
    case 'u':
      executeScript('cli/update-docs.ts', []);
      break;

    // HELP
    case 'help':
    case 'h':
      showHelp(args[0]);
      break;

    default:
      console.log(`\n❌ Comanda necunoscută: "${cmd}"`);
      console.log('   Folosește: ./rag help\n');
      process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  
  // Show help if no arguments
  if (args.length === 0) {
    showHelp();
    return;
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  // Handle --help flag
  if (command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  executeCommand(command, commandArgs);
}

main();
