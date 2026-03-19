/**
 * Chat Memory System - Keeps conversation context
 * Stores question/answer history for contextual responses
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
}

export interface ConversationContext {
  sessionId: string;
  messages: ChatMessage[];
  subject: string | null;
  lastTopic: string | null;
  pendingQuestion: string | null;  // Question waiting for clarifications
  pendingClarifications: string[]; // What clarifications were asked
  isWaitingForClarification: boolean;
}

export class ChatMemory {
  private contexts: Map<string, ConversationContext> = new Map();
  private readonly MAX_HISTORY = 10;
  private readonly CONTEXT_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  /**
   * Get or create conversation context
   */
  getContext(sessionId: string): ConversationContext {
    if (!this.contexts.has(sessionId)) {
      this.contexts.set(sessionId, {
        sessionId,
        messages: [],
        subject: null,
        lastTopic: null,
        pendingQuestion: null,
        pendingClarifications: [],
        isWaitingForClarification: false,
      });
    }
    return this.contexts.get(sessionId)!;
  }

  /**
   * Add user message to context
   */
  addUserMessage(sessionId: string, content: string): void {
    const context = this.getContext(sessionId);
    context.messages.push({
      role: 'user',
      content,
      timestamp: new Date(),
    });
    this.trimHistory(context);
  }

  /**
   * Add assistant response to context
   */
  addAssistantMessage(sessionId: string, content: string, sources?: string[]): void {
    const context = this.getContext(sessionId);
    context.messages.push({
      role: 'assistant',
      content,
      timestamp: new Date(),
      sources,
    });
    this.trimHistory(context);
  }

  /**
   * Set the main subject of conversation
   */
  setSubject(sessionId: string, subject: string): void {
    const context = this.getContext(sessionId);
    context.subject = subject;
  }

  /**
   * Set the last discussed topic
   */
  setLastTopic(sessionId: string, topic: string): void {
    const context = this.getContext(sessionId);
    context.lastTopic = topic;
  }

  /**
   * Mark that we're waiting for clarifications
   */
  setPendingQuestion(sessionId: string, question: string, clarifications: string[]): void {
    const context = this.getContext(sessionId);
    context.pendingQuestion = question;
    context.pendingClarifications = clarifications;
    context.isWaitingForClarification = true;
  }

  /**
   * Process clarification and combine with original question
   */
  processClarification(sessionId: string, clarification: string): string {
    const context = this.getContext(sessionId);
    
    if (!context.isWaitingForClarification || !context.pendingQuestion) {
      return clarification; // Not a clarification, treat as new question
    }

    // Combine original question with clarification
    const combinedQuery = `${context.pendingQuestion}\n\nDetalii suplimentare: ${clarification}`;
    
    // Reset pending state
    context.isWaitingForClarification = false;
    context.pendingQuestion = null;
    context.pendingClarifications = [];
    
    return combinedQuery;
  }

  /**
   * Check if we're waiting for clarification
   */
  isWaitingForClarification(sessionId: string): boolean {
    const context = this.getContext(sessionId);
    return context.isWaitingForClarification;
  }

  /**
   * Get conversation history as formatted string
   */
  getHistory(sessionId: string, maxMessages: number = 5): string {
    const context = this.getContext(sessionId);
    const recentMessages = context.messages.slice(-maxMessages);
    
    if (recentMessages.length === 0) return '';

    return recentMessages
      .map(m => `${m.role === 'user' ? 'Utilizator' : 'Asistent'}: ${m.content}`)
      .join('\n\n');
  }

  /**
   * Check if this is a follow-up question or clarification
   */
  isFollowUp(sessionId: string, newQuestion: string): boolean {
    const context = this.getContext(sessionId);
    
    // If no previous messages, it's not a follow-up
    if (context.messages.length === 0) return false;

    // If we're explicitly waiting for clarification, this IS a follow-up
    if (context.isWaitingForClarification) return true;

    // Check if question is short (likely clarification)
    if (newQuestion.length < 50) return true;

    // Check if it contains pronouns without clear referent
    const followUpIndicators = [
      'cum se', 'cum', 'de ce', 'cât', 'când', 'unde',
      'acesta', 'aceasta', 'ei', 'ele', 'lor', 'acest',
      'selectivitatea', 'protectia', 'circuitul', 'tabloul',
    ];
    
    const lowerQuestion = newQuestion.toLowerCase();
    return followUpIndicators.some(indicator => 
      lowerQuestion.includes(indicator)
    );
  }

  /**
   * Get enhanced query with context
   */
  getEnhancedQuery(sessionId: string, currentQuestion: string): string {
    const context = this.getContext(sessionId);
    
    // If waiting for clarification, combine with original question
    if (context.isWaitingForClarification && context.pendingQuestion) {
      return this.processClarification(sessionId, currentQuestion);
    }
    
    // If not a follow-up, return as-is
    if (!this.isFollowUp(sessionId, currentQuestion)) {
      return currentQuestion;
    }

    // Build context-aware query
    let enhancedQuery = currentQuestion;
    
    // Add subject context if available
    if (context.subject) {
      enhancedQuery = `[Subiect: ${context.subject}] ${enhancedQuery}`;
    }

    // Add last topic if relevant
    if (context.lastTopic && !currentQuestion.toLowerCase().includes(context.lastTopic.toLowerCase())) {
      enhancedQuery = `${enhancedQuery} (în contextul: ${context.lastTopic})`;
    }

    return enhancedQuery;
  }

  /**
   * Get context summary for the AI
   */
  getContextForAI(sessionId: string): string {
    const context = this.getContext(sessionId);
    
    if (context.messages.length === 0) return '';

    let summary = '=== CONTEX CONVERSAȚIE ===\n';
    
    if (context.subject) {
      summary += `Subiect principal: ${context.subject}\n`;
    }
    
    if (context.lastTopic) {
      summary += `Ultimul subiect discutat: ${context.lastTopic}\n`;
    }

    summary += '\nIstoric recent:\n';
    summary += this.getHistory(sessionId, 3);
    summary += '\n\n=== SFÂRȘIT CONTEX ===\n\n';

    return summary;
  }

  /**
   * Clear old contexts
   */
  cleanup(): void {
    const now = Date.now();
    for (const [sessionId, context] of Array.from(this.contexts.entries())) {
      const lastMessage = context.messages[context.messages.length - 1];
      if (lastMessage && (now - lastMessage.timestamp.getTime()) > this.CONTEXT_TIMEOUT) {
        this.contexts.delete(sessionId);
      }
    }
  }

  /**
   * Trim history to max size
   */
  private trimHistory(context: ConversationContext): void {
    if (context.messages.length > this.MAX_HISTORY) {
      context.messages = context.messages.slice(-this.MAX_HISTORY);
    }
  }

  /**
   * Clear specific session
   */
  clearSession(sessionId: string): void {
    this.contexts.delete(sessionId);
  }
}

// Singleton instance
export const chatMemory = new ChatMemory();

// Cleanup every 10 minutes
setInterval(() => chatMemory.cleanup(), 10 * 60 * 1000);
