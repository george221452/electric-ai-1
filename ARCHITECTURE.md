# 🏗️ Arhitectura Aplicației Legal RAG SaaS

## 📋 Overview

Aplicație **Legal RAG (Retrieval-Augmented Generation)** pentru documente juridice ANRE (Autoritatea Națională de Reglementare în Energie), cu suport pentru:
- Chat inteligent cu documente juridice
- Sistem de quiz pentru examene electricieni
- Voice cloning pentru asistent vocal
- Subscription & token-based billing

---

## 🎯 Diagrama Arhitecturală High-Level

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Landing   │  │  Dashboard  │  │   Voice     │  │   Document Viewer       │ │
│  │    Page     │  │             │  │    Page     │  │                         │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
│         │                │                │                     │               │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐  ┌───────────▼─────────────┐ │
│  │   Pricing   │  │    Chat     │  │  Documents  │  │   Quiz Interface        │ │
│  │    Page     │  │ Interface   │  │   Upload    │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           API LAYER (Next.js App Router)                        │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                         MIDDLEWARE                                        │  │
│  │              Auth (NextAuth), Rate Limiting, CORS                         │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                         │                                       │
│  ┌─────────────────┬──────────────────┬──────────────────┬──────────────────┐  │
│  │   RAG API       │  Document API    │   Voice API      │   Auth API       │  │
│  │  ─────────────  │  ─────────────   │  ─────────────   │  ─────────────   │  │
│  │ • query         │ • upload         │ • tts            │ • [...nextauth]  │  │
│  │ • search-ref    │ • list           │ • upload-simple  │                  │  │
│  │ • advanced-srch │ • content        │ • status         │                  │  │
│  │ • citations     │ • view           │ • elevenlabs     │                  │  │
│  │                 │ • download       │                  │                  │  │
│  └─────────────────┴──────────────────┴──────────────────┴──────────────────┘  │
│  ┌─────────────────┬──────────────────┬──────────────────┬──────────────────┐  │
│  │   Cache API     │  Stripe API      │  Feedback API    │  Tables API      │  │
│  │  ─────────────  │  ─────────────   │  ─────────────   │  ─────────────   │  │
│  │ • prewarm       │ • checkout       │ • submit         │ • extract        │  │
│  │ • stats         │ • portal         │                  │                  │  │
│  │                 │ • webhooks       │                  │                  │  │
│  └─────────────────┴──────────────────┴──────────────────┴──────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER (lib/, src/)                              │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                     RAG PROCESSING ENGINE                                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │  │
│  │  │   Query     │  │  Embedding  │  │  Vector     │  │  LLM Response   │  │  │
│  │  │ Understanding│  │  Service    │  │  Search     │  │   Generator     │  │  │
│  │  │             │  │  (OpenAI)   │  │  (Qdrant)   │  │   (OpenAI)      │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │  │
│  │  │ Numerical   │  │  Synonym    │  │  Confidence │  │  Citation       │  │  │
│  │  │   Search    │  │  Expansion  │  │  Optimizer  │  │  Validator      │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                      QUIZ SYSTEM                                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │  │
│  │  │   Smart     │  │  Advanced   │  │  Enhanced   │  │   Quiz Handler  │  │  │
│  │  │   Router    │  │   Quiz      │  │   Quiz      │  │    (Base)       │  │  │
│  │  │             │  │   Handler   │  │   Handler   │  │                 │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                      CACHE & SESSION                                      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │  │
│  │  │    Redis    │  │    Chat     │  │   Intent    │  │   Smart Clarif  │  │  │
│  │  │   Cache     │  │   Memory    │  │   Tracker   │  │                 │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                              │
│                                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────────────────┐  │
│  │    PostgreSQL       │  │      Qdrant         │  │        Redis           │  │
│  │   (Prisma ORM)      │  │   (Vector DB)       │  │       (Cache)          │  │
│  │                     │  │                     │  │                        │  │
│  │  • Users            │  │  • legal_paragraphs │  │  • Query cache         │  │
│  │  • Workspaces       │  │    collection       │  │  • Session store       │  │
│  │  • Documents        │  │  • 1536 dimensions  │  │  • Rate limiting       │  │
│  │  • Paragraphs       │  │  • Cosine similarity│  │                        │  │
│  │  • Chats/Messages   │  │                     │  │                        │  │
│  │  • Subscriptions    │  │                     │  │                        │  │
│  │  • Feedback         │  │                     │  │                        │  │
│  └─────────────────────┘  └─────────────────────┘  └────────────────────────┘  │
│                                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐                              │
│  │       MinIO         │  │  External APIs      │                              │
│  │   (S3-compatible)   │  │                     │                              │
│  │                     │  │  • OpenAI           │                              │
│  │  • PDF Storage      │  │  • Stripe           │                              │
│  │  • Voice Samples    │  │  • ElevenLabs       │                              │
│  └─────────────────────┘  └─────────────────────┘                              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      WORKER & BACKGROUND JOBS                                   │
│                                                                                 │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────────┐   │
│  │   Document Processor        │  │     Embedding Generator                 │   │
│  │   ─────────────────────     │  │     ─────────────────────               │   │
│  │   • PDF parsing             │  │     • Generate embeddings               │   │
│  │   • Text extraction         │  │     • Store in Qdrant                   │   │
│  │   • Table extraction        │  │     • Batch processing                  │   │
│  │   • Paragraph splitting     │  │                                         │   │
│  └─────────────────────────────┘  └─────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Structura Proiectului

