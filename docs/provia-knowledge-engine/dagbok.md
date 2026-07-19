# Dagbok — Provia Knowledge & Learning Engine V1

Löpande, kort sammanfattning session för session. Fullständiga detaljer finns i respektive
`NN-fasX-results.md` och `docs/codex_review.md` — den här filen är bara för snabb återorientering
mellan sessioner, inte en ersättning för dem.

---

## 2026-07-18 → 2026-07-23 — Fas 3 t.o.m. Fas 6/7

**Startläge vid sessionens början:** Fas 0–2 klara (kartläggning, säkerhetsfix, kontrakt/ADR,
schema/RLS/feature flags — allt applicerat live). Den här sessionen körde Fas 3 till och med
Fas 6/7 i följd, med godkännande mellan varje fas.

**Fas 3 — Pilotkorpus + gold-set.** 4 källor (Avtalslagen, Föräldrabalken 9 kap, Konsumentköplagen,
Skolverkets ämnesplan Privatjuridik), 20 chunks, 6 concepts, 50 gold-set-frågor. Applicerat live.
**Alla chunks `review_status='pending'`** — medvetet beslut, kräver mänsklig juridisk granskning
innan de får användas i publicerad generering. Se `13-fas3-results.md`.

**Fas 4 — Retrieval.** pgvector (`text-embedding-3-small`, HNSW, cosine), hybrid tsvector+vector-
sökning via SQL-funktionen `match_knowledge_chunks`. Embeddings backfillade för alla 20 chunks.
Smoke-test: 5/6 gold-set-frågor hittar rätt chunk som bästa träff. Se `14-fas4-results.md`.

**Fas 5 — Generation + verifiering.** `api/knowledge.js` (ny router) + hela pipelinen (generera →
blind-verifiera → deterministisk jämförelse i kod → jämförande verifiering → reparera max en gång).
Live-testat mot alla 6 koncept: 5/6 publicerbara, **1/6 korrekt avvisad** av säkerhetsmekanismen
(bevis på att den fungerar, inte bara teoretiskt). Se `15-fas5-results.md`.

**Fas 6/7 — Härdning + P.E.R juridikläge.**
- **Vercel 12-funktionstaket bröts faktiskt** (bekräftat via Vercels API) när `api/knowledge.js`
  lades till som 13:e fil. Löst genom att slå ihop `api/delete-exams.js` in i
  `api/check-role.js`. Verifierat: ny deploy `● Ready`.
- Atomisk job-claiming i `api/knowledge.js` (race-fönstret helt stängt).
- `short_answer`-vägen live-testad — fungerar säkert men avslöjade att exakt strängmatchning är
  för trubbig för fritextsvar (öppen punkt, ej löst).
- P.E.R juridikläge byggt i `api/explain.js` — **trippel-inert** (ingen frontend-yta, feature-flag
  av, ingen godkänd korpus).
Se `16-fas6-7-results.md`.

**Sidospår, utanför detta uppdrags scope men värt att komma ihåg:** under Fas 4 upptäckte
produktägarens andra session att den tidigare "roterade" service_role-nyckeln aldrig faktiskt
blivit ogiltig (Supabase-begränsning på legacy-nyckelsystemet). Åtgärdat direkt på `main`
(commit `f27971c`), inte på denna feature-branch. Kvarstår: klicka "Disable legacy API keys" i
Supabase Dashboard.

**Arbetssättsfriktion värd att komma ihåg:** den här sessionen saknade länge Supabase MCP-åtkomst
(fick handoffa DB-appliceringar till produktägarens andra session i Fas 3–4). Löstes delvis genom
att en giltig `SUPABASE_SERVICE_ROLE_KEY` lades till lokalt i `.env.local` (ger direkt
data-skrivåtkomst via `@supabase/supabase-js`, räcker för det mesta men INTE för DDL/migrationer).
En `supabase`-MCP-server lades till lokalt (`claude mcp add`) men hann inte autentiseras
(kräver sessionsomstart + OAuth-inloggning i webbläsaren) — **gör det först i nästa session** om
DDL-arbete väntar, annars är handoff-mönstret fortfarande reservplanen.

## Var vi stannade — start här imorgon

**Branch:** `feature/provia-knowledge-engine-v1`, senaste commit `6d3dba3`, pushad. Working tree
rent vid sessionens slut.

**Väntar på:** uttryckligt godkännande att starta nästa fas. Tre öppna punkter innan produktägaren
bör aktivera något på riktigt (se `16-fas6-7-results.md` "Rekommendation"):
1. Mänsklig juridisk granskning av pilotkorpusens 20 chunks (den faktiska spärren mot allt
   elevvänt, oavsett feature-flaggor).
2. `short_answer`-verifieringens kalibrering (semantisk jämförelse istället för exakt strängmatch).
3. Kvot-/rate-limit-skydd för `legalMode` innan `per_legal_rag_enabled` någonsin sätts till `true`.

**Nästa fas är inte definierad än** — "Fas 6/7" var redan en löst tolkad etikett den här sessionen.
Fråga produktägaren vad som är prioritet: fler faser i uppdraget (shadow mode/begränsad
aktivering enligt `09-migration-and-rollback-plan.md` steg 10–11), eller ovanstående tre punkter
först.
