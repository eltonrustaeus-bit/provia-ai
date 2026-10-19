# ExGen: checklista for skolpilot

## Senaste verifiering — 2026-10-19

- Aktiv XelioV-mappning aterbekraftad for pilot-worktree `/private/tmp/provia-ai-pilot-feature-20261019` och ExGen-projekt `c3af48b2-20c3-4d33-a5e0-72aa001a1637`.
- Pilotgrenens HEAD och remote branch ar bada `09cf3a1` (docs/test-only uppfoljning). Vercel Preview `dpl_GBWUNs1ecKhh9VkMykL9E4JP8egS` ar READY fran app-commiten `d90322f`, `target=null`; den ar inte Production. Preview-URL: `https://provia-4qgnxsjxr-eltons-projects-4adfb1a3.vercel.app/app.html`.
- Den nya Previewn oppnas korrekt men visar inloggningsgrinden i en ny session. Inloggnings- och aterstallningsvyn laddar. Runtimefilen och `/aterstall.html` returnerar HTTP 200; återställningssidans titel är `Återställ lösenord – ExGen`.
- Vercel deploymentens publika `js/exgen-runtime.js` verifierades utan att skriva ut nyckelvardet: `environment=pilot` och `projectRef=yhcinqejsocpmmetazpz`. Den innehaller en stabil branch-origin for appen. Branch-scope finns for Preview-variablerna, men Vercel vagrade lasa metadata via anslutningen och CLI visar alla varden krypterade; serverns krypterade `SUPABASE_URL` ar darfor inte separat verifierad.
- Read-only kontroll i Supabase bekraftar att det godkanda stagingkontot finns, ar e-postbekraftat och har minst en tidigare lyckad inloggning. Kontot skapades med `Auto confirm user`, sa skapandet skickade inget bekraftelsemejl. Inget mejl ska forvantas fran just den atgarden; ett separat aterstallningsmejl ar annu inte verifierat mottaget.
- Supabase Auth visar att custom SMTP ar avstangt i staging, sa standardutskicket anvands. Supabases dokumentation anger att standardprovidern endast levererar till teamets forhandsgodkanda adresser och saknar leverans-SLA; detta ar en trolig forklaring till det uteblivna mejlet, men mottagarens teamstatus och faktisk leverans ar inte verifierade.
- En read-only Auth-loggkontroll visar en `/recover`-begaran med status `200` den 19 oktober. Det bevisar att Auth accepterade begaran, inte att mejlet levererades eller hamnade i inkorgen. Ingen ny aterstallning har skickats av Codex. Supabase Auth URL Configuration visade tidigare Site URL `http://localhost:3000` och tom Redirect URLs-lista. Commit `d90322f` anvander den stabila `EXGEN_PILOT_APP_ORIGIN`; runtimefilen livebekraftar stagingprojektet och denna origin. Supabase-allowlisten ar annu inte uppdaterad eller nykontrollerad.
- Tidigare livebevis kvarstar men galler aldre Preview-versioner: syntetiskt P.E.R-samtal fungerade; ett 3-frageprov stoppades ofullstandigt; ett 2-frageprov kunde rattas till 5/5 efter ett forsta 502-forsok. Ett nonsensalternativ observerades tidigare, vilket motiverade den nu testade solver-grinden. Det ar inte ny liveverifiering av `38ce282`.
- Diagnostikcommiten loggar nu verifierarens avslag som `option_quality_failed` eller `option_quality_contract_failed` i stallet for att blanda ihop dem med generella granskarfel. Den ar deployad pa Preview; livefelorsak fran nya deploymenten ar inte verifierad.
- Vercels runtime-logg-API kunde inte hamta den historiska perioden: projektets plan behaller inte runtime-loggar sa langt tillbaka. Det ar en loggtillgangsbegransning, inte belagg for att inga anrop skett.
- Ingen stagingdata eller konto har raderats. Ingen Production- eller `main`-andring har gjorts.

