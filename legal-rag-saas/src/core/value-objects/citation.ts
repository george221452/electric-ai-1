import { z } from 'zod';

export const CitationSchema = z.object({
  paragraphId: z.string().uuid(),
  documentId: z.string().uuid(),
  documentName: z.string(),
  pageNumber: z.number().int().positive(),
  paragraphNumber: z.number().int().positive(),
  text: z.string().min(1),
  confidence: z.number().min(0).max(100),
  articleNumber: z.string().optional(),
  paragraphLetter: z.string().optional(),
});

export type CitationProps = z.infer<typeof CitationSchema>;

export class Citation {
  private readonly props: CitationProps;

  constructor(props: CitationProps) {
    this.props = CitationSchema.parse(props);
  }

  // Getters
  get paragraphId(): string { return this.props.paragraphId; }
  get documentId(): string { return this.props.documentId; }
  get documentName(): string { return this.props.documentName; }
  get pageNumber(): number { return this.props.pageNumber; }
  get paragraphNumber(): number { return this.props.paragraphNumber; }
  get text(): string { return this.props.text; }
  get confidence(): number { return this.props.confidence; }
  get articleNumber(): string | undefined { return this.props.articleNumber; }
  get paragraphLetter(): string | undefined { return this.props.paragraphLetter; }

  get id(): string {
    return `${this.props.documentId}_${this.props.paragraphId}`;
  }

  // Domain logic
  isValid(strictMode: boolean): boolean {
    const threshold = strictMode ? 85 : 70;
    return this.props.confidence >= threshold;
  }

  isHighlyConfident(): boolean {
    return this.props.confidence >= 90;
  }

  toDisplayFormat(index: number): string {
    let ref = `[${index}] ${this.props.documentName}`;
    
    if (this.props.articleNumber) {
      ref += `, Art. ${this.props.articleNumber}`;
      if (this.props.paragraphLetter) {
        ref += ` alin. ${this.props.paragraphLetter}`;
      }
    } else {
      ref += `, pag. ${this.props.pageNumber}`;
      ref += `, parag. ${this.props.paragraphNumber}`;
    }
    
    return ref;
  }

  toShortReference(): string {
    if (this.props.articleNumber) {
      return `Art. ${this.props.articleNumber}${this.props.paragraphLetter ? ` alin. ${this.props.paragraphLetter}` : ''}`;
    }
    return `pag. ${this.props.pageNumber}`;
  }

  // Pentru debugging și logging
  toJSON(): CitationProps {
    return { ...this.props };
  }
}

export interface CitationMatch {
  citation: Citation;
  relevanceScore: number;
  keywordMatches: number;
  semanticScore: number;
}
