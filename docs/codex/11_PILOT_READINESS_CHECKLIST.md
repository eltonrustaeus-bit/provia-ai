# ExGen: checklista for skolpilot

## Senaste verifiering — 2026-10-19

- Aktiv XelioV-mappning verifierad for pilot-worktree `/private/tmp/provia-ai-pilot-feature-20261019` och ExGen-projekt `c3af48b2-20c3-4d33-a5e0-72aa001a1637`.
- Pilotgrenens HEAD ar `f1fca86` (`align exam review with selected level`). Vercel Preview `dpl_4LdfLoMvRy64DRQLLiZ6fzgnJNk6` ar READY fran exakt den committen; deployment ar Preview, inte Production.
- Full offline-svit passerade efter att generator- och verifierarprompten fick explicit E/C/A-kalibrering. Verifieraren far nu ocksa den valda nivan i bade forsta granskningen och reparationsgranskningen; troesklarna ar oforandrade.
- Ett vanligt, syntetiskt P.E.R-samtal fungerade i senaste Preview: kort ATP-forklaring och en relevant foljdfraga. Aktivt provskydd ar inte live-verifierat i denna session.
- Ett syntetiskt Biologi 1-prov med 3 fragor pa `f1fca86` stoppades korrekt i stallet for att visa ett ofullstandigt prov: 0/3 fragor godkandes forst och 1/4 vid reparation, sa slutresultatet blev 1/3. Niva-mismatch syntes inte bland avslagsorsakerna, men kallaanknytning, granskarbeslut och obligatoriska andringar aterstod. Losaren fangade ocksa ett orimligt alternativ. Nivakalibreringen hjalpte men rotorsaken till otillracklig kvalitet ar inte lost.
- En lokal, innehallsfri diagnostikforbattring skiljer nu `option_quality_failed` och `option_quality_contract_failed` fran generella granskartrösklar. Den ar offline-testad men annu inte deployad eller live-verifierad.
- Pa foregaende Preview-commit `5a78f90` stoppades syntetisk Biologi 1-generering bade med 3 fragor och den avgransade 2-frageretryn. For 3 fragor godkandes 0/3 initialt och 0/4 vid reparation; for 2 fragor godkandes 0/2 och 0/3. Inget prov kunde rattas eller anvandas for att verifiera sparning.
- Anvandaren rapporterade att inget konto-/aterstallningsmejl kom fram. Supabase Auth-anvandarlistan hade ett aktivt filter och visade inga matchningar; kontots existens/status ar darfor inte verifierad och ingen ny inbjudan eller aterstallning har skickats.
- Stagingkonto och syntetisk data lamnas ororda. Ingen Production- eller `main`-andring har gjorts.

**PILOT NOT READY.** Nasta steg ar att aterfa verifierad inloggning pa exakt staging-Preview och deploya den nya diagnostiken via befintlig feature-branch. Kor sedan endast ett avgransat syntetiskt 3-frageprov om testbudgeten medger det. Om ett komplett prov godkanns, verifiera aktivt P.E.R-skydd, rattning och att resultatet sparas. Gor inga fler liveprov innan stagingkontots tillgang ar klar.

## Lokal verifiering — 2026-10-19

- [x] Avgransad kodgranskning av provgenerering och P.E.R genomford i separat worktree baserad pa mergade `main`.
- [x] Provverifieraren granskar nu varje flervalsalternativs sprakliga begriplighet och amnesrelevans; saknad eller felaktig kvalitetsmetadata faller stangt.
- [x] P.E.R:s grundniva ger en kort, uppgiftsanpassad ledtrad utan facit for konkreta ovningar, men svarar direkt pa enkla begreppsfragor.
- [x] Riktade tester for verifieringskontrakt, provpipeline, P.E.R-pedagogik och grafflode har korsts.
- [x] Full offline-svit kor om efter fixture-/metadatafixarna och den nya verifierardiagnostiken; `node --test --test-concurrency=4 --test-reporter=dot ...` avslutades med exit 0.
- [x] Vercel Preview har nyverifierats: deployment `dpl_4LdfLoMvRy64DRQLLiZ6fzgnJNk6` ar READY fran exakt branch/commit `f1fca86`; requestloggen for det syntetiska provet bekraftade Preview-korningen. Grenens Preview-envnamn verifierades tidigare, men deploymentens faktiska Supabase-target och framat fortsatt isolering ar inte bevisade enbart av envnamn.
- [ ] Staging-schema, Auth/Storage, provideranrop, RLS/tvakonto-isolering, provskapande, rattning, P.E.R och radering maste verifieras med syntetiska konton.
- [ ] Skolan maste godkanna elevdata, retention, lararatkomst, support/incidentflode och kriterier for pilotstart.

Data deletion gate: see `docs/codex/12_DATA_DELETION_GAP.md`.

**PILOT NOT READY.** Lokala tester och promptforbattringar bevisar inte att Preview, staging eller skolans processer fungerar live. Produktionsmiljo och riktiga elevdata har inte anvants eller andrats i denna genomgang.
