# Common Mistakes

## CJS vs ESM in api/
Never mix module formats in one file. Check existing file's format before editing.
- `generate-exam.js`, `grade.js` → CommonJS
- Everything else → ESM

## OpenAI endpoint confusion
`/v1/responses` and `/v1/chat/completions` are NOT interchangeable. Check which one the file uses before touching it.

## RLS
Always test Supabase Row Level Security rules after any schema change.

## Design tokens
Never change colors/fonts without asking the user first.

## Supabase roles
gratis = 2 prov/vecka | basic = 30/mån | premium = obegränsat | admin = obegränsat
Don't add logic that bypasses these.

## Commits
Always commit before starting a new feature.