**PILOT NOT READY.** Full offline-svit passerade 299/299 pa commit `d90322f`, och Previewn ar READY fran exakt den SHA:n. Klientruntime pekar pa godkant staging; API-serverns krypterade `SUPABASE_URL` ar inte separat verifierad. Kontots skapande skickade inget mejl pa grund av `Auto confirm user`. En senare `/recover`-begaran fick HTTP 200, men ingen leveransbekraftelse finns. Standard-SMTP kan bara skicka till teamadresser och ingen custom SMTP ar konfigurerad; adressens behorighet ar okand. Supabase Redirect URLs-listan var tom vid senaste lasningen; den stabila Preview-origin maste tillatas innan resetflodet kan verifieras fran mejlet. Ingen Auth-/SMTP-konfiguration har andrats. Nar inloggning fungerar, gor hogst ett syntetiskt 3-frageprov; fortsatt bara om ett komplett prov godkanns med kvalitet. Verifiera darefter aktivt P.E.R-skydd, rattning och sparning. Ror inte testdata vid staddning utan separat godkannande.

## Lokal verifiering — 2026-10-19

- [x] Rattningsaterforsok efter ett syntetiskt provider-timeout verifierat i samma handlerflode: forsta forsoket sparar inget delresultat och slapper claimen; samma signerade inlamning kan sedan rattas och sparas exakt en gang. Detta visar kodens kontrollerade timeout-/retrybeteende, inte orsaken till det tidigare live-502:et.
- [x] De tre fokuserade rattningstesterna passerade 3/3 efter regressionsandringen. Tidigare fullsvitsforsok fick enstaka instabila browser-testfail, men den senaste fulla korningen passerade rent: 299 tester, 0 fail, 0 cancelled, 0 skipped (`node --test --test-concurrency=4 --test-reporter=spec $(rg --files tests -g '*.test.mjs')`, exit 0).
- [x] Pilot-public-entry browser regression passerade 23/23 efter callbackandringen; auth-first-run och auth-modal-focus passerade ocksa. Full offline-svit kor-des pa samma andrade kod och avslutades med exit 0, 299/299.
- [x] Det oavsiktligt skapade Vercel-projektet `provia-ai-pilot-feature-20261019` togs bort efter uttryckligt godkannande. Dashboarden visade ingen Production Deployment och inga miljovariabler; deployments-API:t visade noll deployments; efterat returnerade projekt-ID:t 404 `Project not found`.
- [x] Avgransad kodgranskning av provgenerering och P.E.R genomford i separat worktree baserad pa mergade `main`.
- [x] Provverifieraren granskar nu varje flervalsalternativs sprakliga begriplighet och amnesrelevans; saknad eller felaktig kvalitetsmetadata faller stangt.
- [x] P.E.R:s grundniva ger en kort, uppgiftsanpassad ledtrad utan facit for konkreta ovningar, men svarar direkt pa enkla begreppsfragor.
- [x] Riktade tester for verifieringskontrakt, provpipeline, P.E.R-pedagogik och grafflode har korsts.
- [x] Full offline-svit kor om pa commit `d90322f`; `node --test --test-concurrency=4 --test-reporter=dot $(rg --files tests -g '*.test.mjs')` avslutades med exit 0, 299/299.
- [x] Vercel Preview `dpl_GBWUNs1ecKhh9VkMykL9E4JP8egS` ar READY fran exakt branch/commit `d90322f`; target ar Preview och runtime-/aterstallningssidorna svarar HTTP 200.
- [ ] Staging-schema, Auth/Storage, provideranrop, RLS/tvakonto-isolering, provskapande, rattning, P.E.R och radering maste verifieras med syntetiska konton.
- [ ] Skolan maste godkanna elevdata, retention, lararatkomst, support/incidentflode och kriterier for pilotstart.

Data deletion gate: see `docs/codex/12_DATA_DELETION_GAP.md`.

**PILOT NOT READY.** Lokala tester och promptforbattringar bevisar inte att Preview, staging eller skolans processer fungerar live. Produktionsmiljo och riktiga elevdata har inte anvants eller andrats i denna genomgang.
