# Architecture Map

## Stack
- Frontend: Plain HTML/CSS/JS, no framework, no build step
- Backend: `api/*.js` Vercel serverless (one handler per file)
- Auth + DB: Supabase
- AI: OpenAI (gpt-4o-mini default)

## Pages
- `index.html` — landing
- `app.html` — exam wizard (4 steps)
- `korkortet.html` — driving theory practice
- `förbättring.html` — improvement coach + mistake bank (Premium)
- `pricing.html` — upgrade page
- `live-demo.html` — animated demo
- `admin.html` — admin panel

## Module Format — CRITICAL
`api/` mixes two formats — never mix in one file:
- **CommonJS** (`module.exports`): `generate-exam.js`, `grade.js`
- **ESM** (`export default`): `check-approved.js`, `check-role.js`, `smart-tips.js`, `teacher-report.js`, `train-material.js`, `ocr.js`

## OpenAI Endpoints — CRITICAL, NOT interchangeable
- `/v1/responses` (structured output, `json_schema`) → `generate-exam.js`, `grade.js`
  - Body: `{ input: [...], text: { format: schema } }`
- `/v1/chat/completions` → `smart-tips.js` and others
  - Body: `{ messages: [...], response_format: ... }`

## Grading Logic (`api/grade.js`)
- MC questions: graded deterministically, no AI call. Student letter (A–F) vs `correct_index`.
- Non-MC: batched into single AI call.
- Results always returned in original question order.

## Math Detection (`api/generate-exam.js`)
`looksLikeMath()` runs on course name + pasted material. If true: appends math system prompt + uses `OPENAI_MODEL_MATH`.

## Data Flow
```
app.html
  → POST /api/generate-exam   (material → exam JSON)
  → POST /api/grade           (questions + answers + history → graded)
  → POST /api/smart-tips      (wrong question → 200-word tip)

förbättring.html
  → POST /api/train-material  (last 40 mistakes → drill)
  → POST /api/teacher-report  (history + mistakes → report)
  → POST /api/check-approved  (user_id → { approved: bool })
  → POST /api/check-role      (JWT → { role })

api/signup.js
  → Resend welcome email + admin notification
```

## Supabase
- URL: `https://mnmotdluigzeehdjbhbu.supabase.co`
- Tables: `profiles` (id, approved, role, created_at), `user_exams`, `user_profiles`
- Trigger `handle_new_user`: sets `role = 'gratis'`, `approved = true` on signup
- Auth: Supabase JWT; admin endpoints verify service role key via Bearer
- **Always test RLS after schema changes**
