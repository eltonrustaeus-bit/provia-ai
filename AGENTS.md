# ProviaAI — AGENTS.md
# Full project context for AI coding agents (Codex, Claude, etc.)

## What is this project?

ProviaAI (ProvKlarUF) is an AI-powered exam training platform for Swedish students.
- Students paste study material → AI generates mock exams → AI grades answers with feedback
- Current product focus: school study support for grundskola/gymnasium only
- Deployed at: https://proviaai.se (Vercel)
- Repo: https://github.com/eltonrustaeus-bit/provia-ai

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Plain HTML/CSS/JS — NO framework, NO build step |
| Backend | `api/*.js` — Vercel serverless functions |
| Auth + DB | Supabase (PostgreSQL + RLS) |
| AI | OpenAI (gpt-4o-mini default) |
| Payments | Stripe |
| Email | Resend |
| Deploy | Vercel (push to `main` = auto-deploy) |

**No React. No Vite. No TypeScript. No bundler.**
Edit `.html`, `.js`, `.css` files directly and push.

---

## File Structure

```
/                     ← static files served as-is by Vercel
  index.html          ← landing page
  app.html            ← core exam wizard (4 steps: material → generate → answer → grade)
  förbättring.html    ← improvement coach + mistake bank (Premium feature)
  pricing.html        ← plans: Gratis / Basic / Premium
  admin.html          ← admin panel (admin role only)
  konto.html          ← user account settings
  style.css           ← global styles + design tokens
  shared.js           ← shared frontend utilities: getPageContext(), window.setPerContext()

api/
  _auth.js            ← shared auth middleware (JWT verification)
  _per-core.js        ← PER AI engine: callAI(), buildPERSystemPrompt() (ESM)
  generate-exam.js    ← generates exam from pasted material (CJS, uses /v1/responses)
  grade.js            ← grades exam answers (CJS, uses /v1/responses)
  explain.js          ← P.E.R explanation chat (ESM, uses /v1/chat/completions)
  smart-tips.js       ← tips for wrong answers (ESM)
  teacher-report.js   ← generates teacher-style feedback report (ESM)
  check-role.js       ← returns user role from JWT (ESM)
  signup.js           ← creates user profile + sends welcome email (ESM)
  ocr.js              ← image → text via OpenAI vision (ESM)
  admin.js            ← admin operations (ESM, requires admin role)
  create-checkout-session.js ← Stripe checkout (ESM)
  stripe-webhook.js   ← Stripe webhook handler (CJS)
  delete-exams.js     ← delete user exams (ESM)

scripts/
  a11y-audit.mjs      ← accessibility sweep over active pages
  test-emails.js      ← local email template smoke output
```

---

## CRITICAL: Module Format in api/

**Never mix CJS and ESM in one file. Check before editing.**

| File | Format |
|------|--------|
| `generate-exam.js` | CommonJS (`module.exports = async (req, res) => {}`) |
| `grade.js` | CommonJS |
| `stripe-webhook.js` | CommonJS |
| **Everything else** | ESM (`export default async function handler(req, res) {}`) |

ESM files use `import`. CJS files use `require()`. Cross-importing = runtime crash on Vercel.

---

## CRITICAL: OpenAI Endpoints

Two completely different endpoints — NOT interchangeable:

### `/v1/responses` (structured output)
Used by: `generate-exam.js`, `grade.js`
```js
fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    input: [{ role: 'user', content: '...' }],
    text: { format: { type: 'json_schema', json_schema: { name: 'exam', schema: {...} } } }
  })
})
```

### `/v1/chat/completions` (chat)
Used by: `explain.js`, `smart-tips.js`, `teacher-report.js`, `_per-core.js`
```js
fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [{ role: 'system', content: '...' }, { role: 'user', content: '...' }]
  })
})
```

---

## P.E.R Core Architecture

"P.E.R" = the AI personality (Precis, Effektiv, Relevant — a teaching AI persona).

- `api/_per-core.js` — shared ESM module: `callAI()` + `buildPERSystemPrompt()` + `buildPERCoachSystemPrompt()`
- `api/explain.js` accepts: `{ question, userAnswer, pageContext, helpLevel }` where helpLevel: 0=hint, 1=explain, 2=step-by-step, 3=full solution
- `shared.js` on frontend: `getPageContext()` builds rich context string; `window.setPerContext(ctx)` lets pages inject custom context

