# ExGen: checklista for skolpilot

## Local quota-failure fix — 2026-10-21

- [x] The API now reserves P.E.R quota against a server-generated request ID, commits it on a successful response, and refunds it on provider/stream failure. Explain-cache hits no longer consume a new quota unit.
- [x] A service-role-only RLS migration adds the reservation ledger and guarded reserve/commit/refund RPCs. The migration ran successfully in disposable PGlite; its quota/idempotency/stale-cleanup/privilege checks passed. This is not a hosted staging migration run.
- [x] The first full serial run found one stale static assertion in `tips-prompt-security.test.mjs`; after updating it to require refund plus the unchanged generic error, the focused eight-file API/P.E.R./quota suite passed **71/71**. The full suite was not rerun afterward; JavaScript syntax and whitespace checks passed.
- [!] The fix is local only. It is absent from the `04e542a` Preview, has not been pushed, and its migration has not been applied to staging. Hosted schema drift and hosted RLS/RPC permissions still need review before deployment.
- [!] The exact `04e542a` Preview remains at the invited-account sign-in gate. The previously approved one-time synthetic Premium test is unused. No staging role/quota/data or production state changed.

**PILOT NOT READY.** Next: review the migration against the current hosted schema, get separate staging-migration approval, create a READY Preview from this code, sign in there, and run only the already approved single synthetic generation. Restore Gratis immediately after that test.

## Current verification — 2026-10-21

- [x] The approved eight-commit range through `04e542a` is pushed to `codex/exgen-generation-quality-2026-10-20`; remote readback matched local HEAD `04e542aa1fb1452fd4433d2d4c730bf1f82a67a2`.
- [x] Vercel Preview `dpl_4wYECkQiFV83ch1xHnfkJG6k2AXR` is `READY` from that exact SHA and branch: `https://provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [x] Exact-HEAD offline checks recorded in the status source: exam-flow **184/184**, P.E.R./exam-context **66/66**, selected exam/P.E.R./assessment matrix **112/112**.
- [x] Fresh full sequential offline run on `04e542a`: all **178 discovered test files** exited successfully.
- [!] Staging exam and P.E.R. requests were stopped by exhausted quota before model execution. There is no verified provider-backed result for this deployment; offline tests do not prove live model quality.
- [!] Confirmed staging P.E.R. quota issue: read-only SQL shows `consume_per_chat_quota` increments `profiles.per_quota_count` under a row lock and has no request/idempotency key; provider-error branches in `api/explain.js` do not refund. A provider failure can consume a learner's allowance. The forward migration source is missing from the repository. Before a pilot, recover/reconcile that source and review an idempotent reservation/refund design; no staging DDL is authorized by this finding.
- [ ] Still required: bounded live synthetic generation and P.E.R.; grading and persisted-result verification; two-account RLS/IDOR validation; school approval for learner, privacy, consent, support and operating procedures.

**PILOT NOT READY.** A later, separate approval permits only a temporary Premium role for the single synthetic generation documented below; it has not been used because sign-in is blocked. No quota adjustment, database/data write, `main` merge, or Production action is authorized. Recheck deployment and staging state before the approved request.

## Latest bounded staging attempt — 2026-10-21

- [x] Reverified exact deployment `dpl_4wYECkQiFV83ch1xHnfkJG6k2AXR` as `READY`, on `codex/exgen-generation-quality-2026-10-20` at SHA `04e542aa1fb1452fd4433d2d4c730bf1f82a67a2`. Deployment-specific URL: `https://provia-igzpkctdv-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [x] The exact URL presents the invited-account sign-in gate. No session was available, so no generation request was made.
- [x] Read-only staging checks before/after confirm the single matching synthetic profile remains `gratis`, quota count `5`. No role/quota/data write and no provider call occurred.
- [x] User explicitly approved one synthetic three-question generation with staging Premium temporarily enabled and restored to Gratis immediately afterward. The approval is unused; only sign-in is outstanding.
- [x] Five focused offline source-reference, generation-pipeline, verifier, assessment, and solver test files passed (exit 0); these are not live model evidence.
- [x] Additional offline P.E.R. review, completion-proof, error/stream, quota-contract, and pedagogy/help-ladder tests passed. They do not prove live provider behavior or resolve the documented quota-refund risk on provider failure.

**PILOT NOT READY.** Next: sign in to the exact Preview above; then perform the already approved single synthetic generation and immediately restore Gratis. No second generation, role/limit adjustment, database write, `main` merge, or Production action is included.

## Latest staging verification and local follow-up — 2026-10-20

> Historical checkpoint; deployment and local/remote status below are superseded by the current verification above.

- [x] Both approved grading-state migrations are applied only to staging; hosted schema and RPC permissions match the fenced grading contract. Migration versions are `20261020170419` and `20261020170431`.
- [x] A synthetic authenticated 3-question Mathematics 2b flow completed on Preview: generation succeeded, in-exam P.E.R. withheld answer-bearing help, submission graded 6/6, and the verified result/account history were saved. Post-grade P.E.R. explained the verified response.
- [!] The UI selected a mixed exam, but all 3 delivered questions were MC. Local server-side handling now targets 1 MC + 1 short answer for 2 questions and 1 MC + 2 short answers for 3; structural and verifier-driven repairs target the missing type. Integrated 2- and 3-question regressions cover both repair paths and confirm fail-closed behavior if the model ignores the type request. This change is not deployed.
- [!] The deployed logger warned that a four-event AI-usage batch failed. Staging schema metadata matches local event columns/constraints and an aggregate found no matching rows in the exact interval; the cause is not known. Local code now records allowlisted status/error categories without logging response bodies, credentials or study content; this change needs Preview verification.
- [x] The verified result remains bound to its grading claim/fingerprint for recovery. The claim RPC checks verified completion before pending-claim state; a retained claim timestamp is not alone a stale/in-progress grading failure.
- [x] Focused pilot/API/PostgreSQL/P.E.R. suite passed 66/66, migration checker found 39 migrations/36 rollback files, routing fixtures passed and `git diff --check` passed. The full sequential suite had one `pilot-session-recovery` navigation timeout; the same file passed alone (1/1), so the full suite is not green-certified.
- [ ] The deployed Preview is still older commit `303b3c6`; local changes are not pushed or live-verified.
- [ ] Two-account authenticated RLS/IDOR and school operational approvals remain open. Keep the synthetic staging account/data; do not delete without separate approval. `main`, Production, Vercel alias and staging data remain unchanged.

**PILOT NOT READY.** Generation, active exam answer protection, grading/save and post-grade P.E.R. have live staging evidence. Mixed question distribution, telemetry diagnosis, two-account isolation and school operational approvals remain unverified.

## Historisk kontroll före stagingmigrering — 2026-10-20 17:00 UTC

- [x] Preview-aliasen pekar pa READY-deployment fran branchens aktuella HEAD `303b3c6`; ingen `main`-merge eller Production-andring.
- [x] RLS ar aktiverat pa alla `public`-tabeller. Granskade elevtabeller har agarkontroller i policies; katalogkontroll ersatter inte autentiserat tva-konto-IDOR-test.
- [!] Staging saknar `exam_issuances.grading_claim_id` och de RPC-overloads som aktuell grading-API skickar claim-token till. Den aktuella stagingdatabasen ar darfor inte kompatibel med Previewns graderingsflode.
- [x] Fencing-/avbrottsmigreringarna passerade isolerade PostgreSQL/PGlite-regressioner 4/4.
- [!] Klientroller har breda tabellgrant, inklusive `TRUNCATE` pa flera tabeller. RLS skyddar inte `TRUNCATE`; praktisk atkomst via Data API ar inte testad och grants har inte andrats.
- [!] Supabase Security Advisor flaggar `sync_report_count` som klientkallbar `SECURITY DEFINER` med muterbar `search_path`; den ar kopplad som trigger men hardning av dess oqualificerade tabellnamn aterstar. `match_knowledge_chunks` har ocksa muterbar `search_path` (SECURITY INVOKER). Ingen Auth-/DB-installning har andrats.
- [ ] Exakt stagingmigration och hosted verifiering invantar separat godkannande. Ingen databasandring gjordes.

**PILOT NOT READY:** applicera godkanda stagingmigrationer och verifiera autentiserad provgenerering, rattning/sparning, P.E.R. samt tva-konto-IDOR innan elevpilot.

## Aktuell statuskontroll — 2026-10-20 16:55 UTC

- Auth-fixens applikationscommit `15a95880d49a9f54430e47ef2b508317c5c00c7f` och statusdokumentationens commit `691cd290a4b8fc50ec4347d33abe5cfca8764f73` ar pushade till feature branch `codex/exgen-generation-quality-2026-10-20`. Vercel Preview `dpl_7adHe5wkw7rf5VEpDa5HV97PMLaD` ar `READY` fran exakt dokumentations-SHA; appkoden innehaller `15a9588`. Stabil Preview-alias pekar pa deploymenten. Ingen `main`-merge, Production-deploy eller databasandring har gjorts.
- Foregaende liveprov pa `dpl_83i2yFcRadJDSN3DVecMyVF8irz4` stoppades vid `auth_user_lookup` med `TimeoutError` efter 5 sekunder. Ny kod gor en begransad andra Auth-begaran (8 s per forsok), returnerar 503 vid Auth-otillganglighet i stallet for felaktig 401 och behaller 401 for ogiltig elevtoken. Liveeffekten ar annu inte verifierad.
- Offline: 196 Node-tester i 95 API-/assessment-/P.E.R.-testfiler passerade; fokuserad auth/pipeline/Supabase-key-svit passerade 10/10; `git diff --check` passerade. Inget av detta bevisar att liveleverantorer fungerar.
- Kompletterande UI/browser-verifiering: 10 prov-/P.E.R.-/eval-filer genomforda, Node rapporterade 13/13 subtester; P.E.R.-provkontext 66/66, hjalptrappa 28/28, felannonsering 12/12 och mobil-P.E.R. pa 320/375/390/430 px passerade.
- Vercel-metadata visar stagingvariabler krypterade och avgransade till den aktuella feature-branchen. Inga vardena visades.
- Ny Preview-flik visar inloggningsgrinden. Supabase Auth-loggaggregering 16:37-16:40 UTC visar 13 lyckade `GET /user` med `referer=http://localhost:3000`; ingen Preview-begaran syns i resultatet. Rotorsaken till Vercels timeout ar darfor fortfarande okand. Ingen ny livegenerering eller P.E.R./rattning/sparning har verifierats.
- Preview-loggen for `/api/abandon-exam` visade Node `DEP0169`-deprecation fran ett beroende vid en utloggad forfragan; rutten avvisar utloggade anrop med 401 enligt design. Det ar inte en verifierad applikationskrasch.

**PILOT NOT READY.** Nasta steg: logga in i den stabila staging-Previewn och kor ett fa-syntetiskt-endast flode for provgenerering, P.E.R., rattning och sparning. Radera inte stagingkontot eller dess data. Ror inte Production eller `main`.

## Foregaende kontroll — 2026-10-19 (historisk)

- Bekraftad Preview `dpl_AsBzCd1TMVVTCwSLj74Y8sMqrFmG` ar READY fran kodcommit `3d42396` pa pilotbranchen. Den publika runtime-konfigurationen hamtades autentiserat fran just deploymenten och verifierades utan att visa nyckelvardet: pilotlage, stagingref `yhcinqejsocpmmetazpz` och appOrigin `provia-ai-git-codex-exgen-schoo-1725d7-eltons-projects-4adfb1a3.vercel.app`. Supabase-projektet `exgen-pilot-staging` ar `ACTIVE_HEALTHY`.
- Vercel slar for narvarande upp den stabila `appOrigin`-adressen till en aldre deployment pa SHA `e3bd7d9`, inte senaste kod-Previewn `3d42396`. Webblasarens lokala Auth-session delas inte mellan origin-adresser. Vid aterstallning kan lankens sida darfor se annorlunda ut; efter losenordsbyte ska anvandaren manuellt logga in igen pa den exakta aktuella Previewn `https://provia-qa62r9tex-eltons-projects-4adfb1a3.vercel.app/app.html`.
- Supabase Redirect URLs visar den enda godkanda aterstallningscallbacken `https://provia-ai-git-codex-exgen-schoo-1725d7-eltons-projects-4adfb1a3.vercel.app/aterstall.html`. Site URL ar fortsatt `http://localhost:3000`; SMTP-installning har inte andrats.
- Avgransade Auth-loggar 2026-10-19 visar fyra `/token`-forsok med `grant_type=password` och status 200 (15:20-15:53 UTC), samt senare lyckade `refresh_token`-anrop till 18:36 UTC. Tidigare `invalid_credentials`-forsok finns kvar. Loggfragan exponerade inga identitetsfalt, sa detta bevisar inte vilken Preview-flik eller anvandarhandling som lyckades och motsager inte direkt anvandarens uppgift att inloggning nu misslyckas.
- Den generiska 200-responsen fran `/recover` bevisar fortfarande inte mejlleverans. Ingen aterstallning skickades av Codex efter callbackandringen. Standard-SMTP:s leverans till mottagaren ar inte verifierad.
- Vercel runtime-loggar for den senaste Previewn gav ingen matchning pa `exam_quality_rejected` under en 30-minutersfraga. Detta ar inte bevis for att ingen annan korning skett; Hobby-loggretention gav fel nar en bredare period efterfragades.
- Lokala riktade tester: provpipeline/verifierare, rattningsaterhamtning, completion-proof, session recovery, P.E.R.-provkontext och felannonsering gav godkanda filresultat. Separat efter den nya HTTP-502-regressionen passerade `grading-recovery-concurrency.test.mjs` och `grading-provider-timeout.test.mjs` (2/2). Full offline-svit ar inte omkord i denna uppfoljning.
- Nasta live-steg ar att anvandaren provar den stabila branch-Previewn ovan och rapporterar endast vilket fel som visas. Om inloggningen lyckas, kor avgransat syntetiskt prov/P.E.R./rattning/sparning. Om den misslyckas, samla en ny Auth-loggkontroll utan e-post eller andra identifierare; andringar av losenord, SMTP, roll, kvot, stagingdata, `main` och Production kraver fortsatt separat beslut.

**PILOT NOT READY.** Livekvalitet, providerprestanda, rattning och sparning ar inte verifierade i aktuell staging-Preview.

## Senaste Preview — 2026-10-19 (commit `3d42396`)

- P.E.R:s utgangna vanliga inloggningssession behaller nu elevens oskickade fraga i inmatningen medan anvandaren loggas ut. Den nya browserregressionen omfattar HTTP 401, HTTP 503, natverksfel och avbruten strom och passerade 12/12; varje fel annonseras, syns i chatten och ateraktiverar Skicka.
- Commit `3d42396` ar pushad till pilotbranchen. Vercel Preview `dpl_AsBzCd1TMVVTCwSLj74Y8sMqrFmG` ar `READY`, target `preview`, fran exakt SHA `3d42396`.
- Inga staging-AI-anrop gjordes eftersom staginginloggning fortsatt ar blockerad. Ingen `main`-merge, produktionsdeploy, Auth-/databasandring eller stagingradering gjordes.

**PILOT NOT READY.** Livegenerering, P.E.R., rattning och sparning i staging ar fortfarande overifierade.

## Lokal uppfoljning efter Preview — 2026-10-19

- P.E.R.-fel vid HTTP-fel, avbruten strom eller natverksfel annonseras nu aven via befintlig `role=status`/`aria-live=polite`-region. Webblasarregressionen kontrollerar att felet annonseras och visas, att elevens fraga ligger kvar och att Skicka kan anvandas igen.
- Verifierarprompten pa svenska och engelska sager nu uttryckligen att ett ordagrant citat inte styrker ett motsagt pastaende och att dubbletter/nara parafraser ska avvisas. Den deterministiska grinden avvisar redan `source_alignment` under 0,6; detta fortydligar den modellberoende granskningen men ar inte en garanti for att modellen alltid upptacker motsagelser.
- Riktad verifiering efter andringarna: prov/assessment 5/5 testfiler; P.E.R.-felannonsering 9/9; prov-/P.E.R.-browserflode 66/66; materialkontext 39/39; isolerat passkey-test 25/25; syntaxkontroller passerade.
- Sekventiell fullsvit pa 170 testfiler avslutades efter drygt tio minuter med ett rapporterat fel i `tests/frontend/per-passkey.test.mjs`. Isolerad omkorning passerade 25/25. Fullsviten raknas darfor inte som helt gron; orsaken klassas som icke reproducerad flakighet tills den kan aterupprepas.
- Commit `40eb20f` ar pushad till pilotbranchen. Vercel Preview `dpl_4g7eAd9pfxp1EmXfxwM4JXNTZLZa` ar `READY`, target `preview`, fran exakt SHA `40eb20f`; checklistandringen och felannonseringsfixen ar darfor ute i denna Preview. Ingen live-AI eller stagingkorsning gjordes eftersom staginginloggning fortfarande inte fungerar.
- Nasta steg ar att aterfa stagingautentisering och darefter gora ett avgransat syntetiskt liveflode. Ingen `main`-merge, produktionsdeploy, Auth-/databasandring eller stagingradering gjordes.

