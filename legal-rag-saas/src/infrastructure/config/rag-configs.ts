export interface RAGConfiguration {
  id: string;
  name: string;
  description: string;
  engine: 'legal' | 'technical' | 'generic';
  extractionStrategy: 'unstructured' | 'legal-pdf' | 'ocr';
  chunkSize: number;
  chunkOverlap: number;
  minParagraphLength: number;
  embeddingModel: 'text-embedding-3-large' | 'text-embedding-3-small' | 'local';
  boostConfig?: {
    obligationKeywords?: string[];
    prohibitionKeywords?: string[];
    definitionKeywords?: string[];
    technicalTerms?: string[];
    customBoosts?: Array<{
      pattern: string;
      boost: number;
    }>;
  };
}

export const RAG_CONFIGURATIONS: Record<string, RAGConfiguration> = {
  'romanian-legal-norm': {
    id: 'romanian-legal-norm',
    name: 'Normative Tehnice Românești',
    description: 'Optimizat pentru I7/2011, P118, și alte normative tehnice românești. Detectează obligații, interdicții și definiții.',
    engine: 'legal',
    extractionStrategy: 'legal-pdf',
    chunkSize: 500,
    chunkOverlap: 50,
    minParagraphLength: 30,
    embeddingModel: 'text-embedding-3-large',
    boostConfig: {
      obligationKeywords: [
        'trebuie', 'obligatoriu', 'obligat', 'se va', 'se vor', 
        'impune', 'prescrie', 'este necesar', 'avea obligația',
        'se impune', 'este obligatorie'
      ],
      prohibitionKeywords: [
        'se interzice', 'nu este permis', 'este interzis', 
        'nu se admite', 'nu are voie', 'oprit', 'strict interzis',
        'nu este admis', 'nu se permite'
      ],
      definitionKeywords: [
        'se înțelege', 'înțelegându-se', 'reprezintă', 
        'este definit', 'semnifică', 'se definește'
      ],
      customBoosts: [
        { pattern: 'Art\.\\s*\\d+', boost: 0.1 },
        { pattern: 'CAPITOLUL\\s*\\d+', boost: 0.05 },
      ],
    },
  },

  'romanian-law': {
    id: 'romanian-law',
    name: 'Legi și Ordonanțe Românești',
    description: 'Pentru legi, ordonanțe și hotărâri de guvern românești.',
    engine: 'legal',
    extractionStrategy: 'legal-pdf',
    chunkSize: 600,
    chunkOverlap: 100,
    minParagraphLength: 40,
    embeddingModel: 'text-embedding-3-large',
    boostConfig: {
      obligationKeywords: [
        'se stabilește', 'sunt obligate', 'au obligația', 
        'vor aplica', 'se aplică', 'este necesar'
      ],
      prohibitionKeywords: [
        'se interzice', 'se prohibă', 'nu se admite', 'sunt interzise'
      ],
      definitionKeywords: [
        'în sensul prezentei', 'se înțelege prin', 'reprezintă'
      ],
    },
  },

  'technical-manual': {
    id: 'technical-manual',
    name: 'Manuale Tehnice',
    description: 'Pentru manuale tehnice, specificații de produs și documentație tehnică.',
    engine: 'technical',
    extractionStrategy: 'unstructured',
    chunkSize: 800,
    chunkOverlap: 150,
    minParagraphLength: 25,
    embeddingModel: 'text-embedding-3-large',
    boostConfig: {
      technicalTerms: [
        'parametru', 'specificație', 'toleranță', 'dimensiune',
        'material', 'procedură', 'standard', 'normă'
      ],
    },
  },

  'generic-document': {
    id: 'generic-document',
    name: 'Document Generic',
    description: 'Configurație generală pentru orice tip de document.',
    engine: 'generic',
    extractionStrategy: 'unstructured',
    chunkSize: 1000,
    chunkOverlap: 200,
    minParagraphLength: 20,
    embeddingModel: 'text-embedding-3-small',
  },

  'scanned-pdf': {
    id: 'scanned-pdf',
    name: 'Document Scanat (OCR)',
    description: 'Pentru documente scanate care necesită OCR.',
    engine: 'generic',
    extractionStrategy: 'ocr',
    chunkSize: 800,
    chunkOverlap: 100,
    minParagraphLength: 30,
    embeddingModel: 'text-embedding-3-large',
  },
};

export function getRAGConfiguration(configId: string): RAGConfiguration {
  const config = RAG_CONFIGURATIONS[configId];
  if (!config) {
    console.warn(`Unknown RAG config: ${configId}, using default`);
    return RAG_CONFIGURATIONS['generic-document'];
  }
  return config;
}

export function listRAGConfigurations(): RAGConfiguration[] {
  return Object.values(RAG_CONFIGURATIONS);
}

export function detectBestConfig(fileType: string, content?: string): string {
  // Detectare automată bazată pe conținut
  if (content) {
    const hasRomanianLegalTerms = /\b(trebuie|obligatoriu|conform|normativ|tehnic)\b/i.test(content);
    const hasArticlePattern = /\bArt\.\s*\d+\b/.test(content);
    const hasChapterPattern = /\bCAPITOLUL\s+\d+\b/i.test(content);

    if (hasRomanianLegalTerms && hasArticlePattern && hasChapterPattern) {
      return 'romanian-legal-norm';
    }
  }

  // Default based on file type
  if (fileType.startsWith('image/')) {
    return 'scanned-pdf';
  }

  return 'generic-document';
}
