# ExGen: checklista for skolpilot

## Aktuell statuskontroll — 2026-10-19

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
