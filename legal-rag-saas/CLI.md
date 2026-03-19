# 🚀 ANRE RAG CLI

Interfață simplă în linie de comandă pentru managementul sistemului RAG.

---

## 📖 Cum folosești CLI-ul

### Metoda 1: Direct (recomandată)
```bash
./rag [comanda]
```

### Metoda 2: Prin npm
```bash
npm run cli -- [comanda]
```

### Metoda 3: Cu tsx
```bash
npx tsx cli/index.ts [comanda]
```

---

## 📚 Comenzi Esențiale

### 🔄 **Indexare Documente**

```bash
# Indexează TOATE documentele (cu progress bar)
./rag index start

# Vezi progresul curent
./rag index status

# Șterge tot și reindexează (ATENȚIE!)
./rag reindex

# Șterge doar indexul (păstrează fișierele)
./rag clear

# Reset complet Qdrant
./rag reset-qdrant
```

### 🧪 **Testare**

```bash
# Testează grilele ANRE
./rag test quiz

# Testează o singură întrebare
./rag test-single "Care este tensiunea nominală în JT?"
```

### 📊 **Status și Statistici**

```bash
# Status complet al sistemului
./rag status

# Verifică serviciile (DB, Qdrant, Redis)
./rag check

# Statistici detaliate
./rag stats

# Numără documentele descărcate
./rag count
```

### ⬇️ **Descărcare**

```bash
# Descarcă toată legislația
./rag download all

# Doar normele tehnice
./rag download nte

# Doar proiectele de reglementare
./rag download pe
```

### 🗄️ **Baza de Date**

```bash
# Deschide Prisma Studio (interfață web)
./rag db-studio

# Resetează baza de date (PERICULOS!)
./rag db-reset
```

### 🔍 **Utilitare**

```bash
# Caută în documente
./rag search "NTE 001"

# Vezi ultimele log-uri
./rag logs 100

# Exportă rezultate teste
./rag export json
```

---

## ❓ Ajutor

```bash
# Ajutor general cu toate comenzile
./rag help

# Ajutor pentru o comandă specifică
./rag help index
./rag help test
```

---

## 🔤 Alias-uri (scurtături)

| Comanda completă | Alias | Exemplu |
|------------------|-------|---------|
| `./rag index` | `./rag i` | `./rag i start` |
| `./rag status` | `./rag s` | `./rag s` |
| `./rag test` | `./rag t` | `./rag t quiz` |
| `./rag check` | `./rag chk` | `./rag chk` |
| `./rag clear` | `./rag c` | `./rag c` |

---

## ⚠️ Comenzi Periculoase

Aceste comenzi necesită confirmare (scrie `DELETE` sau folosește `--force`):

| Comandă | Ce face | Confirmare |
|---------|---------|------------|
| `reindex` | Șterge TOT și reindexează | Scrie `DELETE` |
| `clear` | Șterge doar indexul | Scrie `DELETE` |
| `db-reset` | Resetează PostgreSQL | Scrie `DELETE` |

Pentru a sări confirmarea (periculos!):
```bash
./rag reindex --force
./rag clear --force
./rag db-reset --force
```

---

## 💡 Workflow-uri Tipice

### **Prima indexare:**
```bash
./rag check           # Verifică serviciile
./rag count           # Vezi câte documente ai
./rag index start     # Începe indexarea
# Așteaptă câteva ore...
./rag status          # Verifică progresul
```

### **Reindexare completă:**
```bash
./rag reindex         # Confirmă cu DELETE
# Sau forțat:
./rag reindex --force
```

### **Testare rapidă:**
```bash
./rag check           # Verifică sistemul
./rag test-single "Care este tensiunea nominală?"
```

---

## 🎨 Output Exemple

### Status:
```
══════════════════════════════════════════════════════════════════════
  📊 STATUS SISTEM RAG
══════════════════════════════════════════════════════════════════════

📚 BAZA DE DATE (PostgreSQL):
   Documente totale:    1,200
   ✅ Completate:       1,200
   ⏳ În procesare:     0
   ❌ Eșuate:           0
   📝 Paragrafe:        24,500

🧠 VECTOR STORE (Qdrant):
   Vectori:            24,500
   Dimensiune:         1536

📈 PROGRES INDEXARE:
   1,200 / 2,841 documente (42.2%)
   [████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]
   ⏳ Rămase: 1641 | ETA: ~55 ore
```

### Căutare:
```
══════════════════════════════════════════════════════════════════════
  🔍 CĂUTARE ÎN DOCUMENTE
══════════════════════════════════════════════════════════════════════

  Query: "tensiune nominală JT"

  ✅ 10 rezultate găsite:

  ────────────────────────────────────────────────────────────────────
  #1  📄 NTE_001_03_00.pdf
      📂 Norme Tehnice ANRE (NTE) | Relevanță: 94.2%
      📝 Tensiunea nominală în rețelele de joasă tensiune este 
         considerată tensiunea de până la 1 kV...
```

---

## 🆘 Troubleshooting

### "Comanda nu există"
```bash
chmod +x rag          # Asigură-te că scriptul e executabil
./rag help            # Vezi comenzile disponibile
```

### "Nu pot conecta la Qdrant/PostgreSQL"
```bash
./rag check           # Verifică ce servicii sunt DOWN
docker ps             # Verifică containerele Docker
```

### Indexarea e prea lentă
- Crește `BATCH_SIZE` în `manual-index.ts`
- Verifică conexiunea la internet
- Asigură-te că OpenAI API key e validă

---

## 📁 Fișiere CLI

```
legal-rag-saas/
├── rag                    # Script wrapper (executabil)
├── cli/
│   ├── index.ts          # Router principal
│   ├── status-check.ts   # Verificare status
│   ├── health-check.ts   # Verificare servicii
│   ├── stats.ts          # Statistici
│   ├── count-docs.ts     # Numărare documente
│   ├── test-runner.ts    # Rulare teste
│   ├── test-single.ts    # Test individual
│   └── search.ts         # Căutare
├── manual-index.ts       # Indexare documente
├── clear-index.ts        # Ștergere index
└── CLI.md               # Acest fișier
```

---

## ✅ Checklist Zilnic

- [ ] `./rag check` - Verifică serviciile
- [ ] `./rag status` - Vezi progresul indexării
- [ ] `./rag stats` - Statistici rapide

---

**Pentru suport suplimentar, vezi `INDEXING.md` sau folosește `./rag help`**
