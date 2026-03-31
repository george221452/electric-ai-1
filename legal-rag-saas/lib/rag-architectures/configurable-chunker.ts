/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CONFIGURABLE TEXT CHUNKER
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Serviciu de chunking complet configurabil din admin.
 * Toți parametrii sunt citiți din RagArchitectureSettings.
 */

import { getArchitectureSettings } from './settings-service';

export interface Chunk {
  content: string;
  metadata: {
    charCount: number;
    wordCount: number;
    sentenceCount: number;
    paragraphCount: number;
    startIndex: number;
    endIndex: number;
  };
}

export interface ChunkingOptions {
  maxChunkSize?: number;
  minChunkSize?: number;
  overlap?: number;
  preserveParagraphBoundaries?: boolean;
  preserveSentenceBoundaries?: boolean;
}

/**
 * Împarte textul în chunk-uri conform setărilor din admin
 */
export async function chunkText(
  text: string,
  pageNumber: number = 1,
  customOptions?: ChunkingOptions
): Promise<Chunk[]> {
  const settings = await getArchitectureSettings();
  
  // Folosește setările din admin sau override-uri
  const options = {
    maxChunkSize: customOptions?.maxChunkSize ?? settings.chunkMaxSize,
    minChunkSize: customOptions?.minChunkSize ?? settings.chunkMinSize,
    overlap: customOptions?.overlap ?? settings.chunkOverlap,
    preserveParagraphBoundaries: customOptions?.preserveParagraphBoundaries ?? settings.preserveParagraphBoundaries,
    preserveSentenceBoundaries: customOptions?.preserveSentenceBoundaries ?? settings.preserveSentenceBoundaries,
  };

  console.log(`[Chunker] Chunking text with settings:`, {
    maxChunkSize: options.maxChunkSize,
    minChunkSize: options.minChunkSize,
    overlap: options.overlap,
    preserveParagraphs: options.preserveParagraphBoundaries,
    preserveSentences: options.preserveSentenceBoundaries,
  });

  // Curățare text dacă e activată în setări
  let cleanText = text;
  if (settings.cleanDiacritics) {
    cleanText = fixDiacritics(cleanText);
  }
  if (settings.removeExtraWhitespace) {
    cleanText = cleanText.replace(/\s+/g, ' ').trim();
  }
  if (settings.fixHyphenatedWords) {
    cleanText = fixHyphenation(cleanText);
  }

  // Strategie de chunking bazată pe setări
  let chunks: Chunk[];
  
  if (options.preserveParagraphBoundaries && options.preserveSentenceBoundaries) {
    chunks = chunkByParagraphsAndSentences(cleanText, options);
  } else if (options.preserveParagraphBoundaries) {
    chunks = chunkByParagraphs(cleanText, options);
  } else if (options.preserveSentenceBoundaries) {
    chunks = chunkBySentences(cleanText, options);
  } else {
    chunks = chunkByCharacters(cleanText, options);
  }

  console.log(`[Chunker] Created ${chunks.length} chunks from page ${pageNumber}`);
  
  return chunks;
}

/**
 * Chunking care păstrează și paragrafele și propozițiile
 */
