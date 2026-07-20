# Fas 3 Resultat — Pilotkorpus och gold-set

Datum: 2026-07-19/20. Branch: `feature/provia-knowledge-engine-v1`. Andra fasen som ändrar
produktionsdatabasen (efter Fas 2:s schema/RLS/feature flags) — den här gången med data, ingen DDL.

## Genomfört

Uppdragets §38 Fas 3: pilotkorpus (källmaterial, chunkning, concepts) och gold-set. Pilotomfattning
enligt `07-proposed-v1-architecture.md` §2 och `10-open-questions.md` #2: Juridik/Privatjuridik,
delområde Avtalsrätt och konsumenträtt, krympt till fyra ämnen — anbud/accept, fullmakt, avtals
ogiltighet/oskälighet, underårigas rättshandlingsförmåga, konsumentköp (fel i varan)/reklamation —
med fri lagtext (Avtalslagen 1915:218, Föräldrabalken 9 kap, Konsumentköplagen 2022:260) och
Skolverkets ämnesplan Privatjuridik (JURPRI0) som källor.

## Faktiska ändringar

- **Källmanifest** (`docs/provia-knowledge-engine/pilot-corpus-sources.md`): fullständig lista över
  4 knowledge_sources, 4 knowledge_documents, 6 concepts, 20 knowledge_chunks — med källa, URL,
  licensgrund och chunk-för-chunk-kvalitetsmärkning (`lagtext_verbatim` / `lagtext_sammanfattning` /
  `laroplan_utdrag`) per rad.
- **Ingestion-migration** (`supabase/migrations/20260721_knowledge_engine_corpus_seed.sql` +
  `_ROLLBACK.sql`): ren datainsert (inget DDL) i tabellerna Fas 2 skapade. Alla ID:n hårdkodade
  (inte `gen_random_uuid()`) så att migrationsfilen, källmanifestet och gold-set-filen refererar
  exakt samma rader.
- **Kritiskt kvalitetsbeslut (produktägare, 2026-07-19):** samtliga chunks/dokument/källor/concepts
  seedas med `review_status`/`status = 'pending'` — **aldrig `approved`** — oavsett hur säker
  källhämtningen var. Motivering: innehållet är juridiskt undervisningsmaterial för elever, och
  varken denna sessions källhämtning (delvis AI-sammanfattning av sökresultat, inte alltid direkt
  dokumentcitat) eller Claude räknas som en godkänd juridisk granskning. Fas 2-schemats §18/§24-spärr
  (bara `approved`-chunks får användas i publicerad generering) styr redan detta — pending-innehåll
  kan användas för gold-set/eval-arbete (denna fas) men inte i elevvänd generering förrän en
  människa godkänt det.
- **`license_status='approved'`** sattes ändå på alla 4 källor — detta är en separat fråga
  (upphovsrättslig rättighetsstatus, redan beslutad i `10-open-questions.md` #2: fri lagtext +
  Skolverkets ämnesplan) och blandas medvetet inte ihop med `review_status` (innehållsgranskning).
- **Gold-set** (`tests/evals/legal-v1/gold-set.v1.json`): 50 manuellt författade och källgrundade
  frågor (39 multiple_choice, 11 short_answer; svårighetsgrad 21×E/19×C/10×A), fördelade över de
  sex concepten. Varje fråga har ett `payload`-objekt som validerar mot
  `schemas/exam-question.schema.json` och citerar `concept_ids`/`source_chunk_ids` mot de seedade
  UUID:erna. Två frågor (avtals-ogiltighet, underårigas rättshandlingsförmåga) testar medvetet
  källkritik — att inte övergeneralisera från chunks som är märkta ofullständiga/pending.
- **Valideringsskript** (`tests/evals/legal-v1/validate-gold-set.mjs`): kör varje payload mot
  `exam-question.schema.json` via ajv, plus en korsreferenskontroll att alla `concept_ids`/
  `source_chunk_ids` faktiskt finns i migrationsfilen (extraherat därifrån, inte dubbellistat).

## Filer

- `docs/provia-knowledge-engine/pilot-corpus-sources.md` (ny)
- `supabase/migrations/20260721_knowledge_engine_corpus_seed.sql` + `_ROLLBACK.sql` (nya)
- `tests/evals/legal-v1/gold-set.v1.json` + `validate-gold-set.mjs` (nya)
- `docs/codex_review.md` (uppdaterad, CR-2026-07-19-004)

## Migrationer

1 migration, ren datainsert (`insert ... on conflict (id) do nothing`) mot de 5 tabellerna
`knowledge_sources`, `knowledge_documents`, `concepts`, `knowledge_chunks`, `chunk_concepts` —
alla skapade av Fas 2:s `20260720_knowledge_engine_schema.sql`, ingen DDL i denna fil. Applicerad
via Supabase MCP (`apply_migration`) mot projekt `mnmotdluigzeehdjbhbu` av produktägaren i en
parallell session (denna session saknade Supabase MCP-åtkomst — se `Kända begränsningar`).

## Tester

**Lokalt (denna session):**
- `node tests/evals/legal-v1/validate-gold-set.mjs` — 101/101 PASS (50 frågor × 2 kontroller +
  1 antalskontroll).
- `node tests/schema/validate-schemas.mjs` — 21/21 PASS (regression, oförändrad).

**Live-verifiering efter applicering** (körd av produktägaren, resultat rapporterat 2026-07-20):
- Radantal: `sources=4, documents=4, concepts=6, chunks=20, chunk_concepts=24` — matchar exakt
  förväntat.
