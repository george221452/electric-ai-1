# Deploy pe Vercel (Free)

## Pasul 1: Pregătire

1. Creează cont pe [Vercel](https://vercel.com) (cu GitHub)
2. Creează repo nou pe GitHub
3. Push codul pe GitHub

## Pasul 2: Environment Variables în Vercel

Du-te în Settings → Environment Variables și adaugă:

```
NEXTAUTH_URL=https://legal-rag-demo.vercel.app
NEXTAUTH_SECRET=generate-random-string-here
OPENAI_API_KEY=sk-your-key-here
QDRANT_URL=http://your-qdrant-server:6333
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
```

## Pasul 3: Deploy

1. Connectează repo-ul în Vercel
2. Click "Deploy"
3. Așteaptă build-ul (~2-3 minute)

## Limitări Free Tier:

- Function invocations: 100GB/hours/month
- Build time: 6000 minutes/month
- Bandwidth: 100GB/month

## Domeniu:

Aplicația va fi disponibilă la:
`https://legal-rag-demo.vercel.app`

## Note:

- Baza de date PostgreSQL poate fi pe [Supabase](https://supabase.com) (free)
- Qdrant poate fi pe [Qdrant Cloud](https://cloud.qdrant.io) (free tier)
- Redis poate fi pe [Upstash](https://upstash.com) (free)
