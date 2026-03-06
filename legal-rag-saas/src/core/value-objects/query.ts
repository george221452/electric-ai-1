import { z } from 'zod';

export const QuerySchema = z.object({
  text: z.string().min(3).max(5000),
  workspaceId: z.string().uuid(),
  documentIds: z.array(z.string().uuid()).optional(),
  options: z.object({
    maxParagraphs: z.number().min(1).max(20).default(5),
    minScore: z.number().min(0).max(1).default(0.75),
    strictMode: z.boolean().default(true),
    useAIFormatting: z.boolean().default(false),
    language: z.enum(['ro', 'en', 'auto']).default('auto'),
  }).default({}),
});

export type QueryProps = z.infer<typeof QuerySchema>;

export class Query {
  private readonly _text: string;
  private readonly _workspaceId: string;
  private readonly _documentIds?: string[];
  private readonly _options: QueryProps['options'];

  private constructor(props: QueryProps) {
    this._text = props.text.trim();
    this._workspaceId = props.workspaceId;
    this._documentIds = props.documentIds;
    this._options = props.options;
  }

  static create(props: unknown): Query {
    const validated = QuerySchema.parse(props);
    return new Query(validated);
  }

  // Getters
  get text(): string { return this._text; }
  get workspaceId(): string { return this._workspaceId; }
  get documentIds(): string[] | undefined { return this._documentIds; }
  get options() { return this._options; }

  // Domain logic
  isRestrictedToDocuments(): boolean {
    return this._documentIds !== undefined && this._documentIds.length > 0;
  }

  normalized(): string {
    return this._text.toLowerCase()
      .replace(/[.,;:!?()"'""''\-\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractKeywords(): string[] {
    // Stop words pentru română și engleză
    const stopWords = new Set([
      // Română
      'care', 'ce', 'cum', 'unde', 'cand', 'când', 'de', 'din', 'la', 'si', 'și',
      'sau', 'pentru', 'pe', 'cu', 'fara', 'fără', 'sub', 'despre', 'prin',
      // Engleză
      'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
      'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
      'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
      'this', 'that', 'these', 'those', 'a', 'an', 'and', 'or', 'but', 'in',
      'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'it', 'its'
    ]);

    return this.normalized()
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
  }

  detectQueryIntent(): QueryIntent {
    const text = this.normalized();
    
    // Detectare obligații
    if (/\b(trebuie|obligatoriu|obligat|se va|se vor|impune|prescrie)\b/.test(text)) {
      return QueryIntent.OBLIGATION;
    }
    
    // Detectare interdicții
    if (/\b(interzis|permis|oprit|nu are voie|nu se admite)\b/.test(text)) {
      return QueryIntent.PROHIBITION;
    }
    
    // Detectare definiții
    if (/\b(ce inseamna|ce este|definitie|definiția|semnificație)\b/.test(text)) {
      return QueryIntent.DEFINITION;
    }
    
    // Detectare proceduri
    if (/\b(cum se|cum se face|procedura|modul de|metoda)\b/.test(text)) {
      return QueryIntent.PROCEDURE;
    }
    
    return QueryIntent.GENERAL;
  }

  extractArticleReferences(): string[] {
    const pattern = /(?:art(?:icol)?\.?\s*|art\.?\s*)(\d+[\.\d]*)/gi;
    const matches = Array.from(this._text.matchAll(pattern));
    return matches.map(m => m[1]);
  }
}

export enum QueryIntent {
  GENERAL = 'general',
  OBLIGATION = 'obligation',
  PROHIBITION = 'prohibition',
  DEFINITION = 'definition',
  PROCEDURE = 'procedure',
}
