import { IResponseFormatter, FormattedResponse, FormatOptions } from '@/core/services/response-formatter';
import { Citation } from '@/core/value-objects/citation';

export class TemplateResponseFormatter implements IResponseFormatter {
  async format(
    query: string,
    context: string,
    citations: Citation[],
    options: FormatOptions
  ): Promise<FormattedResponse> {
    if (options.useAI) {
      // Delegate to AI formatter
      throw new Error('AI formatting not implemented in template formatter');
    }

    return this.formatTemplate(query, citations, options.style);
  }

  formatTemplate(
    query: string,
    citations: Citation[],
    style: FormatOptions['style']
  ): FormattedResponse {
    const formattedText = this.buildResponseText(citations, style);

    return {
      text: formattedText,
      citations,
      confidence: this.calculateAverageConfidence(citations),
      wasFormatted: true,
      formattingMethod: 'TEMPLATE',
    };
  }

  private buildResponseText(citations: Citation[], style: FormatOptions['style']): string {
    if (citations.length === 0) {
      return 'Nu am găsit informații relevante.';
    }

    if (citations.length === 1) {
      return this.formatSingleCitation(citations[0], style);
    }

    return this.formatMultipleCitations(citations, style);
  }

  private formatSingleCitation(citation: Citation, style: FormatOptions['style']): string {
    const prefix = this.getPrefixForStyle(style);
    const ref = citation.toShortReference();
    
    switch (style) {
      case 'legal':
        return `Conform ${ref}: "${citation.text}"`;
      case 'technical':
        return `Referință: ${ref}\n\n${citation.text}`;
      case 'conversational':
        return `${prefix} ${ref}: ${citation.text}`;
      case 'formal':
      default:
        return `${prefix} documentului "${citation.documentName}" (${ref}):\n\n${citation.text}`;
    }
  }

  private formatMultipleCitations(citations: Citation[], style: FormatOptions['style']): string {
    const parts: string[] = [];

    switch (style) {
      case 'legal':
        parts.push('Conform prevederilor citate:');
        citations.forEach((c, i) => {
          parts.push(`\n[${i + 1}] ${c.toShortReference()}: "${c.text}"`);
        });
        break;

      case 'technical':
        parts.push('Referințe identificate:');
        citations.forEach((c, i) => {
          parts.push(`\n[${i + 1}] ${c.documentName}, ${c.toShortReference()}`);
          parts.push(c.text);
        });
        break;

      case 'conversational':
        parts.push('Am găsit următoarele informații:');
        citations.forEach((c, i) => {
          parts.push(`\n${i + 1}. Conform ${c.documentName} (${c.toShortReference()}): ${c.text}`);
        });
        break;

      case 'formal':
      default:
        parts.push('Pe baza documentelor analizate, identificăm următoarele prevederi:');
        citations.forEach((c, i) => {
          parts.push(`\n[${i + 1}] ${c.documentName}, ${c.toShortReference()}:`);
          parts.push(c.text);
        });
        break;
    }

    return parts.join('\n');
  }

  private getPrefixForStyle(style: FormatOptions['style']): string {
    switch (style) {
      case 'legal':
        return 'Conform';
      case 'technical':
        return 'Conform specificațiilor din';
      case 'conversational':
        return 'Conform';
      case 'formal':
      default:
        return 'Conform';
    }
  }

  generateDisclaimer(citations: Citation[], style: string): string {
    const hasObligations = citations.some(c => 
      /\b(trebuie|obligatoriu|obligat|se va|must|shall|required)\b/i.test(c.text)
    );
    
    const hasProhibitions = citations.some(c =>
      /\b(interzis|nu este permis|este interzis|prohibited|forbidden|not allowed)\b/i.test(c.text)
    );

    if (style === 'legal' || style === 'formal') {
      if (hasObligations && hasProhibitions) {
        return 'Textul de mai sus conține atât obligații cât și interdicții legale. Pentru o interpretare juridică completă și aplicarea în cazuri specifice, se recomandă consultarea unui expert în domeniu.';
      }
      
      if (hasObligations) {
        return 'Textul citează obligații legale. Pentru verificarea conformității complete și a tuturor condițiilor aplicabile, se recomandă consultarea unui expert.';
      }
      
      if (hasProhibitions) {
        return 'Textul citează interdicții legale. Nerespectarea acestora poate atrage sancțiuni conform legislației în vigoare.';
      }

      return 'Informațiile prezentate sunt extrase ad-literam din documentele sursă indicate. Pentru interpretări sau aplicări în situații specifice, consultați documentul original.';
    }

    if (hasObligations || hasProhibitions) {
      return 'Aceste informații au caracter orientativ. Pentru decizii importante, consultați un expert.';
    }

    return 'Informații extrase din documentele specificate.';
  }

  private calculateAverageConfidence(citations: Citation[]): number {
    if (citations.length === 0) return 0;
    return citations.reduce((sum, c) => sum + c.confidence, 0) / citations.length;
  }
}
