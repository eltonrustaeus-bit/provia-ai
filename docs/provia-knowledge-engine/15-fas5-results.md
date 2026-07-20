# Fas 5 Resultat — Jobb + generation (api/knowledge.js)

Datum: 2026-07-21/22. Branch: `feature/provia-knowledge-engine-v1`. Första fasen som skriver
**produktionskod** för detta uppdrag (en ny API-endpoint), inte bara migrationer/dokument/data.
Fjärde fasen som rör produktionsdatabasen, men denna gång via egen direkt skrivåtkomst (service-
nyckel i `.env.local`) för dataoperationer — ingen handoff till en parallell session behövdes för
själva testkörningen.

## Genomfört

Uppdragets §38 Fas 5 (jobb + generation) / `09-migration-and-rollback-plan.md` steg 7-8:
juridik-promptmoduler skrivna (ADR 0004-kontraktet), `api/knowledge.js`-routern byggd (ADR 0001),
den fullständiga generate→blind-verifiera→jämför→reparera-pipelinen (§23-25) implementerad och
körd end-to-end mot skarp databas över samtliga 6 pilotkoncept.

## Faktiska ändringar

- **4 promptmoduler** (`src/ai/prompts/legal-{generator,verifier-blind,verifier-compare,repair}/v1.js`):
  fyller ADR 0004-skeletten från Fas 1. `legal-verifier-blind` skickar bevisat aldrig
  `correct_answer`/`explanation` (Codex-verifierat, se nedan).
- **`src/generation/legal-generation.mjs`**: `generateVerifiedQuestion()` — retrieval (Fas 4) →
  generator (`gpt-4o-mini`) → blind-verifiering (`gpt-4o`, oberoende lösning) →
  **deterministisk** jämförelse i kod (`normalizeAnswer()`, inte modellen) → jämförande verifiering
  (`gpt-4o`, ser facit, bedömer factual_support/citation_support/ambiguity m.fl.) →
  `deterministicDecision()` (kod, skriver alltid över modellens eget `recommended_action`-förslag)
  → repair (max EN gång, §25.4) → full re-verifiering av den reparerade frågan.
- **`api/knowledge.js`**: konsoliderad router (ADR 0001, hp.js-mönstret), `body.op`:
  `blueprint` (skapar `exam_blueprints` + `generation_jobs`) och `generate` (kör pipelinen, sparar
  `exam_questions` + `question_verifications`, uppdaterar jobbstatus). Auth via `_auth.js`
  (ingen egen kopia). **Feature-flag-gated**: kräver `knowledge_engine_enabled` OCH
  `legal_rag_enabled`, båda `false` sedan Fas 2 — koden är avsiktligt inert i produktion.
  `includePending` är **hårdkodat `false`** i hela produktionsvägen, oavsett klient-input (§18/§24).
- **`scripts/knowledge-generate-smoke.mjs`**: test-/utvecklingsväg, anropar
  `generateVerifiedQuestion()` **direkt** (inte via `api/knowledge.js`) med `includePending=true`
  — skriver alltså inte till `exam_questions`/`generation_jobs`, bara till `ai_usage_events`
  (fail-open, `job_id`/`user_id`=null).

## Filer

- `src/ai/prompts/legal-generator/v1.js`, `legal-verifier-blind/v1.js`, `legal-verifier-compare/v1.js`, `legal-repair/v1.js` (nya)
- `src/generation/legal-generation.mjs` (ny)
- `api/knowledge.js` (ny — **13:e routade `api/*.js`-filen**, se "Kända begränsningar")
- `tests/schema/validate-prompt-modules.mjs`, `tests/generation/legal-generation.test.mjs` (nya)
- `scripts/knowledge-generate-smoke.mjs` (nytt)
- `docs/codex_review.md` (uppdaterad, CR-2026-07-2X-007)

## Migrationer

Inga nya. Denna fas skriver bara data mot tabeller som redan finns sedan Fas 2 (`exam_blueprints`,
`generation_jobs`, `exam_questions`, `question_verifications`, `ai_usage_events`) — ingen DDL.

## Tester

