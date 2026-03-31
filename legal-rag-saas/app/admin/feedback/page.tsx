'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, MessageSquare, Eye } from 'lucide-react';

export default function FeedbackPage() {
  const feedbacks = [
    {
      id: '1',
      query: 'Ce înălțime trebuie să aibă prizele în școli?',
      answer: 'În școli, prizele trebuie montate la înălțimea de minim 2,0 m...',
      rating: 2,
      user: 'Ion Popescu',
      date: '2024-03-26',
      confidence: 85,
    },
    {
      id: '2',
      query: 'Ce secțiune trebuie pentru conductorul de protecție?',
      answer: 'Conductorul de protecție PE trebuie să aibă aceeași secțiune...',
      rating: 1,
      user: 'Maria Ionescu',
      date: '2024-03-25',
      confidence: 45,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Feedback Utilizatori</h1>
        <p className="text-muted-foreground">
          Rating-uri și feedback pentru răspunsurile RAG
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pozitiv</CardTitle>
            <ThumbsUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">117</div>
            <p className="text-xs text-muted-foreground">75%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Negativ</CardTitle>
            <ThumbsDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">39</div>
            <p className="text-xs text-muted-foreground">25%</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {feedbacks.map((feedback) => (
          <Card key={feedback.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {feedback.rating === 2 ? (
                      <Badge className="bg-green-500">
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        Pozitiv
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <ThumbsDown className="w-3 h-3 mr-1" />
                        Negativ
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">{feedback.user} • {feedback.date}</span>
                  </div>
                  <p className="font-medium mb-2">Q: {feedback.query}</p>
                  <p className="text-sm text-muted-foreground mb-2">A: {feedback.answer}</p>
                  <p className="text-xs text-muted-foreground">Confidence: {feedback.confidence}%</p>
                </div>
                <Button variant="ghost" size="icon">
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
