# 📚 RAG Configuration Guide - Sistem Complet Configurabil

Acest document descrie noul sistem de configurare completă a RAG-ului din Admin Panel.

## 🎯 Overview

Sistemul permite configurarea a **PESTE 50 de parametri** din Admin Panel, inclusiv:
- ✅ Chunking & Text Preprocessing
- ✅ Embedding Models & Parameters  
- ✅ OpenAI Models, Prompts & Temperature
- ✅ Search Strategies & Thresholds
- ✅ Cache & Performance
- ✅ Debug & Monitoring
- ✅ Answer Formatting

---

## 🚀 Accesare Admin Panel

```
http://localhost:3000/admin/rag-architecture
```

---

## 📋 Categorii de Setări

### 1️⃣ CHUNKING & PREPROCESSING

Control complet asupra modului în care textul este împărțit:

| Parametru | Descriere | Default | Range |
|-----------|-----------|---------|-------|
| **chunkMaxSize** | Maxim caractere per chunk | 1500 | 500-5000 |
| **chunkMinSize** | Minim caractere per chunk | 200 | 100-1000 |
| **chunkOverlap** | Suprapunere între chunk-uri | 100 | 0-500 |
| **preserveParagraphBoundaries** | Nu taie paragrafe | true | boolean |
| **preserveSentenceBoundaries** | Nu taie propoziții | true | boolean |
| **cleanDiacritics** | Corectează diacritice | true | boolean |
| **removeExtraWhitespace** | Elimină spații extra | true | boolean |
| **fixHyphenatedWords** | Unește cuvinte despărțite | true | boolean |

**Când să modifici:**
- **Chunk mai mic** (1000): Pentru documente cu răspunsuri foarte specifice
- **Chunk mai mare** (2000): Pentru documente cu context extins necesar
- **Overlap mai mare**: Pentru a nu pierde context la margini

---

### 2️⃣ EMBEDDINGS

Configurare model de embeddings:

| Parametru | Opțiuni | Default |
|-----------|---------|---------|
| **embeddingModel** | text-embedding-3-small, text-embedding-3-large, ada-002 | text-embedding-3-small |
| **embeddingDimensions** | 1536, 3072 | 1536 |
| **embeddingBatchSize** | 10-500 | 100 |

**Recomandări:**
- **text-embedding-3-small**: Eficient, rapid, 90% din cazuri
- **text-embedding-3-large**: Mai precis, dar 5x mai scump
- **Batch size mai mare**: Mai rapid pentru indexare bulk

---

### 3️⃣ LEGACY ARCHITECTURE

Arhitectura simplă și stabilă.

#### OpenAI Settings:
| Parametru | Default | Opțiuni |
|-----------|---------|---------|
| **legacyOpenaiModel** | gpt-4o-mini | gpt-4o-mini, gpt-4o, gpt-4-turbo |
| **legacyMaxTokens** | 500 | 100-4000 |
| **legacyTemperature** | 0.2 | 0.0-1.0 |
| **legacyPromptTemplate** | standard | standard, detailed, concise, quiz |
| **legacySystemPrompt** | (editable) | - |

#### Search Settings:
| Parametru | Default | Descriere |
|-----------|---------|-----------|
| **legacyUseVectorSearch** | true | Căutare semantică |
| **legacyUseKeywordSearch** | true | Căutare text exact |
| **legacyMinScoreThreshold** | 0.40 | Scor minim similaritate |
| **legacyMaxResults** | 10 | Rezultate maxime căutare |
| **legacyFinalResults** | 3 | Rezultate trimise la OpenAI |

**Template-uri disponibile:**
- **standard**: Echilibrat
- **detailed**: Răspunsuri lungi cu citate
- **concise**: Răspunsuri scurte
- **quiz**: Special pentru grile

---

### 4️⃣ HYBRID ARCHITECTURE

Arhitectură avansată cu componente opționale.

#### Componente Opționale (Toggle):
| Componentă | Descriere | Când să o activezi |
|------------|-----------|-------------------|
| **Synonym Expansion** | Generează sinonime | Când utilizatorii folosesc termeni diferiți |
| **Numerical Boost** | Prioritizează numere | Pentru grile cu valori numerice |
| **Smart Router** | Routing inteligent | Când ai multe tipuri de întrebări |
| **Confidence Optimizer** | Ajustează scoruri | Pentru scenarii complexe |

