# Fas 10 Resultat — Shadow mode

Datum: 2026-07-19. Branch: `feature/provia-knowledge-engine-v1`. Matchar steg 10 i
`09-migration-and-rollback-plan.md` ("Shadow mode"), det första steget efter "Verifiering" som
inte tidigare hade konkret kod. Skiljer sig från alla tidigare faser genom att en feature-flagga
(`legal_shadow_mode`) nu medvetet slagits på och **förblir på** i produktionsdatabasen — inte en
tillfällig testkörning som återställdes efteråt.

## Genomfört

Definierade och implementerade shadow mode konkret (ingen tidigare dokumentation specificerade
exakt beteende): pipelinen körs och sparar resultat internt för kvalitetsgranskning, men det
genererade elevinnehållet exponeras aldrig för en riktig elev. Produktägaren bekräftade denna
tolkning innan arbetet startade.

## Faktiska ändringar

- **`src/generation/legal-generation.mjs`**: ny exporterad funktion `persistGeneratedQuestion()`
  — persisteringslogiken (insert mot `exam_questions` + `question_verifications`) extraherad från
  `api/knowledge.js`s `opGenerate` så den kan återanvändas utan duplicering.
- **`api/knowledge.js`**: `opGenerate` refaktorerad att använda `persistGeneratedQuestion()`. Ny
  svarsgren: om `feature_flags.legal_shadow_mode=true`, returnerar endpointen efter lyckad
  persistering en **minimal** respons — `{ ok: true, shadow: true, question_id }` — utan
  frågeinnehåll, facit, förklaring eller verifieringsresultat. Annars (`legal_shadow_mode=false`)
  oförändrat fullständigt svar som i Fas 5/6.
- **`scripts/knowledge-shadow-run.mjs`** (nytt): internt batch-script. Kräver
  `legal_shadow_mode=true` (vägrar köra annars — verifierat, både initialt och per iteration efter
  Codex-fixen). Skapar en riktig `exam_blueprint` (markerad `source_material_ref='SHADOW_RUN —
  internt, ej ett riktigt elevprov'`, kopplad till samma interna testkonto som redan används för
  lärardashboard-testning) + `generation_job`, loopar över samtliga 6 pilotkoncept, kör
  `generateVerifiedQuestion()` (`includePending=false`, oförändrad §18/§24-produktionsspärr) och
  `persistGeneratedQuestion()`, skriver bara sammanfattningsstatistik till terminalen.

## Filer

- `src/generation/legal-generation.mjs` (ändrad)
- `api/knowledge.js` (ändrad)
- `scripts/knowledge-shadow-run.mjs` (ny)
- `docs/codex_review.md` (uppdaterad, CR-2026-07-2X-012)

## Migrationer

Inga. Ren applikationskod + en datauppdatering (feature flag).

## Tester

Full regression grön genom hela fasen: `validate-schemas.mjs` 21/21,
`validate-prompt-modules.mjs` 22/22, `validate-gold-set.mjs` 101/101,
`legal-retrieval.test.mjs` 10/10, `legal-generation.test.mjs` 14/14.

**Live:**
- Säkerhetsspärren (vägrar köra utan `legal_shadow_mode=true`) testad före och efter Codex-fixarna.
- Produktägaren godkände uttryckligen att slå på `legal_shadow_mode=true` permanent (inte en
  tillfällig test) innan något kördes skarpt.
- Skarp shadow-körning: 6 koncept × 1 fråga (`multiple_choice`). Utfall:
  **4 `passed`, 1 `rejected`, 1 `manual_review`** — en sund spridning som visar att pipelinen
  fortfarande diskriminerar (avvisar/flaggar dåligt innehåll) i skala, inte bara i enstaka tester.
  Bekräftat: `exam_blueprints.source_material_ref` innehåller shadow-markören,
  `exam_blueprints.status`/`generation_jobs.status` satta till `completed` korrekt.

## Codex-fynd

**CR-2026-07-2X-012**: 0 CRITICAL/HIGH. 3 MEDIUM — samtliga fixade:
1. `legal_shadow_mode` kollades bara en gång före hela batchen, fungerade inte som en operativ
   kill switch → rechecka flaggan per iteration, avbryt (`status='cancelled'`) om den slås av.