```
legal-rag-saas/
│
├── 📁 app/                          # Next.js App Router (Frontend + API)
│   ├── 📁 api/                      # API Routes
│   │   ├── 📁 auth/[...nextauth]/   # NextAuth.js authentication
│   │   ├── 📁 rag/                  # RAG endpoints
│   │   │   ├── query/route.ts       # Main RAG query endpoint
│   │   │   ├── search-reference/    # Reference search
│   │   │   ├── advanced-search/     # Advanced search with filters
│   │   │   └── citations/           # Citation management
│   │   ├── 📁 documents/            # Document management API
│   │   │   ├── route.ts             # CRUD operations
│   │   │   ├── content/route.ts     # Document content
│   │   │   ├── list/route.ts        # List documents
│   │   │   ├── view/route.ts        # Document viewer
│   │   │   └── [id]/                # Document-specific ops
│   │   ├── 📁 chat/                 # Chat API
│   │   ├── 📁 voice/                # Voice cloning API
│   │   ├── 📁 stripe/               # Payment processing
│   │   ├── 📁 cache/                # Cache management
│   │   └── 📁 feedback/             # User feedback
│   │
│   ├── 📁 dashboard/                # Dashboard page
│   ├── 📁 documents-viewer/         # Document viewer page
│   ├── 📁 voice/                    # Voice cloning page
│   ├── 📁 pricing/                  # Pricing page
│   ├── 📁 auth/signin/              # Sign in page
│   ├── layout.tsx                   # Root layout
│   ├── page.tsx                     # Landing page
│   └── globals.css                  # Global styles
│
├── 📁 components/                   # React Components
│   ├── 📁 chat/                     # Chat interface
│   ├── 📁 documents/                # Document upload/list
│   ├── 📁 quiz/                     # Quiz components
│   ├── 📁 voice/                    # Voice recorder
│   ├── 📁 search/                   # Advanced search
│   ├── 📁 format/                   # Answer formatting
│   ├── 📁 feedback/                 # Feedback buttons
│   ├── 📁 pricing/                  # Pricing cards
│   └── 📁 ui/                       # shadcn/ui components
│
├── 📁 lib/                          # Utility libraries
│   ├── 📁 quiz/                     # Quiz system logic
│   ├── 📁 search/                   # Search utilities
│   ├── 📁 cache/                    # Redis cache
│   ├── 📁 extraction/               # Document extraction
│   ├── 📁 stripe/                   # Stripe config
│   ├── chat-memory.ts               # Chat session memory
│   ├── query-understanding.ts       # Query intent analysis
│   └── smart-clarifications.ts      # Clarification engine
│
├── 📁 src/                          # Clean Architecture Layer
│   ├── 📁 core/                     # Domain entities & business rules
│   ├── 📁 application/              # Use cases & DTOs
│   └── 📁 infrastructure/           # External adapters
│
├── 📁 worker/                       # Background workers
│   ├── document-processor.ts        # PDF processing worker
│   └── embedding-generator.ts       # Embedding generation worker
│
├── 📁 cli/                          # Command-line tools
│   ├── index.ts                     # Main CLI
│   ├── test-runner.ts               # Test automation
│   └── search.ts                    # Search CLI
│
├── 📁 prisma/                       # Database schema
│   └── schema.prisma                # Prisma schema
│
├── 📁 voice-cloning/                # Voice cloning service
│   ├── Dockerfile                   # Container definition
│   └── server.py                    # Python voice server
│
├── 📁 scripts/                      # Utility scripts
├── 📁 uploads/                      # Local file uploads
├── 📁 downloads/                    # ANRE documents
│
├── docker-compose.yml               # Docker orchestration
├── next.config.js                   # Next.js config
└── package.json                     # Dependencies
```