**PILOT NOT READY.** Modellbaserad källsemantik och trefrågekapacitet är inte livevaliderade; fullsviten hade en icke-reproducerad passkey-testfail.

## Senaste uppfoljning — 2026-10-19 (commit `80eeb49`)

- Provbegaran validerar nu att varje godkand fraga matchar elevens valda format (`mc`, `short`, eller en tillaten blandning). Formatfel stoppas i den deterministiska grinden bade efter forstagenerering och efter reparation; regressionen visar att fel format inte nar verifierare eller losare.
- Vanlig P.E.R.-studiehjalp kan nu fa det aktuella inklistrade studiematerialet, begransat till 6 000 tecken och behandlat som opalitlig kalltext, inte instruktioner. Materialet filtreras bort nar kontexten markerar aktivt prov, provresultat eller aktuell provfraga.
- Verifierat lokalt efter dessa andringar: API-/assessment-sviten passerade 5/5 testfiler; P.E.R.-kontextpaketet passerade 39/39; browserregressionen for P.E.R./prov passerade 66/66. Dessa ar lokala tester, inte provider- eller stagingbevis.
- Oberoende kodgranskning bedomde att provskyddet failar stangt enligt de granskade kodvagarna. Kvarstaende risk: kallreferensernas forekomst ar strukturell och semantisk relevans beror fortfarande pa modellgranskning; representativa adversariala kvalitetsfall och verklig providerprestanda ar inte liveverifierade.
- Commit `80eeb49` ar pushad till `codex/exgen-school-pilot-review-2026-10-13`. Git-kopplad Vercel Preview fran exakt SHA ar `dpl_62m3YJkHgc2zMAYwHpBuVakCLjx7`, status `READY`, target `preview`. Build-scriptet accepterade den explicita icke-produktionsruntime-konfigurationen; ingen `main`-merge eller produktionsdeploy har gjorts.
- En forsta lokal CLI-upload utan Git-branchkontext stoppades av build-scriptets fail-closed-miljoskydd. Den ersattes av den Git-kopplade Previewn ovan; inga hemligheter kopierades eller exponerades och inga Vercel/Supabase-miljovariabler andrades.
- Anvandaren kan inte logga in pa stagingkontot. Inga nya AI-anrop, Auth-andringar, DB-andringar eller produktionsatgarder har gjorts. Nasta steg ar att aterfa staginginloggning pa Previewn; darefter kan ett litet syntetiskt flode verifiera trefragorsgenerering, P.E.R. och sparad rattning.

**PILOT NOT READY.** Preview-bygget ar verifierat fran ratt commit, men utan staginginloggning ar liveprov for generering, P.E.R., rattning och sparning inte genomforda.

## Senaste lokala uppfoljning — 2026-10-19

- Grundcommit for denna uppfoljning ar `d9a98f4` pa den befintliga pilotgrenen. Previewn fran den grenen ar separat fran Production; ingen `main`-merge eller produktionsdeploy ingar.
- Provpipelinen kravde tidigare inte att varje genererad fraga hade minst en källreferens som faktiskt finns kvar i elevens material. Kallreferens ar nu obligatorisk for vanliga fragor och ingar som `minItems: 1` i generatorns schema. Fragor utan referens stoppas av den deterministiska grinden fore verifierare/losare och kan ersattas genom den befintliga begransade reparationsvagen. Grafuppgifter ar undantagna eftersom de normaliseras fran den givna tabellen/ekvationen.
- Regressionen bekraftar att en fraga med en referens som saknas i materialet inte nar verifieraren, losaren eller elevens prov. Kallforekomst ar en strukturell kontroll; semantisk relevans och om texten verkligen stodjer fragan bygger fortsatt pa verifieraren och ar inte en full garanti.
- Aterstallningssidan visade tidigare fortsatt automatisk inloggning aven nar webblasaren inte kunde spara Auth-sessionen. Den visar nu att losenordsbytet lyckades men inloggningen misslyckades, samt en tydlig vag till inloggningssidan.
- Verifierat lokalt: fokuserade API-/assessment-tester passerade; `pilot-public-entry.mjs` passerade 24/24; `node --check` for andrade JavaScript-filer och `git diff --check` passerade. En redundant fullsvitskornig avbrots efter tio minuter; den raknas inte som pass for denna diff.
- Anvandaren uppger fortsatt att stagingkontot inte gar att logga in pa. Inga nya liveanrop, auth-andringar, databasandringar eller stagingdataborttagningar gjordes. Godkand staging-callback var redan tillaten.

**PILOT NOT READY.** Offline-regressionerna bevisar inte att provgenerering, P.E.R., rattning eller sparning fungerar i staging. Nasta steg ar att anvandaren loggar in med det avsedda syntetiska stagingkontot i en aktuell Preview. Nar autentisering fungerar kan ett litet, syntetiskt skolpilotflode verifieras. Produktion och `main` lamnas ororda.

## Senaste verifiering — 2026-10-19

- Aktiv XelioV-mappning aterbekraftad for pilot-worktree `/private/tmp/provia-ai-pilot-feature-20261019` och ExGen-projekt `c3af48b2-20c3-4d33-a5e0-72aa001a1637`.
- Pilotgrenens HEAD och remote branch ar `5a233e0` (`fix: fail closed on malformed verifier changes`). Preview `dpl_BcmnGXbhWsjE1KrPaaM8qdMDRtDE` ar READY fran exakt samma SHA, `target=null`; den ar inte Production. Preview-URL: `https://provia-c804wp7rd-eltons-projects-4adfb1a3.vercel.app/app.html`.
- Den nya Previewn oppnas korrekt men visar inloggningsgrinden i en ny session. Inloggnings- och aterstallningsvyn laddar. Runtimefilen och `/aterstall.html` returnerar HTTP 200; återställningssidans titel är `Återställ lösenord – ExGen`.
- Vercel deploymentens publika `js/exgen-runtime.js` verifierades utan att skriva ut nyckelvardet: `environment=pilot` och `projectRef=yhcinqejsocpmmetazpz`. Den innehaller en stabil branch-origin for appen. Branch-scope finns for Preview-variablerna, men Vercel vagrade lasa metadata via anslutningen och CLI visar alla varden krypterade; serverns krypterade `SUPABASE_URL` ar darfor inte separat verifierad.
- Read-only kontroll i Supabase bekraftar att det godkanda stagingkontot finns, ar e-postbekraftat och har minst en tidigare lyckad inloggning. Kontot skapades med `Auto confirm user`, sa skapandet skickade inget bekraftelsemejl. Inget mejl ska forvantas fran just den atgarden; ett separat aterstallningsmejl ar annu inte verifierat mottaget.
- Supabase Auth visar att custom SMTP ar avstangt i staging, sa standardutskicket anvands. Supabases dokumentation anger att standardprovidern endast levererar till teamets forhandsgodkanda adresser och saknar leverans-SLA; detta ar en trolig forklaring till det uteblivna mejlet, men mottagarens teamstatus och faktisk leverans ar inte verifierade.
- Supabase Auth-loggarna visar en `/recover`-begaran med status `200` kl. 14:58 UTC den 19 oktober. Det bevisar att Auth accepterade begaran, inte att mejlet levererades eller hamnade i inkorgen. Samma minut 14:56-14:58 UTC visar tre `/token`-forsok med `400 invalid_credentials`; dessa inloggningsforsok avvisades av Supabase och bevisar inte ett ExGen-serverfel. Exakt orsak (fel e-post kontra fel losenord) ar okand. Ingen ny aterstallning har skickats av Codex.
- Supabase Auth URL Configuration visade Site URL `http://localhost:3000` och tom Redirect URLs-lista. Efter uttryckligt godkannande lades endast den runtime-verifierade callbacken `https://provia-ai-git-codex-exgen-schoo-1725d7-eltons-projects-4adfb1a3.vercel.app/aterstall.html` till i stagingens Redirect URLs; UI-bekraftelse visade `Successfully added 1 URL` och listan innehaller en URL. Site URL och SMTP-konfigurationen andrades inte. Inget aterstallningsmejl skickades efter andringen.
- Ny skrivskyddad staginggranskning: projektet ar `ACTIVE_HEALTHY` pa PostgreSQL 17.11. De 15 senaste fjarrmigrationsnamnen motsvarar de 15 lokala migrationsfilerna for issuance/quota/RLS, men fjarrversionernas timestamp-ID:n skiljer sig fran lokala filnamn. Kor inte om eller applicera migreringar innan versionsdriften har utretts.
- Relevanta tabeller har RLS aktiverat. Centrala server-only provtabeller saknar `anon`/`authenticated` grants och klientpolicyer; stagingens core issuance/grading RPC:er finns. Lease-funktionerna har tom `search_path` och nekar direkt execute for `anon`/`authenticated`. `user_exams` har bredare permissive policies som samtidigt begransas av restrictive owner policies. RLS-tva-konto-isolering har inte testats via Auth-sessioner.
- Supabase Advisor flaggar 29 RLS-enabled/no-policy-tabeller (forvantat for flera server-only tabeller, men grants maste fortsatt granskas), tva funktioner med muterbar search_path, leaked-password-skydd avstangt och flera performance-notiser. DDL/Auth-andringar gjordes inte i denna kontroll.
- Den exakta aktuella Previewn visar inloggningsgrinden i en ny session. Anvandaren uppger att inloggning fortfarande inte fungerar. Previewns senaste 30-minuters runtime-loggfraga gav inga poster; en 7-dagarsfraga nekades eftersom Hobby-loggretentionen ar kortare. Detta verifierar inte att inga anrop skett.
- Tidigare livebevis kvarstar men galler aldre Preview-versioner: syntetiskt P.E.R-samtal fungerade; ett 3-frageprov stoppades ofullstandigt; ett 2-frageprov kunde rattas till 5/5 efter ett forsta 502-forsok. Ett nonsensalternativ observerades tidigare, vilket motiverade den nu testade solver-grinden. Det ar inte ny liveverifiering av `38ce282`.
- Diagnostikcommiten loggar nu verifierarens avslag som `option_quality_failed` eller `option_quality_contract_failed` i stallet for att blanda ihop dem med generella granskarfel. Den ar deployad pa Preview; livefelorsak fran nya deploymenten ar inte verifierad.
- Vercels runtime-logg-API kunde inte hamta den historiska perioden: projektets plan behaller inte runtime-loggar sa langt tillbaka. Det ar en loggtillgangsbegransning, inte belagg for att inga anrop skett.
- Ingen stagingdata eller konto har raderats. Ingen Production- eller `main`-andring har gjorts.

## Lokal uppfoljning efter senaste Previewn

- En oberoende kodgranskning fann att ett ensamt langre ord bland numeriska mattealternativ kunde passera om bade AI-granskarna godkande det. En deterministisk, avgransad formatkontroll stoppar nu just den inkonsekventa formen; den ar inte en stavningsordlista och ska inte beskrivas som generell nonsensdetektion.
- Generator, verifierare, losare och servernormalisering delar nu max fem svarsalternativ, i linje med befintliga 3-5-prompter.
- Utgangna lokala provutkast rensas fortsatt, men eleven far nu uttrycklig information om att sparade svar tas bort medan studiematerialet finns kvar.
- Full offline-svit koren sekventiellt efter andringarna: `node --test --test-concurrency=1 --test-reporter=dot $(rg --files tests -g '*.test.mjs')` avslutades med exit 0. API/P.E.R./assessment-sviten och pilotnara frontendtester passerade ocksa separat. Ämnesroutningens motexempel och P.E.R-gold-setets 25 strukturella kontroller passerade.
- Dessa uppfoljningsandringar ar lokala och har annu inte deployats. Inga live AI-anrop gjordes. Anvandaren uppger att staginginloggning inte fungerar, sa inget nytt syntetiskt skolflode kunde testas.
- Oberoende P.E.R-granskning fann att en stale rattningsclaim failar stangt och inte aterupptas efter processkrasch. Ingen osaker automatisk omkorning lades till; detta kvarstar som en dokumenterad aterhamtningsbegransning. Timeout som fangas kontrollerat slapper fortsatt claimen for retry enligt befintliga tester.

**PILOT NOT READY.** Full offline-svit passerade sekventiellt (exit 0) efter den senaste fail-closed-tillaggen; fokuserad verifierar-/pipeline-/solver-svit passerade 3/3. Preview ar READY fran exakt `5a233e0`; klientruntime visar pilotlage och stagingref, men API-serverns krypterade `SUPABASE_URL` ar inte separat verifierad. En `/recover` fick HTTP 200 utan leveransbevis; tre `/token`-forsok fick `invalid_credentials`. Den exakta staging-callbacken ar nu tillaten, men inget mejl har provats efter andringen och standard-SMTP-mottagarens behorighet ar okand. Anvandaren kan inte logga in. Nasta steg ar att anvandaren sjalv begar en aterstallningslank i Previewn, kontrollerar inkorg/skrappost och loggar in utan att dela adress eller losenord har. Om mejlet uteblir behover mottagarens team-behorighet eller en separat SMTP-losning utredas; ingen sadan andring ar godkand. Efter inloggning: kor hogst ett syntetiskt 3-frageprov, ga vidare till P.E.R aktivt/utanfor prov, rattning och sparning bara efter godkant prov. Ror inte testdata vid staddning utan separat godkannande.

## Lokal verifiering — 2026-10-19

- [x] Rattningsaterforsok efter ett syntetiskt provider-timeout verifierat i samma handlerflode: forsta forsoket sparar inget delresultat och slapper claimen; samma signerade inlamning kan sedan rattas och sparas exakt en gang. Detta visar kodens kontrollerade timeout-/retrybeteende, inte orsaken till det tidigare live-502:et.
- [x] Fore den senaste `required_changes`-hardningen passerade de tre fokuserade rattningstesterna 3/3. En parallell fullsvit hade tidigare varit gron, men senare parallella korningar gav instabila browser-testfail; den ska inte raknas som slutverifiering av aktuell kod.
- [x] `decideApproval()` failar nu stangt om `option_quality_contract_ok` inte uttryckligen ar `true`. Ett positivt kortsvarsfall bevisar att `options: []` och en korrekt tom kvalitetslista fortfarande godkanns; MC med ofullstandigt kontrakt nekas.
- [x] Efter oberoende QA faller `decideApproval()` aven stangt om `required_changes` saknas eller inte ar en array; riktad regression passerar. Ett explicit tomt array ar fortfarande tillatet.
- [x] Efter fail-closed-andringen passerar verifierarens outputkontrakt, provpipeline och solver-tester (3/3 testfiler). Hela offline-sviten passerar sekventiellt med exit 0. Parallella fullsvitsforsok visade olika browser-testfail som passerade nar isolerade.
- [x] Verifierarens besluts- och outputkontrakt, syntetiska provpipeline inklusive reparation, samt full offline-svit passerade efter den tidigare option-quality-hardningen. Den aktuella fullsviten efter `required_changes`-hardningen kor därför sekventiellt; se foregaende punkt.
- [x] Det oavsiktligt skapade Vercel-projektet `provia-ai-pilot-feature-20261019` togs bort efter uttryckligt godkannande. Dashboarden visade ingen Production Deployment och inga miljovariabler; deployments-API:t visade noll deployments; efterat returnerade projekt-ID:t 404 `Project not found`.
- [x] Avgransad kodgranskning av provgenerering och P.E.R genomford i separat worktree baserad pa mergade `main`.
- [x] Provverifieraren granskar nu varje flervalsalternativs sprakliga begriplighet och amnesrelevans; saknad eller felaktig kvalitetsmetadata faller stangt.
- [x] P.E.R:s grundniva ger en kort, uppgiftsanpassad ledtrad utan facit for konkreta ovningar, men svarar direkt pa enkla begreppsfragor.
- [x] Riktade tester for verifieringskontrakt, provpipeline, P.E.R-pedagogik och grafflode har korsts.
- [x] Full offline-svit kor om pa commit `d90322f`; `node --test --test-concurrency=4 --test-reporter=dot $(rg --files tests -g '*.test.mjs')` avslutades med exit 0, 299/299.
- [x] Vercel Preview `dpl_4EGDivqzJCZGEVnvfBQewbUFrMNc` ar READY fran exakt branch/commit `4fe3516`; target ar Preview. Runtimefilen och aterstallningssidan svarar HTTP 200; runtime visar pilotlage och godkant stagingref.
- [ ] Staging-schema, Auth/Storage, provideranrop, RLS/tvakonto-isolering, provskapande, rattning, P.E.R och radering maste verifieras med syntetiska konton.
- [ ] Skolan maste godkanna elevdata, retention, lararatkomst, support/incidentflode och kriterier for pilotstart.

