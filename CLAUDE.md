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

## körkortsteorin — driving_questions table (2026-05-29)
- 416 questions, 16 categories (all normalized — no more "och" vs "&" variants)
- Categories: Vägmärken(81), Säkerhet&Utrustning(41), Alkohol&Droger(41), Miljö&Ekonomi(39),
  Väglag&Bromssträcka(37), Mörker&Sikt(35), Trafikregler(33), Korsningar(24),
  Möte&Omkörning(19), Trafikmiljö&Planering(15), Hastighet(15), Nödsituationer(9),
  Vägtunnlar(8), Fordon&Besiktning(7), Bogsering&Lastsäkring(7), Körning med Släp(5)
- Fields: id, category, question, option_a-d, correct, explanation, difficulty, image_url, image_description
- TEORI_DIST: category weights for 65-question teoriprov (matches Trafikverket distribution)
- Adaptive learning: wrong-answer questions boosted up to 40% of exam pool

## Graphify First
Before reading any source file, query the graphify graph:
`C:\Users\elton\Desktop\ProvKlarUF\graphify-out\graph.json`
212 nodes, 211 edges, 36 communities. Only fall back to raw file reads if graph lacks detail.

## API Routes (security-sensitive — review carefully)
| File | Purpose |
|------|---------|
| `api/_auth.js` | Auth middleware shared by all routes |
| `api/generate-exam.js` | OpenAI call — rate-limit enforced |
| `api/grade.js` | OpenAI call — validates user owns exam |
| `api/explain.js` | OpenAI call — Premium only |
| `api/smart-tips.js` | OpenAI call — Premium only |
| `api/check-role.js` | Returns user role — never trust client-side role |
| `api/signup.js` | Creates user row — validate all inputs |
| `api/admin.js` | Admin-only — verify role server-side |
| `api/ocr.js` | File upload — sanitize paths |
| `api/teacher-report.js` | Reads other users' data — auth required |

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