---

## 🔧 Stack Tehnologic

### Frontend
| Tehnologie | Utilizare |
|------------|-----------|
| **Next.js 14** | Framework React cu App Router |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Styling |
| **shadcn/ui** | Componente UI (Radix UI) |
| **Lucide React** | Icons |

### Backend
| Tehnologie | Utilizare |
|------------|-----------|
| **Next.js API Routes** | REST API endpoints |
| **NextAuth.js v5** | Authentication |
| **Prisma ORM** | Database access |
| **Zod** | Schema validation |

### AI & ML
| Tehnologie | Utilizare |
|------------|-----------|
| **OpenAI GPT-4** | LLM for responses |
| **OpenAI Embeddings** | text-embedding-3-small |
| **@xenova/transformers** | Local embeddings (fallback) |
| **ElevenLabs API** | Text-to-speech |

### Database & Storage
| Tehnologie | Utilizare |
|------------|-----------|
| **PostgreSQL 16** | Relational data |
| **Qdrant** | Vector database |
| **Redis 7** | Cache & sessions |
| **MinIO** | S3-compatible storage |

### Document Processing
| Tehnologie | Utilizare |
|------------|-----------|
| **Unstructured API** | PDF parsing |
| **pdf-parse** | PDF text extraction |
| **mammoth** | DOCX parsing |
| **pdf-lib** | PDF manipulation |

### DevOps
| Tehnologie | Utilizare |
|------------|-----------|
| **Docker** | Containerization |
| **Docker Compose** | Local development |
| **tsx** | TypeScript execution |
| **Playwright** | E2E testing |
| **Jest** | Unit testing |

---

## 📊 Database Schema (Prisma)

