# Fas 8 Resultat — Produktionsvalidering + kalibrering + kvotskydd

Datum: 2026-07-19. Branch: `feature/provia-knowledge-engine-v1`. "Fas 8" är den här sessionens
egen etikett (ingen tidigare dokumentation definierade den) för att lösa de tre öppna punkterna
`16-fas6-7-results.md` lämnade kvar, nu när den mänskliga korpusgranskningen kommit igång (se
`pilot-corpus-sources.md` och den delade dagboken på `~/Desktop/ExGen Sweden AB/dagbok.md`).

## Genomfört

1. End-to-end produktionstest med riktigt godkänt innehåll (ingen testgenväg).
2. Kalibrerad `short_answer`-verifiering (semantisk jämförelse istället för exakt strängmatch).
3. Kvot-/rate-limit-skydd för `legalMode`, live-verifierad RPC-atomik.

Föregicks av att produktägaren manuellt granskade pilotkorpusens 20 chunks mot källan och
godkände 15 av dem (se separata commits `2e3993c`/`12f7eca` samma kväll, före denna fas) — det
är det som gjorde punkt 1 möjlig att testa på riktigt.

## Faktiska ändringar

### 8.1 — Produktionsvalidering
Körde `generateVerifiedQuestion()` med `includePending: false` (produktionsläge, ingen
testflagga) mot konceptet `reklamation`, som nu har fullt godkänt källmaterial. Resultat: hela
pipelinen (retrieve → generate → blind-verify → compare → repair → publish) fungerade
end-to-end med enbart godkänt innehåll — `recommended_action: "publish"` efter en lyckad
reparation. Detta är den första bekräftelsen att produktionsvägen (samma kod `api/knowledge.js`
skulle använda) faktiskt fungerar, inte bara test-/utvecklingsvägen med `includePending: true`.

### 8.2 — `short_answer`-kalibrering
Rotorsak (identifierad i Fas 6.3): `generatorAnswerMatches` jämförde blind-verifierarens svar mot
generatorns facit med exakt strängmatchning (`normalizeAnswer`) — rätt mått för
`multiple_choice` (option-ID:n, litet diskret värdemängd) men i praktiken alltid falskt negativt
för `short_answer` (fritextsvar är sällan identiska strängar även när de är sakligt korrekta).

Fix: `src/ai/prompts/legal-verifier-compare/v1.js` fick ett nytt schema-fält
`semantic_equivalent_to_generator` (boolean) — bedöms av compare-stegets modell, som redan ser
båda svaren (det är hela poängen med det steget, §25.2). `src/generation/legal-generation.mjs`
fick en ny exporterad funktion `computeGeneratorAnswerMatches()`: `multiple_choice` fortsätter
använda deterministisk strängjämförelse (oförändrat, aldrig litar på modellen för detta),
`short_answer` använder nu `semantic_equivalent_to_generator`.

Live-omtest av exakt samma koncept/frågetyp som gav `insufficient_evidence`/`manual_review` i
Fas 6.3 gav efter fixen `status: "passed"`, `recommended_action: "publish"`, ingen reparation
behövdes.

### 8.3 — Kvotskydd för `legalMode`
`api/explain.js`s `handleLegalMode()` återanvänder nu samma `perChat`-kvotmekanism
(`getFeatureLimit(role, "perChat")` + atomisk RPC `consume_per_chat_quota`) som TEACH MODE redan
använder i samma fil — delar kvotpott, ingen ny mekanism uppfunnen. Ordning: frågevalidering →
kvotkontroll → retrieval → AI-anrop (en nekad kvot sparar faktisk kostnad, en ogiltig fråga
bränner ingen kvotplats).

**RPC-atomiken verifierad live** (inte bara antagen från dokumentation, eftersom
forward-migrationen för `consume_per_chat_quota` saknas i repot — känt sedan tidigare
kartläggning): 5 samtidiga anrop mot samma `period_key` gav exakt `count=1,2,3,4,5`, inga
dubbletter — `SELECT ... FOR UPDATE`-serialisering bekräftat fungerande i praktiken. Testdata
återställd efteråt (inget kvarstår i produktionsdata).

## Filer

- `src/ai/prompts/legal-verifier-compare/v1.js` (ändrad — nytt schema-fält)
- `src/generation/legal-generation.mjs` (ändrad — ny `computeGeneratorAnswerMatches()`, uppdaterad
  filhuvud-kommentar)
- `tests/generation/legal-generation.test.mjs` (utökad, +4 tester)
- `api/explain.js` (ändrad — kvotkontroll i `handleLegalMode()`)
- `docs/codex_review.md` (uppdaterad, CR-2026-07-2X-010 + 011)

## Migrationer

Inga. Ren applikationskod.

## Tester

