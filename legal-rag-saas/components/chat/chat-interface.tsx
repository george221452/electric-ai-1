"use client";

import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, FileText, AlertCircle, ExternalLink } from "lucide-react";
import { SourceNavigator } from "@/components/rag/SourceNavigator";
import { cn, formatDate } from "@/lib/utils";

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

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: messageContent,
                citations: data.data.citations || [],
                confidence: data.data.confidence,
                disclaimer: data.data.disclaimer,
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
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-background rounded-lg border">
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
        <div className="text-xs text-muted-foreground">
          Răspunsuri bazate exclusiv pe documentele încărcate
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
                  "max-w-[85%] rounded-lg p-4",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <div className="prose prose-sm max-w-none">
                  {message.content || (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground">
                        Se analizează documentele...
                      </span>
                    </div>
                  )}
                </div>

                {/* Citations */}
                {message.citations && message.citations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-xs font-medium mb-2 text-muted-foreground">
                      Surse:
                    </p>
                    <div className="space-y-2">
                      {message.citations.map((citation) => (
                        <div key={citation.index} className="space-y-2">
                          <Card
                            className="bg-background/50 border-l-4 border-l-blue-500"
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                <span className="font-semibold text-blue-600">
                                  [{citation.index}]
                                </span>
                                <span>{citation.documentName}</span>
                                {citation.articleNumber ? (
                                  <span>
                                    Art. {citation.articleNumber}
                                    {citation.paragraphLetter &&
                                      ` alin. ${citation.paragraphLetter}`}
                                  </span>
                                ) : (
                                  <span>Pag. {citation.pageNumber}</span>
                                )}
                                <Badge
                                  variant={
                                    citation.confidence >= 90
                                      ? "default"
                                      : citation.confidence >= 70
                                      ? "secondary"
                                      : "destructive"
                                  }
                                  className="text-[10px]"
                                >
                                  {citation.confidence}% acuratețe
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-2 text-[10px] ml-auto"
                                  onClick={() => window.open(`/normativ.odt#page=${citation.pageNumber}`, '_blank')}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Vezi în document
                                </Button>
                              </div>
                              <p className="text-sm text-foreground line-clamp-3">
                                {citation.text}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Pagina {citation.pageNumber}
                                {citation.articleNumber && (
                                  <span> • Art. {citation.articleNumber}</span>
                                )}
                                <span className="mx-2">•</span>
                                <a 
                                  href={`/normativ.odt#page=${citation.pageNumber}&paragraph=${citation.paragraphId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline font-medium"
                                >
                                  Deschide document
                                </a>
                              </p>
                            </CardContent>
                          </Card>
                          
                          {/* Source Navigator */}
                          <SourceNavigator 
                            paragraphId={citation.paragraphId}
                            documentName={citation.documentName}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                {message.disclaimer && (
                  <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-yellow-50 p-2 rounded">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-600" />
                    <span>{message.disclaimer}</span>
                  </div>
                )}

                {/* Confidence */}
                {message.confidence !== undefined && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Încredere: {message.confidence}%
                  </div>
                )}

                {/* Timestamp */}
                <div className="mt-1 text-[10px] text-muted-foreground/70">
                  {formatDate(message.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Reference Search */}
      <div className="px-4 py-2 border-t bg-muted/50">
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
              <Card key={idx} className="bg-background border-l-2 border-l-green-500">
                <CardContent className="p-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{result.documentName}, Pag. {result.pageNumber}</span>
                    <a 
                      href={`/normativ.odt#page=${result.pageNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Deschide
                    </a>
                  </div>
                  <p className="text-muted-foreground line-clamp-3">{result.excerpt}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t bg-background"
      >
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrie o întrebare despre documentele tale..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Răspunsurile sunt generate pe baza documentelor tale cu citate exacte.
        </p>
      </form>
    </div>
  );
}
