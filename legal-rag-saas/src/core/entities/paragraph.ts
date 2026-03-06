import { Citation } from '../value-objects/citation';

export interface ParagraphMetadata {
  pageNumber: number;
  paragraphNumber: number;
  chapterTitle?: string;
  sectionTitle?: string;
  wordCount: number;
  charCount: number;
  keywords: string[];
  isObligation?: boolean;
  isProhibition?: boolean;
  isDefinition?: boolean;
  articleNumber?: string;
  paragraphLetter?: string;
}

export interface ParagraphProps {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  metadata: ParagraphMetadata;
  createdAt: Date;
}

export class Paragraph {
  private _citationUsageCount: number = 0;

  private constructor(private props: ParagraphProps) {}

  // Factory method cu validare strictă
  static create(
    props: Omit<ParagraphProps, 'id' | 'createdAt'> & { id?: string }
  ): Paragraph {
    const now = new Date();
    const id = props.id || crypto.randomUUID();

    // Validări de domeniu
    if (!props.content || props.content.length < 10) {
      throw new Error('Paragraph content must be at least 10 characters');
    }

    if (props.metadata.wordCount < 3) {
      throw new Error('Paragraph must have at least 3 words');
    }

    if (props.metadata.pageNumber < 1) {
      throw new Error('Page number must be positive');
    }

    if (props.metadata.paragraphNumber < 1) {
      throw new Error('Paragraph number must be positive');
    }

    // Auto-detectare obligații/interdicții dacă nu sunt setate
    const metadata = { ...props.metadata };
    if (metadata.isObligation === undefined) {
      metadata.isObligation = Paragraph.detectObligation(props.content);
    }
    if (metadata.isProhibition === undefined) {
      metadata.isProhibition = Paragraph.detectProhibition(props.content);
    }
    if (metadata.isDefinition === undefined) {
      metadata.isDefinition = Paragraph.detectDefinition(props.content);
    }

    return new Paragraph({
      ...props,
      id,
      createdAt: now,
      metadata,
    });
  }

  // Reconstituire din DB (fără validări stricte)
  static reconstitute(props: ParagraphProps): Paragraph {
    return new Paragraph(props);
  }

  // Getters
  get id(): string { return this.props.id; }
  get documentId(): string { return this.props.documentId; }
  get content(): string { return this.props.content; }
  get embedding(): number[] | undefined { return this.props.embedding; }
  get metadata(): ParagraphMetadata { return this.props.metadata; }
  get createdAt(): Date { return this.props.createdAt; }

  // Domain methods
  toCitation(confidence: number, documentName: string): Citation {
    return new Citation({
      paragraphId: this.props.id,
      documentId: this.props.documentId,
      documentName,
      pageNumber: this.props.metadata.pageNumber,
      paragraphNumber: this.props.metadata.paragraphNumber,
      text: this.props.content,
      confidence,
      articleNumber: this.props.metadata.articleNumber,
      paragraphLetter: this.props.metadata.paragraphLetter,
    });
  }

  recordUsage(): void {
    this._citationUsageCount++;
  }

  hasEmbedding(): boolean {
    return this.props.embedding !== undefined && 
           this.props.embedding.length > 0;
  }

  setEmbedding(embedding: number[]): Paragraph {
    return new Paragraph({
      ...this.props,
      embedding,
    });
  }

  // Detectare automată tipologie (pentru documente legale)
  private static detectObligation(text: string): boolean {
    const obligationPatterns = [
      /\b(trebuie|obligatoriu|obligat|se va|se vor|impune|prescrie|impune|este necesar)\b/i,
      /\b(must|shall|required|mandatory|obligation)\b/i,
    ];
    return obligationPatterns.some(p => p.test(text));
  }

  private static detectProhibition(text: string): boolean {
    const prohibitionPatterns = [
      /\b(se interzice|nu este permis|este interzis|nu se admite|nu are voie|oprit|strict interzis)\b/i,
      /\b(prohibited|forbidden|not allowed|shall not|must not|strictly prohibited)\b/i,
    ];
    return prohibitionPatterns.some(p => p.test(text));
  }

  private static detectDefinition(text: string): boolean {
    const definitionPatterns = [
      /\b(se înțelege|înțelegându-se|reprezintă|este definit|semnifică)\b/i,
      /\b(means|is defined as|represents|signifies)\b/i,
    ];
    return definitionPatterns.some(p => p.test(text));
  }

  isObligation(): boolean {
    return this.props.metadata.isObligation ?? false;
  }

  isProhibition(): boolean {
    return this.props.metadata.isProhibition ?? false;
  }

  isDefinition(): boolean {
    return this.props.metadata.isDefinition ?? false;
  }

  matchesKeywords(keywords: string[]): number {
    const contentLower = this.props.content.toLowerCase();
    return keywords.filter(kw => contentLower.includes(kw.toLowerCase())).length;
  }

  // Pentru chunking - dacă paragraful e prea lung
  shouldSplit(maxWords: number = 200): boolean {
    return this.props.metadata.wordCount > maxWords;
  }

  // Comparare
  equals(other: Paragraph): boolean {
    return this.props.id === other.props.id;
  }

  // Serialize
  toJSON(): ParagraphProps {
    return { ...this.props };
  }
}
