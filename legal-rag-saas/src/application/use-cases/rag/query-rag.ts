import { Query, QueryIntent } from '@/core/value-objects/query';
import { Citation } from '@/core/value-objects/citation';
import { SearchResult } from '@/core/value-objects/search-result';
import { IRAGEngine } from '@/core/services/rag-engine';
import { ICitationValidator, ValidationResult } from '@/core/services/citation-validator';
import { IResponseFormatter, FormatOptions } from '@/core/services/response-formatter';
import { IDocumentRepository } from '@/core/repositories/document-repository';
import { IWorkspaceRepository } from '@/core/repositories/workspace-repository';
import { UnauthorizedError, InvalidQueryError, DocumentNotFoundError } from '@/core/exceptions/domain-errors';
import { eventBus, QueryExecutedEvent } from '@/core/events/domain-event';
import { PrismaClient } from '@prisma/client';

// DTOs
export interface QueryRAGRequest {
  query: string;
  workspaceId: string;
  documentIds?: string[];
  userId: string;
  options?: {
    maxParagraphs?: number;
    minScore?: number;
    strictMode?: boolean;
    useAIFormatting?: boolean;
    style?: 'formal' | 'conversational' | 'technical' | 'legal';
    language?: 'ro' | 'en' | 'auto';
  };
}

export interface QueryRAGResponse {
  answer: string;
  citations: Citation[];
  confidence: number;
  processingTimeMs: number;
  disclaimer: string;
  queryIntent: QueryIntent;
  resultsCount: number;
  wasFormatted: boolean;
}

export interface QueryRAGMetadata {
  queryId: string;
  paragraphIds: string[];
  validationResults: Map<string, ValidationResult>;
}

export class QueryRAGUseCase {
  private readonly prisma: PrismaClient;
  
  constructor(
    private readonly ragEngine: IRAGEngine,
    private readonly citationValidator: ICitationValidator,
    private readonly responseFormatter: IResponseFormatter,
    private readonly documentRepo: IDocumentRepository,
    private readonly paragraphRepo: any,
    private readonly workspaceRepo: IWorkspaceRepository,
  ) {
    this.prisma = new PrismaClient();
  }

  async execute(request: QueryRAGRequest): Promise<QueryRAGResponse> {
    const startTime = Date.now();
    const queryId = crypto.randomUUID();

    try {
      // 1. Validare și construire Query (Value Object)
      const query = Query.create({
        text: request.query,
        workspaceId: request.workspaceId,
        documentIds: request.documentIds,
        options: {
          maxParagraphs: request.options?.maxParagraphs ?? 5,
          minScore: request.options?.minScore ?? 0.75,
          strictMode: request.options?.strictMode ?? true,
          useAIFormatting: request.options?.useAIFormatting ?? false,
          language: request.options?.language ?? 'auto',
        },
      });

      // 2. Verificare acces utilizator
      const hasAccess = await this.workspaceRepo.userHasAccess(
        request.userId, 
        request.workspaceId
      );
      
      if (!hasAccess) {
        throw new UnauthorizedError('No access to workspace');
      }

      // 3. Validare documente specificate (dacă există)
      if (query.documentIds) {
        await this.validateDocumentAccess(query.documentIds, request.workspaceId);
      }

      // 4. RETRIEVAL - Căutare semantică fără AI
      const searchResults = await this.performRetrieval(query);

      // 5. VALIDARE - Verificare citate
      const { citations, validationResults } = await this.validateCitations(
        searchResults,
        query
      );

      // 6. Verificare rezultate suficiente
      if (citations.length === 0) {
        return this.createEmptyResponse(startTime, query.detectQueryIntent());
      }

      // 7. GENERATION - Doar formulare (opțional AI)
      const formattedResponse = await this.formatResponse(
        query,
        citations,
        request.options
      );

      // 8. Publicare eveniment pentru analytics
      await this.publishQueryEvent(queryId, request, citations, startTime);

      // 9. Construire răspuns final
      return {
        answer: formattedResponse.text,
        citations,
        confidence: this.calculateConfidence(citations, validationResults),
        processingTimeMs: Date.now() - startTime,
        disclaimer: this.generateDisclaimer(citations, query),
        queryIntent: query.detectQueryIntent(),
        resultsCount: citations.length,
        wasFormatted: formattedResponse.wasFormatted,
      };

    } catch (error) {
      console.error(`[QueryRAG:${queryId}] Error:`, error);
      throw error;
    }
  }

