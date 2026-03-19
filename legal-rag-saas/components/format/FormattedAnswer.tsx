"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FileText, BookOpen, AlertTriangle, CheckCircle2, Quote } from "lucide-react";
import React from "react";

interface FormattedAnswerProps {
  content: string;
  confidence?: number;
  isAIGenerated?: boolean;
}

/**
 * Component pentru formatarea profesională a răspunsurilor
 * - Arată clar dacă e din normativ sau AI
 * - Formatare legală profesionistă
 * - Evidențiază citatele și valorile importante
 * - Transformă markdown în componente vizuale
 */
export function FormattedAnswer({ content, confidence, isAIGenerated }: FormattedAnswerProps) {
  // Verifică dacă e răspuns de grilă
  if (content.includes("RĂSPUNS CORECT") || content.includes("━━━━━━━━")) {
    return <QuizAnswer content={content} />;
  }

  // Elimină banner-ele vechi din text dacă există
  const cleanContent = removeOldBanners(content);

  // Procesează conținutul
  const sections = parseContent(cleanContent);

  return (
    <div className="space-y-5">
      {/* Banner sursă informație - doar dacă nu e deja în text */}
      {!content.includes("Bazat pe documente") && !content.includes("Confirmat în normativ") && (
        <SourceBanner 
          confidence={confidence} 
          isAIGenerated={isAIGenerated} 
        />
      )}

      {/* Conținut principal */}
      <div className="space-y-5 text-sm leading-relaxed">
        {sections.map((section, index) => (
          <ContentSection key={index} section={section} sectionIndex={index} />
        ))}
      </div>
    </div>
  );
}

/**
 * Elimină banner-ele vechi din text
 */
function removeOldBanners(text: string): string {
  return text
    .replace(/🟢═+🟢[\s\S]*?═+/g, "") // Elimină banner-ul vechi cu ═══
    .replace(/📄 RĂSPUNS BAZAT PE DOCUMENTE[\s\S]*?───+/gi, "")
    .replace(/🟢[\s\S]*?🟢/g, "") // Elimină emoji-uri separator
    .replace(/RĂSPUNS BAZAT PE DOCUMENTE NORMATIVE/gi, "")
    .replace(/RĂSPUNS GENERAT DE AI[\s\S]*?NU ESTE DIN DOCUMENTE/gi, "")
    .trim();
}

/**
 * Culori tematice pentru secțiuni
 */
const sectionThemes = [
  { bg: "bg-white", border: "border-slate-200", icon: "text-slate-500" },
  { bg: "bg-blue-50/40", border: "border-blue-200", icon: "text-blue-500" },
  { bg: "bg-green-50/40", border: "border-green-200", icon: "text-green-500" },
  { bg: "bg-purple-50/40", border: "border-purple-200", icon: "text-purple-500" },
];

/**
 * Component pentru o secțiune de conținut - cu culori tematice
 */
