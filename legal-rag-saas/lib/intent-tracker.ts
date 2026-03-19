/**
 * Intent Tracker - Tracks the main subject/intent of conversation
 * Ensures AI always responds to the original subject, not just clarifications
 */

export interface Intent {
  subject: string;      // Main subject (e.g., "selectivitate")
  action: string;       // What user wants (e.g., "cum se face")
  context: string[];    // Additional context
  originalQuestion: string;
}

export class IntentTracker {
  private intents: Map<string, Intent> = new Map();

  /**
   * Extract main intent from a question
   * Uses keyword extraction to identify the main subject
   */
  extractIntent(question: string): Intent {
    const lower = question.toLowerCase();
    
    // Extract the MAIN SUBJECT - the noun/phrase that is the focus
    // Remove common question words and extract the core subject
    const questionWords = ['cum', 'ce', 'cat', 'cand', 'unde', 'de ce', 'cine', 'care', 'se', 'sunt', 'este', 'face', 'fac', 'realizeaza'];
    let cleanedQuestion = lower;
    
    // Remove question words from start
    for (const qw of questionWords) {
      const regex = new RegExp(`^${qw}\\s*`, 'i');
      cleanedQuestion = cleanedQuestion.replace(regex, '');
    }
    
    // Remove punctuation
    cleanedQuestion = cleanedQuestion.replace(/[?.,!;:]/g, '');
    
    // Extract the main noun phrase (first 2-3 significant words, excluding small words)
    const words = cleanedQuestion.split(/\s+/).filter(w => w.length > 3);
    const subject = words.slice(0, 2).join(' ') || 'instalatii electrice';
    
    // Extract action (what user wants to know)
    const actions = [
      { pattern: /cum (se|se face|se realizeaza|fac)/, action: 'cum se face' },
      { pattern: /ce (este|sunt|inseamna)/, action: 'definitie' },
      { pattern: /cat(e|i|a)?/, action: 'valoare/cantitate' },
      { pattern: /unde/, action: 'locatie' },
      { pattern: /cand/, action: 'timp' },
      { pattern: /de ce/, action: 'explicatie' },
    ];

    let action = 'informatii';
    for (const a of actions) {
      if (a.pattern.test(lower)) {
        action = a.action;
        break;
      }
    }

    // Extract context (numbers, specific details)
    const context: string[] = [];
    
    // Look for numbers (3 tablouri, 10 mm, etc.)
    const numbers = question.match(/\d+\s*(mm|mm²|A|tablouri|tablou|circuite)/gi);
    if (numbers) {
      context.push(...numbers);
    }

    // Look for materials
    if (lower.includes('cupru')) context.push('cupru');
    if (lower.includes('aluminiu')) context.push('aluminiu');

    // Look for installation types
    if (lower.includes('interior')) context.push('instalatii interioare');
    if (lower.includes('exterior')) context.push('instalatii exterioare');

    return {
      subject,
      action,
      context,
      originalQuestion: question,
    };
  }

  /**
   * Store intent for a session
   */
  setIntent(sessionId: string, question: string): Intent {
    const intent = this.extractIntent(question);
    this.intents.set(sessionId, intent);
    return intent;
  }

  /**
   * Get stored intent
   */
  getIntent(sessionId: string): Intent | null {
    return this.intents.get(sessionId) || null;
  }

  /**
   * Update context with clarifications
   */
  updateContext(sessionId: string, clarification: string): void {
    const intent = this.intents.get(sessionId);
    if (!intent) return;

    // Extract new context from clarification
    const lower = clarification.toLowerCase();
    
    // Materials
    if (lower.includes('cupru') && !intent.context.includes('cupru')) {
      intent.context.push('cupru');
    }
    if (lower.includes('aluminiu') && !intent.context.includes('aluminiu')) {
      intent.context.push('aluminiu');
    }

    // Installation type
    if (lower.includes('interior') && !intent.context.includes('instalatii interioare')) {
      intent.context.push('instalatii interioare');
    }

    // Numbers
    const numbers = clarification.match(/\d+\s*(mm|mm²|A|tablouri|tablou)/gi);
    if (numbers) {
      numbers.forEach(n => {
        if (!intent.context.includes(n)) {
          intent.context.push(n);
        }
      });
    }
  }

  /**
   * Build focused question that includes original subject + clarifications
   */
  buildFocusedQuestion(sessionId: string, clarification: string): string {
    const intent = this.intents.get(sessionId);
    if (!intent) return clarification;

    // ALWAYS include the original subject and action
    const parts = [
      intent.action,
      intent.subject,
    ];

    // Add original context
    parts.push(...intent.context);

    // Add new clarification
    parts.push(clarification);

    return parts.join(' ');
  }

  /**
   * Get reminder about original intent
   */
  getIntentReminder(sessionId: string): string {
    const intent = this.intents.get(sessionId);
    if (!intent) return '';

    return `
🔴 IMPORTANT - SUBIECTUL PRINCIPAL:
   Utilizatorul a întrebat inițial: "${intent.originalQuestion}"
   
   SUBIECT: ${intent.subject}
   ACȚIUNE: ${intent.action}
   CONTEX: ${intent.context.join(', ') || 'fără context specific'}
   
   ⚠️  RĂSPUNDE STRICT despre ${intent.subject.toUpperCase()}!
   ⚠️  NU răspunde doar despre materiale sau detalii tehnice!
   ⚠️  FOCUSEAZĂ-TE pe ${intent.action} ${intent.subject}!
`;
  }

  /**
   * Clear intent for session
   */
  clearIntent(sessionId: string): void {
    this.intents.delete(sessionId);
  }
}

// Singleton
export const intentTracker = new IntentTracker();
