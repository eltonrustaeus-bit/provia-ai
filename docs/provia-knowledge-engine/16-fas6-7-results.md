# Fas 6/7 Resultat — Härdning + P.E.R juridikläge

Datum: 2026-07-22/23. Branch: `feature/provia-knowledge-engine-v1`. "Fas 6" var inte tidigare
definierad i något dokument — produktägaren godkände att den här sessionen tolkar den som
härdningspunkterna flaggade i `15-fas5-results.md`, kombinerat med Fas 7 (P.E.R juridikläge, redan
konkret specificerad i `src/ai/prompts/per-legal/README.md`). Första fasen som ändrar en **LIVE**
produktionsfil med riktig elevtrafik (`api/explain.js`, `api/check-role.js`) sedan den
säkerhetsincident som hanterades utanför detta uppdrags scope mellan Fas 4 och Fas 5.

## Genomfört

**Fas 6 (härdning):**
1. Vercel-funktionstaket klargjort och löst.
2. Atomisk job-claiming i `api/knowledge.js`.
3. `short_answer`-vägen live-testad.

**Fas 7 (P.E.R juridikläge):**
4. `per-legal`-promptmodulen skriven (ADR 0004-kontraktet).
5. Inplumbad i `api/explain.js`, feature-flag-gated.

## Faktiska ändringar

### 6.1 — Vercel-funktionstaket
Bekräftat **konkret, inte teoretiskt**: `vercel inspect` mot de två senaste preview-deployen av
denna branch (innan detta fixades) visade `readyState: ERROR`,
`errorCode: exceeded_serverless_functions_per_deployment`,
`errorMessage: "No more than 12 Serverless Functions can be added to a Deployment on the Hobby
plan."` — hämtat direkt från Vercels API (`GET /v13/deployments/{id}`), inte gissat. Kontot är
bekräftat Hobby-plan. Produktägaren valde konsolidering framför planuppgradering (se 6.2 nedan
för vilken fil).

### 6.2 — Konsolidering + atomisk job-claiming
- `api/delete-exams.js` (35 rader, en enkel `DELETE FROM user_exams WHERE user_id=...`) folded in
  i `api/check-role.js`s redan etablerade `action`-dispatch-mönster som en ny `delete_exams`-gren.
  Samma auth (`requireAuth`), samma `user_id`-scopning, samma felhantering — noll
  beteendeförändring. `app.html`/`förbättring.html` uppdaterade till att anropa
  `/api/check-role` med `action:'delete_exams'`. Repot är nu tillbaka på **12 routade
  `api/*.js`-filer** (inklusive `api/knowledge.js`).
- Upptäckt och fixat i samma veva: `förbättring.html`s raderingsanrop saknade en
  `Authorization`-header sedan tidigare (förexisterande bugg — `api/delete-exams.js` krävde redan
  `requireAuth`, så knappen gav alltid `401` innan denna ändring). Samma
  `db.auth.getSession()`-mönster som redan användes tre andra ställen i filen applicerat här.
- `api/knowledge.js`: den tvåstegs SELECT+UPDATE-baserade job-claimingen från Fas 5 ersatt med EN
  atomär `UPDATE ... WHERE id=? AND user_id=? AND status='queued' ... SELECT`. Postgres
  serialiserar konkurrerande sådana satser mot samma rad — race-fönstret är nu helt stängt, inte
  bara minskat.
- **Verifierat live**: en ny preview-deploy efter denna commit visade `● Ready` (tidigare två
  visade `● Error`) — funktionstaket är bekräftat löst, inte bara "borde vara löst".

