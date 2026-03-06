import { IRAGEngine, SearchContext, BoostConfiguration } from '@/core/services/rag-engine';
import { Query, QueryIntent } from '@/core/value-objects/query';
import { SearchResult } from '@/core/value-objects/search-result';
import { Paragraph } from '@/core/entities/paragraph';
import { IEmbeddingService } from '../embedding/embedding-service';
import { QdrantClient } from '@qdrant/js-client-rest';

interface QdrantSearchResult {
  id: string;
  score: number;
  payload: {
    documentId: string;
    workspaceId: string;
    content: string;
    pageNumber: number;
    paragraphNumber: number;
    isObligation?: boolean;
    isProhibition?: boolean;
    isDefinition?: boolean;
    articleNumber?: string;
    paragraphLetter?: string;
    keywords: string[];
  };
}

export class LegalRAGEngine implements IRAGEngine {
  private readonly collectionName = 'legal_paragraphs';

  constructor(
    private qdrantClient: QdrantClient,
    private embeddingService: IEmbeddingService,
    private boostConfig?: BoostConfiguration,
  ) {}

  async search(query: Query, context: SearchContext): Promise<SearchResult[]> {
    // 1. Generare embedding
    const queryEmbedding = await this.embeddingService.embed(query.text);

    // 2. Căutare în Qdrant
    const searchResults = (await this.qdrantClient.search(this.collectionName, {
      vector: queryEmbedding,
      limit: context.maxResults * 2,
      with_payload: true,
      score_threshold: context.minScore * 0.8,
      filter: this.buildFilter(context),
    })) as unknown as QdrantSearchResult[];

    // 3. Transformare în SearchResult
    let results = searchResults.map(r => this.toSearchResult(r));

    // 4. Boosting semantic legal
    results = this.applyLegalBoosting(results, query);

    // 5. Filtrare și sortare finală
    return results
      .filter(r => r.score >= context.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, context.maxResults);
  }

  async hybridSearch(query: Query, context: SearchContext): Promise<SearchResult[]> {
    // Vector search with lower threshold for better recall
    const vectorResults = await this.search(query, {
      ...context,
      maxResults: context.maxResults * 4,
      minScore: 0.2, // Lower threshold for hybrid search
    });

    // Keyword boosting - give more weight to direct keyword matches
    const keywords = query.extractKeywords();
    const queryLower = query.text.toLowerCase();
    
    const keywordResults = vectorResults.map(r => {
      let boost = 0;
      const contentLower = r.content.toLowerCase();
      
      // Direct keyword matching with higher boost
      keywords.forEach(keyword => {
        if (contentLower.includes(keyword.toLowerCase())) {
          boost += 0.1; // Higher boost per keyword match
        }
      });
      
      // Special boosts for legal/technical terms
      if (queryLower.includes('protectie') && contentLower.includes('protectie')) {
        boost += 0.15;
      }
      if (queryLower.includes('priza') || queryLower.includes('prize')) {
        if (contentLower.includes('priza') || contentLower.includes('prize')) {
          boost += 0.2;
        }
      }
      if (queryLower.includes('obligatoriu') || queryLower.includes('obligatorii')) {
        if (contentLower.includes('trebuie') || contentLower.includes('obligatoriu')) {
          boost += 0.15;
        }
      }
      
      // Boost for specific technical terms
      const technicalTerms = ['ddr', 'diferential', '30 ma', '30mA', 'IΔN'];
      technicalTerms.forEach(term => {
        if (queryLower.includes(term.toLowerCase()) || 
            contentLower.includes(term.toLowerCase())) {
          boost += 0.1;
        }
      });
      
      if (boost > 0) {
        return r.boostScore(Math.min(boost, 0.5));
      }
      return r;
    });

    // Rerank combinând ambele scoruri
    const reranked = keywordResults
      .sort((a, b) => b.score - a.score)
      .slice(0, context.maxResults);

    return reranked;
  }

