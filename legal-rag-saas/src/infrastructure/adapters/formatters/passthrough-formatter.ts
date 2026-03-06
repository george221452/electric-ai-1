import { IResponseFormatter, FormattedResponse, FormatOptions } from '@/core/services/response-formatter';
import { Citation } from '@/core/value-objects/citation';

/**
 * Smart Formatter - Extrage răspunsul relevant și arată sursa clar
 * 100% acuratețe - citează exact din document
 */
export class PassthroughResponseFormatter implements IResponseFormatter {
  async format(
    query: string,
    context: string,
    citations: Citation[],
    options: FormatOptions
  ): Promise<FormattedResponse> {
    return this.formatTemplate(query, citations, options.style);
  }

  formatTemplate(
    query: string,
    citations: Citation[],
    style: FormatOptions['style']
  ): FormattedResponse {
    if (citations.length === 0) {
      return {
        text: '❌ Nu am găsit informații relevante în documentele specificate.\n\nÎncercați să:\n• Reformulați întrebarea cu alți termeni\n• Verificați dacă documentele conțin informații despre acest subiect',
        citations: [],
        confidence: 0,
        wasFormatted: false,
        formattingMethod: 'PASSTHROUGH',
      };
    }

    const lines: string[] = [];
    
    // Find the most relevant sentence from the first citation
    const mainCitation = citations[0];
    const relevantSentence = this.extractRelevantSentence(query, mainCitation.text);
    
    // RĂSPUNSUL CLAR (primul citat cel mai relevant)
    lines.push('📝 RĂSPUNS:');
    lines.push('');
    lines.push(`"${relevantSentence}"`);
    lines.push('');
    
    // SURSA
    const ref = mainCitation.articleNumber 
      ? `📍 Articolul ${mainCitation.articleNumber}${mainCitation.paragraphLetter ? ` alineatul ${mainCitation.paragraphLetter}` : ''}`
      : `📍 Pagina ${mainCitation.pageNumber}`;
    
    lines.push(`Sursă: ${mainCitation.documentName}`);
    lines.push(`${ref} (Confidence: ${mainCitation.confidence}%)`);
    lines.push('');
    
    // Buton "Vezi mai mult" - context complet
    if (citations.length > 1 || mainCitation.text.length > relevantSentence.length + 50) {
      lines.push('─'.repeat(60));
      lines.push('');
      lines.push('📄 CONTEX COMPLET (toate paragrafele găsite):');
      lines.push('');
      
      citations.forEach((citation, index) => {
        const citationRef = citation.articleNumber 
          ? `Art. ${citation.articleNumber}`
          : `Pag. ${citation.pageNumber}`;
        
        lines.push(`${index + 1}. [${citationRef}] "${citation.text.substring(0, 200)}${citation.text.length > 200 ? '...' : ''}"`);
        lines.push('');
      });
    }

    return {
      text: lines.join('\n'),
      citations,
      confidence: Math.round(
        citations.reduce((sum, c) => sum + c.confidence, 0) / citations.length
      ),
      wasFormatted: true,
      formattingMethod: 'PASSTHROUGH',
    };
  }
  
  /**
   * Extrage propoziția cea mai relevantă pentru query
   */
  private extractRelevantSentence(query: string, text: string): string {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    if (sentences.length === 1) {
      return text.substring(0, 300) + (text.length > 300 ? '...' : '');
    }
    
    // Normalize query for matching
    const queryWords = query.toLowerCase()
      .replace(/[ăâ]/g, 'a')
      .replace(/[î]/g, 'i')
      .replace(/[șş]/g, 's')
      .replace(/[țţ]/g, 't')
      .split(/\s+/)
      .filter(w => w.length > 3);
    
    // Score each sentence
    let bestSentence = sentences[0];
    let bestScore = 0;
    
    for (const sentence of sentences) {
      const sentenceNorm = sentence.toLowerCase()
        .replace(/[ăâ]/g, 'a')
        .replace(/[î]/g, 'i')
        .replace(/[șş]/g, 's')
        .replace(/[țţ]/g, 't');
      
      let score = 0;
      for (const word of queryWords) {
        if (sentenceNorm.includes(word)) {
          score += 1;
        }
      }
      
      // Bonus for sentences with numbers (often contain specifications)
      if (/\d+/.test(sentence)) {
        score += 0.5;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestSentence = sentence;
      }
    }
    
    return bestSentence.trim().substring(0, 300) + (bestSentence.length > 300 ? '...' : '');
  }

  generateDisclaimer(citations: Citation[]): string {
    const hasObligations = citations.some(c => 
      /\b(trebuie|obligatoriu|obligat|se va)\b/i.test(c.text)
    );
    
    const hasProhibitions = citations.some(c =>
      /\b(interzis|nu este permis|este interzis)\b/i.test(c.text)
    );

    if (hasObligations && hasProhibitions) {
      return '⚠️ Textele de mai sus includ atât obligații cât și interdicții. Consultați documentul original pentru context complet.';
    }
    
    if (hasObligations) {
      return '⚠️ Textele includ obligații legale. Verificați conformitatea cu un expert.';
    }
    
    if (hasProhibitions) {
      return '⚠️ Textele includ interdicții. Nerespectarea poate atrage sancțiuni.';
    }

    return 'ℹ️ Textele sunt extrase ad-literam din documentele sursă.';
  }

  private calculateAverageConfidence(citations: Citation[]): number {
    if (citations.length === 0) return 0;
    return citations.reduce((sum, c) => sum + c.confidence, 0) / citations.length;
  }
}
