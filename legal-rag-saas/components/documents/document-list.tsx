"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  MoreVertical, 
  Trash2, 
  RefreshCw, 
  CheckCircle2,
  AlertCircle,
  Clock,
  FileUp
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatBytes, formatDate, truncate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { DocumentUpload } from "./document-upload";

interface Document {
  id: string;
  name: string;
  fileType: string;
  fileSize: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  pageCount?: number;
  paragraphCount?: number;
  ragConfigId: string;
  processingError?: string;
  createdAt: string;
}

interface DocumentListProps {
  workspaceId: string;
  onDocumentSelect?: (documentIds: string[]) => void;
  selectedDocuments?: string[];
}

export function DocumentList({ 
  workspaceId, 
  onDocumentSelect,
  selectedDocuments = []
}: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/documents?workspaceId=${workspaceId}`
      );
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.data.documents);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  const handleDelete = async (documentId: string) => {
    if (!confirm("Sigur doriți să ștergeți acest document?")) return;

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      }
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  const handleRetry = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/retry`, {
        method: "POST",
      });

      if (response.ok) {
        fetchDocuments();
      }
    } catch (error) {
      console.error("Failed to retry processing:", error);
    }
  };

  // Load documents on mount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const toggleSelection = (documentId: string) => {
    if (!onDocumentSelect) return;

    const newSelection = selectedDocuments.includes(documentId)
      ? selectedDocuments.filter((id) => id !== documentId)
      : [...selectedDocuments, documentId];

    onDocumentSelect(newSelection);
  };

  const getStatusIcon = (status: Document["status"]) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "PROCESSING":
        return <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case "FAILED":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: Document["status"]) => {
    switch (status) {
      case "COMPLETED":
        return <Badge variant="success">Procesat</Badge>;
      case "PROCESSING":
        return <Badge variant="warning">Se procesează...</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Eroare</Badge>;
      default:
        return <Badge variant="secondary">În așteptare</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Documente ({documents.length})
        </h3>
        <Button onClick={() => setUploadOpen(true)} size="sm">
          <FileUp className="h-4 w-4 mr-2" />
          Încarcă document
        </Button>
      </div>

      {documents.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Niciun document</h3>
          <p className="text-muted-foreground mb-4">
            Încarcă primul tău document pentru a începe să pui întrebări.
          </p>
          <Button onClick={() => setUploadOpen(true)}>
            <FileUp className="h-4 w-4 mr-2" />
            Încarcă document
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <Card
              key={doc.id}
              className={cn(
                "transition-colors",
                onDocumentSelect && "cursor-pointer hover:border-primary",
                selectedDocuments.includes(doc.id) && "border-primary ring-1 ring-primary"
              )}
              onClick={() => toggleSelection(doc.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="mt-1">{getStatusIcon(doc.status)}</div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium truncate">
                          {truncate(doc.name, 60)}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <span>{formatBytes(doc.fileSize)}</span>
                          <span>•</span>
                          <span>{formatDate(doc.createdAt)}</span>
                          {doc.pageCount && (
                            <>
                              <span>•</span>
                              <span>{doc.pageCount} pagini</span>
                            </>
                          )}
                          {doc.paragraphCount !== undefined && (
                            <>
                              <span>•</span>
                              <span>{doc.paragraphCount} paragrafe</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getStatusBadge(doc.status)}
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {doc.status === "FAILED" && (
                              <DropdownMenuItem onClick={() => handleRetry(doc.id)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Reîncearcă procesarea
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDelete(doc.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Șterge
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {doc.processingError && (
                      <p className="text-sm text-destructive mt-2">
                        Eroare: {doc.processingError}
                      </p>
                    )}

                    {doc.ragConfigId && (
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs">
                          {doc.ragConfigId}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DocumentUpload
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        workspaceId={workspaceId}
        onSuccess={fetchDocuments}
      />
    </div>
  );
}