function ContentSection({ 
  section, 
  sectionIndex 
}: { 
  section: { type: "normal" | "quote" | "important" | "title"; content: string }; 
  sectionIndex: number;
}) {
  // Dacă e titlu, renderizează ca heading
  if (section.type === "title") {
    return (
      <h3 className="text-lg font-bold text-slate-800 mt-8 mb-4 flex items-center gap-3 pb-2 border-b border-slate-200">
        <span className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-sm",
          sectionIndex % 2 === 0 ? "bg-blue-500" : "bg-slate-600"
        )}>
          {section.content.match(/\d+/)?.[0] || sectionIndex + 1}
        </span>
        <span className="flex-1">
          {section.content.replace(/^\d+\.\s*/, '').replace(/^#+\s*/, '')}
        </span>
      </h3>
    );
  }

  // Alege tema bazată pe index pentru alternare vizuală
  const theme = sectionThemes[sectionIndex % sectionThemes.length];

  // Stiluri specifice pentru tipul de secțiune
  const typeStyles = {
    quote: "bg-blue-50/80 border-l-4 border-blue-500 shadow-sm",
    important: "bg-red-50/80 border-l-4 border-red-400 shadow-sm",
    normal: cn("border-l-4 border-transparent hover:border-slate-300", theme.bg),
  };

  const typeIcons = {
    quote: { icon: Quote, color: "text-blue-700", bg: "bg-blue-100", label: "Citat din normativ" },
    important: { icon: AlertTriangle, color: "text-red-700", bg: "bg-red-100", label: "Obligație / Interdicție" },
    normal: null,
  };

  const iconConfig = typeIcons[section.type];

  return (
    <div 
      className={cn(
        "rounded-lg p-5 transition-all duration-200",
        "hover:shadow-sm",
        typeStyles[section.type]
      )}
    >
      {/* Header cu iconiță pentru tipul secțiunii */}
      {iconConfig && (
        <div className={cn(
          "flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider",
          iconConfig.color
        )}>
          <div className={cn("p-1.5 rounded-md", iconConfig.bg)}>
            <iconConfig.icon className="h-4 w-4" />
          </div>
          <span>{iconConfig.label}</span>
        </div>
      )}

      {/* Conținut formatat */}
      <div className={cn(
        "prose prose-sm max-w-none",
        "prose-p:mb-3 prose-p:leading-relaxed",
        section.type === "quote" && "prose-p:text-slate-800",
        section.type === "important" && "prose-p:text-red-900",
        section.type === "normal" && "prose-p:text-slate-700"
      )}>
        <FormattedText text={section.content} isImportant={section.type === "important"} />
      </div>
    </div>
  );
}

/**
 * Text formatat cu referințe clickabile și valori evidențiate
 */
function FormattedText({ text, isImportant }: { text: string; isImportant?: boolean }) {
  // Împarte textul în paragrafe
  const paragraphs = text.split(/\n+/).filter(p => p.trim());
  
  return (
    <>
      {paragraphs.map((paragraph, idx) => (
        <p key={idx} className={cn("mb-3 last:mb-0", isImportant && "font-medium")}>
          <ProcessText text={paragraph} isImportant={isImportant} />
        </p>
      ))}
    </>
  );
}

/**
 * Procesează textul pentru a evidenția valori și referințe
 */
function ProcessText({ text, isImportant }: { text: string; isImportant?: boolean }): React.ReactNode {
  // Pattern pentru referințe [1], [2], etc
  const citationPattern = /\[(\d+)\]/g;
  
  // Pattern pentru valori numerice cu unități
  const numericPattern = /(\d+(?:[,.]\d+)?)\s*(mm²|mm2|mm|ohmi|ohm|Ω|A|V|W|kW|m|cm|kg|%|grade|°C|°|megaohmi|MΩ)/gi;
  
  // Pattern pentru OBLIGAȚII (termeni imperativi)
  const obligationPattern = /\b(obligatoriu|obligativitate|mandatoriu|este necesar|trebuie să|trebuie|se impune|impus|cerință obligatorie|prescripție obligatorie)\b/gi;
  
  // Pattern pentru INTERDICȚII (termeni prohibiți)
  const prohibitionPattern = /\b(interzis|nu se permite|nu este permis|nu trebuie|strict interzis|prohibiție|nepermis|operațiune interzisă)\b/gi;
  
  // Pattern pentru recomandări
  const recommendationPattern = /\b(recomandat|sugerat|este bine să|se recomandă|admirabil|opțional)\b/gi;

  // Combină toate pattern-urile
  const combinedPattern = new RegExp(
    `(${citationPattern.source}|${numericPattern.source}|${obligationPattern.source}|${prohibitionPattern.source}|${recommendationPattern.source})`,
    'gi'
  );

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = combinedPattern.exec(text)) !== null) {
    const matchedText = match[0];
    const matchIndex = match.index;

    // Adaugă textul înainte de match
    if (matchIndex > lastIndex) {
      parts.push(
        <span key={`t-${lastIndex}`}>{text.substring(lastIndex, matchIndex)}</span>
      );
    }

    // Determină tipul match-ului
    if (citationPattern.test(matchedText)) {
      // Referință [1], [2] - clickabilă
      const citationNum = matchedText.replace(/\[|\]/g, '');
      parts.push(
        <a
          key={`c-${matchIndex}`}
          href={`#citation-${citationNum}`}
          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition-colors mx-0.5 no-underline shadow-sm"
          title={`Sari la sursa [${citationNum}]`}
        >
          {citationNum}
        </a>
      );
    } else if (prohibitionPattern.test(matchedText)) {
      // INTERDICȚIE - ROȘU intens
      parts.push(
        <strong 
          key={`p-${matchIndex}`} 
          className="text-white bg-red-600 px-2 py-0.5 rounded font-bold shadow-sm"
          title="Interdicție - NU este permis"
        >
          {matchedText}
        </strong>
      );
    } else if (obligationPattern.test(matchedText)) {
      // OBLIGAȚIE - Portocaliu/Amber intens
      parts.push(
        <strong 
          key={`o-${matchIndex}`} 
          className="text-amber-900 bg-amber-400 px-2 py-0.5 rounded font-bold shadow-sm"
          title="Obligație - Este necesar"
        >
          {matchedText}
        </strong>
      );
    } else if (recommendationPattern.test(matchedText)) {
      // RECOMANDARE - Verde deschis
      parts.push(
        <strong 
          key={`r-${matchIndex}`} 
          className="text-green-800 bg-green-200 px-1.5 py-0.5 rounded font-semibold"
          title="Recomandare - Opțional dar sugerat"
        >
          {matchedText}
        </strong>
      );
    } else {
      // Valoare numerică - Albastru
      parts.push(
        <strong 
          key={`n-${matchIndex}`} 
          className="text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded font-semibold border border-blue-200"
        >
          {matchedText}
        </strong>
      );
    }

    lastIndex = matchIndex + matchedText.length;
  }

  // Adaugă restul textului
  if (lastIndex < text.length) {
    parts.push(<span key={`t-end`}>{text.substring(lastIndex)}</span>);
  }

  return parts.length > 0 ? <>{parts}</> : <>{text}</>;
}