### 6.3 — `short_answer` live-testad
Kört mot skarp databas (koncept `reklamation`, `includePending=true`, testläge). Pipelinen
slutförde mekaniskt korrekt genom hela flödet (generera → blind-verifiera → jämföra → reparera →
re-verifiera) utan krasch, och landade säkert i `manual_review` snarare än att felaktigt
publicera. **Viktigt fynd**: den blinda verifieraren returnerade ett tomt fritextsvar
(`independent_answer: [""]`), vilket triggade `insufficient_evidence` — den exakta
strängjämförelsen (`normalizeAnswer()`) som fungerar bra för `multiple_choice`s options-ID:n är
troligen för trubbig för fritextsvar, där två självständigt formulerade men sakligt likvärdiga
svar sällan matchar exakt. Se "Kända begränsningar".

### 7.1–7.2 — P.E.R juridikläge
- `src/ai/prompts/per-legal/v1.js`: `sanitizeLegalQuestion()` speglar `_per-context.js`s
  `BLOCKED_CONTEXT_REGEX`-mönster (kopierat rakt av, inte omuppfunnet — README-kravet). Kan
  returnera `{status:"insufficient_evidence", answer:null, reason}`.
- `api/explain.js`: ny `legalMode`-gren, additiv, insatt efter `requireAuth()`. **Trippel-inert**
  just nu: (a) ingen befintlig frontend-yta skickar `body.legalMode`, (b) feature-flaggan
  `per_legal_rag_enabled` är `false` sedan Fas 2-seedningen, (c) `retrieveChunks()` hittar inga
  `review_status='approved'` chunks eftersom pilotkorpusen (Fas 3) i sin helhet är `pending`.
  Abstain sker utan ett genererat, ogrundat svar — det generativa AI-anropet hoppas helt över när
  inga godkända källor hittas (ett embeddings-anrop görs ändå, för själva sökningen — försumbar
  kostnad, se Codex-fynd nedan).

## Filer

- `api/check-role.js` (ändrad — ny `delete_exams`-gren)
- `api/delete-exams.js` (borttagen)
- `api/knowledge.js` (ändrad — atomisk job-claiming)
- `api/explain.js` (ändrad — ny `legalMode`-gren)
- `app.html`, `förbättring.html` (ändrade — nya anropsplatser)
- `src/ai/prompts/per-legal/v1.js` (ny)
- `tests/schema/validate-prompt-modules.mjs` (utökad, +5 per-legal-tester)
- `docs/codex_review.md` (uppdaterad, CR-2026-07-2X-007 t.o.m. 009)

## Migrationer

Inga. Denna fas rör bara applikationskod, inga schemaändringar.

## Tester

Full regression grön genom hela fasen efter varje delsteg:
`validate-schemas.mjs` 21/21, `validate-prompt-modules.mjs` 22/22 (upp från 17, nya per-legal-
tester), `validate-gold-set.mjs` 101/101, `legal-retrieval.test.mjs` 10/10,
`legal-generation.test.mjs` 10/10. `node --check` grönt på samtliga ändrade filer.

**Live:**
- `short_answer`-pipelinen körd end-to-end (se 6.3).
- Preview-deploy verifierad `● Ready` efter funktionstaks-fixen.

## Codex-fynd

- **CR-2026-07-2X-008** (check-role.js-konsolidering): 1 HIGH (fångad FÖRE commit — `check-role.js`
  var inte staged, hade skeppat en tyst no-op istället för raderingen) — fixat. 1 LOW
  (förexisterande auth-bugg i förbättring.html) — fixat proaktivt utöver vad som krävdes.
- **CR-2026-07-2X-009** (explain.js legalMode, extra rigör pga live fil): 0 CRITICAL/HIGH.
  1 MEDIUM (kommentar överdrev — påstod "inget AI-anrop alls" vid abstain, men embeddings-anropet
  sker ändå) — fixat, kommentaren korrigerad till att bara garantera "inget genererat, ogrundat
  svar". 1 LOW (kvotskydd saknas för `legalMode` — dokumenterat som förutsättning innan
  aktivering, inte blockerande eftersom ytan är trippel-inert).

## Korrigeringar

Samtliga fixbara fynd åtgärdade direkt, se ovan. Inget kvarstår öppet från dessa tre
granskningsomgångar.