Data deletion gate: see `docs/codex/12_DATA_DELETION_GAP.md`.

**PILOT NOT READY.** Lokala tester och promptforbattringar bevisar inte att Preview, staging eller skolans processer fungerar live. Produktionsmiljo och riktiga elevdata har inte anvants eller andrats i denna genomgang.

## Lokal uppfoljning — 2026-10-19 (provgranskarens reparationskontext)

- [x] Vid begransad reparation far den oberoende verifieraren nu se endast ID, typ och formulering for redan godkanda forstafragor. Facit, alternativ, svarsmallar, rubricer och kallreferenser for dessa jamforelsefragor skickas inte.
- [x] Verifieraren instrueras att jamfora reparationskandidater med den godkanda kontexten, men ska returnera resultat endast for kandidaterna. Kontext och total granskningspayload ar begransade; overskridna gransvarden stoppas fore provideranrop.
- [x] Syntetisk regressionskontroll visar att en omskriven kandidat som granskarledet identifierar som dubblett inte levereras, medan den godkanda ursprungsfragan behalls. Detta testar pipelinebeteende, inte faktisk modellprecision pa semantiska dubbletter.
- [x] Hela offline-testsviten korde sekventiellt efter kodandringen med exitkod 0. Efter den kompletterande dubblettregressionen passerade de tva fokuserade proverifierar-/pipeline-testfilerna (2/2), syntaxkontroller och `git diff --check`.
- [ ] Ingen staginginloggning, betald providerutvardering eller nytt liveprov gjordes. Pilotstatus kvarstar NOT READY tills syntetiskt stagingflode och skolans operativa godkannanden ar verifierade.
- [x] Vercel-ID:t `prj_i91LIdfjxVzLJnSoELHc0RlluNg2` fran den tidigare godkanda projektatgarden returnerar 404. Namnet `provia-ai-pilot-feature-20261019` returnerar nu ett annat projekt-ID; detta andra projekt lamnades orort och ska inte raderas under det tidigare godkannandet.
- [x] Commit `bca9524` ar pushad till pilotgrenen. Grenens `vercel.json` har `deploymentEnabled: false`; darfor skapades ingen ny Preview. Ingen manuell deployment, merge till `main` eller Production-andring gjordes.

## Lokal uppfoljning — 2026-10-19 (Preview-databasval)

- [x] Vercel-miljometadata visar en branch-scopad `EXGEN_PILOT_SUPABASE_URL` och en separat delad `SUPABASE_URL`; de krypterade vardena har inte lasits. Previewn kan darfor inte antas anvanda ratt projekt bara utifran dashboardens env-lista.
- [x] Kodsokning fann att server-API:er tidigare anvande `process.env.SUPABASE_URL` direkt. Ny `getSupabaseUrl()` valjer `EXGEN_PILOT_SUPABASE_URL` for pilot/Preview och failar stangt om den saknas; verifierad Production anvander fortsatt `SUPABASE_URL` och befintlig projektgrans.
- [x] Berorda Supabase-anrop i auth, provgenerering, rattning, P.E.R, OCR, signup, kunskap, lararrapport, admin och betalningshooks gar nu via samma resolver.
- [x] Fokuserad URL-/pilot-/P.E.R-testsvit passerade 76/76; hela offline-sviten med `node --test --test-concurrency=4 --test-reporter=dot $(rg --files tests -g '*.test.mjs')` avslutades med exit 0.
- [x] Branchregeln i `vercel.json` ar uttryckligen aktiverad endast for `codex/exgen-school-pilot-review-2026-10-13` efter godkannande av Preview; detta ska inte skapa eller promovera Production.
- [x] Ny Preview `dpl_F269tBdfhqFb7n5E6jU4pmTLnNz6` ar READY fran commit `e4b4168` och visar appens inloggningsgrind pa `https://provia-r0wpmfdtm-eltons-projects-4adfb1a3.vercel.app/app.html`. Detta bevisar inte autentisering eller fungerande server-API.
- [x] En unauthenticated `GET /api/explain` i Preview returnerade `{"error":"Unauthorized"}` i webblasaren. Funktionen startar och nekar korrekt en saknad session; detta verifierar inte ett autentiserat Supabase-anrop.
- [x] Stagingens URL Configuration visar Site URL `http://localhost:3000` och en aldre Preview-aterstallningsadress. Varken Site URL eller SMTP har andrats.
- [x] Supabase Auth URL Configuration visar den exakta Preview-callbacken `https://provia-r0wpmfdtm-eltons-projects-4adfb1a3.vercel.app/aterstall.html` i Redirect URLs (2 URL:er totalt). Site URL ar fortsatt `http://localhost:3000`; inga andra Auth-falt andrades.
- [x] Read-only Auth-kontroll visar att bada befintliga stagingprofiler ar bekraftade och har tidigare lyckade inloggningar. Ingen Auth-logg syntes for dem under senaste timmen; detta faststaller inte om aktuellt fel ar losenord eller Preview-/projektkoppling.
- [x] Supabase Auth > Emails > SMTP Settings visar att `Enable custom SMTP` ar av. Standardutskick ar darfor inte verifierad aterstallningsvag for en extern adress.
- [x] Vercel aterbekraftar aktuell Preview som READY fran exakt `e4b4168` pa feature-branchen. Projektet har SSO-skydd; en obehorig HTTP-kontroll omdirigerades av Vercel (302) fore appen. Inga error-loggar fanns for deploymenten senaste 30 minuterna; franvaro av loggar bevisar inte att ett inloggningsforsok natt API:t.
- [x] Full offline-svit koren sekventiellt pa aktuell feature-HEAD; samtliga 171 testfiler avslutades med exit 0. Detta ar mockad/lokal evidens, inte verifiering av modellkvalitet eller PostgreSQL-beteende.
- [x] Tva oberoende read-only-granskningar av aktuell HEAD: aktivt provs P.E.R-gate ser fail-closed ut i API-testad kod; inga tydliga facitlackor hittades. Generatorns semantiska kallstod, sprakplausibilitet och normal 3-fragekapacitet beror fortfarande delvis pa modellbedomning; granskare/losare kan anvanda samma modell om separata env-modeller saknas.
- [ ] Rattnings-RPC:er saknar saker takeover av en stale claim efter processkrasch; API:t avbryter efter tva minuter. En kontrollerad provider-timeout kan slappa claimen, men stale-aterhamtning/fencing ar inte testad eller implementerad. Migrationsbeteendet ar inte exekverat mot PostgreSQL: API-tester mockar RPC-svar och migrationstester granskar SQL-text. Lokal miljo saknar Supabase CLI, Docker och `psql`.
- [ ] Oberoende granskning fann aven att claim/persist kan behandla en obekraftad `mock_results`-rad med samma submission-ID som fardig/dubblett, medan den senare state-grinden kraver `verified_at`. Ingen stagingforekomst ar verifierad; lagg till DB-beteendetest innan riskbedomning eller andring.
- [ ] Anvandaren kan fortfarande inte logga in. Standard-SMTP ar avstangd och aterstallningsmejl kan darfor inte anvandas som verifierad losning. Ingen ny profil har skapats, och ingen live AI-anropning eller syntetisk provkorning har gjorts. Nasta steg ar att anvandaren skapar ett nytt unikt syntetiskt stagingkonto i Supabase Dashboard med `Auto confirm user?` aktiverat och anger losenordet sjalv; testet fortsatter sedan i samma Preview.

**PILOT NOT READY.** Lokal kod och full offline-svit ar verifierade. Aktuell branch-Preview och callback ar verifierade, men staginginloggning/live API- och AI-flode, PostgreSQL-test av rattnings-RPC:er samt skolans operativa godkannanden aterstar.

## Uppfoljning — 2026-10-19 (stagingblocker och rattnings-QA)

- [x] Supabase Dashboard visar fortfarande det tomma formularet `Create a new user`; inget nytt stagingkonto har skapats. `Auto confirm user?` ar ikryssad och formularet uppger att inget bekraftelsemejl skickas.
- [x] Den exakta regressionsfragan med matematikalternativet `Kesäkten` passerar inte den deterministiska formatgrinden. Reparationsfallet och verifierarens outputkontrakt passerade i `tests/api/exam-pipeline-offline.test.mjs`, `tests/assessment/assessment.test.mjs` och `tests/api/verifier-output-contract.test.mjs` (3/3 testfiler). Modellanrop och Supabase ar mockade.
- [x] Oberoende skrivskyddad granskning bekraftade att gammal grading-claim kan strandas efter processkrasch och att grading-RPC:er behandlar vilken matchande `mock_results`-rad som helst som slutford, medan senare state-kontroll kraver `verified_at`. Om motsvarande stagingdata finns ar inte verifierat.
- [ ] En lokal migreringskandidat lagger till fencing-token for stale-claim-overtagning och ersatter endast overifierade resultatsammanfattningar efter godkand serverratning. Den ar inte applicerad. Nuvarande tester bevisar inte SQL-beteendet mot PostgreSQL eller commit-genomfort/HTTP-svar-bortfall; disposable PostgreSQL-test kravs fore staginggodkannande.
- [ ] Ingen Auth-profil, stagingdata, SMTP-installning eller databas har andrats i denna uppfoljning. Nasta live-steg ar ett nytt syntetiskt konto som anvandaren skapar i det oppna Dashboard-formularet med ett lokalt valt losenord; efter autentisering kor endast ett litet syntetiskt Preview/stagingflode.

**PILOT NOT READY.** Genereringsregressionen ar lokalt verifierad. Stagingautentisering och liveflode ar blockerade; rattnings-RPC-riskerna kraver en separat migrering och faktisk PostgreSQL-verifiering.

## Lokal uppfoljning — 2026-10-19 (ofullstandiga provsvar)

- [x] Ett icke-tomt modellresultat med farre fragor an begart tillats ga vidare till den befintliga enda reparationsrundan. Ett tomt eller overfullt resultat returnerar ett generiskt, strukturerat 502-fel utan modellens provobjekt, facit eller svarsalternativ.
- [x] Regressionstester tackar reparationsframgang till komplett trefrageprov, kontroll av reparationsbegaran och att misslyckad reparation varken levererar delprov eller exponerar modellfacit. Den riktade `tests/api/exam-pipeline-offline.test.mjs` passerar; modell- och Supabase-anrop ar mockade.
- [ ] Detta ar lokal kod-/mockevidens, inte en ny Preview eller live AI-korning. Inloggning till staging ar fortfarande blockerad; graderingsmigreringen ar oprovad mot riktig PostgreSQL.

**PILOT NOT READY.**

## Uppfoljning — 2026-10-20 (P.E.R-felaterhamtning och staginginloggning)

- [x] Vercel Preview `dpl_B8b8buXgdprALU81zBz1ZHTyTe3M` ar READY fran exakt commit `fe6e57e92f767235d3d0a46cdd7870d2a1cde08e` pa `codex/exgen-school-pilot-review-2026-10-13`. P.E.R-fixen ar deployad i Preview; ingen Production-promotering gjordes.
- [x] Den befintliga branch-aliasen `provia-ai-git-codex-exgen-schoo-1725d7-eltons-projects-4adfb1a3.vercel.app` pekade pa en aldre deployment (`e3bd7d9`). Den har nu kopplats till `dpl_B8b8buXgdprALU81zBz1ZHTyTe3M`; Vercel Alias API bekraftar den nya deployment-ID:n.
- [x] Supabase `exgen-pilot-staging` ar `ACTIVE_HEALTHY`. Den godkanda Previewns `/aterstall.html`-callback finns redan i Redirect URLs; ingen dubblett lades till och ingen Auth-installning andrades.
- [x] Auth > Emails > SMTP visar `Enable custom SMTP` av. Supabases standard-SMTP ar begransad till teamadresser; ingen aterstallning skickades i denna uppfoljning. Anvandaren uppger fortsatt att inloggning inte fungerar och att testkontots uppgifter inte kan anvandas.
- [x] P.E.R JSON-fallbacken aterstaller nu fragan och annonserar ett tydligt retry-fel nar HTTP 200 innehaller trasig JSON eller saknat/tomt svar. Ett trasigt JSON-fel pa 502 behaller samtidigt serverfelvagen. Inget automatiskt omskick sker. Regressionerna finns i `tests/frontend/pilot-session-recovery.test.mjs`.
- [x] P.E.R/provskyddets riktade svit passerade 60/60. Full isolerad offline-svit `node --test tests/**/*.test.mjs` passerade 304/304. `git diff --check` ar ren.
- [ ] `node --test` utan filter tar aven med `scripts/test-emails.js` och `.mjs`; bada faller i denna miljo pa saknad `RESEND_API_KEY` respektive en gammal textmarkor i `api/signup.js`. De ar inte del av de 304 testfilerna men behover en separat testkommandograns eller uppdatering.
- [ ] Staginginloggning och ett syntetiskt liveflode (tre fragor, P.E.R utanfor/under prov, rattning och sparning) aterstar. Stagingdata och konto ska inte raderas utan separat uttryckligt godkannande.

**PILOT NOT READY.** P.E.R-fixen och Preview-routing ar verifierade. Anvandaren kan fortfarande inte logga in; custom SMTP ar av och stagingens syntetiska liveflode, PostgreSQL-test av graderings-RPC:er samt skolans operativa godkannanden aterstar.

## Uppfoljning — 2026-10-20 (provaterhamtning och aktuell stagingkontroll)