### Entități Principale

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER MANAGEMENT                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │     User     │◄────┤   Account    │     │   Session    │                │
│  │──────────────│     │──────────────│     │──────────────│                │
│  │ id           │     │ id           │     │ id           │                │
│  │ email        │     │ userId       │     │ sessionToken │                │
│  │ name         │     │ provider     │     │ userId       │                │
│  │ image        │     │ providerAccId│     │ expires      │                │
│  │ ...          │     │ ...          │     │ ...          │                │
│  └──────┬───────┘     └──────────────┘     └──────────────┘                │
│         │                                                                   │
│         │         ┌──────────────┐     ┌──────────────┐                    │
│         └────────►│  ApiKey      │     │TokenBalance  │                    │
│                   │──────────────│     │──────────────│                    │
│                   │ userId       │     │ userId       │                    │
│                   │ keyHash      │     │ balance      │                    │
│                   │ keyPrefix    │     │ totalUsed    │                    │
│                   └──────────────┘     └──────────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           WORKSPACE & DOCUMENTS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐         ┌──────────────┐                                 │
│  │   Workspace  │◄────────┤ WorkspaceUser│                                 │
│  │──────────────│         │──────────────│                                 │
│  │ id           │         │ workspaceId  │                                 │
│  │ name         │         │ userId       │                                 │
│  │ slug         │         │ role         │                                 │
│  │ ownerId      │         │ (OWNER/ADMIN/│                                 │
│  │ isPublic     │         │  MEMBER/VIEW)│                                 │
│  └──────┬───────┘         └──────────────┘                                 │
│         │                                                                   │
│         │         ┌──────────────┐     ┌──────────────┐                    │
│         └────────►│   Document   │◄────┤  Paragraph   │                    │
│                   │──────────────│     │──────────────│                    │
│                   │ workspaceId  │     │ documentId   │                    │
│                   │ userId       │     │ content      │                    │
│                   │ name         │     │ pageNumber   │                    │
│                   │ fileType     │     │ keywords[]   │                    │
│                   │ status       │     │ isObligation │                    │
│                   │ storageKey   │     │ isDefinition │                    │
│                   └──────────────┘     │ articleNumber│                    │
│                                        └───────┬──────┘                    │
│                                                │                            │
│                                                │     ┌──────────────┐      │
│                                                └────►│   Citation   │      │
│                                                      │──────────────│      │
│                                                      │ paragraphId  │      │
│                                                      │ messageId    │      │
│                                                      │ confidence   │      │
│                                                      └──────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              CHAT & MESSAGING                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐         ┌──────────────┐                                 │
│  │     Chat     │◄────────┤   Message    │                                 │
│  │──────────────│         │──────────────│                                 │
│  │ workspaceId  │         │ chatId       │                                 │
│  │ userId       │         │ role         │                                 │
│  │ title        │         │ content      │                                 │
│  │ documentIds[]│         │ citations    │                                 │
│  └──────────────┘         └──────────────┘                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              BILLING & PAYMENTS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │   Subscription   │     │TokenUsage    │     │TokenTransact │            │
│  │──────────────────│     │──────────────│     │──────────────│            │
│  │ userId           │     │ userId       │     │ userId       │            │
│  │ stripeCustomerId │     │ amount       │     │ amount       │            │
│  │ stripeSubscrId   │     │ operation    │     │ type         │            │
│  │ status           │     │ metadata     │     │ source       │            │
│  │ (ACTIVE/CANCELED/│     │ createdAt    │     │ createdAt    │            │
│  │  PAST_DUE/etc)   │     │              │     │              │            │
│  └──────────────────┘     └──────────────┘     └──────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Fluxul RAG (Retrieval-Augmented Generation)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RAG QUERY FLOW                                           │
└─────────────────────────────────────────────────────────────────────────────┘

  User Query
      │
      ▼
┌─────────────────────────────────────┐
│  1. PRE-PROCESSING                  │
│     • Validate query (Zod)          │
│     • Check cache (Redis)           │
│     • Detect intent                 │
│     • Check if quiz question        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. QUERY UNDERSTANDING             │
│     • Extract measurement intent    │
│     • Parse numerical values        │
│     • Create search variants        │
│     • Expand synonyms               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. EMBEDDING GENERATION            │
│     • OpenAI text-embedding-3-small │
│     • 1536 dimensions               │
│     • Query → Vector                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. VECTOR SEARCH (Qdrant)          │
│     • Collection: legal_paragraphs  │
│     • Cosine similarity             │
│     • Top-K results                 │
│     • Filter by workspace/doc       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  5. RE-RANKING & SCORING            │
│     • Numerical match scoring       │
│     • Confidence optimization       │
│     • Select optimal citations      │
│     • Threshold filtering (40%)     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  6. CONTEXT BUILDING                │
│     • Format citations              │
│     • Build prompt context          │
│     • Add system instructions       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  7. LLM GENERATION (OpenAI GPT-4)   │
│     • Generate answer               │
│     • Include citations             │
│     • Format output                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  8. POST-PROCESSING                 │
│     • Cache result                  │
│     • Store in chat history         │
│     • Return formatted response     │
└─────────────────────────────────────┘
```

---

## 🎯 Quiz System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         QUIZ PROCESSING FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   User Query    │
                    │ (Question + A/B │
                    │  /C/D options)  │
                    └────────┬────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │      DETECT QUIZ QUESTION    │
              │  • Regex pattern matching    │
              │  • Extract options (A-D)     │
              │  • Identify question text    │
              └──────────────┬───────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │    SMART ANSWER ROUTER       │
              │  ┌────────────────────────┐  │
              │  │ Route decision logic:  │  │
              │  │ • Confidence threshold │  │
              │  │ • Numeric verification │  │
              │  │ • Keyword matching     │  │
              │  └────────────────────────┘  │
              └──────────────┬───────────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  HIGH CONF   │ │  MEDIUM CONF │ │  LOW CONF    │
    │  (>75%)      │ │  (50-75%)    │ │  (<50%)      │
    └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
           │                │                │
           ▼                ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │Direct Answer │ │ Enhanced     │ │ Clarification│
    │ with context │ │ reasoning    │ │ needed       │
    └──────────────┘ └──────────────┘ └──────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    QUIZ HANDLER TYPES                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  QuizHandler     │    │ AdvancedQuiz     │    │ EnhancedQuiz     │
│  (Base)          │    │ Handler          │    │ Handler          │
│──────────────────│    │──────────────────│    │──────────────────│
│ • Pattern match  │    │ • Context        │    │ • Dual-mode      │
│ • Option extract │    │   analysis       │    │   system         │
│ • Basic prompt   │    │ • Multi-step     │    │ • Document +     │
│                  │    │   reasoning      │    │   AI reasoning   │
│                  │    │ • Self-reflection│    │ • Verification   │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## 🐳 Docker Services Architecture

```yaml
# docker-compose.yml - Services Overview

