export interface SearchResultProps {
  paragraphId: string;
  documentId: string;
  content: string;
  score: number;
  metadata: {
    pageNumber: number;
    paragraphNumber: number;
    chapterTitle?: string;
    sectionTitle?: string;
    isObligation?: boolean;
    isProhibition?: boolean;
    isDefinition?: boolean;
    articleNumber?: string;
    paragraphLetter?: string;
    keywords: string[];
  };
}

export class SearchResult {
  constructor(private readonly props: SearchResultProps) {}

  get paragraphId(): string { return this.props.paragraphId; }
  get documentId(): string { return this.props.documentId; }
  get content(): string { return this.props.content; }
  get score(): number { return this.props.score; }
  get metadata() { return this.props.metadata; }

  // Business logic
  isHighConfidence(threshold: number = 0.8): boolean {
    return this.props.score >= threshold;
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

  boostScore(amount: number): SearchResult {
    return new SearchResult({
      ...this.props,
      score: Math.min(this.props.score + amount, 1.0),
    });
  }
}
