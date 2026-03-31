/**
 * Admin Page: RAG Architecture Management
 * 
 * Permite administrarea setărilor de arhitectură RAG:
 * - Comutare între Legacy și Hybrid
 * - Configurarea componentelor individuale
 * - Monitorizare status
 */

import { Metadata } from 'next';
import { RagArchitecturePanel } from '@/components/admin/RagArchitecturePanel';

export const metadata: Metadata = {
  title: 'Arhitectură RAG | Admin',
  description: 'Configurează arhitectura RAG: Legacy vs Hybrid',
};

export default function RagArchitecturePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Arhitectură RAG</h1>
        <p className="text-muted-foreground">
          Configurează și comută între arhitecturile Legacy și Hybrid
        </p>
      </div>
      <RagArchitecturePanel />
    </div>
  );
}
