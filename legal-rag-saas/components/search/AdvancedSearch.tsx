"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileText, BookOpen, Loader2, ExternalLink } from "lucide-react";

interface SearchResult {
  id: string;
  pageNumber: number;
  documentName: string;
  content: string;
  highlightedContent: string;
  score: number;
}

interface AdvancedSearchProps {
  workspaceId: string;
}

export function AdvancedSearch({ workspaceId }: AdvancedSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [searchType, setSearchType] = useState<"keyword" | "article" | "table">("keyword");

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsLoading(true);
    setResults([]);
    
    try {
      const response = await fetch("/api/rag/advanced-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchTerm,
          workspaceId,
          type: searchType,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.data.results || []);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const openDocument = (page: number) => {
    setSelectedPage(page);
    window.open(`/normativ.odt#page=${page}`, '_blank');
  };

  const highlightText = (text: string, term: string) => {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  };

  const quickReferences = [
    { label: "Tabelul 4.1", value: "tabelul 4.1" },
    { label: "Art. 4.1.5", value: "articolul 4.1.5" },
    { label: "Art. 5.5.3", value: "articolul 5.5.3" },
    { label: "Tabelul 5.18", value: "tabelul 5.18" },
    { label: "DDR 30mA", value: "DDR 30 mA" },
    { label: "Împământare", value: "priza de pamant" },
    { label: "Priza baie", value: "priza baie zona" },
    { label: "Selectivitate", value: "selectivitate DDR" },
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Căutare Avansată în Normativ
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={searchType} onValueChange={(v) => setSearchType(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="keyword">Cuvinte Cheie</TabsTrigger>
            <TabsTrigger value="article">Articole</TabsTrigger>
            <TabsTrigger value="table">Tabele</TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  searchType === "keyword" 
                    ? "Caută cuvinte cheie (ex: DDR, împământare...)"
                    : searchType === "article"
                    ? "Caută articol (ex: 4.1.5, 5.5.3...)"
                    : "Caută tabel (ex: 4.1, 5.18...)"
                }
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button 
                onClick={handleSearch}
                disabled={isLoading || !searchTerm.trim()}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {quickReferences.map((ref) => (
                <Button
                  key={ref.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm(ref.value);
                    handleSearch();
                  }}
                  className="text-xs"
                >
                  {ref.label}
                </Button>
              ))}
            </div>

            {results.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">
                    {results.length} rezultate găsite
                  </p>
                </div>

                <ScrollArea className="h-[400px] border rounded-md">
                  <div className="p-4 space-y-3">
                    {results.map((result, idx) => (
                      <Card 
                        key={result.id} 
                        className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedPage === result.pageNumber ? 'border-blue-500' : ''
                        }`}
                        onClick={() => openDocument(result.pageNumber)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  Pag. {result.pageNumber}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {result.documentName}
                                </span>
                                <Badge 
                                  variant={result.score > 0.7 ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {Math.round(result.score * 100)}%
                                </Badge>
                              </div>
                              <p 
                                className="text-sm text-foreground"
                                dangerouslySetInnerHTML={{ 
                                  __html: highlightText(result.highlightedContent, searchTerm) 
                                }}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDocument(result.pageNumber);
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {results.length === 0 && !isLoading && searchTerm && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>Niciun rezultat găsit pentru "{searchTerm}"</p>
                <p className="text-sm mt-1">Încercați alți termeni sau verificați ortografia</p>
              </div>
            )}
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