**Lokalt:**
- `tests/schema/validate-prompt-modules.mjs` — 17/17 PASS (exportform, schema-kompilerbarhet,
  explicit regressionsspärr mot att legal-verifier-blind någonsin skickar facit).
- `tests/generation/legal-generation.test.mjs` — 10/10 PASS, täcker `deterministicDecision()`
  uttömmande (publish/repair/reject/manual_review för varje kombination av
  canAnswerFromSources/generatorAnswerMatches/factual_support/citation_support/ambiguity_score/
  contradictions/unsupported_claims, samt en explicit kontroll att modellens eget
  `recommended_action`-fält aldrig läses).
- Full regression: `validate-schemas.mjs` 21/21, `validate-gold-set.mjs` 101/101,
  `legal-retrieval.test.mjs` 10/10 — alla gröna.

**Live end-to-end** (`scripts/knowledge-generate-smoke.mjs`, riktig OpenAI-kostnad, körd med
uttryckligt godkännande av produktägaren):
- **6/6 pilotkoncept testade.** 5/6 slutade `recommended_action=publish` (3 direkt, 2 efter en
  lyckad reparation). **1/6 (`underarigas-rattshandlingsformaga`) avvisades korrekt** —
  verifieringspipelinen fångade en fråga som inte höll måttet efter reparationsförsöket, istället
  för att tvinga fram en publicering. Det här är precis den säkerhetsegenskap §25 är till för —
  inte ett fel i piloten.
- `ai_usage_events`: 30 rader loggade under körningen (7 `generate`, 10 `verify_blind`,
  10 `verify_compare`, 3 `repair`) — bekräftar att usage-loggningen fungerar end-to-end.

## Codex-fynd

**CR-2026-07-2X-007**: 0 CRITICAL. §25.1/§25.2/§25.4-säkerhetsegenskapen uttryckligen bekräftad
korrekt (blind lösning utan facit, deterministisk jämförelse i kod, kodens beslut skriver alltid
över modellens eget förslag, exakt ett repair-försök utan loop-risk).

2 HIGH:
1. **Vercel-funktionstak** — `api/knowledge.js` gör repot till 13 routade `api/*.js`-filer;
   `vercel-runtime-map.md` dokumenterar 12 + en kodkommentar i `hp.js` som uttryckligen nämner
   Hobby-planens 12-funktionstak. **Inte kodfixbart** — se "Kända begränsningar".
2. Saknad kvot-/rate-limit-gate — **fixat**, enkel daglig gräns (20 jobb/användare/dag,
   fail-closed).

4 MEDIUM (alla fixade): job-status-race vid dubbelanrop, tyst ignorerat fel vid
`question_verifications`-insert, övergiven `exam_blueprint` vid misslyckad jobb-insert, saknad
oberoende ägarskapskontroll av blueprint i `generate`.

2 LOW (alla fixade): rått DB-felmeddelande läckt till klient, saknad övre gräns på
`question_count`.

## Korrigeringar

Samtliga fixbara Codex-fynd åtgärdade direkt i samma session, se ovan. Vercel-funktionstaket
kvarstår som en beslutspunkt för produktägaren (inte en kodbugg) — se nästa avsnitt.

## Kända begränsningar

- **Vercel-funktionstak (HIGH, olöst):** `api/knowledge.js` gör repot till 13 routade filer mot
  ett dokumenterat, starkt indicierat 12-funktionstak på Hobby-planen. Detta blockerar INTE
  produktions-`main` (koden ligger på en feature-branch, och är dessutom feature-flag-inert även
  om den skulle deployas) — men bör lösas innan denna branch någonsin deployas brett: antingen
  verifiera Vercel-kontots faktiska plan (dashboard), uppgradera till Pro, eller konsolidera
  ytterligare en befintlig `api/*.js`-fil in i `knowledge.js`/`hp.js`-mönstret. Detta var redan
  flaggat som en öppen risk i `00-executive-findings.md` §7 — Fas 5 är fasen där den blir konkret.
- **Ofullständig atomär job-claiming:** `generate` kontrollerar `status==='queued'` och sätter sedan
  `generating` i två separata steg (inte en atomär `UPDATE...WHERE status='queued' RETURNING`).
  Minskar racerisken kraftigt men eliminerar den inte helt vid exakt samtidiga anrop. Acceptabelt
  för en feature-flag-inert endpoint, bör härdas innan bred aktivering.