- [x] Commit `ef0d77a` ar pushad till `codex/exgen-school-pilot-review-2026-10-13`. Vercel Preview `dpl_G63t6BeKKrGKeMS55Ar1n3HBEMN7` ar READY fran exakt commit `ef0d77a2e25395d9dcd50c91dedc5c9eb5b4c1a7`; ingen merge till `main` eller Production-promotering har gjorts.
- [x] Efter sitemap-commit `9e3db09` ar nuvarande branch-Preview `dpl_B9VxNcLaiM8o9cVtMpPPYSGfX8nS` READY fran exakt SHA `9e3db0950e10e778a696ce46c8bdcca72d6bcd52`. Branch-aliasen ar verifierad mot denna deployment. Autentiserad hamtning av runtimefilen fran aliaset gav HTTP 200 och bekraftade pilotlage samt stagingref `yhcinqejsocpmmetazpz`; lokala graderingsmigrationer ar inte del av deploymenten.
- [x] Branch-aliasen `provia-ai-git-codex-exgen-schoo-1725d7-eltons-projects-4adfb1a3.vercel.app` ar flyttad till den nya Previewn och verifierad via Alias API. En autentiserad hamtning av `js/exgen-runtime.js` fran exakt deployment visar `environment: pilot`, stagingref `yhcinqejsocpmmetazpz` och samma alias som `appOrigin`. Publishable-key vardet ar inte sparat i dokumentationen.
- [x] Supabase-projektet `exgen-pilot-staging` ar fortsatt `ACTIVE_HEALTHY`. En skrivskyddad Auth-kontroll utan e-post eller anvandar-ID returnerade tva stagingkonton; bada ar bekraftade, godkanda i profil och inte avstangda, med roll `gratis`. Senaste registrerade inloggning var 2026-10-19 15:53 UTC. Detta bevisar inte att anvandarens aktuella loginforsok lyckas eller identifierar vilket konto som avses.
- [x] Anvandaren uppger fortsatt att inloggning inte fungerar. Vercels logg-API saknade retention for en timmesintervall; en nyare 30-minuterssokning for exakt Preview returnerade inga varningar/fel. Supabase unified logs exponerade endast `pgbouncer_logs` for den kontrollerade timmen. Det finns darfor ingen aktuell auth-felpost som faststaller rotorsaken. En oautentiserad HTTP-kontroll av Preview gav 302 till Vercel SSO; det ar deployment-skydd, inte Supabase-loginfel.
- [x] Skrivskyddad kontroll av `auth.audit_log_entries` visar noll Auth-auditposter senaste 24 timmarna. Detta bevisar inte att inget forsok gjordes, eftersom misslyckade inloggningar inte maste skapa auditposter; anvandarens exakta feltext eller en ny kontrollerad inloggning behovs for rotorsak.
- [x] Callbacken for Previewns `aterstall.html` ar redan verifierad i stagingens Redirect URLs fran tidigare Auth-kontroll; denna uppfoljning lade inte till eller andrade Auth-konfiguration. `Enable custom SMTP` var tidigare verifierat avstangt. Standard-SMTP ar darfor inte en verifierad vag for aterstallningsmejl till externa adresser.
- [x] Provpipelinen gor nu ett enda budgetbegransat strukturellt reparationsforsok fore oberoende verifiering, aven nar den forsta strukturella grinden avvisar alla fragor. Det kompletta provet maste fortfarande godkannas; inget delprov eller osakert facit lamnas ut. UI:t bevarar nu serverns `incomplete_exam`-felkod separat fran lokaliserad text sa att eleven far relevant materialrad.
- [x] Riktad offline/API/P.E.R/pilot-svit passerade 61/61. Separat Playwright-baserad `tests/frontend/exam-flow.regression.mjs` passerade 174 godkanda, 0 fel. `node --check` for andrade JS-filer och `git diff --check` passerade. Dessa ar lokala/mokade tester, inte live modell- eller PostgreSQL-evidens.
- [x] Full offline-svit efter sitemap-, migrations- och testandringarna passerade alla 173 `*.test.mjs`-filer med `node --test --test-concurrency=1 --test-reporter=dot $(rg --files tests -g '*.test.mjs')`, exit 0. Browserflodet kor separat och dess 174/174-resultat galler oforandrad appkod.
- [ ] Ingen syntetisk AI-/prov-/P.E.R-/rattningskorning mot staging har gjorts i denna uppfoljning eftersom autentiserad app-session saknas. Testkonton eller data har inte andrats eller raderats.
- [ ] Stagingens existerande graderings-RPC-kontrakt ar fortfarande aldre an aktuell Preview-API. Den lokala kandidaten `20261019130000_fence_stale_exam_grading_claims.sql` och tillhorande API-arbete ar ocommittat i arbetsytan och inte applicerat eller verifierat mot PostgreSQL; befintliga tester kan inte styrka databaslasning, transaktion eller privilegier. Applicera inte migrationen fore separat granskning och uttryckligt staginggodkannande.
- [ ] Skolans operativa godkannanden for elevdata, retention, lararatkomst, support/incidentflode och pilotkriterier kvarstar.

**PILOT NOT READY.** Ny kod och Preview ar verifierade, och Preview runtime pekar pa staging. Inloggningens rotorsak ar inte faststalld; live AI/prov/rattning/sparning och PostgreSQL-migreringsbeteende ar otestade. Exakta nasta steg: (1) las det exakta appfelmeddelandet utan att dela konto eller losenord, eller satt/bekrafta testkontots losenord direkt i staging Supabase Dashboard; (2) granska och PostgreSQL-verifiera grading-migrationen innan separat godkannande att applicera den i staging; (3) kor det begransade syntetiska testprotokollet och dokumentera resultaten. Produktion, `main` och stagingdata har inte andrats eller raderats.

## Lokal uppfoljning — 2026-10-20 (avbrutna prov och verifierad rattning)

- [x] Ny framatriktad migration `20261020091748_fix_unverified_exam_abandonment_state.sql` ersatter de tva avbrotts-RPC:erna med `CREATE OR REPLACE`. En resultatrad avslutar eller skyddar endast ett prov nar `verified_at` finns; o-verifierade legacyrader kan inte gora ett avbrutet prov fast.
- [x] Isolerad PGlite/PostgreSQL-kompatibel korning exekverade migrationens PL/pgSQL-funktioner mot syntetiska tabeller: enskilt och batch-avbrott lamnar verifierade prov ororda, men kan avbryta prov med o-verifierad resultatrad. Existerande `service_role` EXECUTE-behorighet bevarades och `anon` fick ingen EXECUTE-behorighet.
- [x] Den separata lokala stale-claim-kandidaten exekverades ocksa i PGlite mot syntetiskt schema: migrationen bakfyllde claim-ID for aldre aktiv rattning, stale takeover roterade agaren, gammal agare stoppades fran release och persist, ny agare kunde spara verifierat resultat och endast `service_role` beholl EXECUTE.
- [x] `tests/api/verified-exam-abandonment-migration.test.mjs` granskar migreringens verifierade resultatvillkor och `CREATE OR REPLACE`-form. PGlite-kontrollen ar lokal logik-/funktionskorsning, inte hosted Supabase-verifiering eller ett samtidighetstest mellan separata PostgreSQL-sessioner.
- [ ] Bada migrationerna och graderings-API-andringarna ar lokala och ocommittade; ingen ar applicerad pa staging. PGlite ersatter inte hosted Supabase migration-ledger, riktig PostgreSQL concurrency mellan separata sessioner, live RLS eller HTTP-svarsbortfall. Full transaktions-/concurrency-verifiering och separat staginggodkannande kvarstar.

## Lokal uppfoljning — 2026-10-20 (sprakgrind och stagingblocker)

- [x] Provprompterna kravstaller nu naturligt svenska respektive engelska i elevriktade falt. Verifierarens schema kraver ett explicit `language_match`; den deterministiska grinden stoppar saknat eller falskt utslag och diagnostiken skiljer sprakfel fran kontraktsfel.
- [x] Offline-regressionerna tackar icke-matematiskt nonsensalternativ, felaktig facitnyckel, sprakfel, tva fragor och ett komplett biologi-exempel med tva fragor. Solver-fixturen anvander explicita facitoverskrivningar i stallet for att harleda dem fran modellens `correct_index`.
- [x] Full offline-svit passerade alla 173 `*.test.mjs`-testfiler med `node --test --test-concurrency=4 --test-reporter=dot $(rg --files tests -g '*.test.mjs')`, exit 0. Fokuserad verifierar-/pipeline-/grafsvit passerade 4/4 filer; syntaxkontroller och `git diff --check` passerade. Detta ar lokal/mokad evidens, inte live modell- eller PostgreSQL-verifiering.
- [x] Senast verifierade Preview/branch-alias pekade pa Preview-deployment fran commit `9bbf4b8f767e36f2cb7b07d4b7b0e61f7a93d0f6`; inga andringar har promoverats till Production eller `main`.
- [x] Anvandaren godkande att endast aktuell Preview-callback skulle tillatas, men den exakta callbacken fanns redan i staging Redirect URLs. Ingen Auth-konfiguration andrades i denna uppfoljning. Anvandaren uppger fortfarande att inloggningen misslyckas; rotorsaken ar inte faststalld.
- [ ] Inget autentiserat staginganrop eller syntetiskt AI-/prov-/P.E.R-/graderingsflode har kunnat koras. Inget losenord har aterstallts, inga konton/kvoter/roller eller stagingdata har andrats och ingen stagingdata har raderats.
- [ ] De separata, redan befintliga lokala graderings-API-/migrationsandringarna ar inte del av Previewn och far inte pushas tillsammans med denna uppfoljning innan deras databas-/API-kontrakt granskats och verifierats mot PostgreSQL.
- [ ] Inloggning, livegenerering, P.E.R under/utanfor aktivt prov, sparad rattning, migreringsbeteende och skolans operativa godkannanden aterstar.

**PILOT NOT READY.** Nasta steg ar att aterfa stagingautentisering utan att dela losenord eller aterstallningslank. Daretter kor ett litet syntetiskt stagingflode och verifiera aktuella Preview-/stagingkopplingar. Hall anvandarens separata graderingskandidater utanfor push tills de har en separat granskad verifieringsvag. Produktion, `main` och stagingdata lamnas ororda.

## Farsk kontroll — 2026-10-20 09:52 UTC

- [x] Vercel deployment `dpl_9FhFLbTgfJN2EHARF1pXQkbVf3Cz` ar `READY`, Preview-target, fran exakt commit `856d8ec2eeb9bd75733361ffeb1f7bfbb9a9ee74` pa pilotbranchen. Dess deployment-URL ar `https://provia-bjihuzexm-eltons-projects-4adfb1a3.vercel.app`.
- [x] Med Vercels autentiserade Preview-fetch returnerade `js/exgen-runtime.js` HTTP 200 och visade `environment=pilot`, stagingref `yhcinqejsocpmmetazpz` och stabil gren-origin. Vardet for publicerbar nyckel skrevs inte ut eller dokumenterades.
- [x] Skrivskyddad Auth-loggaggregering for senaste 24 timmarna visade tre `invalid_credentials`-svar, fem lyckade password-token-svar och senare tokenfornyelser, alla senast 2026-10-19 19:50 UTC. Inga nya `/token`- eller `/recover`-forsok syntes efter den tiden. Loggarna saknar har anvandarattribut; de identifierar inte vilket konto eller vilken Preview som anvandes och faststaller inte rotorsaken.
- [x] Stagingens aktuella Preview-callback ar redan allowlistad. Ingen Auth-/SMTP-installning eller stagingdata andrades. Exakt autentiserat skolpilotflode ar fortsatt otestat.
- [x] Lokal `.vercel/project.json` pekade pa ett separat tomt Vercel-projekt och har lokalt rattats till verifierade `provia-ai`-projektet. En `vercel curl` under den felaktiga lankningen rapporterade att den skapade en protection-bypass-token for tomma projektet `provia-ai-pilot-feature-20261019` (`prj_vWo9J6XgP2qJRQ5btgf2WR9C5Xs7`). Vercel lasningskontroll visar att projektet saknar deployment och domaner; env-metadata kunde inte lasas (403). Tokenvardet visades inte eller lades i repo. Projektinstallningen har inte andrats ytterligare.
- [ ] Agaren behover granska och vid behov aterkalla den projektbundna bypass-tokenen for `prj_vWo9J6XgP2qJRQ5btgf2WR9C5Xs7`, eller uttryckligen godkanna radering av just det tomma projektet. Tidigare raderingsgodkannande avsag ett annat projekt-ID och anvands inte har.

**PILOT NOT READY.** Senaste Previewn ar verifierad mot staging, men ingen ny Auth-begaran registrerades efter 2026-10-19 19:50 UTC och anvandarens inloggningsrotorsak ar okand. Fortsatt inte med liveprov forran testkontot loggar in. Ror inte det separat identifierade tomma Vercel-projektet igen utan specifikt agargodkannande.

## Lokal gradingverifiering — 2026-10-20 10:01 UTC

- [x] Exakt pinnad PGlite `0.5.10` ar tillagd som devDependency for reproducerbart lokalt SQL-beteendetest.
- [x] `tests/api/grading-claim-fencing-postgres.test.mjs` exekverar fencing- och abandonment-migrationerna mot en syntetisk PostgreSQL-databas. Den visar stale takeover, att gammal agare inte kan frigora eller spara, att ny agare kan spara/verifiera och aterhamta resultat, att obekraftad legacyrad inte hindrar avbrott samt att RPC-behorigheter ar service-only. Tre riktade migrationstester passerade.
- [x] Den falska `_ROLLBACK.sql`-filen har flyttats ut ur migrationskatalogen till en uttrycklig Markdown-notering. Regressionen kontrollerar att den inte langre kan tolkas som en migration med kolliderande versionsprefix.
- [ ] PGlite ar en isolerad PostgreSQL/WASM-instans, inte hosted Supabase eller tva oberoende samtidiga PostgreSQL-sessioner. Transaktionskonkurrens, hosted migration ledger och riktiga grants maste fortsatt verifieras separat.
- [ ] Nyskapade API-kandidaten skickar `p_claim_id`, medan stagingens aktuella `claim_exam_grading`, `release_exam_grading` och `persist_graded_exam_result` fortfarande har aldre 3/3/10-argumentsignaturer. Darfor ar API och migrering inte deploybara var for sig; stagingmigrering kraver separat uttryckligt godkannande och samordnad Preview-cutover.

**PILOT NOT READY.** Lokal SQL-beteendeverifiering ar starkare men livegrading, verklig concurrency och autentiserat skolflode ar fortfarande obekraftade. Ingen stagingmigration har applicerats.

## Auth-uppfoljning — 2026-10-20 10:07 UTC

- [x] Vercel-listan bekraftade aktuell Preview `dpl_BoJxsyD8NhEtr5RpowYSSWSh6gMN`, `READY`, fran exakt commit `e7d8f43481a7d57b81b57263ed388adc49ca6923` pa pilotbranchen.
- [x] Efter uttryckligt godkannande lades endast denna Previews aterstallningscallback till i stagingens Supabase Auth Redirect URLs: `https://provia-dxi9c0gvk-eltons-projects-4adfb1a3.vercel.app/aterstall.html`. Dashboarden bekraftade `Successfully added 1 URL`; listan visar nu tre adresser. Site URL ar fortsatt `http://localhost:3000`; SMTP och produktion andrades inte.
- [x] Senaste Previewns inloggningsformular laddar. Anvandaren uppger att inloggningen inte fungerar. Auth-loggarna 2026-10-20 09:00-10:08 UTC visar ingen `/token`- eller `/recover`-begaran, bara Auth-konfigurationens omladdning; rotorsaken ar darfor inte faststalld.
- [ ] Anvandaren behover gora ett nytt forsok i den aktuella Previewn och rapportera endast exakt feltext och ungefarlig tid. Dela inte e-post, losenord, aterstallningslank eller token i chatten.

**PILOT NOT READY.** Callbacken ar verifierat tillagd, men den paverkar aterstallningsredirect och bevisar inte att inloggningen fungerar. Inget nytt autentiserat stagingflode har annu kunnat koras.

## Eval- och specialistgranskning — 2026-10-20

- [x] Exam-quality-evalen failar nu stangt nar verifieraren misslyckas; en aktiv blind solver som misslyckas stoppar MC-fragor, medan verifierade kortsvarsfragor inte felaktigt blockeras av MC-solvern. Rapporten skiljer granskaravslag fran totalt tillbakahallna fragor och markerar leverans som forstagangsgranskning utan reparationsrunda.
- [x] Evalen rapporterar granskarens sprakavvikelser och alternativproblem samt solverns plausibilitetsavslag och deterministiska dubblettbortfall. Dessa ar signaler, inte garanti for modellupptackt.
- [x] Full offline-svit passerade 175 `*.test.mjs`-filer med `node --test --test-concurrency=4 --test-reporter=dot $(rg --files tests -g '*.test.mjs')`, exit 0. Riktad svit passerade 6/6; gratis `check-detection.mjs`, syntax och `git diff --check` passerade. Inga provideranrop gjordes.
- [x] Commit `d50259d28fd9b692b14f7e4478bb0db4ce28ed4a` ar pushad till befintlig pilotbranch. Vercel Preview `dpl_4E78s8gH66oiB9Ex4NUzjjNptGfd` ar `READY` fran exakt SHA; endast test-/evalkod och README andrades, inte appens auth eller API.
- [x] Oberoende P.E.R.-granskning fann stark lokal serverstyrd provgrind och god fokuserad offline-tackning. Aktiva prov far avsiktligt generiska, icke-generativa ledtradar; detta ar en pedagogisk kvalitetsbegransning, inte en identifierad facitlacka.
- [x] Oberoende gradinggranskning fann att lokala API-/migrationskandidater maste bytas samordnat: API skickar `p_claim_id`, medan senast dokumenterad staging-RPC har aldre signatur. PGlite-testerna verifierar inte tvasessions PostgreSQL-concurrency; abandon-bulkfunktionen saknar motsvarande runtime-test.
- [ ] Ingen ny autentiserad staging-session eller live AI-/prov-/P.E.R.-/grading-/persistenskornig har gjorts. Senaste Auth-loggar saknar det nya loginforsoket; rotorsaken ar fortsatt okand.
- [ ] Abandonment-migration, grading-cutover, hosted grants/migration-ledger och skolans operativa elevdatagodkannanden ar kvarstaende releasegrindar. Ror inte migration eller API-kandidater i en separat deploy.
- [ ] Evalen simulerar fortfarande inte produktionsreparation, endpoint-budget, kvot eller persistens. Ett granskar-/solvergenomslag i evalen ar inte bevis for live modellkvalitet.