## Kända begränsningar

- **`short_answer`-verifieringen är trubbig**: den exakta strängjämförelsen mellan blind
  verifierares svar och generatorns facit fungerar bra för `multiple_choice` (options-ID:n är
  diskreta värden) men är troligen felkalibrerad för fritextsvar, där olika formulerade men
  sakligt korrekta svar sällan är identiska strängar. Pipelinen förblev SÄKER (landade i
  `manual_review`, publicerade inget felaktigt) men är för konservativ — kommer troligen avvisa
  fler korrekta `short_answer`-frågor än nödvändigt. Behöver en semantisk (troligen
  AI-assisterad) jämförelse istället för `normalizeAnswer()`-strängmatchning för denna frågetyp —
  ett designarbete för en framtida fas, inte en snabb bugfix.
- **`legalMode` saknar kvot-/rate-limit-skydd** (Codex LOW, CR-009) — måste läggas till innan
  `per_legal_rag_enabled` någonsin sätts till `true` i produktion. Samma kategori som redan löstes
  för `api/knowledge.js` i 6.2, men inte upprepad här eftersom ytan är trippel-inert.
- **`api/knowledge.js`s job-claiming är nu atomär, men fortfarande utan en riktig kö** — flera
  jobb-steg för samma användare i snabb följd begränsas fortfarande bara av den dagliga
  kvotgränsen (Fas 5), inte av någon samtidighetsgräns. Inte relevant förrän flaggorna aktiveras.
- Ingen mänsklig juridisk granskning av pilotkorpusens 20 chunks har skett än — kvarstår som **den
  faktiska spärren** mot att någon av dessa nya ytor (knowledge.js:s generate, P.E.R:s legalMode)
  någonsin kan producera elevvänt innehåll, oavsett feature-flaggor.

## Kostnadspåverkan

Försumbar. `short_answer`-testkörningen (6.3) var en enda pipeline-körning (samma kostnadsordning
som Fas 5:s tester). Ingen kostnad från Fas 7 (legalMode aldrig faktiskt anropad — trippel-inert).

## Säkerhetspåverkan

Positiv. Vercel-funktionstaket är nu en bekräftad icke-risk (verifierad, inte bara löst i teorin).
`check-role.js`-konsolideringen bevarar exakt samma auth/scoping (Codex-bekräftat) och fixade en
förexisterande trasig knapp på köpet. `explain.js`s nya yta granskad med extra rigör eftersom
filen är live — additiv, trippel-inert, ingen påverkan på befintlig elevtrafik.

## Rollback

Trivial för samtliga ändringar (feature-branch, `git revert` av respektive commit om det skulle
behövas). Ingen migration att rulla tillbaka. Konsolideringen av `delete-exams` är den enda
ändringen som påverkar en LIVE, redan aktiv klientyta — dess rollback skulle kräva att återställa
`api/delete-exams.js` OCH de två frontend-anropsplatserna tillsammans, inte bara en fil.

## Quality Gate

**PASS.** Tre Codex-granskningsomgångar (CR-007 → CR-009), samtliga PASS efter fix. Full
regression grön genomgående. Vercel-funktionstaket bekräftat löst med en verifierande live-deploy,
inte bara antaget.

## Rekommendation

Kvarstående öppna punkter innan produktägaren beslutar om nästa steg (Fas 8/9 enligt
`09-migration-and-rollback-plan.md`: shadow mode, begränsad aktivering):
1. **Mänsklig juridisk granskning av pilotkorpusens 20 chunks** — den återkommande, verkliga
   spärren mot elevvänd användning, oberoende av all kod som byggts hittills.
2. `short_answer`-verifieringens kalibrering (se "Kända begränsningar") bör lösas innan den
   frågetypen används på riktigt.
3. Kvot-/rate-limit-skydd för `legalMode` måste läggas till innan `per_legal_rag_enabled`
   aktiveras.
Väntar på uttryckligt godkännande innan nästa fas påbörjas.
