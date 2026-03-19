import * as fs from 'fs';

// Load test results
const data = JSON.parse(fs.readFileSync('DUAL_MODE_REPORT_2026-03-12T10-59-46-396Z.json', 'utf-8'));

console.log('📊 ANALIZA ERORILOR\n');
console.log('====================\n');

// Categorize errors
const errors = data.results.filter((r: any) => !r.correct);

console.log(`Total erori: ${errors.length}/${data.total}\n`);

// Group by expected answer
const byExpected: Record<string, any[]> = { a: [], b: [], c: [] };
for (const e of errors) {
  byExpected[e.expected].push(e);
}

console.log('Distribuție erori după răspunsul corect:');
for (const [letter, items] of Object.entries(byExpected)) {
  console.log(`  ${letter.toUpperCase()}: ${items.length} erori`);
}

console.log('\n\n🔍 Erori care ar trebui să fie C (dar sistemul a ales A/B):');
for (const e of byExpected.c) {
  console.log(`\n#${e.questionId}: ${e.question.substring(0, 80)}...`);
  console.log(`   Primit: ${e.actual?.toUpperCase()}, Confidence: ${e.confidence}%`);
  if (e.isNumericMatch) console.log('   ⚠️ A avut match numeric dar tot greșit!');
}

console.log('\n\n📌 Pattern-uri identificate:');
console.log('1. Prea multe răspunsuri A - bias către prima opțiune');
console.log('2. Match numeric găsește valoarea dar nu verifică contextul');
console.log('3. Lipsă verificare pentru "numai" / restricții');
console.log('4. Zonă de protecție vs zonă de siguranță confundate');