services:
  # ┌────────────────────────────────────────────────────────────────┐
  # │ APP (Next.js Application)                                      │
  # │ Port: 3000                                                     │
  # │ Depends on: postgres, qdrant, redis, minio                   │
  # └────────────────────────────────────────────────────────────────┘
  
  # ┌────────────────────────────────────────────────────────────────┐
  # │ POSTGRESQL (Database)                                          │
  # │ Port: 5432                                                     │
  # │ Volume: postgres_data                                          │
  # │ Image: postgres:16-alpine                                     │
  # └────────────────────────────────────────────────────────────────┘
  
  # ┌────────────────────────────────────────────────────────────────┐
  # │ QDRANT (Vector Database)                                       │
  # │ Port: 6333 (HTTP), 6334 (gRPC)                                │
  # │ Volume: qdrant_data                                            │
  # │ Image: qdrant/qdrant:latest                                   │
  # └────────────────────────────────────────────────────────────────┘
  
  # ┌────────────────────────────────────────────────────────────────┐
  # │ REDIS (Cache & Session Store)                                  │
  # │ Port: 6380 (mapped to 6379)                                   │
  # │ Volume: redis_data                                             │
  # │ Image: redis:7-alpine                                         │
  # └────────────────────────────────────────────────────────────────┘
  
  # ┌────────────────────────────────────────────────────────────────┐
  # │ MINIO (S3-Compatible Storage)                                  │
  # │ Port: 9000 (API), 9001 (Console)                              │
  # │ Volume: minio_data                                             │
  # │ Image: minio/minio:latest                                     │
  # └────────────────────────────────────────────────────────────────┘
  
  # ┌────────────────────────────────────────────────────────────────┐
  # │ UNSTRUCTURED (PDF Processing API)                              │
  # │ Port: 8000                                                     │
  # │ Image: downloads.unstructured.io/...                          │
  # └────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SECURITY LAYERS                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Layer 1: AUTHENTICATION
├── NextAuth.js v5 (Auth.js)
├── Providers: Credentials, OAuth
├── JWT Session Strategy
└── Middleware protection for routes

Layer 2: AUTHORIZATION
├── Workspace-level permissions
├── Role-based access (OWNER, ADMIN, MEMBER, VIEWER)
├── Resource ownership checks
└── API route guards

Layer 3: API SECURITY
├── Zod validation on all inputs
├── Rate limiting (Redis-based)
├── CORS configuration
└── API Key authentication for external access

