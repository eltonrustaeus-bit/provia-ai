# Quick Start

## Local Dev
```bash
npm install
vercel dev
```

## Test Endpoint
```bash
curl -X POST http://localhost:3000/api/generate-exam \
  -H "Content-Type: application/json" \
  -d '{"pastedText":"...","level":"C","qType":"mix","numQuestions":5}'
```

## Required Env Vars
```
OPENAI_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_MODEL              # optional, default: gpt-4o-mini
OPENAI_MODEL_MATH         # optional, default: OPENAI_MODEL
RESEND_API_KEY
SUPABASE_WEBHOOK_SECRET   # optional but recommended
```
Set in Vercel dashboard or `.env.local`.

## Deploy
Push to `main` → Vercel auto-deploys.