  private async validateDocumentAccess(
    documentIds: string[],
    workspaceId: string
  ): Promise<void> {
    const documents = await this.documentRepo.findForRAG(workspaceId, documentIds);
    const foundIds = new Set(documents.map(d => d.id));
    
    const missingIds = documentIds.filter(id => !foundIds.has(id));
    if (missingIds.length > 0) {
      throw new DocumentNotFoundError(missingIds[0]);
    }
  }

  private async performRetrieval(query: Query): Promise<SearchResult[]> {
    // Use REAL vector search via RAG Engine
    try {
      const searchResults = await this.ragEngine.search(query, {
        workspaceId: query.workspaceId,
        documentIds: query.documentIds,
        maxResults: query.options.maxParagraphs * 5, // Get more for filtering
        minScore: 0.3, // Lower threshold for better recall
      });
      
      console.log(`[QueryRAG] Vector search found ${searchResults.length} paragraphs`);
      
      // If we have too few results, try hybrid search for better recall
      if (searchResults.length < 3) {
        console.log('[QueryRAG] Trying hybrid search for better recall...');
        const hybridResults = await this.ragEngine.hybridSearch(query, {
          workspaceId: query.workspaceId,
          documentIds: query.documentIds,
          maxResults: query.options.maxParagraphs * 5,
          minScore: 0.25, // Even lower for hybrid
        });
        return hybridResults;
      }
      
      // If semantic search returns results but they don't contain key terms, 
      // supplement with keyword search from PostgreSQL
      const queryLower = query.text.toLowerCase();
      const keyTerms = ['priza', 'prize', 'dispozitiv', 'protectie', 'obligatoriu', 'ddr', 'diferential'];
      const hasKeyTermsInResults = searchResults.some(r => 
        keyTerms.some(term => r.content.toLowerCase().includes(term))
      );
      
      if (!hasKeyTermsInResults && keyTerms.some(t => queryLower.includes(t))) {
        console.log('[QueryRAG] Supplementing with keyword search from PostgreSQL...');
        
        // Get document IDs for this workspace
        const documents = await this.prisma.document.findMany({
          where: { workspaceId: query.workspaceId },
          select: { id: true }
        });
        const documentIds = documents.map(d => d.id);
        
        // Search paragraphs containing keywords
        const keywordParagraphs = await this.prisma.paragraph.findMany({
          where: {
            documentId: { in: documentIds },
            OR: [
              { content: { contains: 'priz', mode: 'insensitive' } },
              { content: { contains: 'DDR', mode: 'insensitive' } },
              { content: { contains: 'diferential', mode: 'insensitive' } },
              { content: { contains: 'dispozitiv de protectie', mode: 'insensitive' } },
            ]
          },
          take: 10,
        });
        
        console.log(`[QueryRAG] Keyword search found ${keywordParagraphs.length} paragraphs`);
        
        // Convert to SearchResult format and merge
        const { Paragraph } = require('@/core/entities/paragraph');
        const convertedResults = keywordParagraphs.map((p: any) => new SearchResult({
          paragraphId: p.id,
          documentId: p.documentId,
          content: p.content,
          score: 0.35, // Assign a base score for keyword matches
          metadata: {
            pageNumber: p.pageNumber,
            paragraphNumber: p.paragraphNumber,
            isObligation: p.isObligation,
            isProhibition: p.isProhibition,
            isDefinition: p.isDefinition,
            articleNumber: p.articleNumber,
            paragraphLetter: p.paragraphLetter,
            keywords: p.keywords || [],
          },
        }));
        
        // Merge and deduplicate
        const combined = [...searchResults];
        for (const kr of convertedResults) {
          if (!combined.some(r => r.paragraphId === kr.paragraphId)) {
            combined.push(kr);
          }
        }
        
        return combined.slice(0, query.options.maxParagraphs * 5);
      }
      
      return searchResults;
    } catch (error) {
      console.error('[QueryRAG] Vector search failed:', error);
      // Fallback: return empty if vector DB unavailable
      return [];
    }
  }