Layer 4: DATA SECURITY
├── PostgreSQL row-level security
├── Encrypted storage keys in MinIO
├── Environment variable secrets
└── No sensitive data in client bundle
```

---

## 📈 ANRE Document Scrapers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ANRE SCRAPER TOOLS                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│ anre-super-         │   │ anre-full-scraper   │   │ anre-quick-scraper  │
│ downloader.ts       │   │ .ts                 │   │ .ts                 │
│─────────────────────│   │─────────────────────│   │─────────────────────│
│ • Progress bar UI   │   │ • Interactive       │   │ • Non-interactive   │
│ • Real-time stats   │   │ • Folder org by     │   │ • Fast bulk dl      │
│ • 500 max pages     │   │   source            │   │ • 3 depth default   │
│ • 600ms delay       │   │ • Max depth 3-5     │   │                     │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘

┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│ anre-targeted-      │   │ anre-full-crawler   │   │ anre-tree-scraper   │
│ scraper.ts          │   │ .ts                 │   │ .ts                 │
│─────────────────────│   │─────────────────────│   │─────────────────────│
│ • 4 NTE target URLs │   │ • Energie + Gaze    │   │ • Recursive tree    │
│ • Norme Tehnice     │   │ • Complete crawl    │   │ • Category path     │
│ • Proceduri         │   │ • 500 pages         │   │ • Nested folders    │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘

SOURCE: https://arhiva.anre.ro/ro/energie-electrica/legislatie
```

---

## 🎤 Voice Cloning Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VOICE SYSTEM                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                         VOICE CLONING FLOW                               │
└──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │ Voice Sample │────►│   Python     │────►│  ElevenLabs  │
  │  Recording   │     │   Server     │     │    Voice     │
  └──────────────┘     └──────────────┘     └──────────────┘
       (User)              (Docker)             (API)

┌──────────────────────────────────────────────────────────────────────────┐
│                          VOICE API ENDPOINTS                             │
└──────────────────────────────────────────────────────────────────────────┘

POST /api/voice/upload-simple  → Upload voice sample
POST /api/voice/tts            → Text-to-speech
GET  /api/voice/status         → Check voice status
POST /api/voice/elevenlabs     → Direct ElevenLabs API

┌──────────────────────────────────────────────────────────────────────────┐
│                        DOCKER SERVICES                                   │
└──────────────────────────────────────────────────────────────────────────┘

  docker-compose.voice.yml:
  ┌────────────────────────────────────────────────────────────────────┐
  │  voice-cloning service                                             │
  │  • Python Flask server                                             │
  │  • Audio processing (FFmpeg)                                       │
  │  • Voice sample validation                                         │
  │  • Port: 5000                                                      │
  └────────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TESTING STRUCTURE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                         TEST CATEGORIES                                  │
└──────────────────────────────────────────────────────────────────────────┘

Unit Tests (Jest)
├── src/__tests__/unit/
│   ├── universal-extractor.test.ts
│   ├── query-rag.test.ts
│   └── strict-citation-validator.test.ts
└── Component testing with React Testing Library

Integration Tests
├── src/__tests__/integration/
│   └── document-upload.test.ts
└── API route testing

E2E Tests (Playwright)
├── playwright.config.ts
└── E2E scenarios for critical paths

┌──────────────────────────────────────────────────────────────────────────┐
│                         TEST SCRIPTS                                     │
└──────────────────────────────────────────────────────────────────────────┘

CLI Test Commands:
├── npm test              → Unit tests
├── npm run test:e2e      → E2E tests
├── npm run test:e2e:ui   → E2E with UI
└── ./test-universal.sh   → Custom test runner

Custom Test Scripts:
├── test-complete.ts          → Full system test
├── test-rag-questions.ts     → RAG accuracy test
├── test-quiz-evaluation.ts   → Quiz system test
├── test_normative_full.ts    → Normative docs test
└── test_dual_mode_system.ts  → Dual mode test

┌──────────────────────────────────────────────────────────────────────────┐
│                      TEST REPORTS                                        │
└──────────────────────────────────────────────────────────────────────────┘

Reports Generated:
├── RAPORT_TEST_COMPLET.md
├── RAPORT_TEST_EVALUARE.md
├── test-report.json / .html
├── ENHANCED_REPORT_*.md
└── DUAL_MODE_REPORT_*.md
```

---

## 📦 Key Environment Variables

```bash
# ┌─────────────────────────────────────────────────────────────────┐
# │ DATABASE & INFRASTRUCTURE                                       │
# └─────────────────────────────────────────────────────────────────┘
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/legalrag
QDRANT_URL=http://localhost:6333
REDIS_URL=redis://localhost:6380
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=documents