**PILOT NOT READY.** Nasta steg ar att fa stagingkontot autentiserat utan att dela losenord i chatten. Darefter verifieras exakt aktuell Preview mot staging med fa syntetiska anrop; grading-API och migration kraver en separat samordnad granskning och uttryckligt staginggodkannande. Produktion, `main` och stagingdata ar ororda.

## Fortsatt lokal och stagingverifiering — 2026-10-20 10:37 UTC

- [x] XelioV:s aktiva projektmappning ar omkontrollerad: ExGen-ID `c3af48b2-20c3-4d33-a5e0-72aa001a1637` pekar pa den isolerade pilot-worktreen. Aktuell kod-HEAD och remote feature-branch var bada `4be6914` fore denna lokala uppfoljning.
- [x] Oberoende read-only QA av den lokala abandonment-migrationen fann ingen regeldefekt, men identifierade saknade effektiva ACL-assertioner och statusfall for enkel-avbryt. PGlite-testet tackar nu `service_role`/`anon`/`authenticated`-EXECUTE pa bada RPC:erna och testar saknad, pagarende rattning, utganget och redan avbrutet prov.
- [x] Riktade regressionsfiler for grading-claims, abandonment och rattningsaterhamtning passerade 4/4. Den fulla sekventiella offline-sviten passerade 310/310 tester, exit 0. Detta ar lokal/mock-evidens; PGlite ar inte hosted PostgreSQL eller ett tvasessions-concurrencytest.
- [x] Farsk skrivskyddad Supabase-kontroll visar att stagingens migrationsledger fortfarande slutar pa `20261016094813`; `grading_claim_id`-migrationen och abandonment-migrationen ar inte applicerade. Stagingens `claim_exam_grading` och `release_exam_grading` tar fortsatt tre argument och `persist_graded_exam_result` tio. Alla kontrollerade RPC:er har EXECUTE for `service_role`, inte for `anon` eller `authenticated`.
- [x] Farsk stagedefinition visar fortsatt att nuvarande abandonment-funktioner kan behandla en befintlig `mock_results`-rad som fardig utan att krava `verified_at`. Den lokala migrationen andrar detta till verifierat resultat, men staging ar annu inte andrad.
- [ ] Grading-API-kandidaten skickar `p_claim_id`, vilket inte matchar stagingens nuvarande graderings-RPC-kontrakt. Distribuera inte kandidat-API separat fran en granskat och uttryckligt godkand stagingmigration/cutover.
- [ ] Inget nytt autentiserat Preview/stagingflode eller AI-anrop har verifierats. Staginginloggningens rotorsak ar fortfarande okand; anvandarens losenord ska hanteras endast direkt i Auth-UI, aldrig efterfragas eller lagras har.

**PILOT NOT READY.** Lokal svit ar gron, men livegenerering, P.E.R., grading, sparning och aktuell deploy mot staging ar fortfarande overifierade. Ingen stagingmigration, Auth-/SMTP-andring, kontoforandring, kvotandring, dataradering, `main`-merge eller produktionsdeploy har gjorts i denna uppfoljning.

## Granskningsfix for utgangna graderingsclaims — 2026-10-20 10:42 UTC

- [x] Oberoende QA flaggade utgangna claims. Kallkontroll bekraftade att `claim_exam_grading` redan stoppar utgangna issuances fore stale takeover; den verkliga luckan var att persist kunde godta en fortfarande aktiv claim efter issuance-deadline.
- [x] Den lokala fencing-migrationen avvisar nu claim och persist nar issuance-deadline har passerat enligt aktuell klocktid. PGlite-regressionen visar att stale utgangen claim inte kan tas over, att varken stale eller tidigare aktiv claim kan spara efter deadline, och att ingen `mock_results`-rad skapas.
- [x] Riktade migration-/recoverytester passerade 4/4 efter expiry-fixen; full sekventiell offline-svit passerade 310/310 innan de senare fail-closed legacy overloads tillkom. Nuvarande kontrakt och ACL verifieras separat av den senare fokuserade sviten; inget av detta bevisar hosted PostgreSQL eller liveflode.
- [ ] Fixen finns endast lokalt i den orenade worktreen och ar inte pushad eller applicerad. Den kravda grading-API/RPC-cutovern ar fortsatt stoppad av stagingens aldre RPC-signaturer och separat godkannande for stagingmigration.

**PILOT NOT READY.** Ingen API- eller databas-cutover har gjorts. Oberoende QA bekräftar utgangssparren, men stagingmigration/cutover kraver separat tydligt godkannande; autentiserat liveflode och skolans operativa godkannanden aterstar ocksa.

## Lokal tidsgrans-QA — 2026-10-20

- [x] Efter den oberoende granskningen behaller migrationen gamla RPC-signaturer som fail-closed stubbar och lagger till tokenbaserade overloads. Migration-forst ger aldre Preview-kod ett avsiktligt stopp fram till ny koddeploy; ny kod forst far saknat RPC och failar ocksa stangt. Det ar en tydligt avgransad staging-cutover, inte nollavbrott. Ingen cutover har gjorts.
- [x] Ytterligare granskning av tidsgranslogiken visade att PostgreSQL `now()` ar transaktionsstarttid. De lokala fencing- och abandonment-migrationerna anvander nu `clock_timestamp()` for deadline-/stale-kontroller efter radlaset.
- [x] PGlite-testet provar att en grading-persistens och en abandonment som anropas efter att issuance-fristen passerat mitt i en langre transaktion returnerar `expired` utan att skriva resultat eller avbrott.
- [x] Fokuserad API-/migration-/gradering-svit passerade 18/18 efter andringen. PGlite bevisar inte konkurrens mellan separata PostgreSQL-sessioner, hosted Supabase eller Preview/live-AI-flode.
- [x] Oberoende QA fann inga SQL-/ACL-defekter i fail-closed legacy overloads. Cutovern ger tillfalligt gradingstopp for aldre Preview-kod; en redan startad gammal claim kan behova aldra ut fore ny kod kan ta over. Den lokala SQL-testen verifierar inte PostgREST:s JSON-overloadval eller schema-cache refresh.
- [ ] Lokala API- och migrationsandringar ar fortfarande ocommittade/odeployerade och stagingkontot ar inte autentiserat i den aktuella Previewn. Ingen stagingmigration har applicerats. Verifiera riktiga tva-sessions PostgreSQL-konflikter fore separat cutover-godkannande.

**PILOT NOT READY.** Nasta steg for livevagen ar att anvandaren loggar in med stagingkontot i aktuell Preview och delar endast feltext/tid om det misslyckas. Grading-cutover forblir separat och kraver uttryckligt godkannande efter PostgreSQL-verifiering.

## Skrivskyddad Auth-kontroll — 2026-10-20 11:02 UTC

- [x] Supabase bekräftar att `exgen-pilot-staging` (`yhcinqejsocpmmetazpz`) är `ACTIVE_HEALTHY`. En boolesk Auth-kontroll visar att det tidigare angivna stagingkontots e-post finns. En separat boolesk join visar att profilen är bekräftad, inte raderad eller avstängd och godkänd. Inga e-postadresser, UUID:er eller lösenord skrevs ut ur Auth-tabellen.
- [x] Auth-loggar för 10:02-11:02 UTC visar ett `POST /token` med `grant_type=password` och `400 invalid_credentials`. Frågan returnerade endast path, grant type, HTTP-status och felkod; inga identitetsfält lästes. Begäran nådde alltså staging Auth, men inloggningsuppgifterna som användes accepterades inte. Rotorsaken är sannolikt lösenordsmismatch; Auths generiska felkod avslöjar inte lösenord eller exakt orsak.
- [ ] Användaren behöver sätta ett känt nytt lösenord direkt i Supabase Dashboard för det bekräftade syntetiska kontot och försöka logga in på aktuell Preview igen. Lösenordet ska inte skickas till Codex. Ingen reset, SMTP-ändring, profil-/kvotändring eller ny Auth-användare gjordes i denna kontroll.

**PILOT NOT READY.** Auth-endpointen och kontot är verifierade; autentiserad app-session saknas fortfarande. Efter lyckad inloggning fortsätter den begränsade syntetiska prov-/P.E.R.-/rättnings-/sparningsverifieringen.

## Lokal helsvit och oberoende granskning — 2026-10-20

- [x] Aktiv XelioV-mappning verifierad via CLI: ExGen-projekt `c3af48b2-20c3-4d33-a5e0-72aa001a1637` pekar på exakt denna isolerade worktree. HEAD är `5a0242e`; arbetsgrenen är detached och innehåller befintliga lokala ändringar. Dessa har bevarats.
- [x] Aktuell Vercel Preview-listning bekräftar READY-deployment från `5a0242e` på den befintliga pilotgrenen. Deploymenten innehåller inte de lokala rättnings-/migrationskandidaterna. Ingen push eller deploy gjordes.
- [x] Riktad API-/migrations-/graderingssvit passerade 18/18; hela offline-sviten passerade med exit 0 och omfattade 175 `*.test.mjs`-filer. `git diff --check` passerade. Resultaten styrker lokal/mokad kod, inte hosted PostgreSQL, riktig modellkvalitet eller live Preview.
- [x] Oberoende P.E.R-granskning fann inget konkret fel i svarsspärren. Föreslagna fall för förfalskad provstatus, avbrutna/utgångna prov och obekräftade gamla resultat kontrollerades mot den befintliga P.E.R-handler-sviten och täcks redan av regressionsfall; inga duplicerade tester lades till.
- [x] Oberoende generatorgranskning bekräftade en begränsad pipeline med verifiering, blind lösning och högst en reparation. Exakta/normaliserade dubbletter testas, men semantiska upprepningar förlitar sig fortfarande på modellgranskning. Verifierare och lösare faller som standard tillbaka på generatorns modell; om Preview har separata modellöverskrivningar är inte verifierat.
- [ ] Ingen autentiserad staging-/Preview-session finns ännu; därför återstår syntetisk liveprovning av provgenerering, P.E.R. och rättning/sparning. Auth-kontrollen visar endast `invalid_credentials`, inte den exakta orsaken. Användaren behöver sätta/återställa lösenordet direkt i stagingens Supabase Dashboard; dela inte lösenordet här.
- [ ] Rättnings-API och två lokala SQL-migrationer är fortfarande ocommittade och oapplicerade. PGlite ersätter inte två oberoende PostgreSQL-sessioner eller hosted Supabase-migrationstest. Applicera inte migration eller skicka API-kandidaten separat.

**PILOT NOT READY.** Helsviten är grön lokalt, men aktuell Preview kör inte de lokala graderingskandidaterna och inget liveflöde har verifierats. Produktion, `main`, stagingdata, roller och kvoter lämnades orörda.

## Ny kontroll av liveblocker — 2026-10-20 11:10 UTC

- [x] Skrivskyddad Auth-loggfråga för 11:02-11:10 UTC hittade inga `/token`- eller `/recover`-anrop. Ingen ny staginginloggning eller återställning har därför observerats i perioden.
- [x] Försök att hämta historiska Vercel Preview-runtime-loggar för de senaste sju dagarna avvisades eftersom Hobby-planens runtime-loggretention är kortare. Detta är ett retentionfel, inte bevis på att loggar eller fel saknades. Orsaken till det rapporterade 502-felet kan inte fastställas retrospektivt från dessa loggar.
- [x] Lokal rättningskod har en kontrollerad 502-väg: providerfel avbryter utan partiell resultatpersistens och släpper den aktuella claimen. Syntetiska regressioner täcker att samma försök kan göras om. Detta bevisar inte orsaken eller återhämtningen för det historiska livefelet.
- [ ] Vid nästa autentiserade stagingförsök, fånga Preview-runtime/request-loggar omedelbart runt ett syntetiskt rättningsfel. Dela endast tidsstämpel och användarvisad feltext.

**PILOT NOT READY.** Liveflödet är fortfarande blockerat av saknad staginginloggning; den historiska 502-orsaken är okänd. Ingen Auth-, stagingdata-, migrerings-, Production- eller `main`-ändring gjordes.

## Gränssnitt och färsk stagingkontraktskontroll — 2026-10-20 11:11 UTC

- [x] Supabase stagingens migrationsledger lästes på nytt: senaste version `20261016094813` (`preserve_latest_exam_issuance`). De tre graderings-RPC:erna har fortfarande äldre kontrakt: `claim_exam_grading` och `release_exam_grading` har tre argument och `persist_graded_exam_result` har tio. De lokala API-/SQL-kandidaterna med `p_claim_id` matchar alltså inte den aktuella databasen ännu. Endast skrivskyddade katalogfrågor kördes.
- [x] `npm run a11y-audit` passerade: noll axe-överträdelse och noll konsolfel på de granskade sidorna; integritetspolicyn hade ingen horisontell overflow vid 390 px. Detta är lokal DOM/a11y-evidens, inte manuell tangentbords-/skärmläsartestning eller helappsmobilverifiering.
- [x] Riktade frontendregressioner passerade 4/4 filer: `per-mobile`, `per-error-announcements`, `per-exam-context` och `graph-keyboard-isolation`. De täcker bland annat P.E.R:s trygga fel/återförsök, in-/utgång ur provläge och visning vid 320/375/390/430 px; tangentbordstestet håller grafpiltangenter inom aktiv fråga.
- [ ] Ingen stagingmigration eller deploy genomfördes. Före cutover krävs riktig PostgreSQL-verifiering av overloads, ACL, transaktionskonkurrens och HTTP-/PostgREST-dispatch samt separat uttryckligt godkännande.

**PILOT NOT READY.** Lokala API-regressioner och sidtillgänglighet är gröna, men stagingens graderingskontrakt är ännu inkompatibelt med den lokala claim-fencing-kandidaten; användarautentisering och liveproven saknas fortfarande.

## Lokal frontendregression och stagingkontohandoff — 2026-10-20 11:22 UTC

- [x] Den riktade frontendsviten passerade efter omkörning: 5/5 testfiler, inklusive `exam-flow.regression.mjs` med 174/174 kontroller och `pilot-session-recovery.test.mjs`. Den första körningen rapporterade ett enstaka `Failed to fetch` från Supabase-klienten i startspråkstestet; det isolerade språkflödet passerade 58/58 och hela sviten passerade vid upprepad körning.
- [x] Oberoende read-only granskning bedömer testfelet som sannolik Playwright-/mockflakighet, inte bekräftat produktionsfel. Testet saknar ännu requestfailed- och routeträffsdiagnostik, så rotorsaken är inte bevisad. Inga kodfiler ändrades.
- [x] Efteråt passerade hela offline-sviten med exit 0: 175 filer `tests/**/*.test.mjs` med `node --test --test-concurrency=4 --test-reporter=dot`. Ändrade API-filer passerade `node --check`; `git diff --check` passerade. Detta är lokal/mokad evidens och ersätter inte tvåsessions-PostgreSQL, verifierade Preview-hemligheter eller syntetiska liveflöden.
- [ ] Supabase Auth-sidan visar det valda syntetiska kontot med en annan e-postadress än den användaren vill använda. Den synliga kontovyn erbjuder att skicka återställningsmejl men inte att sätta lösenord direkt. Ingen e-post, lösenord, konto, profil, roll eller kvot ändrades. Webbläsarens credential-policy kräver att användaren själv anger och skickar ett nytt lösenord; lösenord som skrivits i chatten ska inte återanvändas.
- [ ] Användaren behöver välja om avsikten är att ersätta befintligt syntetiskt konto eller skapa ett separat stagingkonto. Därefter måste användaren själv sätta ett nytt unikt lösenord via den säkra stagingvägen och verifiera inloggning i aktuell Preview.
- [x] Färsk Auth-sökning efter den användarangivna e-postadressen gav ingen match bland stagingkontona. Ny användarform är förberedd med e-postfältet ifyllt, lösenordsfältet tomt och standardvalet "Auto confirm user?" markerat. Kontot skapades inte; användaren måste själv ange ett nytt lösenord och välja om e-postbekräftelse ska hoppas över innan skapandet.

**PILOT NOT READY.** Frontendens riktade regressioner är gröna efter en icke-reproducerad flakighet, men stagingautentisering är inte återställd och inget liveprov har körts.

## Lokal kvalitetsgrind — 2026-10-20 11:43 UTC