#### OpenAI Settings (separate de Legacy):
| Parametru | Default | Note |
|-----------|---------|------|
| **hybridOpenaiModel** | gpt-4o-mini | Poate fi diferit de Legacy |
| **hybridMaxTokens** | 600 | Mai mult pentru componente extra |
| **hybridTemperature** | 0.2 | - |
| **hybridPromptTemplate** | adaptive | Adaptive se schimbă după tipul întrebării |

---

### 5️⃣ CACHE & PERFORMANCE

| Parametru | Default | Descriere |
|-----------|---------|-----------|
| **enableQueryCache** | true | Cache pentru query-uri identice |
| **cacheTtlSeconds** | 3600 | Timp cache (1 oră) |
| **enableResultCache** | false | Cache pentru rezultate procesate |
| **showDebugInfo** | false | Info debug în API response |

---

### 6️⃣ ANSWER FORMATTING

| Parametru | Default | Efect |
|-----------|---------|-------|
| **answerFormat** | markdown | Format output |
| **includeSources** | true | Include sursele |
| **includeConfidenceScore** | true | Include scorul |
| **addDocumentBanner** | false | Banner "bazat pe documente" |

---

## 🔄 Workflow Recomandat

### Pentru Începători:
1. Folosește **Legacy** architecture (default)
2. Nu modifica chunking (setările default sunt bune)
3. Doar ajustează **legacyMinScoreThreshold** dacă e nevoie

### Pentru Avansați:
1. Comută pe **Hybrid**
2. Activează o singură componentă opțională
3. Testează cu query-uri reale
4. Compara rezultatele cu Legacy
5. Ajustează parametrii după nevoie

### Pentru Optimizare:
1. Începe cu **chunk size** (1500-2000)
2. Ajustează **threshold** (0.35-0.50)
3. Testează diferite **prompt templates**
4. Activează **debug info** pentru a vedea metrici

---

## 🧪 Testare Rapidă

### Testează din API fără să salvezi:

```bash
# Test Legacy
curl -X POST http://localhost:3000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Ce cadere de tensiune e admisa?",
    "workspaceId": "...",
    "options": {
      "forceArchitecture": "legacy"
    }
  }'

# Test Hybrid
curl -X POST http://localhost:3000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Ce cadere de tensiune e admisa?",
    "workspaceId": "...",
    "options": {
      "forceArchitecture": "hybrid"
    }
  }'
```

---

## 📊 Comparare Arhitecturi

| Feature | Legacy | Hybrid |
|---------|--------|--------|
| Stabilitate | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Viteză | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Flexibilitate | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Complexitate | ⭐⭐ | ⭐⭐⭐⭐ |
| Debug-ușurință | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 🎛️ Preset-uri Recomandate

### Preset: "Default" (Safe)
```json
{
  "activeArchitecture": "legacy",
  "chunkMaxSize": 1500,
  "legacyMinScoreThreshold": 0.40,
  "legacyMaxTokens": 500
}
```

### Preset: "Quiz Mode"
```json
{
  "activeArchitecture": "hybrid",
  "hybridUseNumericalBoost": true,
  "hybridQuizStrictMode": true,
  "hybridPromptTemplate": "quiz"
}
```

### Preset: "Maximum Recall"
```json
{
  "activeArchitecture": "hybrid",
  "chunkOverlap": 200,
  "hybridUseSynonymExpansion": true,
  "hybridMinScoreThreshold": 0.30,
  "hybridMaxResults": 20
}
```

### Preset: "Speed Mode"
```json
{
  "activeArchitecture": "legacy",
  "chunkMaxSize": 2000,
  "legacyMaxResults": 5,
  "legacyFinalResults": 2,
  "legacyMaxTokens": 300,
  "enableQueryCache": true
}
```

---

## 🐛 Troubleshooting

### "Nu găsește rezultate"
- Scade `minScoreThreshold` (încearcă 0.30)
- Crește `chunkOverlap`
- Activează `synonymExpansion`

### "Răspunsuri prea lungi"
- Scade `maxTokens` (300-400)
- Folosește template `concise`
- Crește `temperature` (0.3-0.4)

### "Răspunsuri prea scurte"
- Crește `maxTokens` (800-1000)
- Folosește template `detailed`

### "Timp de răspuns prea lung"
- Folosește `legacy` architecture
- Scade `maxResults` (5)
- Crește `chunkMaxSize` (2000)
- Activează `enableQueryCache`

---

## 📝 Schimbări Baza de Date

Pentru a aplica noile câmpuri:

```bash
npx prisma migrate dev --name extend_rag_configuration
```

Sau SQL manual:

