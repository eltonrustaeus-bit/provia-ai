# ExGen: checklista for skolpilot

## Lokal verifiering — 2026-10-19

- [x] Avgransad kodgranskning av provgenerering och P.E.R genomford i separat worktree baserad pa mergade `main`.
- [x] Provverifieraren granskar nu varje flervalsalternativs sprakliga begriplighet och amnesrelevans; saknad eller felaktig kvalitetsmetadata faller stangt.
- [x] P.E.R:s grundniva ger en kort, uppgiftsanpassad ledtrad utan facit for konkreta ovningar, men svarar direkt pa enkla begreppsfragor.
- [x] Riktade tester for verifieringskontrakt, provpipeline, P.E.R-pedagogik och grafflode har korsts.
- [ ] Full offline-svit maste koras om efter de sista fixture- och metadatafixarna; forsta breda korningen passerade 163/168 testfiler och hade fem fel, varav flera nu reproducerats som fixtur-/dokumentationsproblem eller timingkansliga tester.
- [ ] Vercel Preview-miljo och deploy-branch ar inte nyverifierade i denna genomgang. Gor inga liveanrop innan Preview bevisligen anvander endast staging och saknar produktionshemligheter.
- [ ] Staging-schema, Auth/Storage, provideranrop, RLS/tvakonto-isolering, provskapande, rattning, P.E.R och radering maste verifieras med syntetiska konton.
- [ ] Skolan maste godkanna elevdata, retention, lararatkomst, support/incidentflode och kriterier for pilotstart.

Data deletion gate: see `docs/codex/12_DATA_DELETION_GAP.md`.

**PILOT NOT READY.** Lokala tester och promptforbattringar bevisar inte att Preview, staging eller skolans processer fungerar live. Produktionsmiljo och riktiga elevdata har inte anvants eller andrats i denna genomgang.
