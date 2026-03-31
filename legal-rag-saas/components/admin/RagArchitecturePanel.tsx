/**
 * Admin Panel pentru managementul arhitecturii RAG
 * 
 * Permite:
 * - Comutarea între Legacy și Hybrid
 * - Activarea/dezactivarea componentelor individuale
 * - Vizualizarea statusului curent
 * - Testarea cu query de exemplu
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  RefreshCw, 
  Activity, 
  Zap, 
  Database,
  Search,
  Brain,
  BarChart3,
  Save,
  AlertCircle,
  CheckCircle2,
  Code2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ArchitectureSettings {
  id: string;
  activeArchitecture: 'legacy' | 'hybrid';
  legacy: {
    useKeywordSearch: boolean;
    useVectorSearch: boolean;
    minScoreThreshold: number;
    maxResults: number;
    finalResults: number;
  };
  hybrid: {
    useKeywordSearch: boolean;
    useVectorSearch: boolean;
    useSynonymExpansion: boolean;
    useNumericalBoost: boolean;
    useSmartRouter: boolean;
    useConfidenceOptimizer: boolean;
    minScoreThreshold: number;
    maxResults: number;
    finalResults: number;
  };
  general: {
    showDebugInfo: boolean;
    enableQueryCache: boolean;
  };
  updatedAt: string;
}

export function RagArchitecturePanel() {
  const [settings, setSettings] = useState<ArchitectureSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'legacy' | 'hybrid'>('legacy');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/rag-architecture');
      const data = await response.json();
      
      if (data.success) {
        setSettings(data.data);
        setActiveTab(data.data.activeArchitecture);
      } else {
        setError('Failed to load settings');
      }
    } catch (err) {
      setError('Error fetching settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      const response = await fetch('/api/admin/rag-architecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legacy: settings.legacy,
          hybrid: settings.hybrid,
          general: settings.general,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Settings saved successfully!');
        setSettings(data.data);
      } else {
        setError(data.error || 'Failed to save settings');
      }
    } catch (err) {
      setError('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const switchArchitecture = async (arch: 'legacy' | 'hybrid') => {
    try {
      setSaving(true);
      setError(null);
      
      const response = await fetch('/api/admin/rag-architecture', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ architecture: arch }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Switched to ${arch.toUpperCase()} architecture!`);
        setSettings(data.data);
        setActiveTab(arch);
      } else {
        setError(data.error || 'Failed to switch architecture');
      }
    } catch (err) {
      setError('Error switching architecture');
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = async () => {
    if (!confirm('Are you sure you want to reset all settings to default?')) return;
    
    try {
      setSaving(true);
      const response = await fetch('/api/admin/rag-architecture', {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Settings reset to default!');
        setSettings(data.data);
        setActiveTab(data.data.activeArchitecture);
      } else {
        setError(data.error || 'Failed to reset settings');
      }
    } catch (err) {
      setError('Error resetting settings');
    } finally {
      setSaving(false);
    }
  };

  const updateLegacySetting = <K extends keyof ArchitectureSettings['legacy']>(
    key: K,
    value: ArchitectureSettings['legacy'][K]
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      legacy: { ...settings.legacy, [key]: value },
    });
  };

  const updateHybridSetting = <K extends keyof ArchitectureSettings['hybrid']>(
    key: K,
    value: ArchitectureSettings['hybrid'][K]
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      hybrid: { ...settings.hybrid, [key]: value },
    });
  };

  const updateGeneralSetting = <K extends keyof ArchitectureSettings['general']>(
    key: K,
    value: ArchitectureSettings['general'][K]
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      general: { ...settings.general, [key]: value },
    });
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load architecture settings</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            RAG Architecture Settings
          </h2>
          <p className="text-muted-foreground mt-1">
            Configurează și comută între arhitecturile Legacy și Hybrid
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchSettings}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="destructive"
            onClick={resetSettings}
            disabled={saving}
          >
            Reset Default
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Architecture Selection */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Arhitectura Activă
          </CardTitle>
          <CardDescription>
            Selectează arhitectura care va fi folosită pentru toate query-urile RAG
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Legacy Option */}
            <div
              className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                settings.activeArchitecture === 'legacy'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-border hover:border-muted-foreground'
              }`}
              onClick={() => switchArchitecture('legacy')}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg">🏛️ LEGACY</h3>
                {settings.activeArchitecture === 'legacy' && (
                  <Badge className="bg-blue-500">ACTIVE</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Arhitectura originală simplă și stabilă. Vector search + Keyword search în paralel, 
                apoi top 3 rezultate la OpenAI.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">Simplă</Badge>
                <Badge variant="outline" className="text-xs">Stabilă</Badge>
                <Badge variant="outline" className="text-xs">Rapidă</Badge>
              </div>
            </div>

            {/* Hybrid Option */}
            <div
              className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                settings.activeArchitecture === 'hybrid'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                  : 'border-border hover:border-muted-foreground'
              }`}
              onClick={() => switchArchitecture('hybrid')}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg">⚡ HYBRID</h3>
                {settings.activeArchitecture === 'hybrid' && (
                  <Badge className="bg-purple-500">ACTIVE</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Arhitectură configurabilă cu componente opționale: synonym expansion, 
                numerical boost, smart router, confidence optimizer.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">Configurabilă</Badge>
                <Badge variant="outline" className="text-xs">Avansată</Badge>
                <Badge variant="outline" className="text-xs">Experimentală</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'legacy' | 'hybrid')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="legacy" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Legacy Settings
          </TabsTrigger>
          <TabsTrigger value="hybrid" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Hybrid Settings
          </TabsTrigger>
        </TabsList>

        {/* Legacy Settings */}
        <TabsContent value="legacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Componente Legacy</CardTitle>
              <CardDescription>
                Configurează componentele arhitecturii Legacy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search Components */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Căutare
                </h4>
                
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">Vector Search (Qdrant)</p>
                      <p className="text-sm text-muted-foreground">
                        Căutare semantică în vector database
                      </p>
                    </div>
                    <Switch
                      checked={settings.legacy.useVectorSearch}
                      onCheckedChange={(v) => updateLegacySetting('useVectorSearch', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">Keyword Search (Prisma)</p>
                      <p className="text-sm text-muted-foreground">
                        Căutare text exact în PostgreSQL
                      </p>
                    </div>
                    <Switch
                      checked={settings.legacy.useKeywordSearch}
                      onCheckedChange={(v) => updateLegacySetting('useKeywordSearch', v)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Thresholds */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Thresholds și Limite
                </h4>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium">Min Score Threshold</label>
                      <span className="text-sm text-muted-foreground">
                        {settings.legacy.minScoreThreshold.toFixed(2)}
                      </span>
                    </div>
                    <Slider
                      value={[settings.legacy.minScoreThreshold]}
                      onValueChange={([v]) => updateLegacySetting('minScoreThreshold', v)}
                      min={0.1}
                      max={0.9}
                      step={0.05}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Scorul minim de similaritate pentru a include un rezultat (0.40 = 40%)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium block mb-2">Max Results</label>
                      <input
                        type="number"
                        value={settings.legacy.maxResults}
                        onChange={(e) => updateLegacySetting('maxResults', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border rounded-md"
                        min={1}
                        max={50}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-2">Final Results</label>
                      <input
                        type="number"
                        value={settings.legacy.finalResults}
                        onChange={(e) => updateLegacySetting('finalResults', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border rounded-md"
                        min={1}
                        max={20}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hybrid Settings */}
        <TabsContent value="hybrid" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Componente Hybrid</CardTitle>
              <CardDescription>
                Activează sau dezactivează componentele avansate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Base Components */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Componente de Bază
                </h4>
                
                <div className="grid gap-3">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">Vector Search (Qdrant)</p>
                      <p className="text-sm text-muted-foreground">Căutare semantică</p>
                    </div>
                    <Switch
                      checked={settings.hybrid.useVectorSearch}
                      onCheckedChange={(v) => updateHybridSetting('useVectorSearch', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">Keyword Search (Prisma)</p>
                      <p className="text-sm text-muted-foreground">Căutare text exact în PostgreSQL</p>
                    </div>
                    <Switch
                      checked={settings.hybrid.useKeywordSearch}
                      onCheckedChange={(v) => updateHybridSetting('useKeywordSearch', v)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Optional Components */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Componente Opționale (Experimentale)
                </h4>
                
                <div className="grid gap-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-3">
                      <Search className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium">Synonym Expansion</p>
                        <p className="text-sm text-muted-foreground">
                          Generează variante de căutare cu sinonime. Poate îmbunătăți recall dar crește latency.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.hybrid.useSynonymExpansion}
                      onCheckedChange={(v) => updateHybridSetting('useSynonymExpansion', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200">
                    <div className="flex items-start gap-3">
                      <BarChart3 className="w-5 h-5 text-purple-600 mt-0.5" />
                      <div>
                        <p className="font-medium">Numerical Boost</p>
                        <p className="text-sm text-muted-foreground">
                          Boostează scorul pentru documente care conțin numere matching query.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.hybrid.useNumericalBoost}
                      onCheckedChange={(v) => updateHybridSetting('useNumericalBoost', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200">
                    <div className="flex items-start gap-3">
                      <Brain className="w-5 h-5 text-orange-600 mt-0.5" />
                      <div>
                        <p className="font-medium">Smart Router</p>
                        <p className="text-sm text-muted-foreground">
                          Routing inteligent între quiz și normal mode cu retry logic.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.hybrid.useSmartRouter}
                      onCheckedChange={(v) => updateHybridSetting('useSmartRouter', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200">
                    <div className="flex items-start gap-3">
                      <Activity className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium">Confidence Optimizer</p>
                        <p className="text-sm text-muted-foreground">
                          Optimizare scor de încredere pentru scenarii practice.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.hybrid.useConfidenceOptimizer}
                      onCheckedChange={(v) => updateHybridSetting('useConfidenceOptimizer', v)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Thresholds */}
              <div className="space-y-4">
                <h4 className="font-medium">Thresholds și Limite</h4>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium">Min Score Threshold</label>
                    <span className="text-sm text-muted-foreground">
                      {settings.hybrid.minScoreThreshold.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[settings.hybrid.minScoreThreshold]}
                    onValueChange={([v]) => updateHybridSetting('minScoreThreshold', v)}
                    min={0.1}
                    max={0.9}
                    step={0.05}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-2">Max Results</label>
                    <input
                      type="number"
                      value={settings.hybrid.maxResults}
                      onChange={(e) => updateHybridSetting('maxResults', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border rounded-md"
                      min={1}
                      max={50}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Final Results</label>
                    <input
                      type="number"
                      value={settings.hybrid.finalResults}
                      onChange={(e) => updateHybridSetting('finalResults', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border rounded-md"
                      min={1}
                      max={20}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Setări Generale</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Show Debug Info</p>
              <p className="text-sm text-muted-foreground">
                Include informații de debug în răspunsurile API
              </p>
            </div>
            <Switch
              checked={settings.general.showDebugInfo}
              onCheckedChange={(v) => updateGeneralSetting('showDebugInfo', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={saveSettings}
          disabled={saving}
          size="lg"
          className="w-full md:w-auto"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Code2 className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Cum funcționează:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Arhitectura <strong>Legacy</strong> este setată ca default pentru stabilitate maximă</li>
                <li>Arhitectura <strong>Hybrid</strong> permite testarea componentelor individuale</li>
                <li>Toate modificările sunt aplicate imediat pentru query-urile noi</li>
                <li>Cache-ul este invalidat automat la schimbarea arhitecturii</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RagArchitecturePanel;