function chunkByParagraphsAndSentences(text: string, options: ChunkingOptions): Chunk[] {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chunks: Chunk[] = [];
  let currentChunk = '';
  let startIndex = 0;

  for (const paragraph of paragraphs) {
    // Dacă adăugăm acest paragraf depășim maxChunkSize
    if (currentChunk.length + paragraph.length > options.maxChunkSize && currentChunk.length >= options.minChunkSize) {
      // Salvăm chunk-ul curent
      chunks.push(createChunk(text, currentChunk, startIndex));
      
      // Începem unul nou cu overlap
      const overlapText = getOverlapText(currentChunk, options.overlap);
      currentChunk = overlapText + '\n\n' + paragraph;
      startIndex = text.indexOf(paragraph, startIndex);
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  // Adăugăm ultimul chunk dacă e valid
  if (currentChunk.length >= options.minChunkSize) {
    chunks.push(createChunk(text, currentChunk, startIndex));
  }

  return chunks;
}

/**
 * Chunking care păstrează doar paragrafele
 */
function chunkByParagraphs(text: string, options: ChunkingOptions): Chunk[] {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chunks: Chunk[] = [];
  let currentChunk = '';
  let startIndex = 0;
  let currentStartIndex = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    
    if (currentChunk.length + paragraph.length > options.maxChunkSize && currentChunk.length >= options.minChunkSize) {
      chunks.push(createChunk(text, currentChunk, currentStartIndex));
      
      currentChunk = paragraph;
      currentStartIndex = text.indexOf(paragraph, startIndex);
      startIndex = currentStartIndex + 1;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk.length >= options.minChunkSize) {
    chunks.push(createChunk(text, currentChunk, currentStartIndex));
  }

  return chunks;
}

/**
 * Chunking care păstrează propozițiile
 */
function chunkBySentences(text: string, options: ChunkingOptions): Chunk[] {
  // Regex pentru propoziții în română
  const sentenceRegex = /[^.!?]+[.!?]+/g;
  const sentences = text.match(sentenceRegex) || [text];
  
  const chunks: Chunk[] = [];
  let currentChunk = '';
  let startIndex = 0;

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    
    if (currentChunk.length + trimmedSentence.length > options.maxChunkSize && currentChunk.length >= options.minChunkSize) {
      chunks.push(createChunk(text, currentChunk, startIndex));
      
      const overlapText = getOverlapText(currentChunk, options.overlap);
      currentChunk = overlapText + ' ' + trimmedSentence;
      startIndex = text.indexOf(trimmedSentence, startIndex);
    } else {
      currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
    }
  }

  if (currentChunk.length >= options.minChunkSize) {
    chunks.push(createChunk(text, currentChunk, startIndex));
  }

  return chunks;
}

/**
 * Chunking simplu pe caractere (cel mai rapid, dar poate tăia cuvinte)
 */
function chunkByCharacters(text: string, options: ChunkingOptions): Chunk[] {
  const chunks: Chunk[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + options.maxChunkSize, text.length);
    const chunkText = text.slice(startIndex, endIndex);
    
    if (chunkText.length >= options.minChunkSize) {
      chunks.push(createChunk(text, chunkText, startIndex));
    }
    
    // Avansăm cu (chunkSize - overlap) pentru overlap
    startIndex += options.maxChunkSize - options.overlap;
  }

  return chunks;
}

/**
 * Creează un obiect Chunk cu metadata
 */
function createChunk(fullText: string, content: string, startIndex: number): Chunk {
  const words = content.trim().split(/\s+/).filter(w => w.length > 0);
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  return {
    content: content.trim(),
    metadata: {
      charCount: content.length,
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      startIndex,
      endIndex: startIndex + content.length,
    },
  };
}

/**
 * Extrage text pentru overlap de la sfârșitul chunk-ului anterior
 */
function getOverlapText(text: string, overlapSize: number): string {
  if (overlapSize <= 0) return '';
  
  // Încercăm să păstrăm propoziții complete în overlap
  const lastSentences = text.match(/[^.!?]+[.!?]+/g);
  if (lastSentences) {
    let overlap = '';
    for (let i = lastSentences.length - 1; i >= 0; i--) {
      const candidate = lastSentences[i] + overlap;
      if (candidate.length > overlapSize) break;
      overlap = candidate;
    }
    return overlap;
  }
  
  return text.slice(-overlapSize);
}

/**
 * Corectează diacriticele comune în texte extrase din PDF
 */
function fixDiacritics(text: string): string {
  const replacements: Record<string, string> = {
    'aĠ': 'ă',
    'þ': 'ț',
    'ÿ': 'â',
    'ü': 'î',
    'ö': 'â',
    'ä': 'ă',
    'ï': 'î',
    'ú': 'ș',
    'û': 'â',
    'ñ': 'î',
  };

  let result = text;
  for (const [wrong, correct] of Object.entries(replacements)) {
    result = result.split(wrong).join(correct);
  }
  return result;
}

/**
 * Corectează cuvintele despărțite la sfârșit de rând
 */
function fixHyphenation(text: string): string {
  // Pattern pentru cuvinte despărțite: "cuvânt-" urmat de newline și continuare
  return text.replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2');
}

/**
 * Preprocesare completă a unui document
 */
export async function preprocessDocument(
  rawText: string,
  documentId: string,
  pageNumber: number
): Promise<Array<Chunk & { documentId: string; pageNumber: number }>> {
  const chunks = await chunkText(rawText, pageNumber);
  
  return chunks.map(chunk => ({
    ...chunk,
    documentId,
    pageNumber,
  }));
}

export default chunkText;
