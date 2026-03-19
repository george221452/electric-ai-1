"use client";

import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, Loader2, FileText, AlertCircle, ExternalLink, Mic, MicOff, Globe, User, BookOpen, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Highlighter } from "lucide-react";
import Link from "next/link";
import { SourceNavigator } from "@/components/rag/SourceNavigator";
import { QuizResponse } from "@/components/quiz/QuizResponse";
import { FormattedAnswer } from "@/components/format/FormattedAnswer";
import { cn, formatDate } from "@/lib/utils";
import { useVoice } from "@/hooks/use-voice";


interface Citation {
  index: number;
  paragraphId: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  articleNumber?: string;
  paragraphLetter?: string;
  text: string;
  confidence: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  confidence?: number;
  disclaimer?: string;
  isAIGenerated?: boolean;
  timestamp: Date;
  isStreaming?: boolean;
}

interface ChatInterfaceProps {
  workspaceId: string;
  documentIds?: string[];
}

export function ChatInterface({ workspaceId, documentIds }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [referenceSearch, setReferenceSearch] = useState("");
  const [referenceResults, setReferenceResults] = useState<any[]>([]);
  const [isSearchingRef, setIsSearchingRef] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [voiceLang, setVoiceLang] = useState<"ro-RO" | "en-US">("ro-RO");

  // Fix hydration mismatch - only render icons after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Inline Document Viewer State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<{ name: string; page: number; content?: string } | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerContent, setViewerContent] = useState<any>(null);
  const [viewerSearchTerm, setViewerSearchTerm] = useState("");
  const [viewerSearchResults, setViewerSearchResults] = useState<number[]>([]);
  const [viewerCurrentResult, setViewerCurrentResult] = useState(-1);
  const viewerScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current result in viewer
  useEffect(() => {
    if (viewerOpen && viewerCurrentResult >= 0 && viewerSearchResults.length > 0 && viewerContent) {
      const resultIndex = viewerSearchResults[viewerCurrentResult];
      const para = viewerContent.paragraphs?.[resultIndex];
      if (para) {
        const element = document.getElementById(`viewer-line-${para.lineNumber}`);
        if (element && viewerScrollRef.current) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [viewerCurrentResult, viewerSearchResults, viewerContent, viewerOpen]);

  // Hook pentru voice
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    hasSpeechRecognition,
    permissionStatus,
    isSpeaking,
    speak,
    stopSpeaking,
    hasSpeechSynthesis,
    voices,
    setLanguage,
    error: voiceError,
    clearError,
  } = useVoice({
    lang: voiceLang,
    onTranscript: (text) => {
      console.log("[Chat] Received transcript:", text);
      setInput((prev) => {
        const newValue = prev ? prev + " " + text : text;
        console.log("[Chat] Input updated to:", newValue);
        return newValue.trim();
      });
    },
  });

  // Actualizează limba când se schimbă
  useEffect(() => {
    setLanguage(voiceLang);
  }, [voiceLang, setLanguage]);
  
  // Debug: log transcript changes
  useEffect(() => {
    console.log("[Chat] Transcript changed:", transcript);
  }, [transcript]);
  
  // Debug: log available voices
  useEffect(() => {
    if (voices.length > 0) {
      console.log("[Chat] Available voices:", voices.map(v => `${v.name} (${v.lang})`));
      const romanianVoices = voices.filter(v => v.lang.startsWith('ro'));
      console.log("[Chat] Romanian voices:", romanianVoices.map(v => v.name));
    }
  }, [voices]);
  
  // Auto-focus send button after voice input
  const [justFinishedListening, setJustFinishedListening] = useState(false);
  useEffect(() => {
    if (!isListening && input.trim()) {
      setJustFinishedListening(true);
      const timer = setTimeout(() => setJustFinishedListening(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isListening, input]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const searchReference = async () => {
    if (!referenceSearch.trim()) return;
    
    setIsSearchingRef(true);
    try {
      const response = await fetch("/api/rag/search-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: referenceSearch,
          workspaceId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setReferenceResults(data.data.results || []);
      }
    } catch (error) {
      console.error("Search reference error:", error);
    } finally {
      setIsSearchingRef(false);
    }
  };

  // Open inline document viewer
  const openViewer = async (docName: string, page: number, searchTerm: string = "") => {
    setViewerOpen(true);
    setViewerDoc({ name: docName, page, content: "" });
    setViewerLoading(true);
    setViewerSearchTerm(searchTerm);

    try {
      // Fetch document content from database
      const res = await fetch(`/api/documents/view?name=${encodeURIComponent(docName)}&workspaceId=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setViewerContent(data);
        
        // If search term provided, find results
        if (searchTerm && data.paragraphs) {
          const results: number[] = [];
          const lowerTerm = searchTerm.toLowerCase();
          data.paragraphs.forEach((para: any, index: number) => {
            if (para.text.toLowerCase().includes(lowerTerm)) {
              results.push(index);
            }
          });
          setViewerSearchResults(results);
          setViewerCurrentResult(results.length > 0 ? 0 : -1);
        }
      } else {
        console.error("Failed to load document:", await res.text());
        setViewerContent(null);
      }
    } catch (e) {
      console.error("Failed to load document:", e);
      setViewerContent(null);
    } finally {
      setViewerLoading(false);
    }
  };

  // Close viewer
  const closeViewer = () => {
    setViewerOpen(false);
    setViewerDoc(null);
    setViewerContent(null);
    setViewerSearchTerm("");
    setViewerSearchResults([]);
    setViewerCurrentResult(-1);
  };

  // Navigate between search results in viewer
  const navigateViewerResult = (direction: "next" | "prev") => {
    if (viewerSearchResults.length === 0) return;
    if (direction === "next") {
      setViewerCurrentResult((prev) => (prev >= viewerSearchResults.length - 1 ? 0 : prev + 1));
    } else {
      setViewerCurrentResult((prev) => (prev <= 0 ? viewerSearchResults.length - 1 : prev - 1));
    }
  };

  // Highlight text function
  const highlightText = (text: string, term: string): React.ReactNode => {
    if (!term) return text;
    const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi"));
    return parts.map((part, i) => 
      part.toLowerCase() === term.toLowerCase() ? (
        <mark key={i} className="bg-yellow-300 text-black px-0.5 rounded font-semibold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      },
    ]);

    try {
      const response = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: input,
          workspaceId,
          documentIds,
          options: {
            maxParagraphs: 5,
            minScore: 0.75,
            strictMode: true,
            useAIFormatting: false,
            style: "legal",
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      // Handle both answer and clarification question
      const messageContent = data.data.answer || data.data.question || "Nu s-a putut genera un răspuns.";

      // Determină dacă răspunsul e generat de AI sau bazat pe documente
      const isAIGenerated = data.data.answerSource !== 'documents' && 
                           !messageContent.includes("RĂSPUNS BAZAT PE DOCUMENTE");

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: messageContent,
                citations: data.data.citations || [],
                confidence: data.data.confidence,
                disclaimer: data.data.disclaimer,
                isAIGenerated,
                isStreaming: false,
              }
            : msg
        )
      );
    } catch (error) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: "A apărut o eroare. Vă rugăm să încercați din nou.",
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-white rounded-lg border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Chat cu documentele tale</h2>
          {documentIds && documentIds.length > 0 && (
            <Badge variant="secondary">
              {documentIds.length} document{documentIds.length > 1 ? "e" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Link către Document Viewer */}
          <Link href="/documents-viewer" target="_blank">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              title="Vizualizează documentele (căutare în text)"
            >
              <BookOpen className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Documente</span>
            </Button>
          </Link>
          
          {/* Link către Voice Setup */}
          <Link href="/voice">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              title="Configurează vocea ta personală"
            >
              <User className="h-4 w-4" />
              <span className="text-xs hidden sm:inline">Vocea Mea</span>
            </Button>
          </Link>
          
          {/* Language Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVoiceLang(voiceLang === "ro-RO" ? "en-US" : "ro-RO")}
            className="gap-1"
            title={`Limbă recunoaștere vocală: ${voiceLang === "ro-RO" ? "Română" : "Engleză"}`}
          >
            <Globe className="h-4 w-4" />
            <span className="text-xs">{voiceLang === "ro-RO" ? "RO" : "EN"}</span>
          </Button>
          
          <div className="text-xs text-muted-foreground hidden sm:block">
            Răspunsuri bazate pe documente
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Începe o conversație</p>
              <p className="max-w-sm mx-auto">
                Pune întrebări despre documentele tale și vei primi răspunsuri
                cu citate exacte din surse.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {[
                  "Ce obligații am conform I7/2011?",
                  "Cum se face împământarea?",
                  "Ce interdicții există pentru instalații electrice?",
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => setInput(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-dashed">
                <p className="text-xs text-muted-foreground mb-2">💡 Testează cu grile:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    `În fiecare instalație la nivelul tabloului general trebuie prevăzută\n\nA) o bornă / bară principală de legare la pământ, numai atunci când rețeaua de distribuție este TN-C;\nB) o bornă / bară principală de legare la pământ, numai în cazul în care alimentarea receptoarelor se face în sistem TN-S\nC) o bornă / bară principală de legare la pământ`,
                  ].map((suggestion, idx) => (
                    <Button
                      key={idx}
                      variant="secondary"
                      size="sm"
                      onClick={() => setInput(suggestion)}
                      className="text-xs"
                    >
                      📝 Grilă: Tablou general - bornă de legare la pământ
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl p-4",
                  message.role === "user"
                    ? "bg-blue-500 text-white rounded-br-md"
                    : "bg-slate-100 text-slate-800 border border-slate-200 rounded-bl-md"
                )}
              >
                <div className="text-sm leading-relaxed">
                  {message.content ? (
                    message.role === "user" ? (
                      // Mesajele userului - afișare simplă
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : message.content.includes("RĂSPUNS CORECT") || message.content.includes("━━━━━━━━") ? (
                      <QuizResponse content={message.content} />
                    ) : (
                      <FormattedAnswer 
                        content={message.content} 
                        confidence={message.confidence}
                        isAIGenerated={message.isAIGenerated}
                      />
                    )
                  ) : (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground">
                        Se analizează documentele...
                      </span>
                    </div>
                  )}
                </div>

                {/* Citations - Secțiune Profesională de Surse */}
                {message.citations && message.citations.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-semibold text-slate-700">
                        Referințe documentare
                      </span>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {message.citations.length} surse
                      </Badge>
                    </div>
                    
                    <div className="space-y-3">
                      {message.citations.map((citation) => (
                        <CitationCard 
                          key={citation.index} 
                          citation={citation} 
                          onOpenViewer={(name, page) => openViewer(name, page, '')}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                {message.disclaimer && message.role !== "user" && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-slate-600 bg-yellow-50 p-2 rounded">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-600" />
                    <span>{message.disclaimer}</span>
                  </div>
                )}

                {/* Confidence */}
                {message.confidence !== undefined && message.role !== "user" && (
                  <div className="mt-2 text-xs text-slate-500">
                    Încredere: {message.confidence}%
                  </div>
                )}

                {/* Timestamp */}
                <div className={cn(
                  "mt-1 text-[10px]",
                  message.role === "user" ? "text-blue-100" : "text-slate-400"
                )}>
                  {formatDate(message.timestamp)}
                </div>
                

              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Reference Search */}
      <div className="px-4 py-2 border-t bg-slate-100">
        <div className="flex gap-2">
          <Input
            value={referenceSearch}
            onChange={(e) => setReferenceSearch(e.target.value)}
            placeholder="Caută tabel, articol sau referință (ex: tabelul 4.1, art. 4.1.5)..."
            disabled={isSearchingRef}
            className="flex-1 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && searchReference()}
          />
          <Button 
            variant="outline" 
            size="sm"
            onClick={searchReference}
            disabled={isSearchingRef || !referenceSearch.trim()}
          >
            {isSearchingRef ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Caută referință</span>
          </Button>
        </div>
        
        {/* Reference Results */}
        {referenceResults.length > 0 && (
          <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground">
              Rezultate pentru "{referenceSearch}" ({referenceResults.length} găsite):
            </p>
            {referenceResults.map((result, idx) => (
              <Card key={idx} className="bg-white border-l-2 border-l-green-500 border border-slate-200">
                <CardContent className="p-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{result.documentName}, Pag. {result.pageNumber}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      onClick={() => openViewer(result.documentName, result.pageNumber, result.searchTerm || referenceSearch)}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Deschide
                    </Button>
                  </div>
                  <p className="text-muted-foreground line-clamp-3">
                    {highlightText(result.excerpt, result.searchTerm || referenceSearch)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t bg-white"
      >
        {/* Voice Errors */}
        {voiceError && (
          <div className="mb-3">
            <div className="p-2 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-red-700">{voiceError}</p>
                <button
                  type="button"
                  onClick={clearError}
                  className="text-xs text-red-600 underline mt-1"
                >
                  Închide
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Listening Indicator */}
        {isListening && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              </div>
              <p className="text-sm text-blue-700 flex-1 font-medium">
                {transcript ? `Se aude: "${transcript}"` : "🎤 Ascult... Vorbește acum"}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={stopListening}
                className="h-6 px-2 text-xs"
              >
                Oprește
              </Button>
            </div>
            {transcript && (
              <p className="text-xs text-blue-600 mt-1 ml-6">
                Textul apare în câmpul de mai jos. Apasă Enter sau butonul trimite.
              </p>
            )}
          </div>
        )}
        
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "🎤 Vorbește acum..." : "Scrie sau apasă 🎤 pentru a vorbi..."}
              disabled={isLoading || isListening}
              className={cn(
                "flex-1",
                input && !isLoading && "border-green-500 focus-visible:ring-green-500"
              )}
            />
            {input && !isLoading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600">
                ✓
              </span>
            )}
          </div>
          
          {/* Microphone Button */}
          {mounted && hasSpeechRecognition && (
            <Button
              type="button"
              variant={isListening ? "destructive" : "outline"}
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading}
              className={isListening ? "animate-pulse" : ""}
              title={
                permissionStatus === "denied" 
                  ? "Microfon blocat - verifică setările browserului"
                  : isListening 
                    ? "Oprește microfonul" 
                    : `Vorbește în ${voiceLang === "ro-RO" ? "Română" : "Engleză"}`
              }
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          )}
          
          <Button 
            type="submit" 
            disabled={isLoading || !input.trim() || isListening}
            className={cn(
              justFinishedListening && "bg-green-600 hover:bg-green-700 animate-pulse"
            )}
            title={justFinishedListening ? "Apasă pentru a trimite întrebarea" : "Trimite întrebarea"}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4" />
                {justFinishedListening && <span className="ml-2 text-xs">Trimite</span>}
              </>
            )}
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground mt-2">
          {!mounted 
            ? "Răspunsurile sunt generate pe baza documentelor tale cu citate exacte."
            : hasSpeechRecognition 
              ? "💡 Apasă 🎤, vorbește clar, apoi apasă Enter sau butonul trimite."
              : "Răspunsurile sunt generate pe baza documentelor tale cu citate exacte."}
        </p>
      </form>

      {/* Inline Document Viewer Dialog */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-slate-50">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-base flex items-center gap-2 shrink-0">
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="truncate max-w-[200px]" title={viewerDoc?.name}>
                  {viewerDoc?.name}
                </span>
                {viewerDoc?.page && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    Pag. {viewerDoc.page}
                  </Badge>
                )}
              </DialogTitle>
              
              <div className="flex items-center gap-3 ml-auto pr-8">
                {viewerSearchResults.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                      <Highlighter className="h-3 w-3 mr-1" />
                      {viewerCurrentResult + 1} / {viewerSearchResults.length}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => navigateViewerResult("prev")}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => navigateViewerResult("next")}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>
          
          <div className="h-[60vh] overflow-y-auto p-4 bg-white" ref={viewerScrollRef}>
            {viewerLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="ml-2 text-muted-foreground">Se încarcă documentul...</span>
              </div>
            ) : viewerContent ? (
              <div className="space-y-1 max-w-3xl mx-auto">
                {viewerContent.paragraphs?.map((para: any, index: number) => {
                  const isMatch = viewerSearchResults.includes(index);
                  const isCurrentMatch = viewerSearchResults[viewerCurrentResult] === index;
                  
                  return (
                    <div
                      key={para.lineNumber}
                      id={`viewer-line-${para.lineNumber}`}
                      className={cn(
                        "flex gap-3 p-2 rounded transition-colors",
                        isCurrentMatch
                          ? "bg-yellow-200 border border-yellow-400"
                          : isMatch
                          ? "bg-yellow-50"
                          : "hover:bg-slate-50"
                      )}
                    >
                      <span className="text-xs text-muted-foreground font-mono w-10 text-right flex-shrink-0 select-none">
                        {para.lineNumber}
                      </span>
                      <p className="text-sm leading-relaxed text-slate-800">
                        {viewerSearchTerm
                          ? highlightText(para.text, viewerSearchTerm)
                          : para.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-50" />
                <p>Nu s-a putut încărca conținutul documentului.</p>
                <p className="text-sm">Documentul poate fi într-un format care necesită descărcare.</p>
              </div>
            )}
          </div>
          
          {viewerContent && (
            <div className="px-4 py-2 border-t bg-slate-50 text-xs text-muted-foreground flex items-center justify-between">
              <span>
                {viewerContent.totalParagraphs} paragrafe • {viewerContent.totalLines} linii
              </span>
              {viewerSearchTerm && (
                <span className="flex items-center gap-1">
                  <Highlighter className="h-3 w-3" />
                  Căutare: "{viewerSearchTerm}"
                </span>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Card profesional pentru afișarea unei citații - COLLAPSIBLE
 */
function CitationCard({ citation, onOpenViewer }: { citation: Citation; onOpenViewer?: (name: string, page: number) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isHighConfidence = citation.confidence >= 90;
  const isMediumConfidence = citation.confidence >= 70 && citation.confidence < 90;
  
  // Procesează textul pentru a-l face mai lizibil
  const formattedText = formatCitationText(citation.text);
  
  return (
    <Card 
      id={`citation-${citation.index}`}
      className={cn(
        "overflow-hidden transition-all duration-200 hover:shadow-lg",
        "border border-slate-200 shadow-md bg-white",
        isHighConfidence 
          ? "ring-1 ring-green-200" 
          : isMediumConfidence
          ? "ring-1 ring-blue-200"
          : "ring-1 ring-amber-200"
      )}
    >
      <CardContent className="p-0">
        {/* Header - Clickable pentru expand/collapse */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full px-4 py-3 flex items-center justify-between gap-2 text-left",
            "hover:opacity-80 transition-opacity",
            isHighConfidence 
              ? "bg-gradient-to-r from-green-50 to-green-100/50" 
              : isMediumConfidence
              ? "bg-gradient-to-r from-blue-50 to-blue-100/50"
              : "bg-gradient-to-r from-amber-50 to-amber-100/50"
          )}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Badge număr citare */}
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-sm shrink-0",
              isHighConfidence 
                ? "bg-green-500 text-white" 
                : isMediumConfidence
                ? "bg-blue-500 text-white"
                : "bg-amber-500 text-white"
            )}>
              {citation.index}
            </div>
            
            {/* Info document */}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-slate-800 truncate">
                {citation.documentName}
              </span>
              <span className="text-xs text-slate-500">
                {citation.articleNumber ? (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Art. {citation.articleNumber}
                    {citation.paragraphLetter && `, alin. ${citation.paragraphLetter}`}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Pagina {citation.pageNumber}
                  </span>
                )}
              </span>
            </div>
          </div>
          
          {/* Right side: Badge + Chevron */}
          <div className="flex items-center gap-2 shrink-0">
            <Badge 
              variant={isHighConfidence ? "default" : isMediumConfidence ? "secondary" : "outline"}
              className={cn(
                "text-xs font-medium px-2 py-1",
                !isHighConfidence && !isMediumConfidence && "border-amber-400 text-amber-700 bg-amber-50"
              )}
            >
              {citation.confidence}%
            </Badge>
            
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </div>
        </button>
        
        {/* Conținut formatat - Collapsible */}
        {isExpanded && (
          <>
            <div className="px-5 py-4 bg-white border-t border-slate-100">
              <div className="prose prose-sm max-w-none">
                {formattedText}
              </div>
            </div>
            
            {/* Footer cu metadate și buton viewer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {citation.documentName}
                </span>
                <span className="text-slate-300">|</span>
                <span>Pag. {citation.pageNumber}</span>
                {citation.articleNumber && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span>Art. {citation.articleNumber}</span>
                  </>
                )}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenViewer?.(citation.documentName, citation.pageNumber)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 flex items-center gap-1 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Vezi în document
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Formatează textul citației pentru lizibilitate
 */
function formatCitationText(text: string): React.ReactNode {
  // Împarte în paragrafe
  const paragraphs = text.split(/\n+/).filter(p => p.trim());
  
  return (
    <div className="space-y-3">
      {paragraphs.map((para, idx) => {
        // Dacă paragraful conține bullet points
        if (para.includes(' - ') || para.includes(' • ')) {
          const items = para.split(/(?: - | • )/).filter(i => i.trim());
          return (
            <ul key={idx} className="space-y-1.5 my-2">
              {items.map((item, iidx) => (
                <li key={iidx} className="flex items-start gap-2 text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                  <span className="leading-relaxed">{highlightValues(item.trim())}</span>
                </li>
              ))}
            </ul>
          );
        }
        
        // Paragraf normal
        return (
          <p key={idx} className="text-slate-700 leading-relaxed">
            {highlightValues(para)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Evidențiază valori numerice în text
 */
function highlightValues(text: string): React.ReactNode {
  // Pattern pentru valori numerice cu unități
  const pattern = /(\d+(?:[,.]\d+)?)\s*(mm²|mm2|mm|ohmi|ohm|Ω|MΩ|megaohmi|A|V|W|kW|m|cm|kg|%|grade|°C|°)/gi;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
    }
    
    parts.push(
      <strong 
        key={`v-${match.index}`}
        className="text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded font-bold border border-blue-200"
      >
        {match[0]}
      </strong>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push(<span key={`t-end`}>{text.substring(lastIndex)}</span>);
  }
  
  return parts.length > 0 ? <>{parts}</> : <>{text}</>;
}
