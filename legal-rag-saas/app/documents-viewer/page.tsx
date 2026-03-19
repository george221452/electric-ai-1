"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  X,
  ExternalLink,
  Highlighter,
  List
} from "lucide-react";
import Link from "next/link";

interface Document {
  name: string;
  size: number;
  modified: string;
}

interface Paragraph {
  lineNumber: number;
  text: string;
}

interface DocumentContent {
  filename: string;
  content: string;
  paragraphs: Paragraph[];
  totalLines: number;
  totalParagraphs: number;
}

function DocumentsViewerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFile = searchParams.get("file");

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(initialFile);
  const [documentContent, setDocumentContent] = useState<DocumentContent | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load list of documents
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Load document content when selected
  useEffect(() => {
    if (selectedFile) {
      loadDocument(selectedFile);
    }
  }, [selectedFile]);

  // Search within document when searchTerm changes
  useEffect(() => {
    if (searchTerm && documentContent) {
      performSearch(searchTerm);
    } else {
      setSearchResults([]);
      setCurrentResultIndex(-1);
    }
  }, [searchTerm, documentContent]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/documents/list?workspaceId=550e8400-e29b-41d4-a716-446655440000");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (e) {
      console.error("Failed to fetch documents:", e);
    }
  };

  const loadDocument = async (filename: string) => {
    setLoading(true);
    setError(null);
    try {
      // Try new endpoint first (from database)
      let res = await fetch(`/api/documents/view?name=${encodeURIComponent(filename)}&workspaceId=550e8400-e29b-41d4-a716-446655440000`);
      
      // Fallback to old endpoint if new one fails
      if (!res.ok) {
        res = await fetch(`/api/documents/content?file=${encodeURIComponent(filename)}&workspaceId=550e8400-e29b-41d4-a716-446655440000`);
      }
      
      if (res.ok) {
        const data = await res.json();
        setDocumentContent(data);
      } else {
        setError("Failed to load document");
      }
    } catch (e) {
      setError("Error loading document");
    } finally {
      setLoading(false);
    }
  };

  const performSearch = (term: string) => {
    if (!documentContent || !term) return;

    const results: number[] = [];
    const lowerTerm = term.toLowerCase();

    documentContent.paragraphs.forEach((para, index) => {
      if (para.text.toLowerCase().includes(lowerTerm)) {
        results.push(index);
      }
    });

    setSearchResults(results);
    setCurrentResultIndex(results.length > 0 ? 0 : -1);
  };

  const navigateToResult = (direction: "next" | "prev") => {
    if (searchResults.length === 0) return;

    if (direction === "next") {
      setCurrentResultIndex((prev) => 
        prev >= searchResults.length - 1 ? 0 : prev + 1
      );
    } else {
      setCurrentResultIndex((prev) => 
        prev <= 0 ? searchResults.length - 1 : prev - 1
      );
    }
  };

  const highlightedText = (text: string, term: string) => {
    if (!term) return text;
    
    const parts = text.split(new RegExp(`(${term})`, "gi"));
    return parts.map((part, i) => 
      part.toLowerCase() === term.toLowerCase() ? (
        <mark key={i} className="bg-yellow-300 text-black px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const currentResultLine = useMemo(() => {
    if (currentResultIndex >= 0 && searchResults.length > 0) {
      return documentContent?.paragraphs[searchResults[currentResultIndex]]?.lineNumber;
    }
    return null;
  }, [currentResultIndex, searchResults, documentContent]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Înapoi la Chat
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Vizualizare Documente</h1>
        </div>
        <div className="text-sm text-muted-foreground">
          {documents.length} documente încărcate
        </div>
      </header>

      <div className="flex h-[calc(100vh-60px)]">
        {/* Sidebar - Document List */}
        <aside className="w-80 bg-white border-r flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-medium flex items-center gap-2">
              <List className="h-4 w-4" />
              Documente disponibile
            </h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {documents.map((doc) => (
                <button
                  key={doc.name}
                  onClick={() => setSelectedFile(doc.name)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedFile === doc.name
                      ? "bg-blue-50 border-blue-200 border"
                      : "hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(doc.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {selectedFile ? (
            <>
              {/* Toolbar */}
              <div className="bg-white border-b p-4 flex items-center gap-4">
                <div className="flex-1 max-w-xl">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Caută în document... (ex: 4 ohm, priză pământ)"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {searchResults.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {currentResultIndex + 1} / {searchResults.length}
                    </Badge>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigateToResult("prev")}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigateToResult("next")}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    setDocumentContent(null);
                    setSearchTerm("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Document Info */}
              {documentContent && (
                <div className="bg-slate-50 border-b px-4 py-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{documentContent.filename}</span>
                    <span className="text-muted-foreground">
                      {documentContent.totalParagraphs} paragrafe
                    </span>
                    <span className="text-muted-foreground">
                      {documentContent.totalLines} linii
                    </span>
                  </div>
                  {searchResults.length > 0 && (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                      <Highlighter className="h-3 w-3 mr-1" />
                      {searchResults.length} rezultate găsite
                    </Badge>
                  )}
                </div>
              )}

              {/* Document Content */}
              <ScrollArea className="flex-1 p-6">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Se încarcă documentul...</p>
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center h-full text-red-500">
                    {error}
                  </div>
                ) : documentContent ? (
                  <div className="max-w-4xl mx-auto space-y-2">
                    {documentContent.paragraphs.map((para, index) => {
                      const isCurrentResult = searchResults[currentResultIndex] === index;
                      const isMatch = searchResults.includes(index);

                      return (
                        <div
                          key={para.lineNumber}
                          id={`line-${para.lineNumber}`}
                          className={`p-2 rounded transition-colors ${
                            isCurrentResult
                              ? "bg-yellow-100 border border-yellow-400"
                              : isMatch
                              ? "bg-yellow-50"
                              : "hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex gap-4">
                            <span className="text-xs text-muted-foreground font-mono w-12 text-right flex-shrink-0">
                              {para.lineNumber}
                            </span>
                            <p className="text-sm leading-relaxed text-slate-800">
                              {searchTerm
                                ? highlightedText(para.text, searchTerm)
                                : para.text}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <Card className="w-96">
                <CardContent className="pt-6 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Selectează un document din lista din stânga pentru a-l vizualiza
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


// Wrapper cu Suspense pentru useSearchParams
export default function DocumentsViewerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Se încarcă...</div>}>
      <DocumentsViewerContent />
    </Suspense>
  );
}
