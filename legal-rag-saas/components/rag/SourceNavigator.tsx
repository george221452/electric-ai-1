'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Paragraph {
  id: string;
  paragraphNumber: number;
  text: string;
  pageNumber: number;
  articleNumber: string | null;
  paragraphLetter: string | null;
}

interface Document {
  id: string;
  title: string;
}

interface SourceNavigatorProps {
  paragraphId: string;
  documentName: string;
  onClose?: () => void;
}

export function SourceNavigator({ paragraphId, documentName, onClose }: SourceNavigatorProps) {
  const [data, setData] = useState<{ paragraph: Paragraph; surrounding: Paragraph[]; document: Document } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const fetchParagraph = async () => {
    if (data) {
      setIsOpen(true);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/paragraphs/${paragraphId}`);
      if (!res.ok) throw new Error('Eroare la încărcarea paragrafului');
      
      const result = await res.json();
      if (result.success) {
        setData(result.data);
        setIsOpen(true);
      } else {
        throw new Error(result.error || 'Eroare necunoscută');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare la încărcare');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={fetchParagraph}
        disabled={loading}
        className="text-blue-400 hover:text-blue-300 p-0 h-auto font-normal"
      >
        <FileText className="w-4 h-4 mr-1" />
        {loading ? 'Se încarcă...' : 'Vezi în document'}
      </Button>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm flex items-center gap-2">
        <span>{error}</span>
        <Button variant="ghost" size="sm" onClick={() => setError(null)}>✕</Button>
      </div>
    );
  }

  if (!data) return null;

  const { paragraph, surrounding } = data;
  const currentIndex = surrounding.findIndex(p => p.id === paragraph.id);

  return (
    <Card className="mt-3 bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          <CardTitle className="text-sm font-medium text-slate-200">
            {documentName}
          </CardTitle>
        </div>
        <div className="flex items-center gap-1">
          {onClose && (
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="h-7 w-7 p-0">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Paragraful {paragraph.paragraphNumber}</span>
          {paragraph.articleNumber && <span>Art. {paragraph.articleNumber}</span>}
          <span>Pag. {paragraph.pageNumber}</span>
        </div>
        
        <div className="space-y-2">
          {surrounding.map((p, idx) => (
            <div 
              key={p.id}
              className={`p-3 rounded-lg transition-colors ${
                p.id === paragraph.id 
                  ? 'bg-blue-500/20 border border-blue-500/30' 
                  : 'bg-slate-900/50 text-slate-400'
              }`}
            >
              <div className="text-xs text-slate-500 mb-1">§{p.paragraphNumber}</div>
              <p className={`leading-relaxed ${
                p.id === paragraph.id ? 'text-slate-100' : 'text-slate-400'
              }`}>
                {p.text}
              </p>
            </div>
          ))}
        </div>

        {surrounding.length === 0 && (
          <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
            <div className="text-xs text-slate-500 mb-1">§{paragraph.paragraphNumber}</div>
            <p className="text-slate-100 leading-relaxed">{paragraph.text}</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
          <span>{surrounding.length > 0 ? `${currentIndex + 1} din ${surrounding.length} paragrafe` : '1 paragraf'}</span>
          <span className="text-slate-600">Context: ±2 paragrafe</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Hook pentru a folosi navigatorul
export function useSourceNavigator() {
  const [activeSource, setActiveSource] = useState<{ paragraphId: string; documentName: string } | null>(null);

  const openSource = (paragraphId: string, documentName: string) => {
    setActiveSource({ paragraphId, documentName });
  };

  const closeSource = () => {
    setActiveSource(null);
  };

  return { activeSource, openSource, closeSource };
}