- [x] En deterministisk komplettering stoppar nu svenska flervalsfrågor utanför språkprofilen när exakt ett långt enordsalternativ sticker ut bland frasalternativ och ordet saknas både i frågan och elevens studiematerial. Regeln kör före verifierare/lösare i första generering och båda begränsade reparationsvägar.
- [x] Regressionen visar att ett nytt syntetiskt felord stoppas före modellkontrollerna, att ett tekniskt ord som finns i materialet (även i singular mot pluralform) passerar och att språkprovets enordsalternativ inte påverkas.
- [x] Riktade assessment-/pipeline-tester, syntaxkontroller och `git diff --check` passerade. Full offline-svit passerade 310 tester, 0 fel, exit 0 (`node --test --test-concurrency=4 --test-reporter=spec ...`).
- [ ] Detta är en format-/källförankringsheuristik, inte generell stavnings- eller semantikkontroll. Den fångar inte nonsens om alla alternativ har samma format och kan stoppa ett giltigt men ej källbelagt enordsbegrepp när det ensamt bryter formatet. Liveproviderkvalitet är inte verifierad.
- [ ] Den nya staging-Auth-användaren är inte skapad. Användaren måste själv ange ett nytt unikt lösenord i Supabase Dashboard; lösenordet som skrevs i chatten ska inte återanvändas. Inget konto, ingen data eller konfiguration ändrades.
- [ ] Lokala grading-API-/SQL-kandidater är fortsatt ocommittade och oapplicerade. PGlite-resultat ersätter inte tvåsessions-PostgreSQL eller hosted Supabase. De pushades inte med kvalitetsgrindscommiten; ingen `main`-merge, stagingmigration eller produktionsändring gjordes.

**PILOT NOT READY.** Den lokala kvalitetsgrinden och 310 offline-tester är verifierade, men staginginloggning, syntetiskt liveflöde och hosted grading/databasbeteende återstår.

## Preview efter kvalitetsgrind — 2026-10-20

- [x] Commit `7ed1033ac84fcd7fad3e3c15e5dca81f9f7bf3dc` pushades till den befintliga pilotgrenen efter att remote head verifierats som dess föregående commit `5a0242e`.
- [x] Vercel Preview `dpl_57vLxsHFy5WBFHJhtHtrRhPCkGiH` är `READY` från exakt `7ed1033`. Runtimefilen från deploymenten returnerade pilotkonfiguration och stagingref `yhcinqejsocpmmetazpz`; nyckelfältet verifierades inte eller sparades.
- [ ] Deploymenten har inte autentiserats i browsern. Det syntetiska stagingkontot är ännu inte skapat, så inga liveanrop för prov, P.E.R., rättning eller sparning har gjorts.

Preview: `https://provia-7um7wegdu-eltons-projects-4adfb1a3.vercel.app/app.html`.

**PILOT NOT READY.** Den nya kvalitetsgrinden är deployad endast till Preview. Stagingautentisering och syntetiskt end-to-end-flöde återstår; `main` och Production är orörda.

## Uppföljning av alternativgrind — 2026-10-20

- [x] Den tidigare hårda regeln som kunde ta bort ett ensamt enordsalternativ om det saknades i källtexten är ersatt. Formatavvikelsen är nu endast en granskningssignal; frågan går vidare till oberoende verifierare och lösare.
- [x] Verifieraren får en intern `review_hints`-signal i första granskning, strukturell reparation och regenerering. Prompten säger uttryckligen att signalen inte är en slutsats och inte ensam får fälla giltiga namn eller facktermer.
- [x] Tester visar att nonsensalternativet `Kesäkten` kan avvisas av den oberoende kvalitetskontrollen, medan det giltiga tekniska svaret `Kloroplasterna` kan överleva när kontrollerna godkänner frågan. Punctuation-wrapped outlier och en från källan saknad egennamnsfråga testas också.
- [x] Oberoende granskning fann inga missade hint-vägar i initial-, strukturell reparations- eller regenereringsflödet. En kvarvarande begränsning är att modellen fortfarande avgör om ett giltigt enordsalternativ ska godkännas; offline-fixturer bevisar inte live-modellens bedömning.
- [x] Slutlig offline-svit passerade alla 175 `*.test.mjs`-filer, exit 0. Ändrade API-filer passerade `node --check`; `git diff --check` passerade.
- [x] Commit `0a93efe5003e23faaf50f31f83d2df90def1cb01` är pushad till den befintliga pilotgrenen efter att remote head verifierats som `7ed1033`.
- [x] Vercel-deployment `dpl_AGsSGxESdPaqwbnFxNtFJrFCA4kK` är `READY` från exakt SHA `0a93efe`. `/app.html` och `/js/exgen-runtime.js` returnerade 200; runtimefilen innehåller stagingref `yhcinqejsocpmmetazpz`. Inga nyckelvärden lästes eller dokumenterades.
- [ ] Ingen autentiserad staging-session eller live-AI-körning gjordes i denna uppföljning.
- [ ] Stagingkontot är inte skapat/autentiserat. Inloggning, syntetisk livegenerering, P.E.R., rättning och resultatsparning återstår. Använd inte lösenord som skrivits i chatten; användaren behöver ange ett nytt lösenord direkt i Supabase Dashboard.
- [ ] Lokala grading-API-/SQL-kandidater har inte inkluderats, migrerats eller verifierats mot hosted Supabase. `main`, Production och stagingdata är orörda.

Preview: `https://provia-ovwytlyid-eltons-projects-4adfb1a3.vercel.app/app.html`.

**PILOT NOT READY.** Korrigerad kvalitetsgrind är pushad och byggd i aktuell branch-deployment, men inte livevaliderad mot AI. Autentiserad staging-E2E väntar fortfarande på att användaren säkert skapar/loggar in på ett syntetiskt konto.

## Lokal grading-cutover-kandidat — 2026-10-20

- [x] Claim-ID-stödet bär nu samma servergenererade ägartoken genom claim, release och persist; stale takeover ska avvisa den gamla ägaren. Testerna täcker 502-/providerfel, retry, idempotens, abandonment och syntetisk SQL-persistens.
- [x] Riktade API-/PGlite-/migrations-/provider-tester passerade 5/5 filer. Efter tillägg av de två avsiktligt spärrade `_ROLLBACK.sql`-filerna passerade migrationstesterna 3/3 och `node scripts/check-migration-files.mjs` rapporterade 39 migrationer och 36 rollbackfiler.
- [x] Båda rollbackfilerna avbryter med exception i stället för att återställa en osäker äldre funktion. Förklaringar finns under `docs/codex/rollback/`.
- [ ] Lokal miljö saknar `postgres`, `psql`, `pg_ctl` och Docker. PGlite kör PL/pgSQL mot isolerat schema men är inte två oberoende PostgreSQL-sessioner och bevisar inte faktisk samtidighet, PostgREST-overloadval/schema-cache eller hosted Supabase-beteende.
- [ ] Cutover mellan befintliga 3-arguments RPC och nya claim-ID-RPC är inte bakåtkompatibel i någondera ordningen: API före migration failar mot saknad overload; migration före API stoppar den gamla Previewn från att gradera. Planera en samordnad staging-cutover efter separat godkännande.
- [ ] Kandidat-API och migrationer är fortfarande ocommittade/oapplicerade; ingen hosted stagingmigration, `main`-merge eller Production-ändring har gjorts. Aktuell Preview använder inte dessa gradingändringar.

**PILOT NOT READY.** Offlinekontrakten är mer täckta, men tvåsessions-PostgreSQL/PostgREST och staging-cutover saknas. Autentiserat staging-E2E med prov, P.E.R. och sparad rättning återstår också.

## Grafhandledning, fail-closed-regressioner och färsk stagingkontrakt — 2026-10-20

- [x] P.E.R.-kontexten bevarar nu endast stödda frågetyper och grafmodus. Linje- och punktdiagram får olika metodstöd; konflikt eller okänt modus får neutral vägledning. Prompten säger uttryckligen att modellen inte ser själva grafbilden och inte får hitta på koordinater.
- [x] Fråga, alternativ, svar och provfrågor avgränsas som klientdata och HTML-liknande sluttaggar escapats innan systemprompten byggs. Sammanfattningskontexten får samma datagräns. Detta minskar injektionsrisken men garanterar inte modellens tolkning av fientlig text.
- [x] Ny testning visar att verifierarens `option_quality=false` ensam kan avvisa och ersätta en biologifråga, och att lösarens `option_plausibility=false` ensam kan göra samma sak; giltig teknisk term kan fortsatt accepteras. Detta testar mockade modellbeslut, inte live-detektion av nonsens.
- [x] Hela lokala/offline-sviten passerade 175 `*.test.mjs`-filer, exit 0. Därefter passerade den tillagda riktade regressionen för motstridiga grafmodus i vanlig P.E.R.-chatt. Riktade P.E.R-/provskyddstester, migrationstestare, syntax och diffkontroll passerade.
- [x] Färsk Supabase-läsning: staging `exgen-pilot-staging` är `ACTIVE_HEALTHY`, men dess tre grading-RPC:er har fortfarande gamla signaturer utan claim-token. Vercel-listningen visar senaste pilot-Preview `READY` från branch-HEAD `0a93efe`; den innehåller inte lokala grading-/P.E.R.-kandidater.
- [ ] Ingen verifierad kontoautentisering eller syntetisk livegenerering, P.E.R., rättning och persistens. Användaren känner inte till staginglösenordet; ett lösenord som skrevs i chatten får inte återanvändas. Sätt ett nytt unikt lösenord direkt i stagingdashboarden.
- [ ] Grading-API-/SQL-kandidaten är fortfarande ocommittad och oapplicerad. Cutover mellan Preview-API och RPC-kontrakt kräver en samordnad stagingsekvens, tvåsessions-PostgreSQL/PostgREST-verifiering och separat uttryckligt godkännande.

**PILOT NOT READY.** Lokala graf-/P.E.R.-förbättringar och fail-closed-kedjor är testade, men ändringarna är inte deployade. Aktuell Preview använder ännu inte dem; liveproviderkvalitet, staginglogin, gradingcutover och sparning är fortfarande otestade.

## P.E.R.-kurskontext och oberoende granskning — 2026-10-20

- [x] Oberoende P.E.R.-granskning hittade att kursfältet inte aktiverade mattepedagogiken vid vag elevfråga. `_per-core.js` använder nu även `pageContext.course`; regressionstester bekräftar Matematik 1b får arbetsgång och Historia 1b inte.
- [x] Alla 175 `*.test.mjs`-filer passerade med exit 0. Den kostnadsfria ämnesroutningsevalen passerade, migrationstestaren rapporterade 39 migrationer/36 rollbackfiler, och `git diff --check` passerade.
- [x] Oberoende granskning körde 54 riktade P.E.R.-provskydds-/streaming- och pedagogiktester utan fel. Den bekräftar lokal testtäckning, inte live-modellsvar.
- [ ] P.E.R. saknar ännu separat eval för faktiska handledningssvar (matte/graf, materialförankring, otillräckligt underlag och naturlig svenska). Detta är en testlucka, inte en verifierad svarsbugg.
- [ ] Staginginloggning är fortfarande blockerad. Användaren känner inte till kontots aktuella lösenord; lösenord som skrivits i chatten ska inte återanvändas. Sätt ett nytt unikt lösenord direkt i stagingens Supabase Dashboard.
- [ ] Lokala grading-/SQL-kandidater inklusive den verifierade-avbrytning-fixen är ocommittade och oapplicerade. Ingen tvåsessions-PostgreSQL/PostgREST- eller hosted migrationsverifiering har gjorts.

**PILOT NOT READY.** Mattepedagogikens kursdetektion är lokalt förbättrad och offline-testad, men ändringen är inte deployad. Liveinloggning, riktad P.E.R.-chat-eval, stagingcutover och syntetiska end-to-end-prov återstår.

## Preview-uppdatering och rättningsgranskning — 2026-10-20

