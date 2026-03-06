"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileUp, X, File, AlertCircle } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { useDropzone } from "react-dropzone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RAG_CONFIGURATIONS } from "@/src/infrastructure/config/rag-configs";

interface DocumentUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onSuccess?: () => void;
}

export function DocumentUpload({
  open,
  onOpenChange,
  workspaceId,
  onSuccess,
}: DocumentUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ragConfigId, setRagConfigId] = useState<string>("auto");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.oasis.opendocument.text': ['.odt'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    disabled: uploading,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("workspaceId", workspaceId);
        if (ragConfigId !== "auto") {
          formData.append("ragConfigId", ragConfigId);
        }

        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to upload ${file.name}`);
        }

        setProgress(((i + 1) / files.length) * 100);
      }

      onSuccess?.();
      onOpenChange(false);
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Încarcă documente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Config Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Tip de procesare
            </label>
            <Select value={ragConfigId} onValueChange={setRagConfigId}>
              <SelectTrigger>
                <SelectValue placeholder="Selectează tipul de document" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Detectare automată</SelectItem>
                {Object.values(RAG_CONFIGURATIONS).map((config) => (
                  <SelectItem key={config.id} value={config.id}>
                    {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {ragConfigId === "auto"
                ? "Sistemul va detecta automat tipul de document"
                : RAG_CONFIGURATIONS[ragConfigId]?.description}
            </p>
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50",
              uploading && "pointer-events-none opacity-50"
            )}
          >
            <input {...getInputProps()} />
            <FileUp className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-1">
              {isDragActive
                ? "Drop fișierele aici..."
                : "Drag & drop fișiere sau click pentru a selecta"}
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, DOCX, ODT, TXT (max 100MB)
            </p>
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Fișiere selectate ({files.length})
              </p>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-muted rounded"
                  >
                    <File className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.size)}
                      </p>
                    </div>
                    {!uploading && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress */}
          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-center text-muted-foreground">
                Se încarcă... {Math.round(progress)}%
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Anulează
            </Button>
            <Button
              onClick={handleUpload}
              disabled={files.length === 0 || uploading}
            >
              {uploading ? "Se încarcă..." : `Încarcă ${files.length} fișier${files.length !== 1 ? 'e' : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