Full regression grön genom hela fasen: `validate-schemas.mjs` 21/21, `validate-prompt-modules.mjs`
22/22, `validate-gold-set.mjs` 101/101, `legal-retrieval.test.mjs` 10/10,
`legal-generation.test.mjs` **14/14** (upp från 10 — 4 nya för `computeGeneratorAnswerMatches()`,
inklusive en som uttryckligen bekräftar att `multiple_choice` aldrig litar på modellens
`semantic_equivalent_to_generator`).

**Live:**
- Produktionsläge (`includePending:false`) — full pipeline, en publicerbar fråga.
- `short_answer`-kalibrering — samma koncept, korrekt resultat efter fix.
- RPC-concurrency — 5 samtidiga anrop, korrekt serialiserat.
- Preview-deploy verifierad efter varje commit.

## Codex-fynd

- **CR-2026-07-2X-010** (short_answer-kalibrering): 0 CRITICAL/HIGH/MEDIUM. 2 LOW (matchningslogik
  ej separat testbar — fixat genom extraktion till `computeGeneratorAnswerMatches()` + 4 nya
  tester; föråldrad filhuvud-kommentar — fixat).
- **CR-2026-07-2X-011** (legalMode-kvotskydd, extra rigör pga live fil): 0 CRITICAL/HIGH/MEDIUM.
  2 LOW (kvot konsumerades före frågevalidering — fixat, ordning ändrad; RPC-atomik overifierbar
  från källkod — löst genom live concurrency-test istället för att bara lita på dokumentation).

## Korrigeringar

Samtliga fynd från båda granskningsomgångarna fixade direkt. Inget kvarstår öppet.

## Kända begränsningar

- **Fortfarande bara 15/20 chunks godkända.** `avtals-ogiltighet`-konceptet har inget godkänt
  källmaterial alls (dess två chunks, 33 § och 36 §, är bland de 5 kvarvarande — de svagast
  källverifierade, medvetet lämnade `pending` av produktägaren). Produktionsvägen för det
  konceptet returnerar fortsatt `no_chunks_retrieved`/abstain, korrekt men ofullständigt.
- **`per_legal_rag_enabled` och `legal_rag_enabled`/`knowledge_engine_enabled` är fortfarande
  `false`.** Fas 8 validerar att koden fungerar när flaggorna VORE på (via direkta
  funktionsanrop, inte via de faktiska HTTP-endpointerna med flaggorna live) — själva
  aktiveringsbeslutet är inte fattat än och kräver egen avstämning.
- Kvotdelningen mellan `legalMode` och TEACH MODE är en medveten produktavvägning (bekräftad
  rimlig av Codex), inte en bugg — men värd att ha i åtanke om juridikläget någon gång ska
  prissättas/kvoteras annorlunda än vanlig P.E.R-chatt.
- Ingen ny kod skriven för att hantera `avtals-ogiltighet` specifikt — den blockeras enbart av
  brist på godkänt källmaterial, inte av något tekniskt problem.

## Kostnadspåverkan

Försumbar. Ett fåtal enskilda genererings-/verifieringskörningar (samma kostnadsordning som
tidigare fasers tester), inga nya löpande kostnader.

## Säkerhetspåverkan

Positiv. Kvotskydd stänger en verklig (om än för närvarande overksam, pga feature-flagg)
kostnadsexponeringslucka. Kalibreringen av `short_answer` bevarad §25.1/§25.2-säkerhetsegenskapen
fullt ut (Codex-bekräftat: blind-steget påverkas inte, `multiple_choice` litar fortfarande aldrig
på modellen för matchning). RPC-atomik nu bekräftad med bevis, inte antagande.

## Rollback

Trivial för samtliga ändringar (ren applikationskod på en feature-branch). Ingen migration.

## Quality Gate

**PASS.** Två Codex-granskningsomgångar (CR-010, CR-011), båda PASS efter fix. 14/14 + 21/21 +
22/22 + 101/101 + 10/10 lokala tester gröna. Tre separata live-verifieringar (produktionspipeline,
short_answer-fix, RPC-concurrency) bekräftar beteende i praktiken, inte bara i teorin.

## Rekommendation

Kvarvarande öppna punkter innan `knowledge_engine_enabled`/`legal_rag_enabled`/
`per_legal_rag_enabled` aktiveras på riktigt:
1. Fler av de 5 kvarvarande chunksen (särskilt 33 §/36 § för att ge `avtals-ogiltighet` täckning)
   behöver mänsklig granskning mot fullständig lagtext.
2. Ett medvetet beslut om **när** och **för vem** flaggorna ska slås på (alla användare direkt,
   eller en begränsad testgrupp — `feature_flags.allowed_user_ids`-kolumnen finns redan för detta
   men används inte än) — matchar `09-migration-and-rollback-plan.md` steg 10-11
   (shadow mode / begränsad aktivering), som ännu inte påbörjats som egen fas.
Väntar på uttryckligt godkännande innan nästa steg.