/**
 * Parser care împarte conținutul în secțiuni
 */
function parseContent(content: string) {
  const sections: Array<{ type: "normal" | "quote" | "important" | "title"; content: string }> = [];
  
  // Elimină prefixe comune
  const cleanContent = content
    .replace(/^Răspuns:\s*/i, "")
    .replace(/^Conform normativelor:\s*/i, "")
    .trim();

  const lines = cleanContent.split("\n");
  let currentSection = "";
  let currentType: "normal" | "quote" | "important" | "title" = "normal";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detectează titluri (### 1. sau ## 1. sau 1. Titlu)
    if (/^(#{1,3}\s*\d+\.?|#{1,3}\s+|^\d+\.\s+\w+)/.test(trimmed)) {
      if (currentSection) {
        sections.push({ type: currentType, content: currentSection.trim() });
        currentSection = "";
      }
      sections.push({ type: "title", content: trimmed.replace(/^#+\s*/, '') });
      currentType = "normal";
    }
    // Detectează citate
    else if (
      trimmed.startsWith('"') || 
      trimmed.startsWith("'") || 
      trimmed.startsWith("„") ||
      trimmed.toLowerCase().includes("conform normativului") ||
      trimmed.toLowerCase().includes("prevede că") ||
      trimmed.toLowerCase().includes("stabilește că") ||
      trimmed.toLowerCase().includes("menționează") ||
      trimmed.toLowerCase().includes("specifică")
    ) {
      if (currentSection && currentType !== "quote") {
        sections.push({ type: currentType, content: currentSection.trim() });
        currentSection = "";
      }
      currentSection += (currentSection ? " " : "") + trimmed;
      currentType = "quote";
    } 
    // Detectează informații importante
    else if (
      /\b(obligatoriu|interzis|obligativitate|este necesar|trebuie|nu se permite|strict|prohibiție|mandatoriu)\b/i.test(trimmed)
    ) {
      if (currentSection && currentType !== "important") {
        sections.push({ type: currentType, content: currentSection.trim() });
        currentSection = "";
      }
      currentSection += (currentSection ? " " : "") + trimmed;
      currentType = "important";
    }
    else {
      if (currentSection && currentType !== "normal") {
        sections.push({ type: currentType, content: currentSection.trim() });
        currentSection = "";
      }
      currentSection += (currentSection ? "\n" : "") + trimmed;
      currentType = "normal";
    }
  }

  // Adaugă ultima secțiune
  if (currentSection) {
    sections.push({ type: currentType, content: currentSection.trim() });
  }

  if (sections.length === 0) {
    sections.push({ type: "normal", content: cleanContent });
  }

  return sections;
}

/**
 * Banner care arată clar sursa informației
 */
function SourceBanner({ confidence, isAIGenerated }: { confidence?: number; isAIGenerated?: boolean }) {
  if (isAIGenerated) {
    return (
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg shadow-sm">
        <div className="p-2 bg-amber-100 rounded-full shrink-0">
          <AlertTriangle className="h-5 w-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-amber-900">Răspuns generat de AI</span>
            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-800 bg-white">
              Verifică în documente
            </Badge>
          </div>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            Acest răspuns este generat de inteligența artificială. Verifică întotdeauna cu documentele oficiale.
          </p>
        </div>
      </div>
    );
  }

  const isHighConfidence = confidence && confidence >= 80;
  
  return (
    <div className={cn(
      "flex items-start gap-3 p-4 rounded-lg border shadow-sm",
      isHighConfidence 
        ? "bg-green-50 border-green-200" 
        : "bg-blue-50 border-blue-200"
    )}>
      <div className={cn(
        "p-2 rounded-full shrink-0",
        isHighConfidence ? "bg-green-100" : "bg-blue-100"
      )}>
        {isHighConfidence ? (
          <CheckCircle2 className="h-5 w-5 text-green-700" />
        ) : (
          <BookOpen className="h-5 w-5 text-blue-700" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "font-bold",
            isHighConfidence ? "text-green-900" : "text-blue-900"
          )}>
            {isHighConfidence ? "Confirmat în normativ" : "Bazat pe documente"}
          </span>
          {confidence !== undefined && (
            <Badge 
              variant={isHighConfidence ? "default" : "secondary"}
              className="text-[10px]"
            >
              {confidence}% acuratețe
            </Badge>
          )}
        </div>
        <p className={cn(
          "text-xs mt-1 leading-relaxed",
          isHighConfidence ? "text-green-800" : "text-blue-800"
        )}>
          {isHighConfidence 
            ? "Răspuns bazat pe citate directe din documentele normative cu înaltă acuratețe."
            : "Răspuns bazat pe informații din documentele normative. Verificați sursele citate."
          }
        </p>
      </div>
    </div>
  );
}

/**
 * Component special pentru răspunsuri de grilă
 */
function QuizAnswer({ content }: { content: string }) {
  const lines = content.split("\n");
  const isCorrect = content.includes("✓ CORECT") || content.includes("RĂSPUNS CORECT");
  
  return (
    <div className="space-y-4">
      <div className={cn(
        "flex items-center gap-3 p-4 rounded-lg border",
        isCorrect 
          ? "bg-green-50 border-green-200" 
          : "bg-red-50 border-red-200"
      )}>
        {isCorrect ? (
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        ) : (
          <AlertTriangle className="h-6 w-6 text-red-600" />
        )}
        <span className={cn(
          "font-bold text-lg",
          isCorrect ? "text-green-800" : "text-red-800"
        )}>
          {isCorrect ? "Răspuns Corect" : "Răspuns Incorect"}
        </span>
      </div>

      <div className="bg-slate-50 rounded-lg p-5 font-mono text-sm">
        {lines.map((line, idx) => {
          if (line.includes("✓") || line.includes("RĂSPUNS CORECT")) {
            return (
              <div key={idx} className="text-green-700 font-bold bg-green-100/50 px-3 py-2 rounded my-2 border-l-4 border-green-500">
                {line}
              </div>
            );
          }
          if (/^[A-D][).]/.test(line.trim())) {
            return (
              <div key={idx} className="ml-4 py-2 border-l-2 border-slate-300 pl-4 my-1 hover:bg-slate-100 rounded-r">
                {line}
              </div>
            );
          }
          return <div key={idx} className="py-1">{line}</div>;
        })}
      </div>
    </div>
  );
}

export default FormattedAnswer;
