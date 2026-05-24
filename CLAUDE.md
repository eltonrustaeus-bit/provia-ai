# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

This project deploys to **Vercel** (serverless functions). There is no build step, no test suite, and no linter configured.

**Run locally:**
```bash
npm install
vercel dev
```

**Required environment variables** (set in Vercel dashboard or `.env.local`):
```
OPENAI_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_MODEL              # optional, defaults to gpt-4o-mini
OPENAI_MODEL_MATH         # optional, defaults to OPENAI_MODEL
RESEND_API_KEY            # welcome email via Resend (resend.com)
SUPABASE_WEBHOOK_SECRET   # optional but recommended — validates Supabase webhook calls
```

**Test an API endpoint manually:**
```bash
curl -X POST http://localhost:3000/api/generate-exam \
  -H "Content-Type: application/json" \
  -d '{"pastedText":"...","level":"C","qType":"mix","numQuestions":5}'
```

## Architecture

The project is a **Vercel serverless monorepo** — no framework, no bundler.

- **Frontend**: Plain HTML/CSS/JS in the root. All pages are self-contained with inline `<script>` and `<style>`. State lives in `localStorage`; Supabase syncs it cross-device on login.
- **Backend**: `api/*.js` — each file exports a single Vercel handler function. No shared utilities or middleware.

### Module format inconsistency

The `api/` directory mixes two module formats:
- **CommonJS** (`module.exports`): `generate-exam.js`, `grade.js`
- **ESM** (`export default`): `check-approved.js`, `check-role.js`, `smart-tips.js`, `teacher-report.js`, `train-material.js`, `ocr.js`, etc.

When adding new endpoints, match the existing style of the file you're editing or copy the pattern from a nearby file. Mixing formats in a single file will break at runtime.

### OpenAI API usage — two different endpoints

Two different OpenAI endpoints are in use:
- `/v1/responses` (newer, structured output with `json_schema`) — used in `generate-exam.js` and `grade.js`
- `/v1/chat/completions` — used in `smart-tips.js` and other endpoints

The `/v1/responses` endpoint expects `{ input: [...], text: { format: schema } }`, not `{ messages: [...], response_format: ... }`. These are not interchangeable.

### Grading logic (`api/grade.js`)

MC questions are graded deterministically (no AI call): the student's letter answer (A–F) is normalized and compared against `correct_index`. Non-MC questions are batched into a single AI call. Results are always returned in original question order — do not reorder.

### Math detection (`api/generate-exam.js`)

`looksLikeMath()` runs on both the course name and pasted material. If it returns true, a separate math-specific system prompt is appended and `OPENAI_MODEL_MATH` is used instead of the default model.

### Data flow summary

```
app.html
  → POST /api/generate-exam   (material → exam JSON with questions)
  → POST /api/grade           (questions + student answers + history/mistakes → graded result)
  → POST /api/smart-tips      (single wrong question → 200-word tip)

förbättring.html
  → POST /api/train-material  (last 40 mistakes → targeted drill)
  → POST /api/teacher-report  (exam history + mistakes → formatted report)
  → POST /api/check-approved  (user_id → { approved: bool })
  → POST /api/check-role      (JWT → { role: "student"|"teacher"|"admin"|"pending" })

api/signup.js (on every new signup, server-side)
  → Resend welcome email to new user (buildWelcomeHtml template, inline in signup.js)
  → Resend admin notification to elton.rustaeus@gmail.com
```

### Supabase schema

- URL: `https://mnmotdluigzeehdjbhbu.supabase.co`
- Tabeller: `profiles` (id, approved, role, created_at), `user_exams`, `user_profiles`
- Roller: `gratis` (2 prov/vecka), `basic` (30/mån), `premium` (obegränsat), `admin` (obegränsat)
- Trigger `handle_new_user` körs vid signup och sätter `role = 'gratis'`, `approved = true`
- Auth är Supabase JWT; admin-endpoints verifierar service role key via Bearer token
- Testa alltid RLS-regler efter schema-ändringar

## Designsystem

Ändra aldrig designtokens utan att fråga.

| Token | Värde |
|-------|-------|
| Bakgrund | `#08100d` |
| Accent | `#1bff8c` |
| Surface | `#111a15` / `#162019` |
| Text (primär) | `#e8f5ee` |
| Text (sekundär) | `#a8c4b4` / `#6b8f7c` |
| Border (subtil) | `rgba(27,255,140,.10)` |
| Border (tydlig) | `rgba(27,255,140,.22)` |
| Border radius | `5px` |
| Font | DM Sans (brödtext) + DM Mono (kod/mono) |

## Arbetsregler

- Gör alltid en commit innan en ny feature påbörjas
- Testa alltid Supabase RLS efter ändringar i databasen