- [x] Commit `cf1b158574aa73c34a743e69ab73a026d92b6d0b` pushad till `codex/exgen-school-pilot-review-2026-10-13`; Vercel Preview `dpl_7oDsx2zdmWfJj4XQCjSdSR71MwbS` nådde `READY` från exakt denna SHA. Preview: `https://provia-29s5kgh0b-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [x] P.E.R använder även kurskontext för mattestöd, ger metodspecifik handledning för linje- och punktdiagram och uttryckligen avstår från att hitta på osynliga grafdata. Klientens frågetyp/grafmodus allowlistas; okända eller motstridiga modus ger neutral vägledning. Otestade/fientliga datagränser escaped innan studentkontext förs in i systemprompten.
- [x] Full lokal offline-svit passerade 175 `*.test.mjs`-filer, exit 0. Riktad rättningssvit passerade 8/8 filer; aktivt provskydd, efterprovsgranskning och front-end provkontext passerade 60/60 tester. Syntax- och diffkontroller passerade. Endast lokala/mokade tester, inte live-modellbevis.
- [x] Oberoende backendgranskning fann ingen reproducerad API-logikbugg. Oberoende migrationsgranskning bekräftade att API och schema måste skiftas samordnat: annars svarar rättning fail-closed tills nya RPC:er finns. Fencing är ännu inte verifierad med två oberoende PostgreSQL-sessioner; PGlite-testet är sekventiellt. Rollbackskripten är avsiktliga stoppvakter, inte schemaåterställningar.
- [x] Färsk skrivskyddad stagingfråga bekräftade att de befintliga claim/release-RPC:erna fortfarande har tre argument och persist-RPC:n tio; lokal kandidat kräver `p_claim_id`. Ingen stagingmigration eller Auth-ändring gjordes.
- [ ] Ingen autentiserad Preview-session eller syntetisk livegenerering, P.E.R., rättning och persistens har verifierats. Användaren behöver sätta ett nytt lösenord direkt i stagingens Supabase Dashboard och logga in i Preview. Lösenordet som skrevs i chatten ska inte återanvändas.
- [ ] Rättnings-API-/migrationskandidaterna är fortfarande ocommittade och oapplicerade; skicka dem inte separat. Före staging-cutover behövs en uttrycklig stagingsekvens, godkänd ändring, tvåsessions-/PostgREST-bevis och verifierad framåtriktad återhämtningsplan.

**PILOT NOT READY.** P.E.R-/generatorförbättringarna är deployade till Preview, men liveflöden återstår. Rättningskandidaten kan inte driftsättas mot nuvarande stagingkontrakt separat från migrationen.

## Färsk stagingkatalog och lokal tillgänglighet — 2026-10-20

- [x] XelioV:s aktiva projektmappning verifierad igen för denna worktree: ExGen `c3af48b2-20c3-4d33-a5e0-72aa001a1637`. Branch-remote och isolerad checkout står på `583afe9`; inga andra/orena worktrees ändrades.
- [x] Supabase staging `exgen-pilot-staging` är `ACTIVE_HEALTHY`, PostgreSQL 17.11. Skrivskyddad katalogläsning bekräftade att `exam_issuances` har den äldre paritetskontrollen för `grading_started_at`/`answer_fingerprint`, saknar `grading_claim_id`, och att `mock_results` har unik indexering på `(user_id, submission_id)`. Claim/release är fortsatt 3-arguments RPC och persist är 10 argument. Funktionerna är `SECURITY INVOKER` med tom `search_path`; inga rader eller Auth-identiteter lästes.
- [x] Officiell Supabase/PostgREST-feldokumentation beskriver `PGRST202` vid inaktuell/okänd RPC-signatur och `PGRST203` för vissa tvetydiga överlagrade RPC-anrop. Det förstärker behovet av att efter varje godkänd stagingmigration verifiera faktisk PostgREST-dispatch, inte bara SQL-funktionsmetadata: https://supabase.com/docs/guides/api/rest/postgrest-error-codes.
- [x] Färsk `npm run a11y-audit` passerade utan axe- eller konsolfel på index, pricing, app, konto, förbättring, lärare, admin och integritetspolicy; mobilkontrollen vid 390 px hade ingen horisontell overflow. Detta är automatiserad DOM-audit, inte manuell skärmläsar- eller helappstestning.
- [ ] Supabase create-user-formuläret är fortfarande öppet med tomt lösenordsfält och förvalt “Auto confirm user?”; kontot är inte skapat. Användaren behöver själv ange ett nytt unikt lösenord direkt i Supabase och därefter verifiera inloggning i aktuell Preview. Chattexponerat lösenord ska inte återanvändas.
- [ ] Ingen stagingmigration eller live-AI-/rättningskörning genomfördes. Den lokala claim-fencing-kandidaten kräver en samordnad stagingcutover och verklig PostgREST- samt tvåsessions-PostgreSQL-verifiering. `main`, Production, stagingrader, roller och kvoter lämnades orörda.

**PILOT NOT READY.** Den färska katalogen bekräftar att migrationens basobjekt finns, men det nya claim-token-kontraktet, Auth-sessionen och syntetisk live E2E är ännu inte verifierade.

## Reparation efter verifieringsavslag — 2026-10-20

- [x] Oberoende granskning hittade ett fyrfrågegränsfall: en underkänd fråga (25 % av fyra) låg under den tidigare reparationströskeln, eftersom triggern räknade genererade frågor i stället för godkända frågor. Provet föll då igenom som ofullständigt trots att en begränsad ersättningsrunda kunde köras.
- [x] Reparation triggas nu när antalet modellgodkända frågor understiger begärt antal. En regression begär fyra frågor, underkänner en och verifierar att ersättningsfrågan granskas, att exakt fyra frågor levereras och att den underkända frågan inte återkommer.
- [x] Det nya testet och hela offline-sviten passerade: `node --test --test-concurrency=4 --test-reporter=dot $(rg --files -g '*.test.mjs')`, 175 testfiler, exit 0. JavaScript-syntax och `git diff --check` passerade. Detta är mockad/offline-evidens, inte live-modellkvalitet.
- [ ] Oberoende granskning bekräftar att nonsensalternativ kan fortfarande passera om både modellbaserad verifierare och lösare felbedömer dem; de kan som standard använda samma modell. Generell nonsensdetektion är därför inte deterministiskt garanterad och måste verifieras mot liveprovider/material.
- [ ] Reparationen är fortfarande ett enda tidsbegränsat försök med högst sex kandidater. Större luckor i långa prov kan därför ge ett tydligt ofullständighetsfel i stället för ett komplett prov; detta ska inte kringgås genom att leverera frågor som inte godkänts.
- [ ] Fresh branchkontroll visar att HEAD och remote är `161b6b0`; Vercel Preview `dpl_6hWtDERiuLDkrnLiAZ115fr28fmS` är `READY` från exakt den SHA. Koden för denna regressionsfix är ännu inte pushad i denna kontroll.
- [ ] Ingen autentiserad staging-session eller syntetiskt liveprov har verifierats. Staginglösenord ska sättas direkt i Supabase Dashboard och får inte återanvändas efter att ha delats i chatten.
- [ ] Rättnings-API-/SQL-kandidaterna är fortsatt lokala och ocommittade: stagingens RPC-kontrakt är äldre, PGlite ersätter inte två sessionsbaserade PostgreSQL- och PostgREST-tester, och en samordnad staging-cutover kräver separat godkännande.

**PILOT NOT READY.** Reparationsgränsfallet är lokalt fixat och testat. Stagingautentisering, livegenerering/P.E.R./rättning/sparning och säker verifiering av databas-cutovern återstår.

## Tydligare genereringsfel — 2026-10-20

- [x] Lokalisering visar att aktiv P.E.R-ledd provvy redan bevarar API:ts detaljerade `incomplete_exam`-meddelande. Den tidigare generiska texten kan komma från en annan stoppväg; utan färska runtime-loggar är den historiska felorsaken inte fastställd.
- [x] Tomma, felräknade eller osäkra provutkast returnerar nu ett konkret svenskt/engelskt fel i stället för den generiska completion-texten. Den breda API-felvägen säger också att ett tekniskt fel stoppade försöket, och klienten använder serverns lokaliserade meddelande i stället för att hårdkoda en generisk text. Korrelation-ID och tillåten fas visas fortsatt utan rå intern kod.
- [x] Full offline-svit passerade med exit 0 före denna feltextändring. Efter ändringen passerade de tre berörda testfilerna: API-pipeline, browserflöde med 175 kontroller och antal-frågor-regression. `node --check` och `git diff --check` verifieras före commit.
- [ ] Den exakta historiska felorsaken är ännu inte verifierad mot nya Preview-loggar; ändringen förbättrar felvägen men är inte ett bevis på att provgenereringens ursprungliga runtimefel är löst.
- [ ] Den browserflik som senast var aktiv visar deployment `dpl_BoJxsyD8NhEtr5RpowYSSWSh6gMN`, commit `e7d8f43`, inte aktuellaste ExGen-previewn. Senaste verifierade Preview före denna kodändring var `d836350`; öppna och testa endast den nya deploymenten efter dess READY-status.
- [ ] Stagingkontot är fortfarande inte autentiserat. Chattexponerat lösenord får inte återanvändas; ange ett nytt lösenord direkt i stagingens Supabase Dashboard. Inga liveanrop, stagingändringar eller produktionsåtgärder har gjorts.

**PILOT NOT READY.** Felmeddelandena är tydligare och lokalt testade. Historiskt runtimefel, autentiserad staging-E2E och grading-databascutover återstår.

## Preview och lokala regressioner — 2026-10-20 (commit `a951cb7`)

- [x] Aktuell branch i isolerad worktree är `codex/exgen-generation-quality-2026-10-20`; HEAD och godkänd feature-remote pekar på `a951cb7` (`fix(exams): align verifier target difficulty`). Orelaterade lokala grading-/migrationsändringar är lämnade orörda och ingår inte i commiten.
- [x] Vercel Preview `https://provia-f0p2ydn11-eltons-projects-4adfb1a3.vercel.app` nådde `READY` från exakt SHA `a951cb742afb9385ac6434c96188a3e4457654cd`. Autentiserad, redigerad runtimekontroll bekräftade `environment=pilot`, stagingref `yhcinqejsocpmmetazpz` och appOrigin på stabil branch-alias. Nyckelvärden lästes inte ut eller dokumenterades.
- [x] Riktade provgenererings-/verifierar-/solver-tester passerade 7/7 testfiler. Separata tester för completion-proof, rättning, recovery, P.E.R.-provskydd och klientåterhämtning passerade 70/70 kontroller. Dessa är lokala/mokade tester, inte live-modell- eller databasbevis.
- [x] Hela aktuella offline-sviten passerade: `node --test --test-concurrency=4 --test-reporter=dot $(rg --files tests -g '*.test.mjs')`, 176 testfiler, exit 0; `git diff --check` passerade. Körningen omfattade den orena worktreen, inklusive ocommittade grading-/migrationskandidater. Det bevisar inte att de kandidaterna finns i Previewn eller fungerar mot hosted PostgreSQL.
- [x] P.E.R:s eval-gold-set klarade sin kostnadsfria strukturkontroll: 25 fall och obligatoriska svåra/negativa kategorier finns. Ingen modell-eval kördes; datasetvalideringen mäter inte svarskvalitet.
- [x] Fokuserad lokal verifiering av den ocommittade grading-kandidaten passerade 3/3 filer: PGlite-migrations-/claim-fencing, grading recovery/concurrency och verifierad exam-abandonment. PGlite ersätter inte två oberoende hosted PostgreSQL-sessioner eller PostgREST-dispatch; kandidatens API/SQL är inte i Preview.
- [x] Den nya Preview-adressen öppnades och visade inloggningsformuläret. Auth-sessionen från äldre Preview-origin följde inte med. Användaren ombads logga in själv; lösenord efterfrågades inte och ska inte skickas i chatten.
- [x] Branch-alias `https://provia-ai-git-codex-exgen-schoo-1725d7-eltons-projects-4adfb1a3.vercel.app/app.html` verifierades också som `environment=pilot` mot samma stagingref och är samma `appOrigin` som deploymenten anger. Den saknar också en återanvändbar webbläsarsession; den lämnades öppen vid inloggningsrutan för stabil fortsättning mellan branch-Preview-byggnader.
- [ ] Senaste verifierade livegenerering är fortfarande från den äldre Previewn `0d6c0e0`: ett syntetiskt trefrågeprov godkände endast 1 av 4 reparationskandidater och avvisades säkert. Diagnostiken visade modellbaserade kvalitetsavslag samt en solverflagga för flera korrekta alternativ. Prompt-/svårighetsändringen i `a951cb7` har ännu inte liveverifierats.
- [ ] Ingen ny livegenerering, P.E.R.-körning, rättning eller persistens har gjorts på `a951cb7`. Efter inloggning återstår ett begränsat syntetiskt prov; därefter P.E.R. utanför och under aktivt prov, verifierad rättning och kontroll av sparat resultat.
- [ ] De separata lokala grading-/SQL-kandidaterna är fortsatt ocommittade och oapplicerade. Ingen migration, `main`-merge, produktionsdeploy eller stagingdataborttagning har gjorts.

**PILOT NOT READY.** Aktuell kod är deployad till staging-Preview och offline-regressionerna passerar, men den nya generationen och hela autentiserade skolpilotflödet saknar livebevis. Nästa steg är användarens inloggning i den exakta Previewn ovan; dela inte lösenordet i chatten.

## Fortsatt offlineverifiering och Preview-session — 2026-10-20

- [x] Öppnade på nytt den verifierade branch-aliasen `https://provia-ai-git-codex-exgen-schoo-1725d7-eltons-projects-4adfb1a3.vercel.app/app.html`. Den visade först pilotens auth-gate och därefter inloggningsformuläret efter att Logga in valdes. Ingen inloggad session finns verifierad på denna origin just nu; en inloggad äldre Preview-origin är inte tillräckligt bevis.
- [x] Färsk riktad offlinekörning passerade 12 testfiler och 61 tester: generatorprompt, regenereringsbudget, verifierarkontrakt, solver, P.E.R. under prov, grading-claim fencing, recovery/concurrency och oavslutat prov. Dessa kördes lokalt med mockar/PGlite; de bevisar inte live-modellkvalitet eller hosted Postgres/PostgREST.
- [x] Försökte få en oberoende kodgranskning via tillgänglig agentfunktion; kapaciteten var full, så ingen agentgranskning genomfördes.
- [x] Read-only-katalogfråga mot staging `yhcinqejsocpmmetazpz` bekräftade att `claim_exam_grading` och `release_exam_grading` endast har äldre treargumentsignaturer och att `persist_graded_exam_result` saknar `p_claim_id`. Den lokala grading-kandidaten kräver det nya tokenkontraktet och kan därför inte deployas separat från en granskad, samordnad migration/cutover. Frågan läste endast RPC-metadata; inga rader eller scheman ändrades.
- [x] Färsk omkörning av lokala grading-candidate-tester passerade 4/4 filer: claim contract, PGlite migration/fencing, recovery/concurrency och verifierad abandonment. En Node module-type performance warning visades, men inga testfel. Detta ersätter inte hosted concurrency eller PostgREST-bevis.
- [x] Vercel-listning bekräftade aktuell Preview-deploy `dpl_F5Mp99836UjxBV9r8e49iiqa4HQ3` som `READY` från SHA `a951cb742afb9385ac6434c96188a3e4457654cd`. Aggregerad funktionsfelkontroll för senaste 30 minuterna gav noll poster. Hobby-loggretentionen är en timme; detta varken verifierar liveflödet eller förklarar det äldre 502-felet.
- [ ] Ingen syntetisk livegenerering eller P.E.R.-/rättning-/persistenskörning gjordes. Fortsätt först när användaren själv loggat in på branch-aliasen och startsidan visas.

**PILOT NOT READY.** Den riktade offlinekedjan passerar, men ny livekvalitet och autentiserad end-to-end-verifiering återstår. Ingen credential hanterades, ingen stagingdata ändrades och ingen produktionsåtgärd gjordes.

## Fortsatt verifiering — aktuell Preview och lokala kvalitetsgrindar — 2026-10-20

- [x] XelioV:s aktiva projektmappning verifierades: ExGen `c3af48b2-20c3-4d33-a5e0-72aa001a1637` pekar på pilot-worktreen `/private/tmp/provia-ai-pilot-feature-20261019`. Worktree HEAD är `461169b`; lokala grading-/migrationsändringar är kvar orörda.
- [x] Färsk Vercel-läsning visar Preview `dpl_4NLCLi7TPskwd83azswNm4YvnjsF` som `READY` på `codex/exgen-school-pilot-review-2026-10-13`, commit `9bbf4b8f767e36f2cb7b07d4b7b0e61f7a93d0f6`. Vercel CLI bekräftade att pilotvariablerna är branch-scope:ade, men värdena är krypterade. MCP-läsning av env-metadata nekades med 403; därför är exakt runtime-destination inte bevisad av denna kontroll.
- [x] Exakt aktuell deployment öppnades i webbläsaren och visar `SKOLPILOT · LOGGA IN`. Ingen inloggad session har verifierats. Inloggning behöver göras av användaren; lösenord ska inte skickas i chatten.
- [x] Lokal browserregression passerade 177 kontroller, 0 fel (`node tests/frontend/exam-flow.regression.mjs`). Exam-quality delivery-test passerade 4/4 och gratis ämnesroutningseval passerade alla fixture- och motexempel.
- [ ] Generell nonsensdetektion är fortfarande inte deterministiskt garanterad: ordformatsavvikelsen skickas som granskningssignal och verifieraren/lösaren avgör. Offline-fixturer testar mockade `false`-bedömningar; de visar inte att live-modellen kommer känna igen ett nytt felord i biologifrågor.
- [ ] Inget autentiserat liveprov, P.E.R-samtal, rättning eller resultatsparning har körts på deploymenten. Stagingkopplingen ska bekräftas genom den syntetiska staginginloggningen innan liveanrop.
- [ ] Ocommittade grading-/SQL-kandidater ingår inte i deploymenten och är inte pushade eller applicerade. Ingen stagingdata, kvot, roll, `main` eller Production ändrades.

**PILOT NOT READY.** Lokala regressioner är gröna och rätt Preview är öppen, men autentiserad staging-E2E och livekvalitet återstår. Separat specialistagent kunde inte startas eftersom agentkapaciteten var full.

## Fortsatt verifiering — syntetiskt Preview-flöde — 2026-10-20

- [x] XelioV:s aktiva ExGen-mappning verifierades på nytt och pekar på detta worktree. En specialistagentgranskning kunde inte startas eftersom agentkapaciteten var full; ingen agentinsats påstås.
- [x] Vercel läs-API bekräftade att branch-aliasen `provia-ai-git-codex-exgen-schoo-1725d7-eltons-projects-4adfb1a3.vercel.app` pekar på `dpl_4NLCLi7TPskwd83azswNm4YvnjsF`, `READY`, branch `codex/exgen-school-pilot-review-2026-10-13`, SHA `9bbf4b8f767e36f2cb7b07d4b7b0e61f7a93d0f6`. Den aktuella runtimefilens Supabase-projektref kunde inte läsas i denna kontroll; behandla därför inte refen som nyverifierad.
- [x] Med den redan inloggade Preview-sessionen genererades ett syntetiskt trefrågeprov i Matematik 2b om linjära funktioner. Alla tre frågor var relevanta och begripliga; de granskade flervalsalternativen innehöll inget uppenbart nonsens.
- [x] P.E.R svarade under aktivt prov på en ledtrådsfråga och en direkt begäran om facit utan att avslöja svaret. Facitknappen var inaktiverad tills inlämning. Ledtråden var dock generisk och inte tillräckligt anpassad till uppgiften.
- [x] Provets syntetiska svar rättades först med HTTP 502; UI:t behöll svaren. Ett manuellt engångsåterförsök gav 7/7. Efter navigering visade kontosidan ett poängsatt prov, vilket stödjer att resultatet sparades. Ingen andra provgenerering gjordes.
- [ ] Vercel-loggar för deploymenten visade ingen `/api/grade`-stacktrace eller rotorsak; endast varningar för `/api/abandon-exam` syntes. 502-problemet är alltså reproducerat, men inte förklarat eller löst.
- [ ] Efter sidbyte från resultatsidan till kontosidan och tillbaka visade `app.html` inloggningsgrinden, trots att kontosidan visade kontohistoriken. Det exakta Auth-/sessionsfelet är inte fastställt; appens sidnavigering kräver fortsatt undersökning.
- [ ] Liveprovningen styrker inte att aktuell runtime pekar på exakt stagingref eftersom runtimekonfigurationen inte kunde hämtas direkt. Inget har pushats, deployats, applicerats i databas, ändrats i produktion eller raderats.
- [x] Riktade lokala tester för rättningsfencing/abandonment passerade 5/5. Hela sviten `node --test --test-concurrency=4 --test-reporter=dot $(rg --files tests -g '*.test.mjs')` avslutades med exit 0 över 176 testfiler. `git diff --check`, `node --check api/grade.js` och `node --check api/_exam-issuance.cjs` passerade. Detta är lokala/PGlite-tester, inte hosted PostgreSQL- eller runtimebevis.