---

## Supabase

- **URL**: `https://mnmotdluigzeehdjbhbu.supabase.co`
- **Tables**:
  - `profiles` — id (UUID), approved (bool), role (text), created_at
  - `user_exams` — id, user_id, created_at, exam_data (JSON), results (JSON)
  - `user_profiles` — extended user data
- **Trigger** `handle_new_user`: auto-creates profile with `role = 'gratis'`, `approved = true`
- **Auth**: Supabase JWT. Admin endpoints verify service role key.
- **ALWAYS test RLS after any schema change.**

### User Roles & Quotas
| Role | Limit |
|------|-------|
| gratis | 2 prov/vecka |
| basic | 30 prov/mån |
| premium | obegränsat |
| admin | obegränsat |

---

## Design Tokens — NEVER change without asking

```css
--a:      #1bff8c   /* Accent green — AI activity, correct answers, CTAs */
--a2:     #16d475   /* Accent hover */
--a-dim:  rgba(27,255,140,.07)
--a-glow: rgba(27,255,140,.18)

--bg:  #08100d   /* Page background */
--s:   #0f1a13   /* Surface */
--s2:  #142018   /* Surface elevated */
--s3:  #1a2820   /* Surface highest */

--t:   #e8f5ee   /* Text primary */
--t2:  #9dbfad   /* Text secondary */
--t3:  #5e856e   /* Text muted */

--l:   rgba(27,255,140,.09)   /* Border subtle */
--l2:  rgba(27,255,140,.20)   /* Border default */
--l3:  rgba(27,255,140,.32)   /* Border emphasis */

--r:  6px   /* Border radius */
--r2: 4px   /* Border radius small */
--max: 1080px
```

**Typography**: DM Sans (UI), DM Mono (badges, labels, mono data). Base: 13–14px UI, 15–16px body.

**Style direction**: Dark luxury. Sharp, focused, no decoration. Green only for interactive/AI/correct states — not decoration. Not Duolingo. Not generic SaaS blue.

---

## Required Environment Variables

```
OPENAI_API_KEY              # OpenAI
OPENAI_MODEL                # optional, default: gpt-4o-mini
OPENAI_MODEL_MATH           # optional, default: OPENAI_MODEL
SUPABASE_URL                # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY   # Supabase service key (server-side only, never expose)
RESEND_API_KEY              # Email (welcome + admin notifications)
STRIPE_SECRET_KEY           # Stripe
STRIPE_WEBHOOK_SECRET       # Stripe webhook signature
SUPABASE_WEBHOOK_SECRET     # optional
```

Set in Vercel dashboard or `.env.local` for local dev.

---

## Local Development

```bash
npm install
vercel dev          # runs at http://localhost:3000
```

---

## Security Rules (enforce on every api/ change)

- [ ] Input validated before use
- [ ] Auth checked via `_auth.js` before any data access
- [ ] No secrets in response body
- [ ] No raw SQL string interpolation (use Supabase client, not raw queries)
- [ ] Rate limiting enforced on AI endpoints (check existing pattern in generate-exam.js)
- [ ] Admin endpoints verify `role === 'admin'` server-side, never trust client

---

## Core Development Rules

1. **Read file before editing** — never edit blind
2. **Commit before every new feature** — `git add -A && git commit -m "chore: pre-feature snapshot"`
3. **Match CJS/ESM of the file you're editing** — see module format table above
4. **No speculative features** — only what's asked, nothing extra
5. **No design token changes** without asking first
6. **Test Supabase RLS** after any schema change
7. **No `innerHTML` with user data** — XSS risk
8. **Secrets via env only** — never hardcode keys

---

## Common Mistakes to Avoid

- Using `require()` in an ESM file or `import` in a CJS file → Vercel crash
- Using `/v1/responses` format in a `/v1/chat/completions` endpoint or vice versa
- Changing `--a` accent color or background tokens without confirmation
- Adding `role: 'admin'` check client-side instead of server-side
- Forgetting to test RLS after Supabase changes
- Generating exam questions without respecting the `TEORI_DIST` category weights
- Not committing before starting feature work

---

## Deploy

```bash
git push            # triggers Vercel auto-deploy to production
# or manual:
vercel --prod
```

Production: https://proviaai.se
