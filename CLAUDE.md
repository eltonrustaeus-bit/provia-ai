# Provia (ProvKlarUF)

Vercel serverless exam platform for Swedish students. No framework, no build step.

## Stack
- Frontend: Plain HTML/CSS/JS in root
- Backend: `api/*.js` Vercel handlers
- Auth + DB: Supabase | AI: OpenAI (gpt-4o-mini)

## Design Tokens — never change without asking
| Token | Värde |
|-------|-------|
| Bakgrund | `#08100d` |
| Accent | `#1bff8c` |
| Surface | `#111a15` / `#162019` |
| Text (primär) | `#e8f5ee` |
| Text (sekundär) | `#a8c4b4` |
| Border radius | `5px` |
| Font | DM Sans + DM Mono |

## Core Rules
- Commit before every new feature
- Test Supabase RLS after any schema change
- Read file before modifying — never edit blind
- Match CJS/ESM style of file being edited (see .claude/COMMON_MISTAKES.md)
- No speculative features, no over-engineering

## Output Rules
- Code first, explanation only if non-obvious
- No boilerplate unless asked
- State bug + fix. Stop. No suggestions beyond scope.
- No guessing about bugs — read the code first.

## körkortsteorin — driving_questions table (2026-06-09)
- 352 questions, 16 categories (all normalized)
- Categories: Vägmärken(60), Trafikregler(44), Korsningar(28), Hastighet(36), Parkering(30),
  Möte&Omkörning(19), Mörker&Sikt(15), Väglag&Bromssträcka(16), Vägtunnlar(12),
  Bogsering&Lastsäkring(11), Fordon&Besiktning(8), Körning med Släp(12),
  Nödsituationer(17), Alkohol&Droger(14), Säkerhet&Utrustning(17), Miljö&Ekonomi(13)
- 89 with image_url (all Wikimedia — E8-50/E8-70/E10-30 fixed to C31 format 2026-06-09)
- Fields: id, category, question, option_a-d, correct, explanation, difficulty, image_url, image_description
- TEORI_DIST: category weights for 65-question teoriprov (matches Trafikverket distribution)
- Adaptive learning: wrong-answer questions boosted up to 40% of exam pool

## Graphify First
Before reading any source file, query the graphify graph:
`C:\Users\elton\Desktop\ProvKlarUF\graphify-out\graph.json`
212 nodes, 211 edges, 36 communities. Only fall back to raw file reads if graph lacks detail.

## P.E.R Core Architecture (uppdaterad 2026-05-30)
- `api/_per-core.js` — Delat AI-lager: `callAI()`, `buildPERSystemPrompt()`, `buildPERCoachSystemPrompt()`
- Alla ESM-endpoints importerar från `_per-core.js` (explain, smart-tips, teacher-report)
- grade.js/generate-exam.js är CJS — importerar EJ _per-core men har PER-branding i system prompt
- `shared.js` — `getPageContext()` injicerar sidkontext i P.E.R-anrop; `window.setPerContext(ctx)` låter sidor sätta rik kontext
- `förbättring.html` coach-sektion → PER API-anrop (cached 24h i `proviaai_per_coach_cache`)
- explain.js accepterar nu `pageContext` + `helpLevel` (0=ledtråd, 1=förklara, 2=steg-för-steg, 3=full lösning)

## API Routes (security-sensitive — review carefully)
| File | Purpose |
|------|---------|
| `api/_auth.js` | Auth middleware shared by all routes |
| `api/_per-core.js` | **PER Core Engine** — callAI + personality (ESM, importeras av explain/smart-tips/teacher-report) |
| `api/generate-exam.js` | OpenAI call — rate-limit enforced (CJS) |
| `api/grade.js` | OpenAI call — validates user owns exam (CJS) |
| `api/explain.js` | P.E.R chat + körkortsförklaring — quota enforced (ESM) |
| `api/smart-tips.js` | P.E.R tips för felbank — auth required (ESM) |
| `api/check-role.js` | Returns user role — never trust client-side role |
| `api/signup.js` | Creates user row — validate all inputs |
| `api/admin.js` | Admin-only — verify role server-side |
| `api/ocr.js` | File upload — sanitize paths |
| `api/teacher-report.js` | P.E.R lärarrapport — auth required (ESM) |

Any change to `api/` triggers security review checklist:
- [ ] Input validated before use
- [ ] Auth checked via `_auth.js` before data access
- [ ] No secrets in response body
- [ ] No raw SQL string interpolation

## Active ECC Rules
These global rules apply automatically (no install needed — already in `~/.claude/rules/ecc/`):
- `web/coding-style.md` — semantic HTML, CSS custom properties, no `innerHTML` raw
- `web/security.md` — XSS, no `unsafe-inline`, sanitize user HTML
- `web/design-quality.md` — no generic templates; enforce dark luxury style
- `common/security.md` — secrets via env only, validate at boundaries
- `common/agents.md` — auto-launch planner for new features, code-reviewer after edits

## Reference Docs (load on demand, not auto-loaded)
- Architecture + data flow → `.claude/ARCHITECTURE_MAP.md`
- Local dev + env vars → `.claude/QUICK_START.md`
- Common pitfalls → `.claude/COMMON_MISTAKES.md`