  private filterByIntent(
    results: SearchResult[],
    intent: QueryIntent
  ): SearchResult[] {
    if (intent === QueryIntent.OBLIGATION) {
      // Boost pentru obligații
      return results
        .map(r => r.isObligation() ? r.boostScore(0.15) : r)
        .sort((a, b) => b.score - a.score);
    }

    if (intent === QueryIntent.PROHIBITION) {
      return results
        .map(r => r.isProhibition() ? r.boostScore(0.15) : r)
        .sort((a, b) => b.score - a.score);
    }

    if (intent === QueryIntent.DEFINITION) {
      return results
        .map(r => r.isDefinition() ? r.boostScore(0.2) : r)
        .sort((a, b) => b.score - a.score);
    }

    return results;
  }

  private async validateCitations(
    results: SearchResult[],
    query: Query
  ): Promise<{ citations: Citation[]; validationResults: Map<string, ValidationResult> }> {
    const citations: Citation[] = [];
    const validationResults = new Map<string, ValidationResult>();

    // Obține document names pentru citate
    const documentIds = Array.from(new Set(results.map(r => r.documentId)));
    const documents = await Promise.all(
      documentIds.map(id => this.documentRepo.findById(id))
    );
    const documentMap = new Map(
      documents.filter(d => d !== null).map(d => [d!.id, d!])
    );

    for (const result of results) {
      const document = documentMap.get(result.documentId);
      if (!document) continue;

      // Creare paragraf temporar pentru validare
      const paragraph = result.toParagraph();

      // Validare strictă + relevance scoring
      const validation = await this.citationValidator.validate(
        result.content,
        paragraph,
        query.text  // Pass query for relevance calculation
      );

      validationResults.set(result.paragraphId, validation);

      // FILTERING: Accept paragraphs with reasonable relevance
      // Lower threshold for semantic search to work better
      const isRelevant = validation.relevanceScore >= 0.01; // Very low threshold for semantic search
      
      if (validation.isValid && isRelevant) {
        const citation = new Citation({
          paragraphId: result.paragraphId,
          documentId: result.documentId,
          documentName: document.name,
          pageNumber: result.metadata.pageNumber,
          paragraphNumber: result.metadata.paragraphNumber,
          text: result.content,
          confidence: validation.confidence,
          articleNumber: result.metadata.articleNumber || undefined,
          paragraphLetter: result.metadata.paragraphLetter || undefined,
        });

        citations.push(citation);
      }

      // Oprim când avem suficiente citate
      if (citations.length >= query.options.maxParagraphs) {
        break;
      }
    }

    return { citations, validationResults };
  }

  private async formatResponse(
    query: Query,
    citations: Citation[],
    options?: QueryRAGRequest['options']
  ) {
    const context = citations
      .map((c, idx) => `[${idx + 1}] ${c.text}`)
      .join('\n\n');

    const formatOptions: FormatOptions = {
      useAI: options?.useAIFormatting ?? false,
      style: options?.style ?? 'formal',
      includeCitations: true,
      language: options?.language ?? 'auto',
    };

    return this.responseFormatter.format(
      query.text,
      context,
      citations,
      formatOptions
    );
  }