- `review_status`/`status` ≠ `'pending'`: 0 rader i samtliga fyra tabeller — inget godkändes
  automatiskt, som avsett.
- `license_status='approved'` bekräftat på samtliga 4 källor.
- `get_advisors(security)`: oförändrat mot Fas 2-baslinjen — samma INFO-mönster
  (`rls_enabled_no_policy`, nu även på de nyss populerade referenstabellerna) + samma redan kända
  WARN (`function_search_path`, `extension_in_public`, `security_definer`-funktioner,
  `leaked_password_protection`). Inga nya varningar.

## Codex-fynd

CR-2026-07-19-004 (`docs/codex_review.md`): 0 CRITICAL, 0 HIGH, 1 MEDIUM, 4 LOW/OK-noteringar.
MEDIUM: `schemas/exam-question.schema.json` förutsätter `review_status='approved'`-chunks för
publicerad generering, medan gold-setet avsiktligt refererar `pending`-chunks för eval-arbete —
risk att någon senare av misstag infogar gold-set-payloads direkt som `exam_questions`-rader innan
mänsklig granskning. **Fixat samma session**: `gold-set.v1.json` fick ett explicit
`eval_only_notice`-fält som säger detta rakt ut. Övriga fynd var LOW/bekräftelser (SQL/rollback-
ordning korrekt, manifest internt konsistent, inga schema-edge-cases missade av valideringsskriptet).

## Korrigeringar

Se Codex-fynd ovan — enda öppna fyndet fixat direkt, inget kvarstår öppet från denna omgång.

## Kända begränsningar

- **Denna Claude Code-session saknar Supabase MCP-åtkomst** (ingen MCP-server konfigurerad, ingen
  `supabase`/`psql`-CLI installerad). Både migrationsapplicering och live-verifiering utfördes
  därför av produktägaren i en parallell session med MCP konfigurerad, inte av mig direkt — en
  avvikelse från Fas 0–2:s mönster där samma session gjorde hela kedjan. Om detta upprepas i
  framtida faser bör en stående lösning (MCP-konfiguration i denna miljö, eller en tydlig
  handoff-rutin) övervägas.
- **7 av 20 chunks har svagare källverifiering** och är explicit flaggade i manifestet: 3 kap 33 §
  och 36 § (Avtalslagen, delvis AI-sammanfattat/ofullständigt citat), Föräldrabalken 9 kap 3 §
  (ålderdomlig ordalydelse, möjlig inaktuell paragrafnumrering), samt de 2 läroplans-chunksen
  (Skolverkets ämnesplan, i sig sammanfattande karaktär). Alla 20 är ändå `review_status='pending'`
  — spärren gäller lika för alla, men dessa 7 bör prioriteras vid mänsklig granskning.
- **Endast utvalda paragrafer ingesterade**, inte hela de tre lagarna — matchar den avsiktligt
  krympta pilotomfattningen (07 §2), inte en brist.
- **Gold-set stannade vid 50 frågor** (nedre gränsen av uppdragets 50–75-intervall), medvetet, för
  att hålla varje fråga strikt grundad i de 20 ingesterade chunksen utan att tänja på källorna för
  att nå ett högre antal. Fler frågor kan läggas till i en senare fas när fler paragrafer
  ingesterats eller chunks satts till `approved`.
- Embedding saknas fortfarande på `knowledge_chunks` (oförändrat sedan Fas 2, kommer Fas 4 —
  pgvector ej installerat).
- Ingen mänsklig juridisk granskning av chunk-innehållet har skett än — samtliga 20 chunks kvarstår
  `pending` och får inte användas i publicerad generering förrän det skett (se §18/§24-spärren).

## Kostnadspåverkan

Ingen. Ingen AI-anrop gjordes för att generera korpusen eller gold-setet (allt manuellt författat
och källhämtat i denna session) — `ai_usage_events` förblir opåverkad av denna fas.

## Säkerhetspåverkan

Ingen. Ren datainsert i tabeller vars RLS redan är låst (Fas 2: `enable row level security`, ingen
policy — service_role-only). `get_advisors(security)` bekräftar oförändrat resultat. Det avsiktliga
`review_status='pending'`-överallt-beslutet är i sig en säkerhets-/kvalitetsåtgärd: förhindrar att
ogranskat juridiskt innehåll av misstag blir tillgängligt för publicerad elevvänd generering.

## Rollback

`supabase/migrations/20260721_knowledge_engine_corpus_seed_ROLLBACK.sql` — tar bort exakt de
seedade raderna via hårdkodade ID:n, i korrekt FK-ordning (`chunk_concepts` → `knowledge_chunks` →
`knowledge_documents` → `concepts` → `knowledge_sources`), bekräftad av Codex. Inte körd (inget
behov, migrationen applicerades utan fel).

## Quality Gate

**PASS.** Codex Gate: PASS efter fix av MEDIUM-fyndet (CR-2026-07-19-004). Lokala tester gröna
(101/101 + 21/21). Live-verifiering bekräftar exakt förväntade radantal, `pending` överallt,
`approved` licensstatus, och oförändrad security-advisor-baslinje.

## Rekommendation

**GO för Fas 4** (retrieval) — men först: (a) mänsklig juridisk granskning av de 20 chunksen
(prioritera de 7 svagast källverifierade) för att sätta relevanta `review_status='approved'`,
eftersom Fas 4/5:s generering annars inte har något godkänt innehåll att hämta från, och (b) en
lösning för Supabase MCP-åtkomst i denna session om samma arbetsmönster som Fas 0–2 ska upprätthållas.
Väntar på uttryckligt godkännande innan Fas 4 påbörjas, per uppdragets grundregel.
