/**
 * CONFIGURABLE OPENAI SERVICE
 */

import OpenAI from 'openai';
import { getArchitectureSettings } from './settings-service';

export type ArchitectureType = 'legacy' | 'hybrid';

export interface GenerateAnswerOptions {
  query: string;
  citations: Array<{
    index: number;
    text: string;
    documentName: string;
    pageNumber: number;
    articleNumber?: string;
    score: number;
  }>;
  architecture: ArchitectureType;
  isQuiz?: boolean;
  quizOptions?: Array<{ letter: string; text: string }>;
}

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

async function getOpenAISettings(architecture: ArchitectureType) {
  const settings = await getArchitectureSettings();

  if (architecture === 'legacy') {
    return {
      model: settings.legacyOpenaiModel,
      maxTokens: settings.legacyMaxTokens,
      temperature: settings.legacyTemperature,
      systemPrompt: settings.legacySystemPrompt,
      promptTemplate: settings.legacyPromptTemplate,
      includeCitations: settings.legacyIncludeCitations,
      requireCitations: settings.legacyRequireCitations,
    };
  } else {
    return {
      model: settings.hybridOpenaiModel,
      maxTokens: settings.hybridMaxTokens,
      temperature: settings.hybridTemperature,
      systemPrompt: settings.hybridSystemPrompt,
      promptTemplate: settings.hybridPromptTemplate,
      includeCitations: settings.hybridIncludeCitations,
      requireCitations: settings.hybridRequireCitations,
    };
  }
}

export async function generateAnswer(options: GenerateAnswerOptions): Promise<{ answer: string; tokensUsed: number }> {
  const settings = await getOpenAISettings(options.architecture);
  const openai = getOpenAIClient();

  console.log(`[OpenAI] Using model: ${settings.model}, temp: ${settings.temperature}`);

  const { systemPrompt, userPrompt } = buildPrompts(options, settings);

  const completion = await openai.chat.completions.create({
    model: settings.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: settings.maxTokens,
    temperature: settings.temperature,
  });

  const answer = completion.choices[0]?.message?.content?.trim() || '';
  const tokensUsed = completion.usage?.total_tokens || 0;

  let finalAnswer = answer;
  if (settings.includeCitations && !options.isQuiz) {
    const sources = Array.from(new Set(
      options.citations.map(c => `${c.documentName}, pag. ${c.pageNumber}`)
    ));
    finalAnswer += `\n\n📚 Sursa: ${sources.join('; ')}`;
  }

  return { answer: finalAnswer, tokensUsed };
}

function buildPrompts(options: GenerateAnswerOptions, settings: any) {
  const context = options.citations.map((c, idx) => {
    let citation = `[${idx + 1}]`;
    if (c.pageNumber) citation += ` Pagina ${c.pageNumber}`;
    if (c.articleNumber) citation += `, Art. ${c.articleNumber}`;
    citation += `:\n${c.text}`;
    return citation;
  }).join('\n\n---\n\n');

  let systemPrompt = settings.systemPrompt;

  if (options.isQuiz) {
    systemPrompt = buildQuizSystemPrompt(settings.systemPrompt, settings.requireCitations);
  } else if (settings.promptTemplate === 'detailed') {
    systemPrompt = buildDetailedSystemPrompt(settings.systemPrompt, settings.requireCitations);
  } else if (settings.promptTemplate === 'concise') {
    systemPrompt = buildConciseSystemPrompt(settings.systemPrompt, settings.requireCitations);
  } else {
    systemPrompt = buildStandardSystemPrompt(settings.systemPrompt, settings.requireCitations);
  }

  let userPrompt = `## Context din normativ:\n${context}\n\n## Intrebare:\n${options.query}`;

  if (options.isQuiz && options.quizOptions) {
    userPrompt += '\n\n## Variante:\n';
    for (const opt of options.quizOptions) {
      userPrompt += `${opt.letter}) ${opt.text}\n`;
    }
    userPrompt += '\nCare este raspunsul corect?';
  }

  return { systemPrompt, userPrompt };
}

function buildStandardSystemPrompt(basePrompt: string, requireCitations: boolean): string {
  const citationRule = requireCitations 
    ? 'OBLIGATORIU: Citeaza sursa pentru fiecare informatie: [pag. X]'
    : 'Recomandat: Citeaza sursa cand e posibil';
    
  return `${basePrompt}

REGULI:
1. ${citationRule}
2. Foloseste DOAR informatiile din contextul furnizat
3. Daca informatia nu exista, spune clar acest lucru
4. Fii concis si direct
5. NU adauga informatii din cunostinte generale`;
}

function buildDetailedSystemPrompt(basePrompt: string, requireCitations: boolean): string {
  const citationRule = requireCitations
    ? 'OBLIGATORIU: Fiecare afirmatie trebuie citata: [pag. X, art. Y]'
    : 'Citeaza sursele cand e relevant';
    
  return `${basePrompt}

REGULI STRICTE:
1. ${citationRule}
2. Foloseste EXCLUSIV paragrafele furnizate
3. Daca informatia nu exista in context: spune clar
4. Prezinta mai intai citatul exact, apoi explicatia
5. Evidentiaza diferente importante
6. Adauga sectiunea IN LIMBAJ SIMPLU pentru explicatii`;
}

function buildConciseSystemPrompt(basePrompt: string, requireCitations: boolean): string {
  const citationRule = requireCitations 
    ? 'Citeaza scurt: [pag. X]' 
    : 'Fara citari obligatorii';
    
  return `${basePrompt}

REGULI:
1. ${citationRule}
2. Raspunde in maximum 2-3 propozitii
3. Fii extrem de concis
4. DOAR informatii esentiale`;
}

function buildQuizSystemPrompt(basePrompt: string, requireCitations: boolean): string {
  const citationRule = requireCitations
    ? 'OBLIGATORIU: Fiecare varianta trebuie verificata in text'
    : 'Verifica variantele in text';
    
  return `${basePrompt}

REGULI PENTRU GRILE:
1. Analizeaza fiecare varianta (A, B, C, D)
2. ${citationRule}
3. Respinge variantele care contrazic normativul
4. Confirma varianta care are suport textual direct
5. Raspunde EXACT cu formatul: RASPUNS: [litera]
6. Adauga JUSTIFICARE scurta cu citare`;
}

export function getAvailableModels() {
  return [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Rapid si eficient', contextWindow: 128000 },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Cel mai capabil', contextWindow: 128000 },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Bun pentru complex', contextWindow: 128000 },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Cel mai ieftin', contextWindow: 16385 },
  ];
}

export function getAvailablePromptTemplates() {
  return [
    { id: 'standard', name: 'Standard', description: 'Echilibrat intre detaliu si concizie' },
    { id: 'detailed', name: 'Detaliat', description: 'Raspunsuri lungi cu multe detalii' },
    { id: 'concise', name: 'Concis', description: 'Raspunsuri scurte si directe' },
    { id: 'adaptive', name: 'Adaptiv', description: 'Se adapteaza la tipul intrebarii' },
    { id: 'quiz', name: 'Quiz', description: 'Special pentru grile' },
  ];
}

export default {
  generateAnswer,
  getAvailableModels,
  getAvailablePromptTemplates,
};
