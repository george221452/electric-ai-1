'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export function RagArchitectureSimple() {
  const [activeArch, setActiveArch] = useState<'legacy' | 'hybrid'>('legacy');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Încarcă setările la montare
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/rag-architecture');
      const data = await res.json();
      
      if (data.success && data.data?.activeArchitecture) {
        setActiveArch(data.data.activeArchitecture);
      }
    } catch (err) {
      setError('Eroare la încărcarea setărilor');
    } finally {
      setLoading(false);
    }
  };

  const switchArch = async (arch: 'legacy' | 'hybrid') => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const res = await fetch('/api/admin/rag-architecture', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ architecture: arch }),
      });

      const data = await res.json();

      if (data.success) {
        setActiveArch(arch);
        setSuccess(`Arhitectura schimbată la ${arch.toUpperCase()}`);
      } else {
        setError(data.error || 'Eroare la schimbarea arhitecturii');
      }
    } catch (err) {
      setError('Eroare de rețea');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6 flex justify-center h-32 items-center">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">RAG Architecture Settings</h1>

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

      <Card className="border-2 border-primary">
        <CardHeader>
          <CardTitle>Alege Arhitectura Activă</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {/* LEGACY */}
            <div
              onClick={() => !loading && switchArch('legacy')}
              className={`
                p-6 rounded-lg border-2 cursor-pointer transition-all
                ${activeArch === 'legacy' 
                  ? 'border-blue-500 bg-blue-50 shadow-lg' 
                  : 'border-gray-200 hover:border-blue-300 bg-white'
                }
              `}
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-xl">🏛️ LEGACY</h3>
                {activeArch === 'legacy' && (
                  <Badge className="bg-blue-500 text-white">ACTIV</Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                Arhitectura originală simplă și stabilă. 
                Recomandată pentru producție.
              </p>
              <ul className="mt-3 text-sm space-y-1">
                <li>✅ Vector Search + Keyword Search</li>
                <li>✅ Stabilă și testată</li>
                <li>✅ Rapidă</li>
              </ul>
            </div>

            {/* HYBRID */}
            <div
              onClick={() => !loading && switchArch('hybrid')}
              className={`
                p-6 rounded-lg border-2 cursor-pointer transition-all
                ${activeArch === 'hybrid' 
                  ? 'border-purple-500 bg-purple-50 shadow-lg' 
                  : 'border-gray-200 hover:border-purple-300 bg-white'
                }
              `}
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-xl">⚡ HYBRID</h3>
                {activeArch === 'hybrid' && (
                  <Badge className="bg-purple-500 text-white">ACTIV</Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                Arhitectură avansată cu componente opționale.
                Pentru testare și optimizare.
              </p>
              <ul className="mt-3 text-sm space-y-1">
                <li>🔧 Synonym Expansion (ON/OFF)</li>
                <li>🔧 Numerical Boost (ON/OFF)</li>
                <li>🔧 Smart Router (ON/OFF)</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-800">
              <strong>💡 Sfat:</strong> Click pe una dintre opțiuni pentru a schimba arhitectura activă. 
              Modificarea se aplică imediat pentru toate query-urile noi.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status curent */}
      <Card>
        <CardHeader>
          <CardTitle>Status Curent</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">Arhitectura activă:</span>
            <Badge 
              className={activeArch === 'legacy' ? 'bg-blue-500' : 'bg-purple-500'}
            >
              {activeArch.toUpperCase()}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RagArchitectureSimple;