```sql
-- Adaugă toate coloanele noi
ALTER TABLE "rag_architecture_settings" 
ADD COLUMN IF NOT EXISTS "chunk_max_size" INTEGER DEFAULT 1500,
ADD COLUMN IF NOT EXISTS "chunk_min_size" INTEGER DEFAULT 200,
ADD COLUMN IF NOT EXISTS "chunk_overlap" INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS "preserve_paragraph_boundaries" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "preserve_sentence_boundaries" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "clean_diacritics" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "remove_extra_whitespace" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "fix_hyphenated_words" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "embedding_model" TEXT DEFAULT 'text-embedding-3-small',
ADD COLUMN IF NOT EXISTS "embedding_dimensions" INTEGER DEFAULT 1536,
ADD COLUMN IF NOT EXISTS "embedding_batch_size" INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS "legacy_search_strategy" TEXT DEFAULT 'parallel',
ADD COLUMN IF NOT EXISTS "legacy_combine_method" TEXT DEFAULT 'merge',
ADD COLUMN IF NOT EXISTS "legacy_openai_model" TEXT DEFAULT 'gpt-4o-mini',
ADD COLUMN IF NOT EXISTS "legacy_max_tokens" INTEGER DEFAULT 500,
ADD COLUMN IF NOT EXISTS "legacy_temperature" DOUBLE PRECISION DEFAULT 0.2,
ADD COLUMN IF NOT EXISTS "legacy_system_prompt" TEXT DEFAULT 'Esti un asistent...',
ADD COLUMN IF NOT EXISTS "legacy_prompt_template" TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS "legacy_include_citations" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "legacy_require_citations" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "hybrid_synonym_max_variants" INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS "hybrid_numerical_boost_weight" DOUBLE PRECISION DEFAULT 0.3,
ADD COLUMN IF NOT EXISTS "hybrid_smart_router_quiz_threshold" DOUBLE PRECISION DEFAULT 0.75,
ADD COLUMN IF NOT EXISTS "hybrid_smart_router_normal_threshold" DOUBLE PRECISION DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS "hybrid_smart_router_max_retries" INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS "hybrid_use_query_understanding" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "hybrid_use_intent_detection" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "hybrid_rerank_enabled" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "hybrid_rerank_method" TEXT DEFAULT 'score',
ADD COLUMN IF NOT EXISTS "hybrid_openai_model" TEXT DEFAULT 'gpt-4o-mini',
ADD COLUMN IF NOT EXISTS "hybrid_max_tokens" INTEGER DEFAULT 600,
ADD COLUMN IF NOT EXISTS "hybrid_temperature" DOUBLE PRECISION DEFAULT 0.2,
ADD COLUMN IF NOT EXISTS "hybrid_system_prompt" TEXT DEFAULT 'Esti un asistent...',
ADD COLUMN IF NOT EXISTS "hybrid_prompt_template" TEXT DEFAULT 'adaptive',
ADD COLUMN IF NOT EXISTS "hybrid_include_citations" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "hybrid_require_citations" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "hybrid_quiz_enabled" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "hybrid_quiz_strict_mode" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "hybrid_quiz_confidence_threshold" INTEGER DEFAULT 70,
ADD COLUMN IF NOT EXISTS "cache_ttl_seconds" INTEGER DEFAULT 3600,
ADD COLUMN IF NOT EXISTS "enable_result_cache" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "result_cache_ttl_seconds" INTEGER DEFAULT 86400,
ADD COLUMN IF NOT EXISTS "log_queries" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "log_performance_metrics" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "enable_query_tracing" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "answer_format" TEXT DEFAULT 'markdown',
ADD COLUMN IF NOT EXISTS "include_sources" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "include_confidence_score" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "include_execution_time" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "add_document_banner" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "fallback_on_low_confidence" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "fallback_confidence_threshold" INTEGER DEFAULT 40,
ADD COLUMN IF NOT EXISTS "fallback_to_general_knowledge" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "show_clarification_on_no_results" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "extract_metadata" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "extract_article_numbers" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "extract_keywords" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "classify_paragraphs" BOOLEAN DEFAULT false;
```

---

## 🔮 Viitor

Funcționalități planificate:
- ✅ A/B Testing între configurații
- ✅ Analytics pentru fiecare parametru
- ✅ Preset-uri salvate custom
- ✅ Export/Import configurații
- ✅ Auto-optimization based on feedback

---

**Ultima actualizare:** 2026-03-24
**Versiune:** 2.0.0 - Full Configuration System