- **`ai_usage_events.input_tokens`/`output_tokens`/`estimated_cost` loggas som 0/null** — `callAI()`
  i `_per-core.js` extraherar bara textsvaret, inte OpenAI-svarets `usage`-objekt. Att ändra
  `callAI()`s returform skulle vara en brytande ändring för alla befintliga anropare (P.E.R,
  lärarrapport, coach m.fl.) och kräver regressionstestning av de modulerna — bedömt för riskabelt
  att göra i denna fas. `pipeline_step`/`model`/`feature`-spårning fungerar fullt ut (bekräftat:
  30 rader loggade under testkörningen), bara kostnadssiffrorna saknas tills vidare.
- **Ingen `ajv`-validering av den sammansatta payloaden i `api/knowledge.js`** innan insert mot
  `exam_questions` — `ajv` är en devDependency, inte en runtime-dependency, och OpenAIs
  `strict:true` structured-outputs-läge ger redan stark garanti om formen på varje enskilt
  AI-svar. En fullständig `exam-question.schema.json`-validering av det sammansatta objektet vore
  ett rimligt härdningssteg om `ajv` flyttas till `dependencies`.
- Endast `multiple_choice`-frågor testade live i denna fas (samtliga 6 körningar). `short_answer`-
  vägen är kodmässigt identisk (samma pipeline, samma prompter, olika schema-gren) men inte
  live-verifierad.

## Kostnadspåverkan

Första fasen med en meningsfull, avsiktlig AI-kostnad (utöver Fas 4:s försumbara embedding-
backfill): 7 generate-anrop (`gpt-4o-mini`) + 10 blind-verifieringar + 10 jämförande
verifieringar (`gpt-4o`) + 3 repair-anrop, körda med produktägarens uttryckliga godkännande efter
att kostnaden flaggats i förväg. Exakt kronbelopp inte uträknat (se "Kända begränsningar" om
saknad tokenloggning) — grovt uppskattat till under en dollar totalt för hela testomgången.

## Säkerhetspåverkan

Positiv. Kärnsäkerhetsegenskapen (§25.1/§25.2/§25.4) Codex-verifierad korrekt både i kod och i
faktisk körning (den avvisade frågan i `underarigas-rattshandlingsformaga` är levande bevis på att
pipelinen inte gummistämplar). Feature-flag-gaten gör hela ytan inert i produktion tills ett
medvetet beslut fattas. `includePending` kan aldrig sättas av en klient. Ny daglig
kvotgräns förhindrar obegränsad kostnadsexponering från en enskild autentiserad användare.

## Rollback

Ingen migration att rulla tillbaka. Kodrollback är trivial (feature-branch, `git revert` av
commit `426aa9a` om det skulle behövas) — ingen produktionsbeteende att återställa eftersom
endpointen aldrig varit nåbar (feature flags false).

## Quality Gate

**PASS.** Codex-granskning PASS efter fix av samtliga fixbara fynd (Vercel-taket kvarstår som en
medveten, dokumenterad, icke-kodmässig risk). 17/17 + 10/10 + 21/21 + 101/101 + 10/10 lokala
tester gröna. Live end-to-end: 6/6 koncept testade, 5/6 publicerbara, 1/6 korrekt avvisad av
säkerhetsmekanismen.

## Rekommendation

**GO för Fas 6/7** (härdning/P.E.R-juridikläge enligt tidigare fasplan) — men tre saker bör lösas
eller medvetet accepteras som kvarstående risk först: (a) Vercel-funktionstaket måste klargöras
innan denna branch deployas brett (dashboard-koll eller planuppgradering, inte kodarbete),
(b) mänsklig juridisk granskning av pilotkorpusens 20 chunks (flaggat redan i `13-fas3-results.md`,
fortsatt olöst — det är den faktiska spärren mellan detta och en elevvänd funktion, inte
feature-flaggorna i sig), (c) `short_answer`-vägen bör få minst en live-testkörning innan den
räknas som lika bevisad som `multiple_choice`. Väntar på uttryckligt godkännande innan nästa fas
påbörjas.
