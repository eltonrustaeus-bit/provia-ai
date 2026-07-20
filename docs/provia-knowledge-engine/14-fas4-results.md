# Fas 4 Resultat — Retrieval (pgvector-embeddings + hybrid sökning)

Datum: 2026-07-20/21. Branch: `feature/provia-knowledge-engine-v1`. Tredje fasen som ändrar
produktionsdatabasen (efter Fas 2 schema/RLS och Fas 3 corpus-data) — additiv DDL (extension,
kolumn, index, funktion) plus ett datafyllnadssteg.

## Genomfört

Uppdragets §38 Fas 4 / `09-migration-and-rollback-plan.md` steg 6 ("Retrieval"): embedding-modell
vald och dokumenterad (ADR 0005), pgvector-infrastruktur applicerad, pilotkorpusens 20 chunks
embeddade, en fristående hybrid retrieval-modul byggd och testad.

## Faktiska ändringar

- **ADR 0005** (`docs/adr/0005-embedding-model-and-retrieval.md`): `text-embedding-3-small`
  (1536 dim, matchar ADR 0002:s "billig modell som default"-princip), HNSW-index (IVFFlat
  förkastat — kräver ett representativt radantal för att träna listorna meningsfullt, verkningslöst
  på pilotens 20 rader), cosine distance, hybrid linjär viktning (`0.4 × ts_rank_cd + 0.6 ×
  cosine_similarity`) istället för en reranker-modell (uppdragets §8-avgränsning).
- **Migration 1** (`20260722_knowledge_engine_embeddings.sql`): `pgvector`-extensionen installerad
  i `extensions`-schemat (Supabase best practice, inte `public`), ny nullable
  `knowledge_chunks.embedding extensions.vector(1536)`, HNSW-index. Additiv, ingen RLS-ändring.
- **Migration 2** (`20260723_knowledge_engine_retrieval_function.sql`): SQL-funktionen
  `public.match_knowledge_chunks(...)` — hybrid retrieval i en enda `stable`-fråga, `SECURITY
  INVOKER` (ingen ny security-definer-funktion). `p_include_pending` (default `false`) styr om
  `pending`-chunks får inkluderas — produktionsdefaulten begränsar strikt till
  `review_status='approved'` (§18/§24), aldrig `blocked` oavsett flaggans värde.
- **`src/retrieval/legal-retrieval.mjs`**: fristående modul (`getEmbedding()` mot OpenAIs
  `/v1/embeddings`, `retrieveChunks()` som anropar `match_knowledge_chunks` via `supabase.rpc()`).
  Inte en del av `api/knowledge.js` än — den byggs i Fas 5 (ADR 0001/`08-file-impact-map.md`).
  `getEmbedding()` är en avsiktlig, smal avvikelse från "återanvänd `callAI()` för allt" (ADR 0002):
  `callAI()` täcker bara `/v1/responses` (chattkompletteringar), inte embeddings-endpointen — en
  strukturellt annan OpenAI-yta, inte en ny generell AI-abstraktion.
- **`scripts/knowledge-embed-chunks.mjs`**: backfill-script, laddar nycklar från `.env.local`
  (samma säkra mönster som `scripts/hp-quality.mjs` — nycklar skrivs aldrig ut), skriver embeddings
  via `@supabase/supabase-js` + service_role (ren dataoperation, ingen DDL/MCP krävs för detta steg).

## Filer

- `docs/adr/0005-embedding-model-and-retrieval.md` (ny)
- `supabase/migrations/20260722_knowledge_engine_embeddings.sql` + `_ROLLBACK.sql` (nya)
- `supabase/migrations/20260723_knowledge_engine_retrieval_function.sql` + `_ROLLBACK.sql` (nya)
- `src/retrieval/legal-retrieval.mjs` (ny)
- `tests/retrieval/legal-retrieval.test.mjs` (ny)
- `scripts/knowledge-embed-chunks.mjs` (ny)
- `docs/codex_review.md` (uppdaterad, CR-2026-07-20-005 + CR-2026-07-23-006)

## Migrationer

2 migrationer, båda applicerade via Supabase MCP av produktägaren i en parallell session (denna
session saknade Supabase MCP-åtkomst under DDL-stegen — samma begränsning som Fas 3, se
`13-fas3-results.md`). Ordning: embeddings-migrationen först (kolumnen måste finnas innan
funktionen som refererar den), sedan retrieval-funktionen.

