import { Citation } from '../value-objects/citation';

export interface FormatOptions {
  useAI: boolean;
  style: 'formal' | 'conversational' | 'technical' | 'legal';
  includeCitations: boolean;
  maxLength?: number;
  language: 'ro' | 'en' | 'auto';
}

export interface FormattedResponse {
  text: string;
  citations: Citation[];
  confidence: number;
  wasFormatted: boolean;
  formattingMethod: 'AI' | 'TEMPLATE' | 'PASSTHROUGH';
}

export interface IResponseFormatter {
  /**
   * Formulează răspunsul pe baza citatelor
   * @param query - Întrebarea utilizatorului
   * @param context - Textul citatelor concatenat
   * @param citations - Lista de citate
   * @param options - Opțiuni de formatare
   * @returns Răspunsul formatat
   */
  format(
    query: string,
    context: string,
    citations: Citation[],
    options: FormatOptions
  ): Promise<FormattedResponse>;
  
  /**
   * Formatare fără AI - folosește template-uri
   */
  formatTemplate(
    query: string,
    citations: Citation[],
    style: FormatOptions['style']
  ): FormattedResponse;
  
  /**
   * Generează disclaimer legal
   */
  generateDisclaimer(citations: Citation[], style: string): string;
}
