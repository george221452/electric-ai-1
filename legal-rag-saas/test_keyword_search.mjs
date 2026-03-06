import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({ host: 'localhost', port: 6333 });

// Scroll all points and filter by keyword
const result = await client.scroll('legal_paragraphs', {
  filter: {
    must: [
      { key: 'content', match: { text: 'nu se admite' } }
    ]
  },
  limit: 50,
  with_payload: true
});

console.log(`Found ${result.points.length} paragraphs with 'nu se admite'`);
result.points.forEach((p, i) => {
  const text = p.payload.content;
  // Extract sentences with the keyword
  const sentences = text.split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.toLowerCase().includes('nu se admite') && s.length > 30);
  
  sentences.forEach(s => {
    console.log(`\n${i+1}. ${s.substring(0, 200)} (pag. ${p.payload.pageNumber})`);
  });
});
