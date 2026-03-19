# 📚 Comenzi Simplificate

Acum totul e mult mai simplu! Doar tastezi numele comenzii.

---

## ❓ Să vezi ce comenzi ai

```bash
./help
```

---

## 🚀 Cele mai folosite comenzi

| Comandă | Ce face |
|---------|---------|
| `./count` | Numără documentele PDF descărcate |
| `./check` | Verifică dacă PostgreSQL, Qdrant, Redis merg |
| `./status` | Vezi statusul indexării |
| `./stats` | Statistici despre documente |

---

## 📥 Indexare Documente

```bash
./index-start      # Începe indexarea (durează multe ore)
./index-status     # Vezi cât a indexat
./reindex          # Șterge tot și ia de la capăt
./clear            # Șterge doar indexul
```

---

## 🧪 Testare

```bash
./test-one "Care este tensiunea nominală în JT?"
```

---

## 🔍 Căutare

```bash
./search "NTE 001"
./search "tensiune nominală"
```

---

## 💡 Workflow Zilnic

```bash
./check           # 1. Verifică sistemul
./count           # 2. Vezi câte documente ai
./index-start     # 3. Începe indexarea (doar prima dată)
./index-status    # 4. Verifică progresul
```

---

## ⚠️ Atenție!

Comenzile `./reindex` și `./clear` șterg date! Vor cere confirmare.

---

**Totul e în folderul `legal-rag-saas/`. Navighează acolo și rulează comenzile.**