## Tester

**Lokalt (denna session):**
- `node tests/retrieval/legal-retrieval.test.mjs` — 10/10 PASS. Mockad `fetch`/Supabase-klient,
  ingen live-DB krävs: validerar felhantering (saknad `apiKey`/`queryText`, fel embedding-dimension,
  icke-OK HTTP-svar), att `retrieveChunks()` anropar `match_knowledge_chunks` med rätt
  default-parametrar (`p_include_pending=false` som produktionsdefault, explicit testad), och att
  RPC-fel propageras med tydligt meddelande.
- `node tests/schema/validate-schemas.mjs` — 21/21 PASS (regression).
- `node tests/evals/legal-v1/validate-gold-set.mjs` — 101/101 PASS (regression).

**Live-verifiering efter applicering** (körd av produktägaren):
- `pg_extension`: `vector` installerad i `extensions`-schemat — bekräftat.
- `knowledge_chunks.embedding`: kolumn finns, `udt_name=vector` — bekräftat.
- HNSW-index `idx_knowledge_chunks_embedding_hnsw` finns — bekräftat.
- `match_knowledge_chunks`: funktion finns, `pronargs=6` — bekräftat.
- `get_advisors(security)` mot Fas 3-baslinjen: **en ny post**, `function_search_path_mutable` på
  `public.match_knowledge_chunks` — samma redan kända, accepterade kategori som redan finns för tre
  andra funktioner i projektet (`get_weekly_exam_count`, `get_monthly_exam_count`,
  `sync_report_count`). Inga nya kategorier av varning, inga nya `rls_enabled_no_policy`-poster.

**Embedding-backfill** (kört av produktägaren, `scripts/knowledge-embed-chunks.mjs`):
- `--dry-run`: 20/20 chunks beräknade, rätt dimension (1536).
- Skarp körning: 20/20 lyckades, 0 misslyckades.
- Verifierat i databasen: `with_embedding=20`, `total=20` — samtliga pilotchunks har nu embeddings.

## Codex-fynd

- **CR-2026-07-20-005** (embeddings-migrationen): 1 MEDIUM (pgvector installerad i `public` istället
  för `extensions`-schemat) — **fixat** innan applicering. Övrigt bekräftat korrekt (HNSW-syntax,
  1536 dim, RLS opåverkad, rollback säker).
- **CR-2026-07-23-006** (retrieval-funktionen): 1 MEDIUM — en genuin logikbugg:
  `(p_include_pending or kc.review_status = 'approved')` gjorde att testflaggan `p_include_pending`
  av misstag även släppte igenom `review_status='blocked'`-chunks, inte bara `pending`. **Fixat**
  innan applicering (villkoret skrivet om så `blocked` aldrig kan returneras oavsett flaggan).
  1 LOW (rått OpenAI-felsvar upp till 300 tecken i `Error.message`) — **accepterat, uppskjutet till
  Fas 5**, samma kategori som redan en gång accepterats (CR-2026-07-18-001).

## Korrigeringar

Se Codex-fynd ovan — båda MEDIUM-fynden fixade före applicering, inget kvarstår öppet från dessa
två granskningsomgångar.

## Kända begränsningar

- **Denna session saknade fungerande DB-skrivåtkomst under stora delar av fasen** — inte bara för
  DDL (samma Supabase MCP-begränsning som Fas 3) utan tillfälligt även för
  dataoperationer (`SUPABASE_SERVICE_ROLE_KEY` var tom/felformaterad i lokal `.env.local`, löstes
  efter flera försök genom att produktägaren fyllde i nyckeln manuellt via terminal). Både
  migrationsapplicering och embedding-backfill utfördes till sist av produktägaren i en parallell
  session. En Supabase MCP-server (`supabase`, HTTP-transport) lades till i denna sessions lokala
  config under fasen men hann inte autentiseras — kräver sessionsomstart + OAuth-inloggning, inte
  klart vid fasens slut. Bör slutföras innan Fas 5 om samma arbetsmönster som Fas 0–2 ska återupptas.
