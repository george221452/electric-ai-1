'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FeedbackButtonsProps {
  query: string;
  answer: string;
  confidence: number;
  citations: any[];
  metadata?: {
    scenario?: any;
    fromCache?: boolean;
  };
  workspaceId: string;
  onFeedbackSubmitted?: () => void;
}

export function FeedbackButtons({
  query,
  answer,
  confidence,
  citations,
  metadata,
  workspaceId,
  onFeedbackSubmitted,
}: FeedbackButtonsProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [rating, setRating] = useState<1 | 2 | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleRate = (newRating: 1 | 2) => {
    setRating(newRating);
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!rating) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          answer,
          rating,
          reason: reason.trim() || undefined,
          confidence,
          citations,
          metadata,
          workspaceId,
        }),
      });

      if (response.ok) {
        setIsSubmitted(true);
        onFeedbackSubmitted?.();
        setTimeout(() => {
          setShowDialog(false);
          setIsSubmitted(false);
          setReason('');
          setRating(null);
        }, 1500);
      } else {
        console.error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 mt-4 pt-4 border-t">
        <span className="text-sm text-muted-foreground">A fost util acest răspuns?</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleRate(2)}
          className="h-8 w-8 p-0"
          title="Da, util"
        >
          <ThumbsUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleRate(1)}
          className="h-8 w-8 p-0"
          title="Nu, nu a fost util"
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rating === 2 ? 'Mulțumim pentru feedback!' : 'Ne pare rău că nu a fost util'}
            </DialogTitle>
            <DialogDescription>
              {rating === 2
                ? 'Ne bucurăm că răspunsul v-a fost de ajutor.'
                : 'Ajutați-ne să îmbunătățim răspunsurile.'}
            </DialogDescription>
          </DialogHeader>

          {isSubmitted ? (
            <div className="py-8 text-center">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-muted-foreground">Feedback salvat cu succes!</p>
            </div>
          ) : (
            <>
              {rating === 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Ce ar putea fi îmbunătățit? (opțional)
                  </label>
                  <Textarea
                    placeholder="Descrieți ce informație a lipsit sau ce nu a fost clar..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                  disabled={isSubmitting}
                >
                  Anulează
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Se salvează...' : 'Trimite'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
