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

## Reference Docs (load on demand, not auto-loaded)
- Architecture + data flow → `.claude/ARCHITECTURE_MAP.md`
- Local dev + env vars → `.claude/QUICK_START.md`
- Common pitfalls → `.claude/COMMON_MISTAKES.md`
