'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Save, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  BarChart3,
  TestTube
} from 'lucide-react';

interface TestQuestion {
  id: string;
  question: string;
  expectedKeywords: string[];
  category: string;
  result?: {
    answer: string;
    citations: any[];
    confidence: number;
    score: number;
    keywordsFound: string[];
    keywordsMissing: string[];
    responseTime: number;
  };
}

const DEFAULT_QUESTIONS: TestQuestion[] = [
  {
    id: '1',
    question: 'Ce înălțime minimă trebuie să aibă prizele de curent montate în școli?',
    expectedKeywords: ['2,0 m', '2.0 m', 'școli', 'clase', 'peste 2'],
    category: 'instalatii'
  },
  {
    id: '2',
    question: 'Ce secțiune minimă trebuie să aibă conductorul de fază pentru circuite de prize monofazate?',
    expectedKeywords: ['2,5 mm', '2.5 mm', 'cupru'],
    category: 'conductoare'
  },
  {
    id: '3',
    question: 'Ce culoare trebuie să aibă conductorul de protecție PE?',
    expectedKeywords: ['verde', 'galben', 'verde-galben'],
    category: 'conductoare'
  },
  {
    id: '4',
    question: 'Ce înălțime trebuie să aibă prizele montate în locuințe obișnuite?',
    expectedKeywords: ['0,1 m', '0.1 m', '10 cm', 'pardoseală'],
    category: 'instalatii'
  },
  {
    id: '5',
    question: 'Ce tip de protecție se folosește pentru prizele din baie?',
    expectedKeywords: ['diferențial', 'DDR', '30 mA'],
    category: 'protectie'
  }
];

