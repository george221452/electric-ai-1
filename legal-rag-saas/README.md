# LegalRAG SaaS 🏛️

Platformă enterprise RAG (Retrieval-Augmented Generation) pentru documente legale și tehnice, cu **100% acuratețe** garantată prin validare strictă a citatelor.

## ✨ Features

- 🔍 **RAG Multi-Document** - Interoghează multiple documente simultan
- ✅ **100% Acuratețe** - Citate validate, anti-halucinație
- 📄 **Procesare PDF** - Extrage paragrafe cu structură păstrată
- 💳 **Plăți Stripe** - Abonamente și token system
- 🏢 **Multi-Tenant** - Workspaces cu izolare completă
- 🔐 **Securitate** - Rate limiting, auth, autorizare
- 🤖 **AI Opțional** - Folosește AI doar pentru formatare, nu pentru facts

## 🚀 Quick Start

### 1. Clone și Setup
```bash
git clone <repo>
cd legal-rag-saas
make setup
```

### 2. Configurează Environment
```bash
cp .env.example .env
# Editează .env cu cheile tale
```

### 3. Start Dezvoltare
```bash
# Terminal 1 - App
docker-compose up -d
npm run dev

# Terminal 2 - Worker
npm run worker
```

### 4. Accesează
- **App**: http://localhost:3000
- **Prisma Studio**: npx prisma studio

## 🐳 Docker

```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

## 📁 Structură

```
app/                 # Next.js App Router
├── api/            # API Routes
├── dashboard/      # Dashboard page
└── pricing/        # Pricing page

components/          # React Components
├── chat/           # Chat interface
├── documents/      # Document management
├── pricing/        # Pricing cards
└── ui/             # shadcn/ui components

src/
├── core/           # Domain Layer (DDD)
│   ├── entities/   # Document, Paragraph, etc.
│   ├── services/   # Ports (interfaces)
│   └── events/     # Domain events
├── application/    # Use Cases
└── infrastructure/ # Adapters & Config

worker/             # Background workers
prisma/             # Database schema
```

## 💳 Stripe Setup

1. Creează cont Stripe
2. Configurează produse în Stripe Dashboard
3. Copiază price IDs în `.env`
4. Configurează webhook endpoint: `/api/webhooks/stripe`

## 🧪 Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

## 🚢 Deployment

### VPS (Docker)
```bash
make deploy-build
```

### GitHub Actions
Configurează secrets în repo:
- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`

## 📋 API Endpoints

### RAG Query
```http
POST /api/rag/query
Content-Type: application/json

{
  "query": "Ce obligații există?",
  "workspaceId": "uuid",
  "options": {
    "maxParagraphs": 5,
    "strictMode": true
  }
}
```

### Document Upload
```http
POST /api/documents
Content-Type: multipart/form-data

file: <binary>
workspaceId: uuid
ragConfigId: romanian-legal-norm
```

## 🎯 Arhitectura RAG

```
Query → Retrieval (Vector Search) → Validation → Response
                ↓                        ↓
          Qdrant (Vectors)      Citation Validator
                ↓                        ↓
        Boosting Legal          100% Accuracy Check
```

## 📝 Configurații RAG

- `romanian-legal-norm` - I7/2011, P118
- `romanian-law` - Legi și ordonanțe
- `technical-manual` - Documentație tehnică
- `generic-document` - Configurație generală

## 🤝 Contributing

1. Fork
2. Feature branch: `git checkout -b feature/amazing`
3. Commit: `git commit -m 'Add amazing'`
4. Push: `git push origin feature/amazing`
5. Pull Request

## 📄 License

MIT