  private createEmptyResponse(startTime: number, intent: QueryIntent): QueryRAGResponse {
    const intentMessages: Record<QueryIntent, string> = {
      [QueryIntent.GENERAL]: 'Nu am găsit informații relevante în documentele specificate.',
      [QueryIntent.OBLIGATION]: 'Nu am găsit obligații specifice referitoare la această întrebare.',
      [QueryIntent.PROHIBITION]: 'Nu am găsit interdicții specifice referitoare la această întrebare.',
      [QueryIntent.DEFINITION]: 'Nu am găsit definiții pentru termenul căutat în documentele specificate.',
      [QueryIntent.PROCEDURE]: 'Nu am găsit proceduri specifice pentru această operațiune.',
    };

    return {
      answer: intentMessages[intent],
      citations: [],
      confidence: 0,
      processingTimeMs: Date.now() - startTime,
      disclaimer: 'Nu s-au găsit surse pentru întrebarea dumneavoastră.',
      queryIntent: intent,
      resultsCount: 0,
      wasFormatted: false,
    };
  }

  private calculateConfidence(
    citations: Citation[],
    validationResults: Map<string, ValidationResult>
  ): number {
    if (citations.length === 0) return 0;
    
    // Calculate combined score: validation accuracy (60%) + relevance (40%)
    const scores = citations.map(citation => {
      const validation = validationResults.get(citation.paragraphId);
      const validationScore = citation.confidence / 100; // 0-1
      const relevanceScore = validation?.relevanceScore ?? 0; // 0-1
      
      // Combined: 60% validation + 40% relevance
      return (validationScore * 0.6) + (relevanceScore * 0.4);
    });
    
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    return Math.round(avgScore * 100); // Back to 0-100
  }

  private generateDisclaimer(citations: Citation[], query: Query): string {
    const hasObligations = citations.some(c => 
      /\b(trebuie|obligatoriu|obligat|se va)\b/i.test(c.text)
    );
    
    const hasProhibitions = citations.some(c =>
      /\b(interzis|nu este permis|este interzis)\b/i.test(c.text)
    );

    if (hasObligations && hasProhibitions) {
      return 'Textul conține atât obligații cât și interdicții legale. Pentru interpretare juridică completă, consultați un expert.';
    }
    
    if (hasObligations) {
      return 'Textul citează obligații legale. Pentru verificarea conformității, consultați un expert în domeniu.';
    }
    
    if (hasProhibitions) {
      return 'Textul citează interdicții legale. Nerespectarea poate atrage sancțiuni.';
    }

    return 'Textul este citat ad-literam din documentele sursă.';
  }

  private async publishQueryEvent(
    queryId: string,
    request: QueryRAGRequest,
    citations: Citation[],
    startTime: number
  ): Promise<void> {
    const event = new QueryExecutedEvent(queryId, {
      queryId,
      userId: request.userId,
      workspaceId: request.workspaceId,
      documentIds: request.documentIds,
      queryText: request.query,
      resultCount: citations.length,
      confidence: citations.length > 0 
        ? citations.reduce((s, c) => s + c.confidence, 0) / citations.length 
        : 0,
      processingTimeMs: Date.now() - startTime,
    });

    await eventBus.publish(event);
  }
}

// Extension method pentru SearchResult
declare module '@/core/value-objects/search-result' {
  interface SearchResult {
    toParagraph(): import('@/core/entities/paragraph').Paragraph;
  }
}

SearchResult.prototype.toParagraph = function() {
  const { Paragraph } = require('@/core/entities/paragraph');
  return Paragraph.reconstitute({
    id: this.paragraphId,
    documentId: this.documentId,
    content: this.content,
    metadata: {
      pageNumber: this.metadata.pageNumber,
      paragraphNumber: this.metadata.paragraphNumber,
      wordCount: this.content.split(/\s+/).length,
      charCount: this.content.length,
      keywords: this.metadata.keywords || [],
      isObligation: this.metadata.isObligation,
      isProhibition: this.metadata.isProhibition,
      isDefinition: this.metadata.isDefinition,
      articleNumber: this.metadata.articleNumber,
      paragraphLetter: this.metadata.paragraphLetter,
    },
    createdAt: new Date(),
  });
};
