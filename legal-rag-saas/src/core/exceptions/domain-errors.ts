// Domain Exceptions - pentru errori specifice domeniului

export class DomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class DocumentNotFoundError extends DomainError {
  constructor(documentId: string) {
    super(`Document with ID ${documentId} not found`, 'DOCUMENT_NOT_FOUND');
    this.name = 'DocumentNotFoundError';
  }
}

export class ParagraphNotFoundError extends DomainError {
  constructor(paragraphId: string) {
    super(`Paragraph with ID ${paragraphId} not found`, 'PARAGRAPH_NOT_FOUND');
    this.name = 'ParagraphNotFoundError';
  }
}

export class WorkspaceNotFoundError extends DomainError {
  constructor(workspaceId: string) {
    super(`Workspace with ID ${workspaceId} not found`, 'WORKSPACE_NOT_FOUND');
    this.name = 'WorkspaceNotFoundError';
  }
}

export class InvalidStateTransitionError extends DomainError {
  constructor(currentState: string, attemptedAction: string) {
    super(
      `Cannot perform '${attemptedAction}' from state '${currentState}'`,
      'INVALID_STATE_TRANSITION'
    );
    this.name = 'InvalidStateTransitionError';
  }
}

export class CitationValidationError extends DomainError {
  constructor(message: string) {
    super(message, 'CITATION_VALIDATION_ERROR');
    this.name = 'CitationValidationError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Access denied') {
    super(message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class QuotaExceededError extends DomainError {
  constructor(resource: string) {
    super(`Quota exceeded for ${resource}`, 'QUOTA_EXCEEDED');
    this.name = 'QuotaExceededError';
  }
}

export class ProcessingError extends DomainError {
  constructor(message: string, public readonly originalError?: Error) {
    super(message, 'PROCESSING_ERROR');
    this.name = 'ProcessingError';
  }
}

export class InvalidQueryError extends DomainError {
  constructor(message: string) {
    super(message, 'INVALID_QUERY');
    this.name = 'InvalidQueryError';
  }
}

export class EmbeddingError extends DomainError {
  constructor(message: string) {
    super(message, 'EMBEDDING_ERROR');
    this.name = 'EmbeddingError';
  }
}
