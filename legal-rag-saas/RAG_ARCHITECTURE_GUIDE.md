# 🏗️ RAG Architecture Switcher - Ghid de Utilizare

Acest sistem permite comutarea între două arhitecturi RAG și configurarea componentelor individuale.

## 📋 Overview

### Arhitectura **LEGACY** (Default)
- ✅ **Stabilă** - Funcționează bine, testată în timp
- ✅ **Simplă** - Vector search + Keyword search în paralel
- ✅ **Rapidă** - Minim overhead
- ✅ **Previzibilă** - Comportament consistent

### Arhitectura **HYBRID** (Experimentală)
- ⚙️ **Configurabilă** - Componente pot fi activate/dezactivate
- 🔬 **Avansată** - Synonym expansion, numerical boost, smart router
- 🧪 **Pentru testare** - Îmbunătățiri incrementale
- ⚠️ **Mai complexă** - Mai multe puncte de eșec potențiale

---

## 🚀 Quick Start

### 1. Accesează Admin Panel
```
http://localhost:3000/admin/rag-architecture
```

### 2. Selectează Arhitectura
- Click pe **🏛️ LEGACY** pentru stabilitate (recomandat pentru producție)
- Click pe **⚡ HYBRID** pentru testare componente noi

### 3. Configurează Componentele (doar pentru Hybrid)
- Activează/dezactivează componentele individuale cu toggle-urile
- Ajustează thresholds cu slider-ele
- Salvează setările

---

## 🔧 Componente Disponibile

### Componente de Bază (ambele arhitecturi)
| Componentă | Descriere | Legacy | Hybrid |
|------------|-----------|--------|--------|
| **Vector Search** | Căutare semantică în Qdrant | ✅ | ✅ |
| **Keyword Search** | Căutare text în PostgreSQL | ✅ | ✅ |

### Componente Opționale (doar Hybrid)
| Componentă | Descriere | Recomandare |
|------------|-----------|-------------|
| **Synonym Expansion** | Generează variante de căutare | Testează cu grijă |
| **Numerical Boost** | Boost pentru match-uri numerice | Util pentru grile |
| **Smart Router** | Routing quiz vs normal | Testează separat |
| **Confidence Optimizer** | Optimizare scor încredere | Experimental |

---

## 📊 API Endpoints

### GET /api/admin/rag-architecture
Obține setările curente.

```json
{
  "success": true,
  "data": {
    "activeArchitecture": "legacy",
    "legacy": { ... },
    "hybrid": { ... },
    "general": { ... }
  }
}
```

### POST /api/admin/rag-architecture
Actualizează setările.

```json
{
  "legacy": {
    "useKeywordSearch": true,
    "minScoreThreshold": 0.40
  },
  "hybrid": {
    "useSynonymExpansion": false,
    "useSmartRouter": false
  }
}
```

### PUT /api/admin/rag-architecture
Comută arhitectura activă.

```json
{
  "architecture": "hybrid"
}
```

### DELETE /api/admin/rag-architecture
Resetează la default.

---

## 🧪 Testare cu Query

Pentru a testa o arhitectură specifică fără a o activa global:

```typescript
const response = await fetch('/api/rag/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "Ce cădere de tensiune e admisă?",
    workspaceId: "...",
    options: {
      forceArchitecture: "hybrid" // Sau "legacy"
    }
  })
});
```

---

## 🔄 Migrare Baza de Date

Pentru a aplica schema nouă:

```bash
cd legal-rag-saas
npx prisma migrate dev --name add_rag_architecture_settings
```

Sau creează manual tabela:

```sql
CREATE TABLE "rag_architecture_settings" (
  "id" TEXT NOT NULL,
  "active_architecture" TEXT NOT NULL DEFAULT 'legacy',
  "legacy_use_keyword_search" BOOLEAN NOT NULL DEFAULT true,
  "legacy_use_vector_search" BOOLEAN NOT NULL DEFAULT true,
  "legacy_min_score_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.40,
  "legacy_max_results" INTEGER NOT NULL DEFAULT 10,
  "legacy_final_results" INTEGER NOT NULL DEFAULT 3,
  "hybrid_use_keyword_search" BOOLEAN NOT NULL DEFAULT true,
  "hybrid_use_vector_search" BOOLEAN NOT NULL DEFAULT true,
  "hybrid_use_synonym_expansion" BOOLEAN NOT NULL DEFAULT false,
  "hybrid_use_numerical_boost" BOOLEAN NOT NULL DEFAULT false,
  "hybrid_use_smart_router" BOOLEAN NOT NULL DEFAULT false,
  "hybrid_use_confidence_optimizer" BOOLEAN NOT NULL DEFAULT false,
  "hybrid_min_score_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.40,
  "hybrid_max_results" INTEGER NOT NULL DEFAULT 10,
  "hybrid_final_results" INTEGER NOT NULL DEFAULT 3,
  "show_debug_info" BOOLEAN NOT NULL DEFAULT false,
  "enable_query_cache" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "updated_by" TEXT,
  CONSTRAINT "rag_architecture_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "rag_architecture_settings" ("id", "active_architecture", "updated_at")
VALUES ('global', 'legacy', NOW());
```

---

## 📁 Structura Fișierelor

```
lib/rag-architectures/
├── legacy-rag.ts          # Arhitectura Legacy
├── hybrid-rag.ts          # Arhitectura Hybrid
└── settings-service.ts    # Serviciu management setări

app/api/admin/rag-architecture/
└── route.ts               # API endpoints

app/api/rag/query/
└── route.ts               # Query endpoint cu switch

components/admin/
└── RagArchitecturePanel.tsx  # UI Admin Panel

app/admin/rag-architecture/
└── page.tsx               # Pagina admin
```

---

## 🎯 Workflow Recomandat

### Pentru Dezvoltare/Testare:
1. Setează arhitectura pe **Hybrid**
2. Activează o singură componentă nouă
3. Testează cu query-uri reale
4. Verifică calitatea răspunsurilor
5. Dacă funcționează bine, păstrează activată

### Pentru Producție:
1. Folosește arhitectura **Legacy** (default)
2. E stabilă și testată
3. Dacă Hybrid funcționează bine în teste, poți comuta

---

## 🐛 Debugging

Activează `showDebugInfo` în setări pentru a vedea în API response:
- Numărul de rezultate vector/keyword
- Componentele folosite
- Timpul de execuție
- Processing steps

```json
{
  "data": {
    "answer": "...",
    "debug": {
      "vectorResultsCount": 10,
      "keywordResultsCount": 5,
      "componentsUsed": {
        "synonymExpansion": true,
        "numericalBoost": false
      }
    }
  }
}
```

---

## 💡 Best Practices

1. **Întotdeauna testează pe Hybrid înainte de a trece în producție**
2. **Activează componentele una câte una** - nu toate odată
3. **Monitorizează timpul de răspuns** - unele componente adaugă latency
4. **Verifică calitatea răspunsurilor** - mai multe feature-uri ≠ mai bine
5. **Folosește Legacy ca fallback** - dacă Hybrid dă erori

---

## 📝 Note Tehnice

- Setările sunt cache-uite 1 minut pentru performanță
- Cache-ul query-urilor poate fi invalidat schimbând arhitectura
- Componentele Hybrid sunt independente - poți avea doar Synonym Expansion activ, de exemplu
- Legacy și Hybrid pot coexista - unele requesturi pot folosi Legacy, altele Hybrid