**PILOT NOT READY.** Ett syntetiskt prov kunde genereras, P.E.R höll facitskyddet och rättningen lyckades på återförsök. Kvar är 502-rotorsak, Auth-persistens över sidbyte, färsk verifiering av exakt stagingref, separat granskning/applicering av lokala SQL-kandidater samt skolans operativa godkännanden.

## Fortsatt pilotfelsökning — livegrundorsak och avgränsad reparation — 2026-10-20 15:30 UTC

- [x] XelioV:s aktiva ExGen-mappning pekar fortsatt på `/private/tmp/provia-ai-pilot-feature-20261019`; arbetsgrenen är `codex/exgen-generation-quality-2026-10-20`. Ingen annan arbetsyta ändrades. Specialistagenter kunde inte startas eftersom agentkapaciteten var full.
- [x] Vercel aliasläsning visar att stabila branch-aliasen pekar på `dpl_4NLCLi7TPskwd83azswNm4YvnjsF`, `READY`, SHA `9bbf4b8f767e36f2cb7b07d4b7b0e61f7a93d0f6`. En separat Vercel-listning visar nyare deployment `a951cb7` på samma branch, men stabila aliasen har inte flyttats till den. Livebeviset nedan gäller alltså den äldre aliasdeploymenten. Browsern visar pilotläge; exakt server-side Supabase-ref kunde inte läsas i denna kontroll.
- [x] Den redan aktiva Preview-sessionen kunde återanvändas utan lösenord: `konto.html` visade det syntetiska kontots poängsatta historik; navigering till `app.html` visade först auth-gaten och låstes sedan upp när sessions-/profilkontrollen blev klar. Det pekar på ett tillfälligt startläge, inte bevis på felaktigt lösenord. Inga uppgifter eller tokens lästes ut.
- [x] Ett syntetiskt P.E.R.-samtal utanför prov gav en relevant, ämnesspecifik ledtråd om energi och näringsämnen samt en följdfråga. Vercel loggade samtidigt `ai_usage_event_write_failed` med `count: 1`; P.E.R.-svaret kom fram, men orsaken till att användningshändelsen inte skrevs är okänd.
- [x] Ett trefrågeprov i Biologi 1 med syntetiskt material avvisades säkert med `incomplete_exam` (HTTP 502); inget delprov lämnades ut. Exakt Preview-telemetri: alla tre första kandidater föll på `source_reference_missing`; den strukturella reparationen gav fyra kandidater; den oberoende granskningen godkände två av tre; slutresultatet hade två av tre godkända frågor. Ingen verifierardriven reparation kördes (`repairVerifierCallOk: null`). Detta förklarar just denna avvisning.
- [x] Rotorsaken i koden var att en gemensam `repairAttempted`-flagga räknade den strukturella kompletteringen som den enda tillåtna kvalitetsreparationen. API:t stoppade därför efter att en kandidat underkändes, trots tillräcklig återstående budget. Lokalt har stegen separerats: högst en strukturell komplettering och högst en verifierardriven kvalitetsreparation, båda fortfarande begränsade av befintlig tidsbudget. Kvalitetsgrinden är oförändrat fail-closed.
- [x] Ny regression reproducerar tvåstegsfelet och verifierar att underkända frågor aldrig levereras, att den andra reparationen kan fylla luckan och att totalt högst två avgränsade reparationsanrop görs. `exam-pipeline-offline.test.mjs`, regenereringsbudget och eval-leverans passerade 6/6; ämnesroutningens fixtures/motexempel, `node --check api/generate-exam.js` och `git diff --check` passerade.
- [x] Full offline-svit med fyra samtidiga testprocesser avslutades med en enda felande fil: `tests/frontend/app-auth-gate.test.mjs` (35,3 s). Samma fil passerade ensam (1/1, 22,5 s). Detta är förenligt med testresurskonkurrens men fastställer inte orsaken; fullsviten räknas därför inte som helt grön efter ändringen.
- [ ] Den lokala ändringen är ännu inte deployad. Den aktiva aliasdeploymenten innehåller inte fixen; krävs en separat åtgärdsgodkänd push och Preview innan samma syntetiska Biologi-test kan bekräfta effekten live.
- [ ] Denna körning bekräftar Vercel Preview-branch och pilotgränssnitt, men kunde inte nyverifiera exakt Supabase-ref från aktiva servermiljövariabler. Gradera inte stagingisolering som fullt verifierad enbart utifrån UI:t.
- [ ] Denna ändring löser inte det tidigare rättnings-API:ets HTTP 502 som lyckades på återförsök. Den körningen saknar fortfarande rotorsak. P.E.R.-användningsloggens misslyckade skrivning behöver också felsökas; inget provider-/serverfel i P.E.R.-svaret observerades.
- [ ] Ingen Preview-push/deploy, Supabase-migration, `main`-merge, Production-åtgärd, kontokvot-/rolländring eller stagingdata-radering utfördes. Skolans godkännanden för elevdata, retention, läraråtkomst, support och incidentflöde kvarstår.

**PILOT NOT READY.** En konkret rotorsak bakom den aktuella trefrågeavvisningen är nu rättad lokalt och täckt offline. Livebekräftelse kräver Preview från den ändrade grenen; stagingref, grading-502, AI-användningsloggning och skolans operativa grindar återstår.

## Fortsatt liveverifiering — ny kvalitetsreparation och P.E.R. — 2026-10-20 15:50 UTC

- [x] Efter uttryckligt godkännande flyttades den stabila Preview-aliasen till deployment `dpl_6KtS422CdUHwWBzC3DCTYz5hPRG9`, READY från commit `8e8abe695a6ac285d88ad427b7061dc61c5dc628` på `codex/exgen-generation-quality-2026-10-20`. Aliasen är fortsatt Preview; `exgen.se` och Production ändrades inte. Runtimekonfigurationen via aliasen visade pilotläge, stagingref `yhcinqejsocpmmetazpz` och samma origin som `appOrigin`.
- [x] Ett syntetiskt Biologi 1-prov med blandade frågor startades. Kvalitetsreparationen kördes efter den första granskningen, men endast två av tre slutfrågor klarade oberoende verifiering och solverkontroll. Loggen visar 7 verifierade frågor, 2 godkända, 5 avvisade, varav två reparationskandidater avvisades på alternativkvalitet och en solvermarkerades för flera korrekta alternativ. API:t lämnade inte ut något delprov. Detta är en faktisk återstående kapacitets-/kvalitetsbrist, inte ett lyckat provflöde.
- [x] Ett separat syntetiskt P.E.R.-meddelande utanför aktivt prov fick svar i staging. Svaret gav en biologispecifik ledtråd om syrets roll och ställde en vägledande följdfråga utan att börja med facit.
- [x] Ett andra syntetiskt provförsök stoppades före generering: Vercel loggade `exam_auth_rejected` vid `auth_user_lookup` utan HTTP-status. Koden loggar detta när Supabase Auth-fetch kastar i stället för att returnera ett HTTP-fel; transport-/timeoutorsak är sannolik men inte bevisad. Staging-unified-logs-frågan i exakt tidsfönster visade endast `pgbouncer_logs`, så rotorsaken är inte fastställd.
- [x] Hela offline-sviten `node --test --test-concurrency=1 --test-reporter=dot $(rg --files tests -g '*.test.mjs')` avslutades med exit 0. Ingen kod ändrades i denna uppföljning.
- [ ] Kvalitetsreparationen har fortfarande inte visat att ett liveprov med begärt antal frågor kan färdigställas. Förbättra kandidatkvalitet utan att försvaga verifierare/solver; täck realistiskt blandat och kortsvarsflöde med regressionsfall innan ny begränsad livekörning.
- [ ] Auth-fetch-felet behöver bättre säker, aggregerad diagnostik och en reproducerbar stagingkontroll. Logga aldrig token, nyckel, e-post eller rått användarmaterial. Inga ytterligare liveanrop gjordes efter auth-avvisningen.
- [ ] Rättning, P.E.R. under aktivt prov/facitskydd, sparat resultat, RLS/tvakonto-isolering, hosted PostgreSQL-gradering, rollback och skolans operativa godkännanden är fortfarande overifierade.

**PILOT NOT READY.** Preview-aliasen och staging-runtimekonfigurationen är verifierade. P.E.R. svarade på ett syntetiskt fristående meddelande, men liveprovskapandet föll en gång på kvalitetsgrinden och nästa försök fastnade på Auth-fetch. Full offline-svit är grön; autentiserad end-to-end, rättning/sparning och skolans säkerhets-/driftgodkännanden återstår.

## Lokal förbättring efter livefynd — 2026-10-20

- [x] Källkontroll av `js/exam-flow.js` bekräftade att klienten skickar `qType: "mix"`. Kvalitetsreparationen gav tidigare inget exakt antal per frågetyp; live-loggen visade fyra flervalskandidater och noll kortsvarskandidater. Reparationsprompten anger nu en exakt, balanserad kandidatfördelning för `mix` (udda antal får en extra kortsvarskandidat). Ingen kvalitetsgrind har försvagats.
- [x] Auth-fetch-undantag loggar nu endast en allowlistad felklass, ett allowlistat nätverkskodfält och timeoutindikator. Rått felmeddelande, stack, token och användarinnehåll loggas inte. Auth-svaret fortsätter fail-closed som 401.
- [x] Regressionsfall täcker den verkliga klienttypen `mix`, svensk och engelsk kandidatfördelning, timeout-/nätverksklassificering samt att privata sentinel-strängar inte når loggen.
- [x] Riktade tester: provpipeline, regenereringsbudget, verifierarkontrakt och assessment-core passerade; `node --check` för generator och testfil samt `git diff --check` passerade. Hela offline-sviten `node --test --test-concurrency=1 --test-reporter=dot $(rg --files tests -g '*.test.mjs')` avslutades med exit 0.
- [ ] Ändringen är lokal och ännu inte deployad eller liveverifierad. Push/ny Preview kräver separat åtgärdsgodkännande; efter ny READY-kontroll ska högst ett syntetiskt blandat prov användas för att se om reparationen ger både MC och kortsvar och klarar oförändrade verifierar-/solvergrindar.
- [ ] Auth-diagnostiken är endast en säker felklassificering. Den fastställer inte orsaken till det tidigare stagingfelet förrän en ny kontrollerad körning visar till exempel timeout eller allowlistad nätverkskod.

**PILOT NOT READY.** De två lokala regressionerna är täckta och hela offline-sviten är grön. Liveprov, Auth-transportdiagnos, rättning/sparning, provskydd och skolans operativa godkännanden återstår.

## Fortsatt stagingtest — auth återställd, mixed-prov fail-closed — 2026-10-20 16:07 UTC

- [x] Pushade endast de godkända commitsen `42fcbb1` och `8a064dc` till den befintliga feature-branchen. Vercel Preview `dpl_AuuTBRpznpHnFW74GNyF1MSN2SEx` nådde `READY` på exakt SHA `8a064dc16d707f4486fdd6bb1911cebebb3b2c86`; den godkända stabila Preview-aliasen verifierades därefter mot samma deployment. Ingen `main`-merge, Production- eller databasändring gjordes.
- [x] Den befintliga stagingwebbläsarsessionen återställdes efter omladdning: appen visade kontots välkomstvy och upplåst studieyta. En avgränsad syntetisk Biologi 1-begäran med blandade frågetyper nådde generator och oberoende granskning; inga riktiga elevuppgifter användes.
- [x] Trefrågeprovet stoppades fail-closed med `incomplete_exam`/HTTP 502 och inget delprov lämnades ut. Säker Vercel-diagnostik för samma begäran visade 2/3 initialt godkända; kvalitetsreparationen returnerade två kandidater, den deterministiska grinden behöll en och den oberoende verifieraren godkände 0/1. Solvergrinden avvisade inga frågor. Reparationen hade alltså för litet användbart kandidatunderlag; detta var inte ett autentiserings- eller providertransportfel.
- [x] Den befintliga loggen summerade inte skälen till varför reparationskandidater föll i den deterministiska grinden. Lokalt begär kvalitets- och strukturell reparation nu ett bounded översampel (`2 × saknade platser + 2`, max 6), och den oförändrade kvalitetsgrinden måste fortfarande godkänna varje fråga. Innehållsfria, allowlistade räknare för reparationsgrindens avvisningar har lagts till; de loggar inte fråga, svar, material eller användaruppgifter.
- [x] Nya regressioner verifierar kandidatgränsen (4 kandidater för en lucka, högst 6), att osäkra kandidater fortsatt stoppas och att diagnostiken endast innehåller issue-koder/räknare. Riktade tester passerade 6/6 filer. Senaste fulla seriala svitkörningen hade en enda felande fil (`tests/frontend/app-auth-gate.test.mjs`); samma fil passerade isolerat direkt efteråt. Orsaken till avvikelsen är inte fastställd, så senaste fulla körningen räknas inte som helt grön.
- [ ] Den nya översamplingen och diagnostiken är ännu lokala och har inte deployats. Nästa livekontroll kräver separat push/Preview för den nya committen och därefter ett enda syntetiskt trefrågetest. Inget ytterligare AI-anrop gjordes efter den avvisade begäran.
- [ ] Rättning/sparning, P.E.R. under aktivt prov, sessionåterhämtning över sidbyte, RLS/IDOR, hosted PostgreSQL-gradering, rollback och skolans operativa godkännanden är fortsatt öppna pilotgrindar. Stagingkontot och dess testdata lämnades orörda.

**PILOT NOT READY.** Den senaste Previewn autentiserade och körde hela provflödet, men den levererade inte tre verifierade frågor. En lokal bounded-oversampling-fix täcks av grön full offline-svit; den måste först deployas och liveverifieras innan den kan räknas som åtgärdad.

## Lokal deterministisk spärr för misstänkta svarsalternativ — 2026-10-20 16:31 UTC

- [x] Den tidigare spärren gjorde ett ensamt längre ord bland frasalternativ till en granskningshint. Livefyndet `Kesäkten` visar att modellgranskare kan godkänna ett sådant nonsensord. Svenska genererade flervalsprov stoppar nu deterministiskt just denna formatavvikelse när ett fristående distraktorord inte har exakt eller tydligt böjningsstöd i det inskickade materialet. Kandidaten stoppas före både verifierare och blind lösare; bounded-repair och befintliga kvalitetsgrindar är oförändrade.
- [x] Källförankrade ensamma fackord kan fortfarande gå vidare till oberoende granskning. Ett ensamt korrekt svar som kan vara ett egennamn blockeras inte av denna källstödsregel. Engelska prov och språkprov där enstaka ord är avsiktliga glosor använder inte denna svenska formatregel.
- [x] Regression täcker `Kesäkten`, källförankrad böjning (`Kloroplast`/`kloroplasterna`), verifierar-/solvergränsen samt befintliga ämnes- och mattekontrakt. Hela API- och assessment-sviten passerade sekventiellt: 171/171. `node --check` för ändrade JS-filer och `git diff --check` passerade.
- [ ] Regeln är en avgränsad källstödsheuristik, inte en svensk stavningsordlista. Ett giltigt fristående egennamn eller fackord som inte förekommer i elevens material kan nekas och göra att reparationen behöver ersätta frågan.
- [ ] Ändringarna är lokala på `codex/exgen-generation-quality-2026-10-20`; commits `136b9d8` och `7ce13b2` är inte pushade eller Preview-verifierade. Separat pushgodkännande krävs för dessa commits. Ingen staging-/produktionsdata, miljövariabel, `main` eller alias har ändrats.
- [ ] Oberoende specialistagent kunde inte startas eftersom agentkapaciteten var full. Granskning och sammanslagning gjordes av huvudagenten; den separata agent-QA:n är kvar.

**PILOT NOT READY.** Den kända formen av osourcat ensamt nonsensord stoppas nu deterministiskt i lokal kod, men den nya regeln och bounded-oversampling-fixen behöver Preview och ett fåtal syntetiska stagingprov innan liveeffekt kan bekräftas. Rättning/sparning, P.E.R. under aktivt prov, RLS/IDOR, hosted PostgreSQL-gradering och skolans operativa godkännanden kvarstår.
