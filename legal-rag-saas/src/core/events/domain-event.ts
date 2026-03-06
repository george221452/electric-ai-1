// Domain Events - pentru comunicare între agregate și notificări

export interface DomainEvent {
  readonly type: string;
  readonly timestamp: Date;
  readonly aggregateId: string;
  readonly payload: Record<string, unknown>;
}

export class DocumentUploadedEvent implements DomainEvent {
  readonly type = 'DocumentUploaded';
  readonly timestamp = new Date();
  
  constructor(
    readonly aggregateId: string, // documentId
    readonly payload: {
      documentId: string;
      workspaceId: string;
      userId: string;
      fileName: string;
      fileSize: number;
      ragConfigId: string;
    }
  ) {}
}

export class DocumentProcessingStartedEvent implements DomainEvent {
  readonly type = 'DocumentProcessingStarted';
  readonly timestamp = new Date();
  
  constructor(
    readonly aggregateId: string,
    readonly payload: {
      documentId: string;
      workspaceId: string;
      startedAt: Date;
    }
  ) {}
}

export class DocumentProcessedEvent implements DomainEvent {
  readonly type = 'DocumentProcessed';
  readonly timestamp = new Date();
  
  constructor(
    readonly aggregateId: string,
    readonly payload: {
      documentId: string;
      workspaceId: string;
      pageCount: number;
      paragraphCount: number;
      processingTimeMs: number;
    }
  ) {}
}

export class DocumentProcessingFailedEvent implements DomainEvent {
  readonly type = 'DocumentProcessingFailed';
  readonly timestamp = new Date();
  
  constructor(
    readonly aggregateId: string,
    readonly payload: {
      documentId: string;
      workspaceId: string;
      error: string;
      failedAt: Date;
    }
  ) {}
}

export class ParagraphsExtractedEvent implements DomainEvent {
  readonly type = 'ParagraphsExtracted';
  readonly timestamp = new Date();
  
  constructor(
    readonly aggregateId: string, // documentId
    readonly payload: {
      documentId: string;
      paragraphCount: number;
      sampleParagraphs: Array<{ id: string; pageNumber: number }>;
    }
  ) {}
}

export class ParagraphsIndexedEvent implements DomainEvent {
  readonly type = 'ParagraphsIndexed';
  readonly timestamp = new Date();
  
  constructor(
    readonly aggregateId: string,
    readonly payload: {
      documentId: string;
      indexedCount: number;
      embeddingModel: string;
    }
  ) {}
}

export class QueryExecutedEvent implements DomainEvent {
  readonly type = 'QueryExecuted';
  readonly timestamp = new Date();
  
  constructor(
    readonly aggregateId: string, // query ID or user ID
    readonly payload: {
      queryId: string;
      userId: string;
      workspaceId: string;
      documentIds?: string[];
      queryText: string;
      resultCount: number;
      confidence: number;
      processingTimeMs: number;
    }
  ) {}
}

export class CitationValidatedEvent implements DomainEvent {
  readonly type = 'CitationValidated';
  readonly timestamp = new Date();
  
  constructor(
    readonly aggregateId: string,
    readonly payload: {
      citationId: string;
      paragraphId: string;
      confidence: number;
      isValid: boolean;
      validationMethod: string;
    }
  ) {}
}

export class TokenBalanceUpdatedEvent implements DomainEvent {
  readonly type = 'TokenBalanceUpdated';
  readonly timestamp = new Date();
  
  constructor(
    readonly aggregateId: string, // userId
    readonly payload: {
      userId: string;
      oldBalance: number;
      newBalance: number;
      change: number;
      reason: 'usage' | 'purchase' | 'refill' | 'bonus';
      description?: string;
    }
  ) {}
}

// Event Bus (simplu, pentru același proces)
export interface EventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>;
}

export class DomainEventBus {
  private handlers: Map<string, Array<EventHandler<DomainEvent>>> = new Map();

  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler as EventHandler<DomainEvent>);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];
    await Promise.all(handlers.map(h => h.handle(event)));
  }
}

// Singleton pentru aplicație
export const eventBus = new DomainEventBus();
