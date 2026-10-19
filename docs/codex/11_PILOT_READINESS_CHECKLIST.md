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
