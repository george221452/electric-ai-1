import { IResponseFormatter, FormattedResponse, FormatOptions } from '@/core/services/response-formatter';
import { Citation } from '@/core/value-objects/citation';
import OpenAI from 'openai';

/**
 * AI Formatter - Formulează răspunsul clar din citate, fără halucinații
 * Folosește AI doar pentru reformulare, NU pentru informații noi
 */
export class AIResponseFormatter implements IResponseFormatter {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY required for AI formatter');
    }
    this.openai = new OpenAI({ apiKey });
  }

  async format(
    query: string,
    context: string,
    citations: Citation[],
    options: FormatOptions
  ): Promise<FormattedResponse> {
    if (citations.length === 0) {
      return {
        text: '❌ Nu am găsit informații relevante în documentele specificate pentru această întrebare.\n\nÎncercați să reformulați întrebarea sau verificați dacă documentele conțin informații despre acest subiect.',
        citations: [],
        confidence: 0,
        wasFormatted: true,
        formattingMethod: 'AI',
      };
    }

    // Construiesc promptul pentru AI - strict să folosească DOAR informațiile din citate
    const citationsText = citations.map((c, i) => 
      `[${i + 1}] ${c.documentName} (Pag. ${c.pageNumber}): "${c.text.substring(0, 800)}"`
    ).join('\n\n');

    const systemPrompt = `Ești un asistent juridic/tehnic care formulează răspunsuri clare bazate EXCLUSIV pe documentele furnizate.

REGULI STRICTE:
1. Folosește DOAR informațiile din citatele furnizate
2. NU adăuga informații care nu sunt în citate
3. NU presupune - dacă nu știi, spune că nu e în documente
4. Formulează răspunsul clar și concis în română
5. Menționează articolele/paginile exacte ca surse
6. Dacă informația nu e completă, spune ce lipsește`;

    const userPrompt = `ÎNTREBARE: "${query}"

CITATE DIN DOCUMENT (folosește doar aceste informații):
${citationsText}

FORMULEAZĂ RĂSPUNSUL:
1. Răspunde clar la întrebare
2. Citează sursele (articolul/pagina)
3. Dacă nu e suficientă informație, spune explicit`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Model rapid și ieftin
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Low temperature = mai puțin creativ, mai exact
        max_tokens: 500,
      });

      const formulatedAnswer = completion.choices[0].message.content || 
        'Nu s-a putut formula răspunsul.';

      // Construiesc răspunsul final cu sursele
      const lines: string[] = [];
      lines.push('📝 RĂSPUNS:');
      lines.push('');
      lines.push(formulatedAnswer);
      lines.push('');
      lines.push('─'.repeat(60));
      lines.push('');
      lines.push('📚 SURSE (citate exacte din document):');
      lines.push('');

      citations.forEach((c, i) => {
        const ref = c.articleNumber 
          ? `Art. ${c.articleNumber}`
          : `Pag. ${c.pageNumber}`;
        lines.push(`${i + 1}. [${ref}] ${c.documentName}`);
        lines.push(`   "${c.text.substring(0, 150)}..."`);
        lines.push('');
      });

      return {
        text: lines.join('\n'),
        citations,
        confidence: Math.round(
          citations.reduce((sum, c) => sum + c.confidence, 0) / citations.length
        ),
        wasFormatted: true,
        formattingMethod: 'AI',
      };

    } catch (error) {
      // Fallback la formatul passthrough dacă AI eșuează
      console.error('AI formatting failed:', error);
      return this.fallbackFormat(query, citations);
    }
  }

  private fallbackFormat(query: string, citations: Citation[]): FormattedResponse {
    const lines: string[] = [];
    lines.push('📝 RĂSPUNS (bazat pe documente):');
    lines.push('');
    lines.push('Conform documentelor găsite:');
    lines.push('');

    citations.forEach((c, i) => {
      const ref = c.articleNumber 
        ? `Art. ${c.articleNumber}`
        : `Pag. ${c.pageNumber}`;
      lines.push(`${i + 1}. [${ref}] "${c.text.substring(0, 200)}..."`);
      lines.push('');
    });

    return {
      text: lines.join('\n'),
      citations,
      confidence: 75,
      wasFormatted: false,
      formattingMethod: 'PASSTHROUGH',
    };
  }

  /**
   * Format template pentru când AI nu e disponibil
   */
  formatTemplate(
    query: string,
    citations: Citation[],
    style: FormatOptions['style']
  ): FormattedResponse {
    return this.fallbackFormat(query, citations);
  }

  /**
   * Generează disclaimer legal
   */
  generateDisclaimer(citations: Citation[], style: string): string {
    return '⚠️ Informațiile sunt bazate exclusiv pe documentele analizate și nu constituie consultanță juridică profesională.';
  }
}
