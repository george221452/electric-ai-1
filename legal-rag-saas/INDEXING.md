# 📚 Manual Document Indexing Guide

Acest document explică cum să indexezi manual documentele ANRE descărcate în sistemul RAG.

---

## 🚀 Comenzi Rapide

### 1. **Start Indexare** - Indexează TOATE documentele
```bash
cd legal-rag-saas
npm run index:start
```

**Ce face:**
- Procesează toate PDF-urile din `downloads/anre_super_complete/`
- Extrage textul și împarte în chunk-uri
- Generează embeddings cu OpenAI
- Salvează în PostgreSQL (Prisma) și Qdrant
- Afișează progress bar cu ETA în timp real

**Output exemplu:**
```
[████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 41.2% | 1200/2909 | ⏱️  12:34 | ⏳ ETA: 18:15 | ⚡ 1.6 docs/s
```

---

### 2. **Status Indexare** - Verifică progresul curent
```bash
npm run index:status
```

**Output exemplu:**
```
📊 INDEXING STATUS
====================================
📁 Source files found: 2909
📚 Documents in database: 1200
   ✅ Completed: 1200
   ⏳ Processing: 0
   ❌ Failed: 0

📝 Total paragraphs: 24500
⏳ Remaining to index: 1709 documents
⏱️  Estimated time: ~57 hours 0 minutes
```

---

### 3. **Șterge Index** - Pentru reindexare completă
```bash
npm run index:clear
```

**⚠️ ATENȚIE:** Această comandă șterge TOATE documentele indexate!
- Va cere confirmare (scrie `DELETE`)
- Șterge din PostgreSQL și Qdrant
- **NU** poate fi anulată

**Skip confirmare (periculos):**
```bash
npx tsx clear-index.ts --force
```

---

### 4. **Reset Complet Qdrant** - Șterge și recreează colecția
```bash
npm run index:reset
```

Sau:
```bash
npx tsx clear-index.ts --reset
```

---

## 📊 Estimări Timp

| Nr Documente | Timp Estimat | Vectore Create |
|--------------|--------------|----------------|
| 100 docs | ~15 minute | ~1,500 |
| 500 docs | ~1.5 ore | ~7,500 |
| 1,000 docs | ~3 ore | ~15,000 |
| 2,909 docs | ~8-10 ore | ~45,000 |

*Estimările variază în funcție de:
- Lungimea documentelor
- Viteza conexiunii OpenAI
- Performanța serverului PostgreSQL/Qdrant*

---

## ⚙️ Configurare

Setările sunt în `manual-index.ts`:

```typescript
const CONFIG = {
  SOURCE_DIR: './downloads/anre_super_complete',  // Sursă documente
  CHUNK_SIZE: 1000,        // Caractere per chunk
  CHUNK_OVERLAP: 200,      // Suprapunere între chunk-uri
  BATCH_SIZE: 50,          // Documente per batch
  DELAY_BETWEEN_DOCS: 100, // Rate limiting (ms)
};
```

---

## 🔧 Troubleshooting

### Eroare: `Cannot find module 'pdf-parse'`
```bash
npm install
```

### Eroare: Connection refused la Qdrant
Verifică dacă Qdrant rulează:
```bash
docker ps | grep qdrant
# sau
curl http://localhost:6333/collections
```

### Indexarea e prea lentă
- Crește `BATCH_SIZE` în config (dar atenție la rate limits OpenAI)
- Verifică conexiunea la internet
- Asigură-te că PostgreSQL și Qdrant sunt pe server local sau aproape

### Vreau să opresc indexarea
Apasă `Ctrl+C` - poți relua oricând, documentele deja indexate vor fi sărite.

---

## 📁 Structura Fișierelor

```
legal-rag-saas/
├── manual-index.ts      # Script principal indexare
├── clear-index.ts       # Script ștergere index
├── INDEXING.md          # Acest fișier
├── package.json         # Comenzi npm
└── downloads/
    └── anre_super_complete/   # Documentele sursă
```

---

## ✅ Workflow Recomandat

1. **Prima dată:**
   ```bash
   npm run index:status    # Verifică ce e deja indexat
   npm run index:start     # Start indexare completă
   ```

2. **Dacă vrei să reindexezi tot:**
   ```bash
   npm run index:clear     # Șterge tot
   npm run index:start     # Indexează din nou
   ```

3. **Monitorizare:**
   ```bash
   npm run index:status    # Verifică periodic statusul
   ```

---

## 🆘 Suport

Dacă întâmpini probleme:
1. Verifică log-urile pentru erori specifice
2. Asigură-te că toate serviciile rulează (PostgreSQL, Qdrant)
3. Verifică variabilele de mediu în `.env.local`