# ┌─────────────────────────────────────────────────────────────────┐
# │ EXTERNAL APIs                                                   │
# └─────────────────────────────────────────────────────────────────┘
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
ELEVENLABS_API_KEY=...

# ┌─────────────────────────────────────────────────────────────────┐
# │ AUTHENTICATION                                                  │
# └─────────────────────────────────────────────────────────────────┘
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-key

# ┌─────────────────────────────────────────────────────────────────┐
# │ DOCUMENT PROCESSING                                             │
# └─────────────────────────────────────────────────────────────────┘
UNSTRUCTURED_URL=http://localhost:8000
UNSTRUCTURED_API_KEY=...
```

---

## 🚀 Deployment Options

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                      LOCAL DEVELOPMENT                                   │
└──────────────────────────────────────────────────────────────────────────┘

  docker compose up -d
  ├── postgres:5432
  ├── qdrant:6333
  ├── redis:6380
  ├── minio:9000/9001
  └── unstructured:8000

  npm run dev (Next.js on :3000)

┌──────────────────────────────────────────────────────────────────────────┐
│                      PRODUCTION (Vercel)                                 │
└──────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────┐
  │  Vercel Edge    │  Next.js App
  │  Network        │
  └────────┬────────┘
           │
  ┌────────▼────────┐    ┌───────────────┐    ┌───────────────┐
  │   Vercel        │───►│   Supabase    │───►│  PostgreSQL   │
  │   Functions     │    │   (Database)  │    │               │
  └─────────────────┘    └───────────────┘    └───────────────┘
           │
  ┌────────▼────────┐    ┌───────────────┐
  │   Qdrant Cloud  │    │   Upstash     │
  │   (Vector DB)   │    │   (Redis)     │
  └─────────────────┘    └───────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                      PRODUCTION (Self-Hosted)                            │
└──────────────────────────────────────────────────────────────────────────┘

  Docker Swarm / Kubernetes
  ├── app (Next.js) - 3 replicas
  ├── postgres - 1 primary
  ├── qdrant - 3 nodes
  ├── redis - 1 master + 1 replica
  └── minio - 4 nodes (distributed)
```

---

## 📊 Performance Optimizations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PERFORMANCE FEATURES                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                        CACHING STRATEGY                                  │
└──────────────────────────────────────────────────────────────────────────┘

Query Cache (Redis)
├── Common questions pre-cached
├── Cache warming service
├── Hit count tracking
└── TTL-based expiration

Response Cache
├── Cached answers for frequent queries
├── Confidence-based cache eligibility
└── Workspace-scoped cache keys

┌──────────────────────────────────────────────────────────────────────────┐
│                        SEARCH OPTIMIZATIONS                              │
└──────────────────────────────────────────────────────────────────────────┘

Vector Search
├── OpenAI embeddings (1536 dims)
├── Cosine similarity scoring
├── Top-K filtering (20 results)
└── Workspace/document filtering

Re-ranking
├── Numerical value matching
├── Confidence threshold (40%)
├── Citation optimization
└── Synonym expansion

┌──────────────────────────────────────────────────────────────────────────┐
│                        SCALING STRATEGIES                                │
└──────────────────────────────────────────────────────────────────────────┘

Horizontal Scaling
├── Stateless API servers
├── Shared Redis session store
├── Distributed Qdrant cluster
└── Read replicas for PostgreSQL

Background Processing
├── Async document processing
├── Worker queue for embeddings
└── Parallel PDF processing
```

---

## 📚 Documentation Files

| File | Description |
|------|-------------|
| `CLI.md` | CLI usage guide |
| `INDEXING.md` | Document indexing guide |
| `COMENZI.md` | Quick commands reference |
| `README-DEPLOY.md` | Deployment instructions |
| `VOICE_CLONING.md` | Voice system documentation |
| `RAPORT_TEST_COMPLET.md` | Complete test report |
| `RAPORT_TEST_EVALUARE.md` | Evaluation report |
| `TESTING.md` | Testing guide |

---

*Generated for Legal RAG SaaS - ANRE Document Intelligence System*
