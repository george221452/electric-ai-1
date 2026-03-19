"use client";

import { CheckCircle2, XCircle, BookOpen, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizResponseProps {
  content: string;
}

/**
 * Component pentru afișarea formatată a răspunsurilor la grile
 */
export function QuizResponse({ content }: QuizResponseProps) {
  // Verificăm dacă e un răspuns de tip grilă
  const isQuizResponse = content.includes("RĂSPUNS CORECT") || 
                         content.includes("✅") ||
                         content.includes("━━━━━━━━");

  if (!isQuizResponse) {
    // Nu e grilă, returnăm textul normal
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  // Parsăm conținutul pentru a-l formata frumos
  const lines = content.split('\n');
  const sections: JSX.Element[] = [];
  let currentSection: JSX.Element[] = [];
  let sectionType: 'header' | 'answer' | 'explanation' | 'wrong' | 'footer' | null = null;

  const pushCurrentSection = () => {
    if (currentSection.length > 0) {
      const key = sections.length;
      if (sectionType === 'header') {
        sections.push(
          <div key={key} className="mb-4">
            {currentSection}
          </div>
        );
      } else if (sectionType === 'answer') {
        sections.push(
          <div key={key} className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
            {currentSection}
          </div>
        );
      } else if (sectionType === 'explanation') {
        sections.push(
          <div key={key} className="mb-4">
            {currentSection}
          </div>
        );
      } else if (sectionType === 'wrong') {
        sections.push(
          <div key={key} className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            {currentSection}
          </div>
        );
      } else {
        sections.push(
          <div key={key} className="mb-2">
            {currentSection}
          </div>
        );
      }
      currentSection = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Header separator
    if (trimmedLine.includes('━━━━━━━━')) {
      pushCurrentSection();
      sectionType = 'header';
      continue;
    }

    // Răspuns corect
    if (trimmedLine.includes('✅') || trimmedLine.includes('RĂSPUNS CORECT')) {
      pushCurrentSection();
      sectionType = 'answer';
      currentSection.push(
        <div key={i} className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
          <span className="text-lg font-bold text-green-800">
            {trimmedLine.replace(/[✅━]/g, '').trim()}
          </span>
        </div>
      );
      continue;
    }

    // Explicație
    if (trimmedLine.startsWith('📖') || trimmedLine.toLowerCase().includes('explicație')) {
      pushCurrentSection();
      sectionType = 'explanation';
      currentSection.push(
        <div key={i} className="flex items-center gap-2 mb-2 text-blue-700 font-semibold">
          <BookOpen className="h-5 w-5" />
          <span>Explicație</span>
        </div>
      );
      continue;
    }

    // Variante greșite
    if (trimmedLine.includes('❌') || trimmedLine.toLowerCase().includes('greșite')) {
      pushCurrentSection();
      sectionType = 'wrong';
      currentSection.push(
        <div key={i} className="flex items-center gap-2 mb-2 text-red-700 font-semibold">
          <XCircle className="h-5 w-5" />
          <span>De ce celelalte variante sunt greșite</span>
        </div>
      );
      continue;
    }

    // Termeni cheie
    if (trimmedLine.includes('🔍')) {
      currentSection.push(
        <div key={i} className="flex items-center gap-2 mt-3 text-purple-700">
          <Search className="h-4 w-4" />
          <span className="font-medium">{trimmedLine.replace('🔍', '').trim()}</span>
        </div>
      );
      continue;
    }

    // Sursă
    if (trimmedLine.includes('📚') || trimmedLine.toLowerCase().includes('sursă')) {
      pushCurrentSection();
      sectionType = 'footer';
      currentSection.push(
        <div key={i} className="text-sm text-muted-foreground mt-4 pt-2 border-t">
          {trimmedLine}
        </div>
      );
      continue;
    }

    // Varianță corectă (textul după "Varianta X):")
    if (trimmedLine.match(/^\*\*Varianta [A-D]\):\*\*/)) {
      currentSection.push(
        <div key={i} className="text-green-900 font-medium mb-2 pl-2 border-l-4 border-green-400">
          {processMarkdown(trimmedLine)}
        </div>
      );
      continue;
    }

    // Varianță greșită (textul după "Varianta X):" în secțiunea de greșeli)
    if (sectionType === 'wrong' && trimmedLine.match(/^\*\*Varianta [A-D]\):\*\*/)) {
      currentSection.push(
        <div key={i} className="text-red-900 font-medium mt-3 mb-1 pl-2 border-l-4 border-red-400">
          {processMarkdown(trimmedLine)}
        </div>
      );
      continue;
    }

    // Săgeată pentru explicație greșeală
    if (trimmedLine.startsWith('→')) {
      currentSection.push(
        <div key={i} className="text-red-800 text-sm pl-4 italic">
          {processMarkdown(trimmedLine.substring(1).trim())}
        </div>
      );
      continue;
    }

    // Text normal
    if (trimmedLine) {
      currentSection.push(
        <div key={i} className={cn(
          "text-sm",
          sectionType === 'explanation' && "text-gray-700 leading-relaxed"
        )}>
          {processMarkdown(trimmedLine)}
        </div>
      );
    }
  }

  pushCurrentSection();

  return (
    <div className="space-y-2">
      {sections}
    </div>
  );
}

/**
 * Procesează markdown simplu (**bold**, etc.)
 */
function processMarkdown(text: string): JSX.Element {
  // Procesăm **text bold**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const boldText = part.slice(2, -2);
          return <strong key={idx} className="font-bold">{boldText}</strong>;
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}