  private applyLegalBoosting(results: SearchResult[], query: Query): SearchResult[] {
    const intent = query.detectQueryIntent();
    const keywords = query.extractKeywords();
    const articleRefs = query.extractArticleReferences();

    return results.map(result => {
      let boostedScore = result.score;

      // Boost pentru obligații
      if (intent === QueryIntent.OBLIGATION && result.isObligation()) {
        boostedScore += 0.2;
      }

      // Boost pentru interdicții
      if (intent === QueryIntent.PROHIBITION && result.isProhibition()) {
        boostedScore += 0.2;
      }

      // Boost pentru definiții
      if (intent === QueryIntent.DEFINITION && result.isDefinition()) {
        boostedScore += 0.25;
      }

      // Boost pentru matching cuvinte cheie
      const keywordMatches = result.matchesKeywords(keywords);
      boostedScore += keywordMatches * 0.03;

      // Boost pentru referințe la articole
      if (articleRefs.length > 0 && result.metadata.articleNumber) {
        if (articleRefs.includes(result.metadata.articleNumber)) {
          boostedScore += 0.3; // Boost masiv pentru articol specific menționat
        }
      }

      // Boost config custom
      if (this.boostConfig?.customBoosts) {
        for (const boost of this.boostConfig.customBoosts) {
          if (boost.pattern.test(result.content)) {
            boostedScore += boost.boost;
          }
        }
      }

      return result.boostScore(Math.min(boostedScore - result.score, 0.3));
    });
  }

  private buildFilter(context: SearchContext): object {
    const must: any[] = [
      { key: 'workspaceId', match: { value: context.workspaceId } },
    ];

    if (context.documentIds && context.documentIds.length > 0) {
      must.push({
        key: 'documentId',
        match: { any: context.documentIds },
      });
    }

    return { must };
  }

  private toSearchResult(result: QdrantSearchResult): SearchResult {
    return new SearchResult({
      paragraphId: result.id,
      documentId: result.payload.documentId,
      content: result.payload.content,
      score: result.score,
      metadata: {
        pageNumber: result.payload.pageNumber,
        paragraphNumber: result.payload.paragraphNumber,
        isObligation: result.payload.isObligation,
        isProhibition: result.payload.isProhibition,
        isDefinition: result.payload.isDefinition,
        articleNumber: result.payload.articleNumber,
        paragraphLetter: result.payload.paragraphLetter,
        keywords: result.payload.keywords || [],
      },
    });
  }

  async indexParagraphs(paragraphs: Paragraph[], documentId: string): Promise<void> {
    const points = paragraphs.map(p => ({
      id: p.id,
      vector: p.embedding!,
      payload: {
        documentId: p.documentId,
        workspaceId: '', // Setat la query time
        content: p.content.substring(0, 2000),
        pageNumber: p.metadata.pageNumber,
        paragraphNumber: p.metadata.paragraphNumber,
        isObligation: p.isObligation(),
        isProhibition: p.isProhibition(),
        isDefinition: p.isDefinition(),
        articleNumber: p.metadata.articleNumber,
        paragraphLetter: p.metadata.paragraphLetter,
        keywords: p.metadata.keywords,
      },
    }));

    // Upsert în batch-uri
    const batchSize = 100;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      await this.qdrantClient.upsert(this.collectionName, {
        points: batch,
      });
    }
  }

  async removeDocument(documentId: string): Promise<void> {
    await this.qdrantClient.delete(this.collectionName, {
      filter: {
        must: [{ key: 'documentId', match: { value: documentId } }],
      },
    });
  }

  async updateParagraph(paragraph: Paragraph): Promise<void> {
    if (!paragraph.hasEmbedding()) {
      throw new Error('Paragraph must have embedding to update');
    }

    await this.qdrantClient.upsert(this.collectionName, {
      points: [{
        id: paragraph.id,
        vector: paragraph.embedding!,
        payload: {
          documentId: paragraph.documentId,
          workspaceId: '',
          content: paragraph.content.substring(0, 2000),
          pageNumber: paragraph.metadata.pageNumber,
          paragraphNumber: paragraph.metadata.paragraphNumber,
          isObligation: paragraph.isObligation(),
          isProhibition: paragraph.isProhibition(),
          isDefinition: paragraph.isDefinition(),
          articleNumber: paragraph.metadata.articleNumber,
          paragraphLetter: paragraph.metadata.paragraphLetter,
          keywords: paragraph.metadata.keywords,
        },
      }],
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.qdrantClient.getCollections();
      return true;
    } catch {
      return false;
    }
  }
}
