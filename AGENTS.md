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
OPENAI_MODEL_PER            # optional, P.E.R-only model override (must support Responses + Chat Completions); falls back to OPENAI_MODEL
OPENAI_MODEL_MATH           # optional, default: OPENAI_MODEL
SUPABASE_URL                # Supabase project URL
SUPABASE_SECRET_KEY         # Supabase server secret (preferred; server-side only, never expose)
SUPABASE_SERVICE_ROLE_KEY   # Legacy fallback during key migration (server-side only, never expose)
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
2. **Preserve the worktree** — inspect `git status` before edits; never stage or commit with `git add -A` by default. Commit only when requested or explicitly authorized, and stage exact files.
3. **Match CJS/ESM of the file you're editing** — see module format table above
4. **No speculative features** — only what's asked, nothing extra
5. **No design token changes** without asking first
6. **Test Supabase RLS** after any schema change
7. **No `innerHTML` with user data** — XSS risk
8. **Secrets via env only** — never hardcode keys

## Reusable Agent and Learning Workflow

At the start of each substantive task, read `docs/codex/08_CURRENT_STATUS.md`
and `docs/codex/15_AGENT_PLAYBOOK.md`, then inspect the exact source files and
current Git diff. Load task-relevant reviewed lessons with
`npm run xeliov:context -- --task "<short task description>"`; read the full
`docs/codex/16_LEARNING_LEDGER.md` for a broad project audit. The project root
is mapped to XelioV; use its injected project context and leave a structured
handoff at the end of the task.

The context command prints relevant role cards and reviewed ledger entries for
the current checkout. Use it as an index, not a substitute for reading current
status, source, diff, or applicable rules. It prints to stdout and is not
stored. Do not include secrets, credentials, student data, or private customer
details in the task argument.

- Reuse the role cards in `docs/codex/15_AGENT_PLAYBOOK.md`; agent instances
  themselves are not persistent. Select only the smallest relevant roles.
- Keep one designated writer for each mutable code area. Reviewers are
  read-only unless a separate, disjoint implementation task is explicitly
  assigned.
- Record only concise, source-backed outcomes in `docs/codex/16_LEARNING_LEDGER.md`.
  Mark evidence as offline, staging, or production; do not promote assumptions,
  raw private reasoning, credentials, user data, or unverified agent claims.
- At task end, update `docs/codex/08_CURRENT_STATUS.md` with the verified state,
  tests and blockers when the task materially changes project status. Add to the
  learning ledger only if the finding is reusable; do not turn every task or
  agent response into a permanent rule.
- A learning becomes a durable rule only after evidence is checked and a human
  approves it. Preserve rejected hypotheses and known limitations when they
  prevent the same investigation from being repeated.

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
