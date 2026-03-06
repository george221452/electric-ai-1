import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({ host: 'localhost', port: 6333 });

// Search for prohibition-related terms
const searchTerms = [
  'nu se admite',
  'se interzice', 
  'nu se permite',
  'nu este permis',
  'nu are voie',
  'este interzis',
  'nu se face'
];

const allResults = [];

for (const term of searchTerms) {
  try {
    const result = await client.scroll('legal_paragraphs', {
      filter: {
        must: [
          {
            key: 'content',
            match: {
              text: term
            }
          }
        ]
      },
      limit: 30,
      with_payload: true
    });
    
    for (const point of result.points) {
      const text = point.payload.content;
      // Extract sentences with prohibition keywords
      const sentences = text.split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 30);
      
      for (const sentence of sentences) {
        const lower = sentence.toLowerCase();
        if (searchTerms.some(kw => lower.includes(kw))) {
          allResults.push({
            text: sentence,
            page: point.payload.pageNumber,
            doc: point.payload.documentName,
            term: term
          });
        }
      }
    }
  } catch (e) {
    console.log(`Error for term "${term}": ${e.message}`);
  }
}

// Remove duplicates and display
const seen = new Set();
const unique = [];
for (const r of allResults) {
  const key = r.text.toLowerCase().substring(0, 80);
  if (!seen.has(key)) {
    seen.add(key);
    unique.push(r);
  }
}

console.log(`\n=== ${unique.length} INTERDICȚII/RESTRICȚII UNICE GĂSITE ===\n`);
unique.slice(0, 20).forEach((r, i) => {
  console.log(`${i + 1}. ${r.text.substring(0, 250)}`);
  console.log(`   (pag. ${r.page})\n`);
});
