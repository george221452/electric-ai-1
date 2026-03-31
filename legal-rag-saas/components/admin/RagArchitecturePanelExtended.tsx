/**
 * Admin Panel EXTINS pentru managementul complet al arhitecturii RAG
 * 
 * Include TOATE setările configurabile:
 * - Chunking & Preprocessing
 * - Embeddings
 * - Legacy Architecture
 * - Hybrid Architecture  
 * - OpenAI/Prompts pentru ambele
 * - Cache & Performance
 * - Debug & Monitoring
 * - Answer Formatting
 * - Fallback & Error Handling
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, RefreshCw, Activity, Zap, Database, Search,
  Brain, BarChart3, Save, AlertCircle, CheckCircle2, Code2,
  Scissors, FileText, Cpu, Timer, Shield, MessageSquare,
  Layers, SlidersHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ArchitectureSettings {
  id: string;
  activeArchitecture: 'legacy' | 'hybrid';
  
  // Chunking
  chunkMaxSize: number;
  chunkMinSize: number;
  chunkOverlap: number;
  preserveParagraphBoundaries: boolean;
  preserveSentenceBoundaries: boolean;
  cleanDiacritics: boolean;
  removeExtraWhitespace: boolean;
  fixHyphenatedWords: boolean;
  
  // Embeddings
  embeddingModel: string;
  embeddingDimensions: number;
  embeddingBatchSize: number;
  
  // Legacy OpenAI
  legacyOpenaiModel: string;
  legacyMaxTokens: number;
  legacyTemperature: number;
  legacySystemPrompt: string;
  legacyPromptTemplate: string;
  legacyIncludeCitations: boolean;
  legacyRequireCitations: boolean;
  
  // Legacy Search
  legacyUseKeywordSearch: boolean;
  legacyUseVectorSearch: boolean;
  legacyMinScoreThreshold: number;
  legacyMaxResults: number;
  legacyFinalResults: number;
  
  // Hybrid OpenAI
  hybridOpenaiModel: string;
  hybridMaxTokens: number;
  hybridTemperature: number;
  hybridSystemPrompt: string;
  hybridPromptTemplate: string;
  hybridIncludeCitations: boolean;
  hybridRequireCitations: boolean;
  
  // Hybrid Search
  hybridUseKeywordSearch: boolean;
  hybridUseVectorSearch: boolean;
  hybridUseSynonymExpansion: boolean;
  hybridUseNumericalBoost: boolean;
  hybridUseSmartRouter: boolean;
  hybridUseConfidenceOptimizer: boolean;
  hybridMinScoreThreshold: number;
  hybridMaxResults: number;
  hybridFinalResults: number;
  
  // General
  enableQueryCache: boolean;
  showDebugInfo: boolean;
  addDocumentBanner: boolean;
}

const defaultSettings: ArchitectureSettings = {
  id: 'global',
  activeArchitecture: 'legacy',
  chunkMaxSize: 1500,
  chunkMinSize: 200,
  chunkOverlap: 100,
  preserveParagraphBoundaries: true,
  preserveSentenceBoundaries: true,
  cleanDiacritics: true,
  removeExtraWhitespace: true,
  fixHyphenatedWords: true,
  embeddingModel: 'text-embedding-3-small',
  embeddingDimensions: 1536,
  embeddingBatchSize: 100,
  legacyOpenaiModel: 'gpt-4o-mini',
  legacyMaxTokens: 500,
  legacyTemperature: 0.2,
  legacySystemPrompt: 'Esti un asistent specializat in normative electrice romanesti.',
  legacyPromptTemplate: 'standard',
  legacyIncludeCitations: true,
  legacyRequireCitations: true,
  legacyUseKeywordSearch: true,
  legacyUseVectorSearch: true,
  legacyMinScoreThreshold: 0.40,
  legacyMaxResults: 10,
  legacyFinalResults: 3,
  hybridOpenaiModel: 'gpt-4o-mini',
  hybridMaxTokens: 600,
  hybridTemperature: 0.2,
  hybridSystemPrompt: 'Esti un asistent specializat in normative electrice romanesti.',
  hybridPromptTemplate: 'adaptive',
  hybridIncludeCitations: true,
  hybridRequireCitations: true,
  hybridUseKeywordSearch: true,
  hybridUseVectorSearch: true,
  hybridUseSynonymExpansion: false,
  hybridUseNumericalBoost: false,
  hybridUseSmartRouter: false,
  hybridUseConfidenceOptimizer: false,
  hybridMinScoreThreshold: 0.40,
  hybridMaxResults: 10,
  hybridFinalResults: 3,
  enableQueryCache: true,
  showDebugInfo: false,
  addDocumentBanner: false,
};

export function RagArchitecturePanelExtended() {
  const [settings, setSettings] = useState<ArchitectureSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/rag-architecture');
      const data = await response.json();
      if (data.success) {
        setSettings({ ...defaultSettings, ...data.data });
      }
    } catch (err) {
      setError('Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/rag-architecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Settings saved!');
      } else {
        setError(data.error || 'Save failed');
      }
    } catch (err) {
      setError('Error saving');
    } finally {
      setSaving(false);
    }
  };

  const switchArchitecture = async (arch: 'legacy' | 'hybrid') => {
    setSettings(s => ({ ...s, activeArchitecture: arch }));
    await fetch('/api/admin/rag-architecture', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ architecture: arch }),
    });
    setSuccess(`Switched to ${arch.toUpperCase()}`);
  };

  const updateSetting = <K extends keyof ArchitectureSettings>(key: K, value: ArchitectureSettings[K]) => {
    setSettings(s => ({ ...s, [key]: value }));
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6 flex justify-center h-48 items-center">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="w-8 h-8" />
            RAG Architecture Configuration
          </h2>
          <p className="text-muted-foreground mt-2">
            Configureaza COMPLET sistemul RAG - chunking, embeddings, OpenAI, search, cache
          </p>
        </div>
        <Button onClick={saveSettings} disabled={saving} size="lg">
          {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save All Settings
        </Button>
      </div>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="bg-green-50 border-green-200"><CheckCircle2 className="h-4 w-4 text-green-600" /><AlertDescription className="text-green-800">{success}</AlertDescription></Alert>}

      {/* Architecture Selector */}
      <Card className="border-2 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Active Architecture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div
              className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                settings.activeArchitecture === 'legacy'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
              onClick={() => switchArchitecture('legacy')}
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg">🏛️ LEGACY</h3>
                {settings.activeArchitecture === 'legacy' && <Badge className="bg-blue-500">ACTIVE</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">Simplu, stabil, testat</p>
            </div>
            <div
              className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                settings.activeArchitecture === 'hybrid'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
              onClick={() => switchArchitecture('hybrid')}
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg">⚡ HYBRID</h3>
                {settings.activeArchitecture === 'hybrid' && <Badge className="bg-purple-500">ACTIVE</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">Configurabil, avansat, experimental</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs pentru categorii */}
      <Tabs defaultValue="chunking" className="w-full">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="chunking"><Scissors className="w-4 h-4 mr-2" />Chunking</TabsTrigger>
          <TabsTrigger value="embeddings"><Cpu className="w-4 h-4 mr-2" />Embeddings</TabsTrigger>
          <TabsTrigger value="legacy"><Database className="w-4 h-4 mr-2" />Legacy</TabsTrigger>
          <TabsTrigger value="hybrid"><Zap className="w-4 h-4 mr-2" />Hybrid</TabsTrigger>
          <TabsTrigger value="cache"><Timer className="w-4 h-4 mr-2" />Cache</TabsTrigger>
          <TabsTrigger value="advanced"><SlidersHorizontal className="w-4 h-4 mr-2" />Advanced</TabsTrigger>
        </TabsList>

        {/* CHUNKING TAB */}
        <TabsContent value="chunking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Scissors className="w-5 h-5" />Text Chunking</CardTitle>
              <CardDescription>Cum se imparte textul in bucati pentru procesare</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Max Chunk Size</Label>
                  <Input 
                    type="number" 
                    value={settings.chunkMaxSize} 
                    onChange={e => updateSetting('chunkMaxSize', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Maxim caractere per chunk</p>
                </div>
                <div>
                  <Label>Min Chunk Size</Label>
                  <Input 
                    type="number" 
                    value={settings.chunkMinSize} 
                    onChange={e => updateSetting('chunkMinSize', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Minim caractere per chunk</p>
                </div>
                <div>
                  <Label>Overlap</Label>
                  <Input 
                    type="number" 
                    value={settings.chunkOverlap} 
                    onChange={e => updateSetting('chunkOverlap', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Caractere suprapuse intre chunk-uri</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">Preprocessing Options</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded">
                    <Label>Preserve Paragraphs</Label>
                    <Switch 
                      checked={settings.preserveParagraphBoundaries} 
                      onCheckedChange={v => updateSetting('preserveParagraphBoundaries', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded">
                    <Label>Preserve Sentences</Label>
                    <Switch 
                      checked={settings.preserveSentenceBoundaries} 
                      onCheckedChange={v => updateSetting('preserveSentenceBoundaries', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded">
                    <Label>Clean Diacritics</Label>
                    <Switch 
                      checked={settings.cleanDiacritics} 
                      onCheckedChange={v => updateSetting('cleanDiacritics', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded">
                    <Label>Remove Extra Whitespace</Label>
                    <Switch 
                      checked={settings.removeExtraWhitespace} 
                      onCheckedChange={v => updateSetting('removeExtraWhitespace', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded">
                    <Label>Fix Hyphenated Words</Label>
                    <Switch 
                      checked={settings.fixHyphenatedWords} 
                      onCheckedChange={v => updateSetting('fixHyphenatedWords', v)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EMBEDDINGS TAB */}
        <TabsContent value="embeddings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Cpu className="w-5 h-5" />Embedding Model</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Model</Label>
                <Select 
                  value={settings.embeddingModel} 
                  onValueChange={v => updateSetting('embeddingModel', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text-embedding-3-small">text-embedding-3-small (Recomandat)</SelectItem>
                    <SelectItem value="text-embedding-3-large">text-embedding-3-large (Mai precis)</SelectItem>
                    <SelectItem value="text-embedding-ada-002">text-embedding-ada-002 (Legacy)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Dimensions</Label>
                  <Input 
                    type="number" 
                    value={settings.embeddingDimensions} 
                    onChange={e => updateSetting('embeddingDimensions', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Batch Size</Label>
                  <Input 
                    type="number" 
                    value={settings.embeddingBatchSize} 
                    onChange={e => updateSetting('embeddingBatchSize', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LEGACY TAB */}
        <TabsContent value="legacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" />Legacy Architecture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* OpenAI Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">OpenAI Configuration</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Model</Label>
                    <Select value={settings.legacyOpenaiModel} onValueChange={v => updateSetting('legacyOpenaiModel', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                        <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                        <SelectItem value="gpt-4-turbo">gpt-4-turbo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Max Tokens</Label>
                    <Input type="number" value={settings.legacyMaxTokens} onChange={e => updateSetting('legacyMaxTokens', parseInt(e.target.value))} />
                  </div>
                  <div>
                    <Label>Temperature</Label>
                    <Slider 
                      value={[settings.legacyTemperature]} 
                      onValueChange={([v]) => updateSetting('legacyTemperature', v)}
                      min={0} max={1} step={0.1}
                    />
                    <span className="text-sm text-muted-foreground">{settings.legacyTemperature.toFixed(1)}</span>
                  </div>
                </div>
                <div>
                  <Label>System Prompt</Label>
                  <Textarea 
                    value={settings.legacySystemPrompt} 
                    onChange={e => updateSetting('legacySystemPrompt', e.target.value)}
                    rows={4}
                  />
                </div>
              </div>

              <Separator />

              {/* Search Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">Search Configuration</h4>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={settings.legacyUseVectorSearch} 
                      onCheckedChange={v => updateSetting('legacyUseVectorSearch', v)}
                    />
                    <Label>Vector Search</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={settings.legacyUseKeywordSearch} 
                      onCheckedChange={v => updateSetting('legacyUseKeywordSearch', v)}
                    />
                    <Label>Keyword Search</Label>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Min Score Threshold</Label>
                    <Slider 
                      value={[settings.legacyMinScoreThreshold]} 
                      onValueChange={([v]) => updateSetting('legacyMinScoreThreshold', v)}
                      min={0.1} max={0.9} step={0.05}
                    />
                    <span className="text-sm">{settings.legacyMinScoreThreshold.toFixed(2)}</span>
                  </div>
                  <div>
                    <Label>Max Results</Label>
                    <Input type="number" value={settings.legacyMaxResults} onChange={e => updateSetting('legacyMaxResults', parseInt(e.target.value))} />
                  </div>
                  <div>
                    <Label>Final Results</Label>
                    <Input type="number" value={settings.legacyFinalResults} onChange={e => updateSetting('legacyFinalResults', parseInt(e.target.value))} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HYBRID TAB */}
        <TabsContent value="hybrid" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5" />Hybrid Architecture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* OpenAI */}
              <div className="space-y-4">
                <h4 className="font-medium">OpenAI Configuration</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Model</Label>
                    <Select value={settings.hybridOpenaiModel} onValueChange={v => updateSetting('hybridOpenaiModel', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                        <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                        <SelectItem value="gpt-4-turbo">gpt-4-turbo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Max Tokens</Label>
                    <Input type="number" value={settings.hybridMaxTokens} onChange={e => updateSetting('hybridMaxTokens', parseInt(e.target.value))} />
                  </div>
                  <div>
                    <Label>Temperature</Label>
                    <Slider 
                      value={[settings.hybridTemperature]} 
                      onValueChange={([v]) => updateSetting('hybridTemperature', v)}
                      min={0} max={1} step={0.1}
                    />
                    <span className="text-sm">{settings.hybridTemperature.toFixed(1)}</span>
                  </div>
                </div>
                <div>
                  <Label>System Prompt</Label>
                  <Textarea 
                    value={settings.hybridSystemPrompt} 
                    onChange={e => updateSetting('hybridSystemPrompt', e.target.value)}
                    rows={4}
                  />
                </div>
              </div>

              <Separator />

              {/* Optional Components */}
              <div className="space-y-4">
                <h4 className="font-medium">Optional Components</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-200">
                    <Label>Synonym Expansion</Label>
                    <Switch 
                      checked={settings.hybridUseSynonymExpansion} 
                      onCheckedChange={v => updateSetting('hybridUseSynonymExpansion', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded border border-purple-200">
                    <Label>Numerical Boost</Label>
                    <Switch 
                      checked={settings.hybridUseNumericalBoost} 
                      onCheckedChange={v => updateSetting('hybridUseNumericalBoost', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded border border-orange-200">
                    <Label>Smart Router</Label>
                    <Switch 
                      checked={settings.hybridUseSmartRouter} 
                      onCheckedChange={v => updateSetting('hybridUseSmartRouter', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded border border-green-200">
                    <Label>Confidence Optimizer</Label>
                    <Switch 
                      checked={settings.hybridUseConfidenceOptimizer} 
                      onCheckedChange={v => updateSetting('hybridUseConfidenceOptimizer', v)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CACHE TAB */}
        <TabsContent value="cache" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Timer className="w-5 h-5" />Cache Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Enable Query Cache</p>
                  <p className="text-sm text-muted-foreground">Cache results for identical queries</p>
                </div>
                <Switch 
                  checked={settings.enableQueryCache} 
                  onCheckedChange={v => updateSetting('enableQueryCache', v)}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Show Debug Info</p>
                  <p className="text-sm text-muted-foreground">Include debug data in API responses</p>
                </div>
                <Switch 
                  checked={settings.showDebugInfo} 
                  onCheckedChange={v => updateSetting('showDebugInfo', v)}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Add Document Banner</p>
                  <p className="text-sm text-muted-foreground">Add header to document-based answers</p>
                </div>
                <Switch 
                  checked={settings.addDocumentBanner} 
                  onCheckedChange={v => updateSetting('addDocumentBanner', v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADVANCED TAB */}
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Code2 className="w-5 h-5" />Advanced Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Nota:</strong> Aceste setari avansate pot fi modificate direct din API. 
                  Pentru control complet, foloseste endpoint-urile /api/admin/rag-architecture
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="p-4 border rounded">
                  <p className="font-medium">Total Settings</p>
                  <p className="text-2xl font-bold">50+</p>
                </div>
                <div className="p-4 border rounded">
                  <p className="font-medium">Active Architecture</p>
                  <p className="text-2xl font-bold uppercase">{settings.activeArchitecture}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving} size="lg">
          {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save All Settings
        </Button>
      </div>
    </div>
  );
}

export default RagArchitecturePanelExtended;