export default function RAGTestPage() {
  const [questions, setQuestions] = useState<TestQuestion[]>(DEFAULT_QUESTIONS);
  const [newQuestion, setNewQuestion] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState(0);
  const [activeTab, setActiveTab] = useState('run');

  const runTest = async (question: TestQuestion): Promise<TestQuestion> => {
    const startTime = Date.now();
    
    try {
      const response = await fetch('/api/rag/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': 'demo-user'
        },
        body: JSON.stringify({
          query: question.question,
          workspaceId: '550e8400-e29b-41d4-a716-446655440000'
        })
      });

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      if (!data.success) {
        return {
          ...question,
          result: {
            answer: 'Error: ' + (data.error || 'Unknown error'),
            citations: [],
            confidence: 0,
            score: 0,
            keywordsFound: [],
            keywordsMissing: question.expectedKeywords,
            responseTime
          }
        };
      }

      // Analyze keywords
      const answerLower = data.data.answer.toLowerCase();
      const found: string[] = [];
      const missing: string[] = [];

      for (const keyword of question.expectedKeywords) {
        if (answerLower.includes(keyword.toLowerCase())) {
          found.push(keyword);
        } else {
          missing.push(keyword);
        }
      }

      const score = question.expectedKeywords.length > 0
        ? Math.round((found.length / question.expectedKeywords.length) * 100)
        : 0;

      return {
        ...question,
        result: {
          answer: data.data.answer,
          citations: data.data.citations || [],
          confidence: data.data.confidence || 0,
          score,
          keywordsFound: found,
          keywordsMissing: missing,
          responseTime
        }
      };
    } catch (error) {
      return {
        ...question,
        result: {
          answer: 'Error: ' + (error instanceof Error ? error.message : 'Unknown error'),
          citations: [],
          confidence: 0,
          score: 0,
          keywordsFound: [],
          keywordsMissing: question.expectedKeywords,
          responseTime: Date.now() - startTime
        }
      };
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setCurrentTest(0);

    for (let i = 0; i < questions.length; i++) {
      setCurrentTest(i + 1);
      const result = await runTest(questions[i]);
      setQuestions(prev => [...prev.slice(0, i), result, ...prev.slice(i + 1)]);
      await new Promise(r => setTimeout(r, 1000));
    }

    setIsRunning(false);
    setActiveTab('results');
  };

  const addQuestion = () => {
    if (!newQuestion.trim()) return;
    const keywords = newKeywords.split(',').map(k => k.trim()).filter(Boolean);
    
    setQuestions([...questions, {
      id: Date.now().toString(),
      question: newQuestion,
      expectedKeywords: keywords,
      category: 'custom'
    }]);
    
    setNewQuestion('');
    setNewKeywords('');
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 60) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const passedCount = questions.filter(q => (q.result?.score || 0) >= 60).length;
  const avgScore = questions.filter(q => q.result).length > 0
    ? Math.round(questions.filter(q => q.result).reduce((sum, q) => sum + (q.result?.score || 0), 0) / questions.filter(q => q.result).length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <TestTube className="w-8 h-8 text-blue-600" />
          RAG Test Suite
        </h1>
        <p className="text-muted-foreground mt-2">
          Testează și validează calitatea răspunsurilor RAG pe baza normativului I7-2011
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{questions.length}</div>
            <div className="text-sm text-gray-600">Întrebări totale</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{passedCount}</div>
            <div className="text-sm text-gray-600">Teste reușite (≥60%)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{avgScore}%</div>
            <div className="text-sm text-gray-600">Scor mediu</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {questions.filter(q => q.result).length}
            </div>
            <div className="text-sm text-gray-600">Teste completate</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="run">
            <Play className="w-4 h-4 mr-2" />
            Rulează Teste
          </TabsTrigger>
          <TabsTrigger value="questions">
            <BarChart3 className="w-4 h-4 mr-2" />
            Gestionează Întrebări
          </TabsTrigger>
          <TabsTrigger value="results">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Rezultate
          </TabsTrigger>
        </TabsList>

        <TabsContent value="run">
          <Card>
            <CardHeader>
              <CardTitle>Rulează Teste RAG</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button 
                  onClick={runAllTests} 
                  disabled={isRunning || questions.length === 0}
                  className="flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  {isRunning ? `Se testează... (${currentTest}/${questions.length})` : 'Rulează toate testele'}
                </Button>

                {isRunning && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                      <span className="font-medium">Se testează întrebarea {currentTest} din {questions.length}...</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${(currentTest / questions.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {questions.map((q, idx) => (
                    <div 
                      key={q.id} 
                      className={`p-3 rounded-lg border ${
                        q.result 
                          ? getScoreColor(q.result.score)
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">#{idx + 1}</span>
                          <span className="text-sm">{q.question.substring(0, 80)}...</span>
                        </div>
                        {q.result && (
                          <Badge variant="outline" className="font-mono">
                            {q.result.score}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions">
          <Card>
            <CardHeader>
              <CardTitle>Adaugă Întrebare Nouă</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Întrebare</label>
                  <Textarea
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder="Ex: Ce înălțime trebuie să aibă prizele în școli?"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Cuvinte cheie așteptate (separate prin virgulă)</label>
                  <Input
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                    placeholder="Ex: 2,0 m, școli, peste 2"
                  />
                </div>
                <Button onClick={addQuestion} disabled={!newQuestion.trim()}>
                  <Save className="w-4 h-4 mr-2" />
                  Adaugă întrebare
                </Button>
              </div>

              <div className="mt-8">
                <h3 className="font-medium mb-4">Întrebări existente ({questions.length})</h3>
                <div className="space-y-2">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-500 mt-0.5">#{idx + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm">{q.question}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Keywords: {q.expectedKeywords.join(', ')}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeQuestion(q.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          <div className="space-y-4">
            {questions.filter(q => q.result).map((q, idx) => (
              <Card key={q.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-gray-500">#{idx + 1}</span>
                        <Badge variant="outline">{q.category}</Badge>
                      </div>
                      <CardTitle className="text-base font-medium">{q.question}</CardTitle>
                    </div>
                    <Badge className={getScoreColor(q.result!.score)}>
                      {q.result!.score}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Răspuns:</h4>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm">
                      {q.result!.answer.substring(0, 300)}
                      {q.result!.answer.length > 300 && '...'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-green-700 mb-1">
                        <CheckCircle2 className="w-4 h-4 inline mr-1" />
                        Keywords găsite ({q.result!.keywordsFound.length})
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {q.result!.keywordsFound.map((k, i) => (
                          <Badge key={i} variant="secondary" className="text-xs bg-green-100">
                            {k}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-red-700 mb-1">
                        <XCircle className="w-4 h-4 inline mr-1" />
                        Keywords lipsă ({q.result!.keywordsMissing.length})
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {q.result!.keywordsMissing.map((k, i) => (
                          <Badge key={i} variant="secondary" className="text-xs bg-red-100">
                            {k}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 text-sm text-gray-600">
                    <span>Confidence: {q.result!.confidence}%</span>
                    <span>Citații: {q.result!.citations.length}</span>
                    <span>Timp: {q.result!.responseTime}ms</span>
                  </div>
                </CardContent>
              </Card>
            ))}

            {questions.filter(q => q.result).length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Nu există rezultate. Rulează testele mai întâi.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
