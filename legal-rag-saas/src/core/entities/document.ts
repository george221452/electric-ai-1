import { Paragraph } from './paragraph';

export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface DocumentProps {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  status: DocumentStatus;
  pageCount?: number;
  ragConfigId: string;
  paragraphs: Paragraph[];
  processingError?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class Document {
  private constructor(private props: DocumentProps) {}

  // Factory method
  static create(
    props: Omit<DocumentProps, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'paragraphs'>
  ): Document {
    const now = new Date();

    // Validări
    if (!props.name || props.name.length < 1) {
      throw new Error('Document name is required');
    }

    if (props.fileSize <= 0) {
      throw new Error('File size must be positive');
    }

    if (!props.storageKey) {
      throw new Error('Storage key is required');
    }

    return new Document({
      ...props,
      id: crypto.randomUUID(),
      status: 'PENDING',
      paragraphs: [],
      metadata: props.metadata || {},
      createdAt: now,
      updatedAt: now,
    });
  }

  // Reconstituire din DB
  static reconstitute(props: DocumentProps): Document {
    return new Document({
      ...props,
      paragraphs: props.paragraphs || [],
    });
  }

  // Getters
  get id(): string { return this.props.id; }
  get workspaceId(): string { return this.props.workspaceId; }
  get userId(): string { return this.props.userId; }
  get name(): string { return this.props.name; }
  get fileType(): string { return this.props.fileType; }
  get fileSize(): number { return this.props.fileSize; }
  get storageKey(): string { return this.props.storageKey; }
  get status(): DocumentStatus { return this.props.status; }
  get pageCount(): number | undefined { return this.props.pageCount; }
  get ragConfigId(): string { return this.props.ragConfigId; }
  get paragraphs(): ReadonlyArray<Paragraph> { return this.props.paragraphs; }
  get processingError(): string | undefined { return this.props.processingError; }
  get metadata() { return this.props.metadata; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  // State transitions
  startProcessing(): Document {
    if (this.props.status !== 'PENDING') {
      throw new Error(`Cannot start processing from status: ${this.props.status}`);
    }
    return new Document({
      ...this.props,
      status: 'PROCESSING',
      updatedAt: new Date(),
    });
  }

  completeProcessing(pageCount: number): Document {
    if (this.props.status !== 'PROCESSING') {
      throw new Error('Document not in processing state');
    }
    return new Document({
      ...this.props,
      status: 'COMPLETED',
      pageCount,
      updatedAt: new Date(),
    });
  }

  failProcessing(error: string): Document {
    return new Document({
      ...this.props,
      status: 'FAILED',
      processingError: error,
      updatedAt: new Date(),
    });
  }

  // Paragraph management
  addParagraph(paragraph: Paragraph): Document {
    if (this.props.status !== 'PROCESSING') {
      throw new Error('Can only add paragraphs during processing');
    }
    return new Document({
      ...this.props,
      paragraphs: [...this.props.paragraphs, paragraph],
      updatedAt: new Date(),
    });
  }

  addParagraphs(paragraphs: Paragraph[]): Document {
    let doc: Document = this;
    for (const para of paragraphs) {
      doc = doc.addParagraph(para);
    }
    return doc;
  }

  getParagraphById(id: string): Paragraph | undefined {
    return this.props.paragraphs.find(p => p.id === id);
  }

  getParagraphsForCitation(paragraphIds: string[]): Paragraph[] {
    return this.props.paragraphs.filter(p => paragraphIds.includes(p.id));
  }

  // Statistics
  get totalParagraphs(): number {
    return this.props.paragraphs.length;
  }

  get totalWordCount(): number {
    return this.props.paragraphs.reduce(
      (sum, p) => sum + (p.metadata.wordCount || 0), 
      0
    );
  }

  get paragraphsWithEmbeddings(): number {
    return this.props.paragraphs.filter(p => p.hasEmbedding()).length;
  }

  isIndexed(): boolean {
    return this.props.status === 'COMPLETED' && 
           this.paragraphsWithEmbeddings === this.totalParagraphs;
  }

  // Query helper
  searchInParagraphs(keyword: string): Paragraph[] {
    const kw = keyword.toLowerCase();
    return this.props.paragraphs.filter(p => 
      p.content.toLowerCase().includes(kw)
    );
  }

  // Metadata helpers
  getTitle(): string {
    return this.props.metadata.title as string || this.props.name;
  }

  setMetadata(key: string, value: unknown): Document {
    return new Document({
      ...this.props,
      metadata: { ...this.props.metadata, [key]: value },
      updatedAt: new Date(),
    });
  }

  // Serialize
  toJSON(): any {
    return {
      ...this.props,
      paragraphs: this.props.paragraphs.map(p => p.toJSON()),
    };
  }
}