2. `generation_jobs.status` maskerade delvisa persisteringsfel → samma `partially_completed`-
   semantik som API-vägen tillämpad även här.
3. Shadow-blueprints hade ingen egen markör, risk att blandas med riktiga användarprov om ett
   framtida UI listar "mina prov" → `source_material_ref`-markör tillagd.

1 LOW: refaktoreringen till `persistGeneratedQuestion()` tappade server-side-loggning av
`question_verifications`-insertfel → återställd.

En egen upptäckt utöver Codex-granskningen, fixad samma session: `exam_blueprints.status`
uppdaterades aldrig till `completed` efter en lyckad körning (stannade på sitt initiala
`generating` för alltid) — fixat, scriptet slutför nu blueprintens status eftersom det äger hela
dess livscykel i en enda körning.

## Korrigeringar

Samtliga fynd fixade direkt, inget kvarstår öppet.

## Kända begränsningar

- Shadow-körningen kördes bara EN gång (6 frågor totalt) för att bekräfta att mekanismen fungerar
  — inte tillräcklig volym för statistiskt meningsfulla kvalitetsslutsatser om pipelinens
  träffsäkerhet i stort. Fler körningar (`node scripts/knowledge-shadow-run.mjs [antal]`) kan
  köras när som helst nu när flaggan är på, utan ytterligare kod.
- `legal_shadow_mode=true` är nu permanent i produktionsdatabasen. Om någon annan kod-yta i
  framtiden av misstag börjar anropa `api/knowledge.js`s `op=generate` (t.ex. om en frontend-yta
  byggs utan att känna till shadow-flaggan), kommer den att få den redigerade shadow-responsen,
  inte det fullständiga svaret — detta är avsiktligt konservativt (fail-safe mot oavsiktlig
  elevexponering), men värt att komma ihåg när `api/knowledge.js` faktiskt kopplas till ett UI.
- Ingen schemaändring gjordes för en "riktig" shadow-markör (t.ex. en egen boolean-kolumn på
  `exam_blueprints`) — `source_material_ref`-återanvändningen är en pragmatisk lösning utan
  migration, inte en permanent arkitektur. Om shadow-körningar blir en stående, frekvent aktivitet
  vore en dedikerad kolumn renare.

## Kostnadspåverkan

Försumbar. 6 genereringar (samma kostnadsordning som tidigare fasers enskilda tester).
`legal_shadow_mode=true` innebär att FRAMTIDA körningar av `scripts/knowledge-shadow-run.mjs`
också kommer kosta något litet varje gång — ingen löpande/automatisk körning är schemalagd, bara
manuell körning vid behov.

## Säkerhetspåverkan

Positiv. Codex-bekräftat: shadow-svaret läcker aldrig genererat elevinnehåll. Produktionsspärren
(`includePending=false`, §18/§24) oförändrad. Kill switch-beteendet (flagg-recheck per iteration)
gör att `legal_shadow_mode=false` faktiskt stoppar pågående batchar omedelbart, inte bara nya.

## Rollback

Sätt `legal_shadow_mode=false` i `feature_flags` för att omedelbart stoppa all vidare shadow-
aktivitet (ingen kod-rollback behövs, ren datauppdatering). Kodändringarna i sig är trivialt
reversibla (feature-branch, `git revert`).

## Quality Gate

**PASS.** Codex-granskning PASS efter fix av 3 MEDIUM + 1 LOW. Full regression grön. Skarp
shadow-körning genomförd med produktägarens uttryckliga godkännande, gav en sund, diskriminerande
utfallsspridning (inte bara "allt passerar").

## Rekommendation

Shadow mode är nu operativt. Naturliga nästa steg (inget beslutat än):
1. Låt shadow mode samla mer data över tid (kör `scripts/knowledge-shadow-run.mjs` med högre volym
   periodvis) innan ett beslut om begränsad aktivering (steg 11 i fasplanen) fattas.
2. Ett faktiskt beslut om **när** och **för vem** `knowledge_engine_enabled`/`legal_rag_enabled`/
   `per_legal_rag_enabled` ska aktiveras för RIKTIGA elever — `feature_flags.allowed_user_ids`
   finns redan i schemat för en begränsad testgrupp, oanvänd än.
Väntar på uttryckligt godkännande innan nästa steg.
