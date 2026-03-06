import { PassthroughResponseFormatter } from './src/infrastructure/adapters/formatters/passthrough-formatter.ts';

const formatter = new PassthroughResponseFormatter();

const mockCitation = {
  paragraphId: 'test-1',
  documentId: 'doc-1',
  documentName: 'Normativ I7-2011',
  pageNumber: 108,
  paragraphNumber: 1,
  text: 'Se recomanda ca in incaperile de locuit sii similare, traseele tuburilor orizontale pe pereti sa fi distantate la circa 0,3 m de plafon. 5.2.12.2.5.',
  confidence: 100,
};

const result = formatter.formatTemplate(
  'la ce distanta de tavan se monteaza dozele',
  [mockCitation],
  { useAI: false, style: 'formal', includeCitations: true, language: 'ro' }
);

console.log('=== RĂSPUNS FORMATAT ===');
console.log(result.text);