- **`function_search_path_mutable`-advisorn** på `match_knowledge_chunks` är oadresserad — matchar
  ett redan existerande, accepterat mönster (3 andra funktioner har samma varning), men samlas
  lämpligen i en framtida konsoliderad hardening-PR (jämför `10-open-questions.md` #4:s
  "5 icke-blockerande buggar"-mönster) snarare än att åtgärdas ad hoc.
- **Oberoende av denna fas, men värt att notera:** under backfill-arbetet upptäckte produktägarens
  andra session att den tidigare "roterade" `service_role`-nyckeln (Fas 0,
  `02-security-findings.md`) i själva verket aldrig blivit ogiltig — Supabase tillåter inte
  självbetjänad rotation av den delade legacy-JWT-hemligheten utan en full migrering till det nya
  nyckelsystemet. Detta åtgärdades i en separat commit direkt på `main` (`f27971c`, **inte** på
  denna feature-branch), verifierad av mig i efterhand: ändringen i `api/hp.js` (en av de
  icke-förhandlingsbara avgränsningarna för detta uppdrag) är minimal och mekanisk — bara borttagen
  redundant `Authorization: Bearer`-header, ingen logik- eller beteendeändring. Utanför
  kunskapsmotor-scopet, men flaggas här för spårbarhet. Kvarstår: produktägaren behöver klicka
  "Disable legacy API keys" i Supabase Dashboard för att slutgiltigt ogiltigförklara den gamla
  strängen.
- Retrieval-modulen är otestad mot **verklig** produktionsdata i denna session (bara mockade
  tester) — produktägarens rapporterade radantal (20/20 embeddings) är den enda live-signalen.
  Faktisk hämtningskvalitet (får rätt frågor rätt chunks?) är inte utvärderad än — hör till Fas 5
  när `api/knowledge.js` kan köra gold-setets 50 frågor mot `retrieveChunks()`.

## Kostnadspåverkan

Första fasen med en verklig, om än försumbar, AI-API-kostnad: 20 korta juridiska textstycken ×
`text-embedding-3-small` ($0.02/1M tokens) — sub-cent. Ingen `ai_usage_events`-loggning av detta
backfill-steg (scriptet körs utanför `api/knowledge.js`/`callAI()`, som är det som skriver dit) —
en medveten lucka värd att notera, inte blockerande för en engångs pilot-backfill.

## Säkerhetspåverkan

Positiv för retrieval-funktionen: `SECURITY INVOKER` (ingen ny security-definer-yta),
`p_include_pending`-logiken kan aldrig läcka `blocked`-innehåll efter Codex-fixen. Neutral för
migrationerna i övrigt (additiv DDL, RLS oförändrad). Se "Kända begränsningar" ovan för den
separata, utanför-scope säkerhetsincidenten som hanterades parallellt.

## Rollback

- `supabase/migrations/20260722_knowledge_engine_embeddings_ROLLBACK.sql` — tar bort index +
  kolumn, lämnar `vector`-extensionen kvar (medveten avvägning, Codex-bekräftad).
- `supabase/migrations/20260723_knowledge_engine_retrieval_function_ROLLBACK.sql` — droppar
  funktionen, signatur Codex-verifierad att matcha exakt.
- Ingen körd (inget behov, båda migrationerna applicerades utan fel).

## Quality Gate

**PASS.** Två Codex-granskningar, båda PASS efter fix av var sitt MEDIUM-fynd. Alla lokala tester
gröna (10/10 + 21/21 + 101/101). Live-verifiering bekräftar migrationerna, embedding-backfillen
(20/20) och en oförändrad security-advisor-baslinje förutom en redan-känd varningskategori.

## Rekommendation

**GO för Fas 5** (jobb + generation, `api/knowledge.js`) — men två saker bör lösas eller medvetet
accepteras som kvarstående risk först: (a) denna sessions Supabase MCP-åtkomst (påbörjad, inte
autentiserad — annars fortsätter handoff-mönstret till den parallella sessionen för varje
DB-beroende steg), (b) en snabb faktisk hämtningskvalitetskoll (kör några av gold-setets 50 frågor
genom `retrieveChunks()` manuellt) innan Fas 5 bygger vidare på att retrieval faktiskt hittar rätt
chunks, inte bara att infrastrukturen existerar. Väntar på uttryckligt godkännande innan Fas 5
påbörjas.
