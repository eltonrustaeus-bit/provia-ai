# 08 Current Status

## Terminal rättningsstatus, kostnad och fortsatt stagingverifiering — 2026-10-25

- [x] Användaren höjde den totala godkända AI-kostnadsgränsen till `$5`.
  Stagingens egen budgetrad lämnades oförändrad: cap `$3.379071`, spenderat
  `$1.989743`, reserverat `$0.263628`, effektiv marginal cirka `$1.125700`.
  Ingen budget, kvot eller roll ändrades.
- [x] Den enda återanvända Preview-fliken visade ett redan ifyllt 12/12-prov.
  Ett avslutsförsök gick kort till rättningsläge och återgick till provvyn.
  Staging hade 20 issuance-poster, 12 med verifierat resultat, 0 aktiva
  ograderade och 0 rättningar utan resultat. Vyns sista fråga/svar matchade
  inte någon sparad resultatrad. Inga nya `ai_usage_events` registrerades.
  Vyn bedöms därför som en gammal klientvy, inte en ny liveverifiering.
- [x] Rättningsmotorn spärrar nu upprepade inlämningar efter terminala svar
  (`EXAM_NOT_ACTIVE`, redan rättat, svarskonflikt, avbruten rättning eller
  utgånget resultat). Spärren gäller även P.E.R:s direkta `grade(answers)`-väg.
  Provets lokala innehåll lämnas kvar; ny provrendering/återupptagning återställer
  spärren. Tillfälliga nätverks- och modellfel förblir återförsökbara.
- [x] Ny riktad regression `tests/frontend/terminal-grade-state.test.mjs`
  passerade; den kontrollerar att terminal standard-/P.E.R-inlämning inte gör
  ett nytt API-anrop och att ett tillfälligt providerfel kan återförsökas.
  Hela `tests/frontend/exam-flow.regression.mjs` passerade **192/192**.
  `git diff --check` passerade. Oberoende granskning fann ingen blockerare.
- [!] Ingen ny modellförfrågan, ny generering, produktionsändring eller merge
  gjordes. Aktuell flik kan inte användas som bevis för lyckad ny rättning.
  Före ett nytt liveprov ska den gamla vyns identitet/återhämtning lösas; kör
  därefter högst ett komplett syntetiskt flöde inom stagingens kvarvarande
  interna spärr, utan att skapa parallella prov.

## Enfliksregel och aktuell Preview-status — 2026-10-25

- [x] Arbetet återanvänder en befintlig Preview-session. Inga nya
  browserflikar, inloggningsrundor eller prov har skapats i den här
  uppföljningen. Ett syntetiskt liveprov ska genereras, besvaras och rättas i
  samma session; avbryt inte efter generering och skapa inte parallella prov.
- [x] Dedupe-fixen och P.E.R.-saneringen är committade i `c9e04aa`. Den lokala
  checkout-branchen är `codex/exgen-school-pilot-integration-20261024`; samma
  SHA finns på den godkända fjärrbranchen
  `origin/codex/exgen-generation-quality-2026-10-20` och i Vercel Preview
  `READY` från just den fjärrbranchen.
  Den befintliga branch-aliasen är
  `https://provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [x] Den befintliga Preview-sessionen visade autentiserad ExGen-startsida efter
  omladdning. Ingen ny inloggning behövdes i den här kontrollen.
- [x] Exakt READY-deployment och branch-scopade Preview-variabler verifierades
  igen: deployment `dpl_GRbkaEMrt361TFLTCMJjU2zbeejC` kör `c9e04aa` från
  `codex/exgen-generation-quality-2026-10-20`. Variabelnamn och scope kunde
  läsas utan att dekryptera några värden.
- [x] Supabase staging `yhcinqejsocpmmetazpz` saknade två lokala migrationer.
  Efter förhandskontroll (20 befintliga jobb, 0 aktiva, inga checkpointar över
  begärt antal) tillämpades endast stagingmigrationerna
  `release_abandoned_exam_pipeline_after_recovery_window` och
  `tighten_pipeline_integrity_bounds`. Supabase registrerade dem som
  `20261024225011` respektive `20261024225017`; motsvarande repo-filer heter
  `20261024165536_...` och `20261024212500_...`. De två integritetsvillkoren finns;
  quota-reapern skyddar en aktiv parent-lease innan pipeline-jobbet skapats.
  Postkontrollen fann fortsatt 20 jobb och 0 aktiva; budgetraden var oförändrad.
- [x] Staging-ACL-kontroll bekräftade att anon inte kan anropa status-RPC:n,
  authenticated kan anropa den endast via ägarbunden `auth.uid()`-kontroll.
  Security Advisor visar övriga projektvarningar (bland annat RLS-tabeller utan
  policies och SECURITY DEFINER-funktioner); de granskade pipelinefunktionerna
  är avsiktligt server- eller ägarbegränsade och inga nya behörigheter gavs här.
- [x] Den hostade retention-schemaläggningen verifierades skrivskyddat:
  `exgen-mock-exam-pipeline-retention` är aktiv med `*/15 * * * *` och kör den
  förväntade cleanup-funktionen mot stagingdatabasen.
- [x] Lokal riktad svit efter verifiering av kod passerade **135/135**:
  pipeline/Postgres, 3/6/12-gränser, reservation/lease, källgrundning,
  dubbletter, felträning, verifierarkontrakt och P.E.R.-lägen. En oberoende
  granskning rapporterade separat **52/52** källgrundnings-/pipeline-tester.
  HTTP-/återställnings- och kvotgränssnittssviten passerade dessutom **24/24**.
- [x] De fem nya rollbackspärrarna passerar **5/5** PGlite-tester;
  `node scripts/check-migration-files.mjs` passerar med 53 migrationer och
  50 rollbackfiler. Spärrarna vägrar osäker rollback i stället för att ta bort
  reservationer eller återöppna provpipelinefel.
- [x] Riktade offline-tester och syntaxkontroller för ändringarna passerade;
  oberoende P.E.R.- och provgenereringsgranskningar fann inga blockerare.
  Dessa verifierar kodens deterministiska regler, inte live-modellens svar.
- [!] Ingen ny modellförfrågan gjordes. Senast lästa stagingbudget visade
  spenderat `$1.989743` och reserverat `$0.263628` mot den användargodkända
  gränsen `$2`; kvarvarande godkänd marginal kan därför inte säkert täcka ett
  nytt test. Ingen budget, kvot, roll eller konto ändras för att kringgå detta.
- [!] **PILOT NOT READY.** P.E.R.- och den senaste ändringens live-modellbeteende
  är inte verifierade. Main/Production har inte ändrats. Ett framtida
  stagingtest kräver först en färsk budgetkontroll som visar tillräcklig
  marginal och ett befintligt konto utan pågående prov; kör då ett enda prov
  och slutför generering, elevsvar och rättning i samma flik. Oberoende
  säkerhetsgranskning fann ingen blockerare för ett bounded försök, men verklig
  konkurrens mellan PostgreSQL-sessioner återstår att verifiera före bredare
  pilottrafik.

## P.E.R. efter rättat prov — 2026-10-25 (checkpoint före c9e04aa-push)

- [x] Oberoende granskning fann att vanlig hjälp från en kvarhängande `prov`-
  sida efter ett rättat prov kunde få gammal klientkurs, studiematerial,
  historik och felbank. Servern verifierade att ett prov var rättat, men inte
  att dessa kvarvarande klientfält hörde till det provet.
- [x] Vanlig P.E.R.-hjälp från en stale provvy sanerar nu dessa fält även när
  senaste serverstatus är `completed`. Den nya frågan går fortfarande till
  vanlig studiehjälp; aktivt provs ledtrådsskydd och verifierad efterrättning
  använder oförändrade kodvägar.
- [x] Regressionstest kontrollerar att gamla kurs-/material-/historik-/felbank-
  markörer inte når modellgränssnittet och att vanlig hjälp fortsätter fungera.
  Oberoende granskning fann inga blockerare; riktade P.E.R.-tester passerade.
- [x] Vid detta checkpoint var ändringen ännu lokal. Den kom senare med i
  `c9e04aa`, pushades till feature-branchen och verifierades på READY Preview;
  se aktuell sammanfattning ovan. Live-modellbeteendet är fortfarande
  overifierat.

## Slutfört enfliks-test och processdubblett — 2026-10-25

- [x] Återanvände den redan inloggade stabila Preview-fliken; inga nya flikar,
  konton eller prov startades. Det enda nya syntetiska Biologi 1-provet
  slutfördes och rättades i samma session.
- [x] Previewn utfärdade och sparade alla **12/12** begärda frågor. Rättningen
  sparade resultatet **11/12 (92 %)**. De flesta svaren fick full poäng och
  resultatvyn visade täckta begrepp och nästa träningsområde.
- [!] Liveutfallet blottlade ändå redundans: två enzymfrågor, två
  fotosyntesfrågor och överlapp mellan cellandning/mitokondrier. En bred fråga
  om cellens funktioner gav 0/1 eftersom rubriken förväntade specifika roller
  för cellmembran och cytoplasma. 12/12 antal är alltså inte ensamt ett
  kvalitetsmått.
- [x] Oberoende, skrivskyddad granskning reproducerade en möjlig falskpositiv:
  om två processfrågor delar ämne och facit kan de felaktigt slås ihop.
  Processparafraser kräver nu samma in-/utdatainriktning och samma
  ämnessignatur; enda specialfallet är den snäva kloroplast/fotosyntes-
  parafrasen med samma ämnestagg och facit.
- [x] Lade till offline-regressioner som fångar två parafraser av samma
  fotosyntesprocess, behåller separata frågor om indata/utdata och bevarar
  olika processer under breda och blandade ämnestaggar. Riktade assessment-, 3/6/12
  pipeline- och offline-pipeline-tester passerade; syntax- och diffkontroller
  passerade.
- [x] Dedupe-fixen och regressionerna kom senare med i `c9e04aa` och finns på READY Preview.
  Inget andra liveprov kördes; den nya regeln är därför offline-verifierad men
  inte livebevisad.
- [!] Denna uppföljning lämnade 9/12-gränsen, andra konton och reservationer
  orörda. Skrivskyddad stagingkontroll efter rättningen: cap `$3.379071`,
  spent `$1.989743`, reserved `$0.263628`, kvar under cap `$1.125700`; raden
  var uppdaterad `2026-10-24 22:27:08 UTC`. Inga nya AI-anrop gjordes utöver
  det enda godkända provets generering och rättning.

## Svarsmålsdubbletter och enfliksregel — 2026-10-25

- [x] Behöll regeln om en återanvänd Preview-flik. Den här ändringen använde
  enbart offline-tester; inga nya flikar, prov eller modell-anrop skapades.
- [x] Reproducerade de tre observerade Biologi 1-dubblettparen i
  `tests/assessment/assessment.test.mjs`. Svarslikhet ensam får inte längre
  kasta bort frågor: paret måste även ha samma koncept, frågeintention och
  icke-uppgiftsbärande ämnessignatur. Regressionerna behåller tilläggsmål om
  temperatur, NADH, aktiveringsenergi/"inklusive" och omvända processer som
  fotosyntes/cellandning, samtidigt som de tre observerade parafraserna fångas.
  Matematiska frågor behåller sin uttrycks-/färdighetslogik.
- [x] Tidigare godkända facit skickas separat till granskaren i
  `comparison_answer_targets`, inte till frågegeneratorns prompt. ID-koppling,
  max 20 poster, 400 tecken per facit och total granskningsstorlek valideras;
  felkopplade poster stoppar före leverantörsanrop.
- [x] Oberoende granskningsprompt instruerar att upptäcka onaturligt/översatt
  språk och tautologiska frågor. Rättningsprompten betonar semantisk innebörd
  och synonymer utan att släppa explicita rubric-kriterier.
- [x] P.E.R behandlar nu en kvarlämnad `page="prov"`-etikett som inaktuell
  provkontext när servern inte har ett aktivt prov. Innan vanlig studiehjälp
  skickas rensas gammalt material, kurs, historik, fel och förtydliganden;
  en ny regression verifierar att elevens aktuella allmänna fråga ändå går
  vidare till vanlig hjälp.
- [x] Riktade offline-sviter passerade: `assessment.test.mjs`,
  `grading-output-contract.test.mjs`, `verifier-output-contract.test.mjs`,
  `exam-generation-pipeline.test.mjs` (inklusive 3/6/12) och
  `exam-pipeline-offline.test.mjs`. `node --check` för ändrade API-filer samt
  `git diff --check` passerade. Efter den senaste dedupe-regeln passerade
  `node --test tests/assessment/assessment.test.mjs`. Den kombinerade
  bedömnings-/P.E.R-sviten passerade tidigare 59/59; P.E.R-filen har inte
  ändrats sedan dess.
- [x] Oberoende granskare hittade successivt flera falska dublettfall.
  Senaste omgranskningen fann ingen kvarvarande konkret blockerare: svarslikhet
  måste också matcha uppgiftstyp, koncepttagg och exakt ämnessignatur, utan
  sammansatta eller villkorade extrauppgifter.
- [!] Inga nya staging-anrop kördes; AI-promptens beteende och rättning är inte
  liveverifierade. Ändringarna kom senare med i `c9e04aa` och en READY Preview;
  produktens livekvalitet är fortfarande oprövad.

**PILOT NOT READY.** Kodgranskningen är klar och ändringen ligger på feature-
Previewn, men AI-beteendet har inte verifierats live. Håll fast vid enfliksregeln
och använd inte fler betalda liveprov utan bekräftad återstående budget.

## En Preview-session och ett helt slutfört stagingprov — 2026-10-24 21:50 UTC

- [x] Behöll samma Preview-alias och flik genom commit `f2e52f4`, READY-
  deployment `dpl_BxAnsgsXWHC7Ekjm5GWXZUDhDyjW` och inloggning. Ingen ny flik
  eller nytt konto behövdes. En kort auth-gate vid sidstart försvann efter den
  befintliga sessionens initiering.
- [x] Testflödesregel: återanvänd den befintliga stabila branch-aliasen i samma
  flik; öppna inte deployment-specifika Preview-URL:er för samma kod. Om
  sessionen upphör, stanna och återuppta först efter en enda ny inloggning i
  samma flik. Starta inte ett nytt modellprov förrän föregående prov är helt
  rättat/sparat eller uttryckligen bevarat utan omförsök. Denna uppföljning
  inspekterade befintlig flik 20 och skapade inga flikar, prov eller AI-anrop.
- [x] Uppdaterade P.E.R:s skyddade frågedetektering för vanliga formuleringar
  som ber om bekräftelse på ett svar. Vanliga studiefrågor fungerar fortsatt;
  verifierade provgränser ändras inte.
- [x] Felbankens senaste misstag begränsas på serversidan till den aktiva kursen;
  om kurs saknas skickas ingen kursbunden felhistorik till modellen.
- [x] Lade till databaskontroller för att `progress_current` och antalet
  accepterade frågor aldrig ska överstiga elevens begärda antal. Reapern skyddar
  också en levande parent-lease innan pipelinejobbraden skapats.
- [x] Färsk, skrivskyddad staging-preflight på `yhcinqejsocpmmetazpz` fann
  0 jobb med progress över begärt antal och 0 med för många accepterade frågor.
- [x] Riktad offline-svit för pipeline, HTTP, PGlite, källtäckning, felträning,
  P.E.R och klientkontext passerade **147/147**. Separat PGlite-svit passerade
  **28/28**; syntax- och diffkontroller passerade.
- [x] Ett enda syntetiskt Biologi 1-prov med 12 begärda kortsvarsfrågor
  genererades, besvarades och rättades i samma session. Appen utfärdade 12/12;
  sparat resultat blev 10/12 (83%). Inget omförsök eller andra prov skapades.
- [!] Stagingkörningen visade ett kvalitetsfel trots 12/12: tre nära-dubblettpar
  om mitokondrier, cellmembran och enzymers funktion samt en klumpigt formulerad
  cellfråga. De flesta frågorna var källgrundade, men detta räcker inte som
  kvalitetsbevis för pilot. Rättningen gav även delpoäng/0 poäng på två svar som
  i huvudsak uttryckte det förväntade begreppet.
- [x] Stagingbudget efter testet: cap `$3.379071`, spent `$1.850432`, reserved
  `$0.263628`, available `$1.265011`; rad uppdaterad `2026-10-24 21:49 UTC`.
  Förändringen under den enda genereringen och rättningen var cirka `$0.112`.
- [!] Den nya constraint-/reaper-migrationen `20261024212500` är committad men
  inte applicerad i staging. Ingen produktionsdatabas, `main` eller Production
  ändrades.
- [x] Oberoende granskning av slutlig diff fann inga blockerare. Granskaren
  bekräftade att legacy-rad-testet stoppar vid brott mot båda gränserna utan
  partiella constraints. PGlite bevisar inte hosted PostgreSQL-racebeteende.

**PILOT NOT READY.** Nästa steg är att lägga till offline-regressioner som
avslöjar dessa semantiska dubbletter och för snäv rättningsbedömning, förbättra
urval/rättning utan att sänka kvalitetsgrindarna och låta oberoende granskare
kontrollera diffen. Gör inte ett nytt betalt liveprov förrän den ändringen är
redo och budgeten lästs om. Ingen production/main-ändring.

## Uppföljning utan extra liveförbrukning — 2026-10-24 21:04 UTC

- [x] Behöll en och samma befintliga Preview-flik. Inga nya flikar, provstarter,
  stagingkonton eller modellförfrågningar skapades i denna fortsättning.
- [x] Regressionstest reproducerade ett återupptaget felträningsprov där ett
  gammalt, obestyrkt fokus-anspråk kunde ta sista platsen utan att täcka rätt
  källunderlag. Pipeline täcker nu bara tidigare fokus som stöds av frågans
  källa. Regressionen och angränsande 3/6/12-tester passerar.
- [x] När fler godkända kandidater än platser finns rankas nya lärandemål före
  redan representerade mål. Detta är urval, inte en ny avvisningsregel: inga
  frågor underkänns av breddheuristiken och godkänd övning kan fylla provet när
  bättre källstödda alternativ saknas.
- [x] Oberoende granskning fann inga blockerande fynd eller försvagade grindar.
  Granskaren noterar att lärandemålsbredd rangordnas före materialsektionernas
  täckning när kandidater konkurrerar om platser.
- [x] Offline-sviten för pipeline, HTTP, Postgres-emulering, källtäckning och
  felträning passerade **77/77**. Inga OpenAI-anrop gjordes. Tidigare riktade
  P.E.R.-regressioner passerade **4/4**.
- [!] Ändringarna i denna fortsättning är lokala och ocommittade; de har inte
  byggts i en ny Preview eller liveverifierats. Det redan synliga påbörjade
  provet och dess session lämnades orörda.

**PILOT NOT READY.** Nästa säkra verifikation är en enda stagingkörning på
Previewn efter att ett befintligt konto utan aktivt prov valts och den aktuella
stagingbudgeten bekräftats. Håll samma Preview-flik; skapa inte prov i flera
flikar eller starta om en pågående körning.

## Senaste session- och kvotkontroll — 2026-10-24 20:50 UTC

- [x] Aktuell kodrevision är `6582f96ad34c7f233f738c5bf483411deca97ec0` på
  `codex/exgen-school-pilot-integration-20261024`; fjärrens godkända
  feature-branch pekar på samma commit. Matchande Vercel Preview är `READY`.
- [x] Den befintliga branch-aliasen i sidbrowsern visar den autentiserade
  ExGen-appen. UI:t erbjuder att fortsätta ett tidigare påbörjat prov. Ingen
  knapp trycktes; provet identifierades inte närmare och lämnades orört.
- [x] Ingen ny flik, provstart eller modellförfrågan gjordes. Samma Preview-flik
  behölls för fortsatt arbete.
- [x] Read-only aggregerad stagingbudget kontrollerades kl. 20:50 UTC:
  cap `$3.379071`, spenderat `$1.737989`, reserverat `$0.263628`, aktiverad;
  tillgängligt `$1.377454`. Radens senaste uppdatering är 20:22 UTC. Detta är
  appens stagingbudget, inte en OpenAI-faktura.
- [x] `node --test tests/api/exam-generation-pipeline-postgres.test.mjs`
  passerade **25/25**. Den kombinerade offlinekörningen av pipeline-, HTTP- och
  PGlite-tester avslutades med exit code 0 och innehöll 3/6/12-, retry-,
  assembly- och kvotreaperfallen.
- [x] Två oberoende skrivskyddade reviewers fann ingen blockerande race för
  redan skapade aktiva jobb och ingen blockerare i idempotens/provstatus.
  Reaper skyddar aktiva jobb; completion låser jobbet och committar kvot och
  utfärdande transaktionellt. PGlite-testerna är dock sekventiella och bevisar
  inte konkurrens mellan verkliga PostgreSQL-sessioner.
- [!] En separat, smal testlucka finns före pipeline-jobbskapandet: reaper
  kontrollerar aktiva pipelinejobb, inte en ännu ej skapad jobbrad. En paus över
  två minuter kan i teorin återbetala reservationen. I den konfigurerade vägen
  är API:ets `maxDuration` 60 s, parent-leasen 90 s och reapertröskeln 2 min;
  scenariot ligger alltså utanför normal exekvering och har inte reproducerats.
  Ingen kodändring gjordes för hypotesen.
- [!] Historisk kontroll kl. 20:50 visade `20261024140557` och
  `20261024151433`, men saknade senare migrationer. Migrationsgapet är nu
  åtgärdat på staging efter preflight; se aktuell sammanfattning ovan. Ingen
  Production-schemaändring gjordes.
- [x] Fem riktade P.E.R.- och felträningsfiler avslutades lokalt med exit code 0.
  Alla körningar var offline och gjorde inga modellförfrågningar.

**PILOT NOT READY.** Detta är en historisk checkpoint från kl. 20:50. Det
synliga påbörjade provet lämnades orört; staging-schema uppdaterades senare
enbart enligt aktuell sammanfattning ovan. `main`, Production, konton, roller
och kvoter har inte ändrats.

# Fortsatt skolpilotfix — fokusord, källbredd och felträning — 2026-10-24

- [x] Färsk Vercel-runtime-logg för den versionssynkade Previewn bekräftar att
  det syntetiska Matematik 2b-provet begärde 12 men slutade på 0/12. Kandidater
  genererades och nådde verifierare/lösare, men godkändes inte: loggade orsaker
  omfattade `source_support`, `option_quality_failed`, `difficulty_mismatch`,
  `low_source_alignment` och solver-avvikelser. UI:t lämnade inte ut något prov.
- [x] Kodgranskning fann ett separat, bekräftat källbreddsfel: när vanliga
  materialprov skickade elevens valda `focusTerms` stängde pipelinen av
  rubrikbaserad källstyrning (`sourceSectionCount=0`). Rubriker analyseras nu
  även med fokusord; fokusorden skickas vidare oförändrade. Det förklarar inte
  ensamt modellens verifieringsunderkännanden och är inte beskrivet som deras
  bevisade grundorsak.
- [x] Generell källavsnittsstyrning stängs av när jobbet har obligatoriska
  `trainingFocus`. Felträning instrueras då inte samtidigt att prioritera ett
  allmänt materialavsnitt; serverns krav på matchning av verifierade misstag
  och verifieringsstatus är oförändrade. En regression bevisar att en
  irrelevant, i övrigt verifierad kandidat avvisas och att ouppfyllda
  felmoment håller jobbet i `repair`.
- [x] Oberoende skrivskyddad granskning fann inga blockerande problem i ändringen
  eller försvagade kvalitetsgrindar. Granskaren noterade att regressionerna
  mockar verifierade kandidater och inte bevisar den riktiga modellpromptens
  kvalitet.
- [x] Offline-verifiering på slutlig kod: generering/pipeline/kvot/återhämtning
  **80/80**, P.E.R. **56/56**, felträning/källkontext/stream/frontend **44/44**.
  Syntaxkontroll och `git diff --check` passerade.
- [!] Senast verifierade stagingbudget, read-only (databasrad uppdaterad
  `2026-10-24 20:22 UTC`): hårt cap `$3.379071`, spenderat `$1.737989`,
  reserverat `$0.263628`, tillgängligt `$1.377454`.
  Detta är bokföring i staging, inte en OpenAI-faktura. Inget nytt AI-anrop
  gjordes efter budgetläsningen.
- [x] Ändringen committades som `a5732275169f12bd414aea9285e23d86fa26a4d8`
  och pushades till `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_2TSwT2GTCE6zQHEtt562AAYrMaqu` blev `READY` på exakt denna commit; dess
  branch-alias öppnades i sidbrowsern och visade den inloggade appen.
- [!] Ingen ny modellkörning gjordes efter ändringen. Den tidigare
  godkända 12-frågekörningen slutade 0/12 före fixen. Användaren har nu godkänt
  ett nytt syntetiskt test inom taket. Den tidigare 9/12-körningen bevaras och
  lämnas orörd. En redan öppen flik med en deployment-specifik Preview-URL
  återanvändes. Vercel verifierade att den stabila branch-aliasen pekar på
  `a573227`; fliken navigerades inte till den aliasen. Efter omladdning på den
  specifika URL:en visades inloggningsgrinden igen. Inga nya flikar eller prov
  skapades. Nästa Preview ska öppnas via branch-aliasen i samma flik.
  `main`, Production, produktionsdatabasen, konton, roller, kvoter och hemligheter
  har inte ändrats.

**PILOT NOT READY.** Den senaste livekörningen visar att appen säkert stoppar
ett 0/12-resultat, men inte att den kan leverera 12 kvalitetsgodkända frågor.
Efter färdig offline-granskning och slutlig Preview behövs en enda staginginloggning
på samma alias, verifiering att kontot saknar aktivt prov samt färsk kontroll av
budget och staging-schema före det enda godkända syntetiska testflödet. Det äldre
9/12-provet ska bevaras.

## Felträning knuten till källan — lokal uppföljning, 2026-10-24

- [x] Verifierad källkontext från ett rättat prov knyts nu per fokus-ID till högst
  tre serverhärledda, ordagranna källutdrag (högst 500 tecken vardera). En
  kandidats påstådda fokusmatch godtas i pipelinen endast när dess redan
  validerade `source_references` stöder samma utdrag. Obestyrkta fokus-ID:n
  sparas inte och räknas inte som täckta. Äldre köjobb utan fältet behåller
  kompatibilitet; nytt fokus med uttryckligen tom evidens failar stängt.
- [x] Tomma eller blankstegssvar avvisas som felträning även när ett gammalt
  betygsresultat saknar `unanswered: true`.
- [x] Oberoende källgranskare hittade och verifierade de två ovanstående
  riskerna. Efterföljande granskning fann inga blockerare. Riktade offlineprov
  passerade för två olika källor i samma kurs, felaktiga/överdrivna fokus-ID:n,
  äldre källfält, tom evidens samt 3/6/12-frågepipelinen.
- [x] Oberoende säkerhetsgranskning fann ingen blockerare eller försvagad
  ägar-, auth-, kvot- eller kvalitetsgrind. En icke-blockerande lucka kvarstår:
  inget separat PGlite-test laddar om ett checkpointat jobb med en obestyrkt
  lagrad fokusmatch; återkontrollen i koden och vanliga persistensprov finns.
- [x] Relevanta API-/pipeline-/verifierar-/Postgres-emuleringstester passerade;
  syntaxkontroll och diffkontroll passerade. P.E.R.-regressionerna för vanlig
  hjälp, aktivt prov och rättat resultat passerade 3/3. Inga modeller anropades.
- [x] Ändringarna är committade som `6582f96ad34c7f233f738c5bf483411deca97ec0`
  och pushade till `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_H6TXc96SnQZNqKEoQrwZeFbHkQ3b` blev `READY` på exakt den committen.
  Branch-aliasen öppnades i samma befintliga flik; ingen ny flik eller prov
  skapades.
- [!] Ingen ny stagingmodellkörning har verifierat den slutliga ändringen.
  Previewn visar inloggningsgrinden. Senast tidigare budgetläsning visade
  `$1.377454` tillgängligt under Preview-cap, men den är inte färsk och får inte
  användas som anropsgodkännande utan ny läsning.

**PILOT NOT READY.** Källbindning och tomsvarsfelet är åtgärdade, offline-
testade och deployade till en READY staging-Preview. Nästa steg är en enda
inloggning på branch-aliasen i samma flik, följt av kontroll att kontot saknar
aktivt prov och färsk budget-/schema-verifiering före det enda godkända
syntetiska flödet. Ingen Production-, `main`-, kontovals- eller kvotåtgärd har
gjorts.

## Ny stagingkörning och förbättringar för provbredd — 2026-10-24

- [x] Den inloggade staging-Previewn på commit `3006e1e5c2e4c12ccea02843c87f4cabaa5375f9` tog emot ett syntetiskt Matematik 2b-prov: nivå C, blandat, 12 begärda. Jobbet avslutades korrekt som **9/12**; UI:t visade endast de nio godkända och sade uttryckligen att tre saknades. Inga svar skickades in.
- [x] Genomgång av de nio visade frågorna fann upprepade rot-/nollställeuppgifter för samma andragradsfunktion och snävare än avsett färdighetsbredd. Detta är direkt observerat i Previewn; vi har inte korrelerad batchtelemetri för att hävda att just dubblettgrinden orsakade de tre saknade platserna.
- [x] Oberoende kodgranskning fann att `quadraticZeroSignature` inte extraherade `p(x)=…`, trots att den stödde `f(x)`/`y=`, och att dubblettklassning tappade riktningen i `> 0`/`< 0`. Slutgranskningen fann också att strikta `>`/`<`-intervall kunde slås ihop med inklusiva `>=`/`<=`; fix och regressioner lades till, och eftergranskningen fann inga blockerande eller allvarliga kvarstående fynd. Ändringarna lägger till notationstöd och täckning för parafraser, motsatta intervall, strikta/inklusiva gränser och annan färdighet på samma polynom.
- [x] Oberoende kodgranskning fann att promptens 9/2/1-mattebalans räknades per delbatch, fast den är tänkt för hela provet. Lokal ändring för vidarebefordran av hela provets begärda antal gör instruktionen konsekvent: målen gäller hela provet och godkända frågor är täckningskontext, inte bara ordalydelse att undvika.
- [x] Oberoende recovery-review fann att 9/12-statusen behölls i det aktiva provet men saknades efter rättning i sparad provpost/resultatvy. Lokala ändringar visar underskottet även efter rättning och sparar begärt antal plus `partial_delivery`; kontohistorik återställer dessa värden. Grade-requesten använder oförändrat signerade frågor och manifest.
- [x] Riktad API-/pipeline-/recovery-svit passerade **35/35**. Browserkontroller för 2/3, 4/6 och 8/12 passerade; nytt browsertest för 1/3 kontrollerade resultatskärmen, lagrad metadata och att begärt antal/delprov återställs från kontohistorik efter omladdning. `node --check` för ändrade JavaScript-filer och `git diff --check` passerade.
- [x] Ändringarna är committade som `09dc034` och pushade endast till `codex/exgen-generation-quality-2026-10-20`. Vercel-deployment `dpl_93UjDDvnPdmBimdDjccohKGFf7Xu` blev `READY` på exakt commit `09dc034fa6cad690452b4025a11bceef44da0faa`; den återanvänder den befintliga staging-Preview-aliasen. `main` och Production har inte ändrats.
- [!] Read-only kontroll av stagingbudgeten kl. `2026-10-24 19:05 UTC`: cap `$3.379071`, spenderat `$1.616745`, reserverat `$0.263628`; kvar under det hårda taket efter reservation `$1.498698`. Ingen AI-körning gjordes efter kontrollen. Den redan aktiva syntetiska 9-frågekörningen är fortfarande osvarad; den bevaras och skrivs inte över.

**PILOT NOT READY.** Förra livekörningen bekräftade korrekt delprovsmärkning men levererade inte 12/12 och visade redundans. Förbättringarna för dubblettklassning, helprovsbalans i delbatchar och delprovsstatus efter rättning är nu granskade, testade och deployade till staging-Preview. En ny liveverifiering inom budget återstår; det öppna 9/12-provet bevaras tills eleven väljer om det ska lämnas åt sidan eller avbrytas. `main`, Production, produktionsdatabasen, hemligheter, konton och kvoter är orörda.

## Skolpilotens felträning, P.E.R. och testbudget — 2026-10-24

- [x] Åtgärdade två verifierade relevansfel. En tydligt formulerad vanlig P.E.R.-
  fråga får inte längre blockeras av exakt eller semantisk överlappning med en
  gammal `page=prov`-fråga när servern bekräftar att inget prov finns. Explicit
  facit-/uppgiftsreferens och aktivt/osäkert provläge förblir spärrade.
- [x] Felträningshistorik delar nu samma operatorbevarande normalisering mellan
  källresolver och jämförelsekontext. Regressioner bevarar skillnader som `+`/
  `-`, `∈`/`∉`, `≠`/`≡`, `∣`/`∤`, och slår ihop ekvivalenta mellanslagsvarianter.
  Ägar-, kurs-, signerad rättning-, svarsfingerprint- och felkontroller är
  oförändrade.
- [x] Stagingens AI-budgetvakt kan nu använda en branch-scopead cap som bara får
  sänka det befintliga hårda taket på 5 USD. Både reservation och avräkning
  skickar samma verifierade cap; saknad eller ogiltig cap failar stängt.
- [x] En oberoende P.E.R.-granskare verifierade att aktivt/okänt provläge och
  facitintention fortfarande stoppas före modell/kvot. En oberoende
  källgranskare verifierade att felträningsproven förblir ägar- och
  rättningsbundna. En oberoende säkerhetsgranskare bekräftade att databasens
  cap måste matcha exakt; den synkas först efter att rätt Preview är `READY`.
- [x] Riktad samlad offline-svit passerade 158/158, inklusive 3/6/12-fråge-
  pipeline, retry/timeout/idempotens/kvot, P.E.R.-läge och källgrundning. Syntax-
  och diffkontroller passerade. Dessa resultat är lokala och inte livebevis.
- [x] `EXGEN_PILOT_BUDGET_CAP_USD=3.379071` lades till endast som Preview-variabel
  för `codex/exgen-generation-quality-2026-10-20`; beloppet motsvarar då
  verifierad spend 1.379071 USD + den godkända ytterligare gränsen 2 USD. Värdet
  är inte en hemlighet. Databasraden är ännu inte uppdaterad; dess cap är fortsatt
  5 USD tills ny Preview är redo, så budgeterade anrop failar stängt under
  övergången.
- [!] Senaste read-only stagingvärden: cap 5.000000 USD, spent 1.379071 USD,
  reserved 0.263628 USD; raden uppdaterades 2026-10-23 19:43 UTC. Ett nytt AI-
  anrop har inte gjorts. Syntetiskt liveprov inväntar commit/Preview och exakt
  synkning av databas-cap. Produktion, `main`, roller och kvoter är orörda.

**PILOT NOT READY.** Lokala relevansfixar är granskade och testade; branch-
Preview, budgetcapens databassynkning och därefter avgränsad liveverifiering
återstår.

## Skolpilot-uppföljning — träningskontext och övergivna jobb, 2026-10-24

- [x] Bekräftad orsak till irrelevanta prov från tidigare misstag: `app.html`
  skickade nytt provmaterial via `setInputs()` utan träningsmetadata precis före
  `generate()`. Motorn tolkade saknade fält som att träningen skulle rensas,
  trots att föregående steg hade verifierat och lagt till kursens felområden.
  Ändringen bevarar endast kontext när fälten utelämnas; uttryckligt tomma
  värden och Nytt ämne rensar fortfarande träningsläget.
- [x] Regressionstesterna täcker nu hela kedjan från rättat prov och P.E.R till
  felbaserat träningsprov, inklusive att kurs och valda fel når den riktiga
  generatorbegäran. Alla berörda offline-tester passerade 150/150.
- [x] En separat retentionmigration kortar städgränsen för privata, utgångna
  pipelinejobb från 24 timmar till 20 minuter efter jobbets deadline. Den
  behåller radlåsning, lease-fencing, exakt kvotåterbetalning och payload-rensning.
  PGlite verifierade gränsen före/efter cutoff, återbetalning och idempotent
  upprepad städning; pipeline-/Postgres-fixturen passerade 25/25.
- [x] Oberoende säkerhets-/kvotgranskning fann ingen blockerare i migrationen.
  Begränsning: PGlite testar inte faktisk samtidighet mellan PostgreSQL-sessioner;
  låssäkerheten är granskad statiskt och kan stärkas med hosted concurrencytest.
- [x] Uppföljningsändringarna är committade som `a53ff9c` och pushade endast
  till `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_FLG7ZQBUoTxcZYUAZ6JLqPJYp96U` blev `READY` på exakt denna commit;
  den skyddade appvägen svarade 200 och runtime konfigurationen pekar på
  stagingprojektet `yhcinqejsocpmmetazpz`.
- [!] Den nya retentionmigrationen är ännu inte tillämpad i staging; separat
  bekräftelse inväntas. Ingen syntetisk live-AI-körning har gjorts. Den öppna
  stagingwebbläsarsessionen har ett aktivt prov vars ägare/ursprung inte kan
  fastställas säkert, så det har inte lämnats in, avbrutits eller ändrats.
- [!] `appOrigin` för lösenordsåterställning pekar fortfarande på en äldre
  Preview-alias. Den lämnades orörd; auth-recovery i denna Preview är därför
  inte verifierad.
- [x] Det godkända tomma Vercel-projektet `provia-ai-school-pilot-clean` gav 404
  vid kontroll av exakt projekt-ID; projektet saknas redan, så inget raderades.

**PILOT NOT READY.** Lokal regressionssvit är grön; stagingmigration, ny
Preview och säker syntetisk liveverifiering återstår. Ingen produktionsdatabas,
`main`, hemlighet, användarkonto eller kvot har ändrats.

## Integrerad skolpilot-fix — lokal verifiering, 2026-10-24

- [x] Den lokala, isolerade integrationsarbetskopian sammanför nu den befintliga
  genererings-/säkerhetskedjan med verifierad felträning från rättade konto-prov.
  Träningskälla, kurs och felval binds fortsatt till serververifierat, ägarbundet
  provresultat; kvalitets- och källgrindar har inte sänkts.
- [x] Kontobyte och utloggning rensar idempotensnyckel och tillfälligt
  återhämtningsmaterial för provgenerering. Utkast för sparade prov fortsätter
  vara separerade per användare och bevaras för säker återhämtning.
- [x] Återupptagningsstatus vid avbruten generering visas i det aktiva
  provkontraktet med `role=status`; provet öppnas inte och inget falskt
  komplettresultat visas. Browser-fixturen testar nu den verkliga
  `start → advance → status`-vägen och serverns terminala `incomplete_exam`.
- [x] Riktad offline-svit passerade 104/104. Full browserregression passerade
  188/188. `node --check` och `git diff --check` passerade.
- [!] En separat kodreview upptäckte att ett tidigare föreslaget start-svarsfel
  inte matchade produktionspipelinen; den verkningslösa klientändringen togs
  bort och testfixturen korrigerades till pipeline-kontraktet. Reviewens
  uppföljning av den slutliga testfixturen är ännu inte mottagen.
- [!] Arbetet är lokalt och ocommittat i en isolerad integrationsarbetskopia;
  ingen staging-Preview eller live-AI-generering verifierades i denna kontroll.
  En stagingrad med gammalt köat jobb utan motsvarande kvotreservation behöver
  först undersökas read-only. Ingen stagingrättning, migration eller radering
  utfördes.
- [!] Produktionen är inte redo för denna integration: tidigare review fann att
  produktionsschemat saknar `assembly_grace_used`, vilket kodvägen behöver.
  Produktionsmigrationer, `main` och Production får inte ändras utan separat
  granskning och godkännande.

**PILOT NOT READY.** Lokal verifiering är grön, men hosted staging-Preview,
upprepade modellprov över flera kurser, P.E.R.-användbarhet och kvarvarande
produktions-/pilotkrav återstår. Offline-resultat är inte livebevis.

## Tokenutgång i återupptagbar provkörning — pågående, 2026-10-23

- [x] Read-only staginglogg för körningen 23 okt kl. 19:01 UTC bekräftade
  `bad_jwt` / `token is expired` på Supabase Auth `/user` (403). Tidigare
  `/user`-kontroller och en refresh-tokenförnyelse hade lyckats. Ingen token,
  fråga eller materialtext kopierades till dokumentationen.
- [x] Grundorsaken i klientkoden var att den återupptagbara provkörningen tog
  en verifierad token vid start och återanvände den genom hela den långa
  pipeline-sessionen, även om Supabase hann rotera token. Ny klientåterhämtning
  verifierar en ny token mot samma ursprungliga användar-ID och försöker samma
  idempotenta start-/advance-/statusbegäran en gång till. Ett authfel i status
  lämnas nu som authfel, inte som falsk `generation_in_progress`.
- [x] Lokala progress-/snapshottester täcker utgången token i start, advance och
  status, nekad token för annat konto, misslyckad refresh och terminala authfel.
  Oberoende granskning fann inga blockerare i fixen och dess gränstester.
- [x] Browserregressionen passerade 193/193 efter att dess syntetiska
  refresh-session fick matcha rätt testkonto. Riktad browserkontroll passerade:
  en verifierad refresh, ett idempotent återförsök och ett tydligt terminalt
  authfel. Ingen ny provgenerering, AI-kostnad, kvot-/rolländring eller
  databasändring har gjorts.
- [x] Commit `29280c31c7608a2ac134fc32c3ea092a2a11f9e0` pushades endast till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview blev `READY` som
  deployment `dpl_8KfrCVtAHMDkcZ3cwBCVYLAibuSY`; Vercel CLI visade pilotens
  env-variabler branch-scopade till samma Preview-branch. Inga värden lästes.
- [x] Ett syntetiskt Biologi 1-prov med 1 271 tecken begärde 12 kortsvarsfrågor
  på denna Preview. Inget prov utfärdades: exakt 1/12 godkändes och pipelinen
  avslutades säkert med `STAGE_RETRY_LIMIT` efter tre begränsade reparations-
  försök. Sanerad Verceltelemetri visar att många kandidater underkändes med
  `source_answer_not_extractable`; granskning underkände även källstöd,
  svarslinje och poängkvalitet. Auth/setup anropen lyckades under försöket.
- [x] Telemetrin visar att grundprompten redan krävde ordagranna meningar, men
  reparationsprompten inte uttryckligen förbjöd inledning/förklaring runt
  `model_answer`. Lokal uppföljningsändring förstärker samma extraktiva krav i
  både grund- och reparationsprompt på svenska/engelska; inga kvalitetsgrindar
  har sänkts. Oberoende read-only review fann inga blockerare och bekräftade
  att ändringen svarar mot den dominerande observerade avvisningsorsaken.
  Syntax, prompt-, budget-, pipeline-, HTTP- och Postgres/PGlite-tester passerade
- [x] Promptfixen pushades som `91e4714bd632eb5459aa4edef61cd1fdd8ec3d6d`
  endast till feature-branchen. Preview `dpl_44avLTTqEWQqVRiWRb5EBE13EPZV`
  blev READY på exakt den SHA:n, och branch-scopade stagingvariabler verifierades
  utan att läsa deras värden.
- [x] Ett andra syntetiskt Biologi 1-prov med 799 tecken begärde 12 kortsvars-
  frågor. Samma Preview levererade och utfärdade exakt 12/12 godkända frågor;
  Supabase-jobbet slutade `succeeded`, `progress_current=12`, utan felkod.
  Telemetrin visar att sista omgången verifierade två kandidater och godkände
  båda. I tidigare omgångar förekom fortfarande avslag för källstöd, tydlighet,
  svarslinje och poängsättning. Inget provsvar skickades in.
- [!] Stagingbudgeten lästes read-only kl. 19:43 UTC: tak `$5.000000`, spenderat
  `$1.379071`, reserverat `$0.263628`, kvar `$3.357301`. Jämfört med före det
  andra syntetiska försöket ökade spend med `$0.120592`, inom den godkända
  ytterligare gränsen på `$2`. Annan sparad provsession lämnades orörd.
- [!] Äldre syntetiskt prov från 23 okt kl. 16:12 UTC var redan markerat
  avbrutet vid read-only-kontroll; ingen separat resultatpost fanns för det.

**PILOT NOT READY.** Ett syntetiskt 12-frågeprov passerade live efter promptfixen,
men upprepade körningar över flera kurser, användbarhet/P.E.R. och övriga
skolpilotkrav återstår. Ingen produktion eller `main` har ändrats.

## Källstöd i 12-frågeprov — pågående feature-arbete, 2026-10-23

## Senaste stagingprov — `16d4f14`, 2026-10-23

- [x] Commit `16d4f14951d3e2bfcd19fcc0debb7fa473b1e0c6` är pushad endast till
  `codex/exgen-generation-quality-2026-10-20` och Preview `dpl_39qpVp7vWwtXn27T3yP2ZVZDpMiE`
  blev READY. Vercel visade separata, krypterade Preview-variabler på just den
  branchen; Production och `main` ändrades inte.
- [!] Ett syntetiskt Biologi 1-prov begärde 12 kortsvarsfrågor. UI och privat
  jobbmetadata nådde 8/12 godkända frågor efter upprepade generationer,
  oberoende granskning och reparation. Inget komplett prov utfärdades.
  Därefter visade UI:t att provtjänsten inte kunde verifiera inloggningen.
  Innehållsfri jobbmetadata låg kvar som `queued`, `repair`, 8/12 med
  `NO_NEW_APPROVED_QUESTIONS`; orsaken till autentiseringsfelet är inte
  fastställd. Ingen ny generering kördes efter felet.
- [x] Kostnadsgränsen höll: senaste stagingläsningen visade 1,213161 USD
  spenderat och 0,263628 USD reserverat av 5 USD, alltså 3,523211 USD kvar.
  Telemetrin innehöll genererings-, reparations- och verifieringsrader utan
  text från underlag eller frågor.
- [!] Detta är inte bevis på att 12-frågeproblemet är löst. Källnära grinden
  finns i Preview, men tjänstens auth/recovery-väg behöver återställas för att
  slutföra och verifiera återupptagning. Separat kvarstår den tidigare
  blockeraren att rubrik/poängdelar/alternativa svar inte deterministiskt
  binds till samma källfacit.

- [x] Ny lokal säkerhetsgrind för naturvetenskapliga kortsvar kräver att hela
  facitsvaret är en ordagrann, sammanhängande del av elevens material. Matchningen
  bevarar versalisering och jämförelsesymboler och kräver ord-/talgränser, så
  `CO`/`Co`, `7`/`70` eller `7`/`7,5` inte blandas ihop. En källhänvisning kan
  inte längre bära ett facit med extra påståenden.
  Matematikbehållare för härledda svar är undantagna; grafuppgifter har sin
  befintliga deterministiska väg. Initiala kandidater, reparationer och slutlig
  sammansättning använder grinden.
- [!] Den deterministiska kontrollen gäller just `model_answer`. Rubric,
  poängdelar och accepterade svar granskas fortsatt av verifierarmodellen,
  som tidigare missat obestyrkta krav. Därför är källtrohet i hela
  bedömningskontraktet fortfarande ett pilotstopp.

- [x] Feature-Preview för `b676c8f` skapade ett nytt syntetiskt Biologi 1-prov
  med 12/12 godkända frågor från tre källavsnitt. Det färdiga provet lämnades
  in med tolv tomsvar för att visa alla fullpoängssvar; ett serververifierat
  resultat på 0/24 visades. Inga riktiga elevsvar användes.
- [!] Även detta prov har blockerande kvalitetsfynd: fråga 6 och 8 prövar
  nästan samma sak om koldioxid i fotosyntesen, liksom fråga 10 och 11 om
  glukos/stärkelse. Facit till bland annat fråga 1, 3, 8 och 12 innehåller
  påståenden eller preciseringar som saknas i det syntetiska underlaget.
  Källcitatet täcker alltså inte alltid hela svaret trots den nya
  fältnivågranskningen. 12/12 är framsteg för leveransantalet, inte bevis
  för pedagogisk pilotkvalitet.
- [x] I feature-Preview efter första livefyndet: generatorn instrueras att hålla varje
  poängkrav och facitpåstående inom materialet; granskaren instrueras att
  kontrollera facit sats för sats och rapportera explicit `duplicate_of`
  för frågor med samma lärandemål och svarsmål. Servern stoppar rapporterade
  dubbletter. Offline-kontraktstester passerar, men nästa liveprov visade
  att detta inte räckte för semantisk källtrohet eller variation.
- [x] En separat telemetrijustering ger batchade AI-kostnadsrader samma
  kolumner. Rader har nu sparats i staging utan det tidigare `PGRST102`-felet
  under ett syntetiskt 12-frågeprov. Den hårda stagingbudgeten är separat
  och kvar; ett test utesluter inte alla andra telemetrifel.
- [x] Nästa Preview (`eb37536`, `dpl_8bdXicRTAGAemtcaSkQZTk6wCcyi`)
  levererade åter 12/12 från samma syntetiska underlag. Tom inlämning gav ett
  serververifierat 0/24-resultat och visade alla facit. Alla tre källavsnitt
  refererades. Stagingens `ai_usage_events` fick rader för generering,
  reparation och granskning; det tidigare bulkfelet syntes inte i denna
  körning. Budgeten efter testet var 1,172112 USD spenderat av 5 USD.
- [!] Den nya revisionen löste inte semantisk källtrohet: första frågan hade
  ett språkfel, flera frågor prövade samma samband, och facit lade till
  detaljer om DNA-helix, elektroner/väte och ett ekosystemkretslopp som inte
  fanns i det syntetiska materialet. `duplicate_of` och den strängare
  instruktionen fångade inte dessa live. Detta är ett fortsatt pilotstopp.
  Nästa åtgärd bör pröva en källnära facitkontrakt för faktabaserade
  kortsvar, med separat undantag för beräkning/graf och test av hur många
  godkända frågor som återstår. Sänk inte kvalitetsgrinden för att nå 12.

- [x] Preview på `5dc2470` skapade ett syntetiskt Biologi 1-prov med 12/12
  frågor från ett tredelat material. Sanerad pipeline-status rapporterade att
  alla tre avsnitt refererades; frågorna omfattade fotosyntes, cellandning och
  genetik. Alla tolv frågor och facit lästes i appen efter ett serververifierat
  resultat. Ett tidigare 12-frågeprov rättades också live till 22/23 poäng och
  resultatet återhämtades utan nytt modellanrop. Det äldre syntetiska prov som
  blockerade resultatvisning avbröts separat efter uttryckligt godkännande.
- [!] Kvalitetsgranskningen hittade ett nytt blockerande fynd trots 12/12:
  genetikfrågorna om dominant/recessiv nedärvning och DNA:s struktur, samt
  delar av facit och poängkraven, gick längre än det syntetiska underlaget.
  Att ett källcitat finns och granskaren ger hög `source_alignment` bevisar
  inte att hela frågan och exempelsvaret stöds. Detta prov är inte pilotbevis.
- [x] Lokalt kräver den oberoende granskaren nu strukturerade verdict för
  frågans krav, hela exempelsvaret, rubriken, varje poängdel och varje
  accepterat alternativ. Varje del måste peka på sina egna källutdrag och
  servern kontrollerar att utdragen finns i materialet. Frågan stoppas om
  en del saknar stöd, pekar på ett ogiltigt utdrag eller saknar verdict.
  Endast en fast `source_support`-kod når reparationsfeedbacken; råa citat
  förs inte vidare dit. Befintliga poäng- och kvalitetsgrindar består.
- [!] Både fältnivågranskningen och de efterföljande prompt-/dubblettkraven
  har liveprövats men är otillräckliga: modellen missar fortfarande vissa
  obestyrkta tillägg. `main` och Production lämnas orörda.

**PILOT NOT READY.** Källstödet i frågorna och facit är fortsatt en blockerare
tills den skärpta granskningen prövats live och de kvarvarande pilotgrindarna
är uppfyllda.

## Skolpilotens prov- och P.E.R.-grind — feature-Preview, 2026-10-23

- [x] Målkoden committades som `cefde2e` och pushades endast till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_Ghhv5etnRPAenHLFi6TxuBYWtK6S` blev `READY` för exakt den
  revisionen. Rättningsfixen `432024d` blev också `READY` i Preview
  `dpl_FBuiESjdpnrXt6zDT3Vh8xNeV1Tx`. `main`, produktion, konton och
  hemligheter ändrades inte.
- [x] Ett nytt syntetiskt Biologi 1-prov med 12 begärda kortsvarsfrågor gav
  12/12 i denna Preview. P.E.R. nekade facit under aktivt prov och gav en
  svarsfri ledtråd. Frågorna saknade dock helt genetik trots ett tredelat
  underlag och hade flera snarlika uppgifter. Det är ett kvalitetsfynd, inte
  pilotbevis.
- [!] Rättning av de 12 syntetiska svaren gav HTTP 502 och sparade inget
  verifierat resultat. Sanerad Vercel-logg visar att tredje fyragruppen gav
  fem rader i stället för fyra (`contract_row_count`). Svaren fanns kvar i
  klienten. En efterföljande Preview (`9ed797d`,
  `dpl_CdbhYnqh5i2EGgP1N2MhQQgRv4Eh`) återupptog samma 12 svar men
  rättningen fick åter HTTP 502: första fyragruppen gav två rader och den
  begränsade återhämtningen räckte inte inom tidsbudgeten. Ingen delrättning
  sparades. Ytterligare lokal ändring delar därför upp upp till 12 öppna svar
  i grupper om två från början. Den blev `READY` i Preview `6e20e37`
  (`dpl_CmZNBB2M4Z5noswavmLdAXHLxmQa`) men samma svar fick HTTP 502:
  fjärde tvågruppen nådde en `transport_error` vid den dåvarande
  30-sekunders modellbudgeten. En testad men säkerhetsmässigt otillräcklig
  idé om kortare lagringsreserv skickades inte. Den nu lokala lösningen ger
  varje fyragrupp ett strikt JSON-objekt med exakt fyra obligatoriska slotar,
  återställer 30 sekunders lagringsreserv och validerar fortfarande varje
  modellsvar mot sin signerade fråga. Denna fix rättade de 12 syntetiska
  svaren live, sparade 22/23 poäng serververifierat och spelade upp samma
  resultat utan ny modellkostnad. Ett äldre, oavslutat syntetiskt stagingprov
  blockerade först facit enligt provskyddet. Efter separat godkännande
  avbröts endast det äldre provet med `abandon_exam_issuance`-funktionen;
  det nya, verifierade resultatet visades sedan i appen.

- [x] En staging-Preview med tidigare kod skapade ett syntetiskt 3/3-prov.
  P.E.R. gav en svarsfri ledtråd under provet och kunde förklara efter
  verifierad rättning. Ett separat syntetiskt 12/12-prov skapades, men frågorna
  koncentrerades till fotosyntes trots material med fyra avsnitt. Rättningen
  av det provet fick `grading_response_invalid` och sparade inget verifierat
  resultat. Detta är stagingfynd, inte bevis för den nuvarande lokala diffen.
- [x] Lokalt styr den återupptagbara generatorn nya batcher mot mindre
  refererade, tydligt rubriksatta källavsnitt. När fler redan verifierade
  kandidater än platser finns prioriteras dem som tillför nya avsnitt.
  Strukturell kontroll, källstöd, oberoende granskare, lösare och
  dubblettkontroll är kvar. Avsnittsprioritering är inte en ny avslagsgrind;
  tunna avsnitt och frågor som jämför avsnitt får inte ensamma stoppa 12
  godkända frågor. Telemetrin beskriver refererade avsnitt, inte semantiskt
  garanterad täckning.
- [!] Liveprovet med 12/12 skapades innan korrigeringen av fokusvalet.
  Gränssnittet valde då automatiskt alla extraherade ord, vilket stängde av
  avsnittsstyrningen i pipelinen. En lokal ändring lämnar nu fokusorden
  avvalda från början; eleven kan fortfarande välja dem aktivt. Det stora
  gränssnittstestet passerade 193/193 kontroller, inklusive standardval och
  aktivt fokusval. API-testerna för avsnittsstyrning med uttryckligen tomt
  fokusval passerade. En ny 12-frågegenerering i Preview måste visa om
  detta förbättrar bredden.
- [x] Lokalt rättas öppna svar i grupper om högst fyra, med högst tre samtidiga
  modellförfrågningar. Varje grupp måste matcha sina signerade frågor och alla
  grupper måste passera innan ett enda resultat sparas. Tester täcker 12 och
  20 svar, saknad mittgrupp, HTTP-fel, kostnadshändelser, tidsbudget och
  frisläppt rättningsanspråk. Den äldre stagingens 12-svarsfel är ännu inte
  omtestat med denna ändring.
- [x] Riktad prov-/rättningssvit: 39/39 tester passerade. P.E.R.-svit: 55/55
  passerade. En seriell körning av samtliga 200 upptäckta lokala testfiler
  utanför `tests/live/` avslutades med exitkod 0 efter att två föråldrade
  testförväntningar uppdaterats. `git diff --check` och syntaxkontroller
  passerade. Oberoende granskare fann inga kvarstående blockerande fynd i
  den ändrade avsnittsprioriteringen och rättningsflödet.
- [!] Arbetskopian är detached och innehåller en orelaterad lokal
  `förbättring.html`-ändring som inte följer med målets commits. Ny Preview
  och livekontroll av innehållsbredd samt P.E.R. efter rättning återstår.
  Inga produktionsåtgärder ingår.

**PILOT NOT READY.** 12 frågor och rättning fungerar nu i ett stagingfall,
men avsnittsbredd, duplicering och reproducerbarhet måste verifieras innan skolpilot.

## UI-skydd för ofullständiga prov — 2026-10-23

- [x] Appen avgör nu delprov genom att jämföra faktiskt antal returnerade
  frågor med klientens begärda antal. `meta.partial` kan inte längre få ett
  kortare prov att visas som komplett om flaggan är falsk eller saknas.
- [x] Browserregression väljer 3, 6 och 12 frågor i wizardens UI, verifierar
  att valt antal skickas till API:t och provar 2/3 med motsägande metadata,
  4/6 utan metadata samt 8/12 med delprovsmetadata. Visad instruktion anger
  godkänt antal och endast returnerade frågor renderas.
- [x] Riktat browsertest passerade 1/1. Hela seriella offline-sviten över 193
  testfiler passerade efter UI-fixen. Den oberoende granskningen fann inga
  blockerare; staging/livebeteende är inte verifierat av dessa tester.
- [x] Den avgränsade ändringen är committad som `1804cf2` och pushad till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_23iEGHpAgqZ23W5qAXbJCDw16Vzj` är `READY` för exakt commit
  `1804cf2ce44544ba40d110cb46df98292cc3f9ec`; feature-aliasen är
  `provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app`.
- [!] Ingen migration, betald AI-förfrågan eller merge till `main` utfördes.
  PR #123 är fortsatt draft. Produktionsschema saknar dokumenterat pipeline-
  och P.E.R-kvotschema, därför är merge till `main` fortfarande osäker.

## Releasegrind efter Preview-push — 2026-10-23

- [x] Den semantiska jämförelsegrinden känner nu igen enkla, omkastade
  tvåledade frågor av typen "Jämför X och Y" / "Compare X and Y". Svenska och
  engelska dubblettregressioner passerar; frågor med ytterligare kontextled
  förblir separata. Oberoende read-only review fann inga fynd i denna snäva
  normalisering.
- [x] Commit `0d5394b` innehåller den granskade kod-/test-/XelioV-uppdateringen;
  `44fdcb4` för in senaste `main` (`7dc2e9a`) och bevarar P.E.R:s
  kvotreservation och begränsade allmänna studiehjälp.
- [x] Branchen pushades till
  `codex/exgen-generation-quality-2026-10-20`. Draft-PR #123 är öppen mot
  `main`; den är inte mergad. Vercel Preview `dpl_Dp9HqPP1SsS3MDQYuBDvTgYhHEy5`
  är `READY` för exakt commit `44fdcb47c173db20c4fab9afe8297647910cec1c` och
  öppnades i sidbrowserflik 76. Den visar inloggningsgrinden; ingen inloggning
  eller live-AI-begäran gjordes.
- [x] Read-only produktionskontroll med Supabase bekräftade att
  `mock_exam_generation_pipeline_jobs`,
  `claim_mock_exam_generation_pipeline_job`,
  `checkpoint_mock_exam_generation_pipeline_batch` och
  `reserve_per_chat_quota` saknas. Migrationslistan innehåller inte den nya
  pipeline-/P.E.R-kvotschemakedjan. En merge till `main` skulle därför
  auto-deploya kod med saknade database contracts och är spärrad tills exakt
  produktionsmigrationsplan granskats och separat godkänts.
- [x] Staging saknar fortfarande
  `20261022220521_add_repeated_learning_objective_checkpoint_feedback.sql`.
  Ingen Supabase-migration, produktionsdatabasändring eller Vercel Production-
  deploy gjordes. `.temp/cli-latest` är en befintlig lokal ändring och lämnades
  utanför committen.
- [x] Full seriell offline-svit avslutades med exit 0 över 193 testfiler; den
  kördes medan den sista lilla dedupliceringsfixen redigerades, så den riktade
  `tests/api/exam-pipeline-offline.test.mjs` kördes om efter fixen. P.E.R-
  handler + kvotmigration passerade 52/52 efter merge med `main`.
  `npm run xeliov:context:test` passerade 4/4; `node --check` och
  `git diff --check` passerade.

**PILOT NOT READY.** Kod/Preview är pushad för granskning, men produktionens
schema är inte versionssynkat. Draft-PR #123 ska inte mergas innan databasens
förkrav har granskats, godkänts och verifierats.

## Integrerad dubblettreparation och rollbackskydd — 2026-10-23

- [x] Semantisk dubblettkontroll fångar även svenska förklaringsparafraser
  efter böjningsnormalisering. Regressionen stoppar "Beskriv ... innebär"
  kontra "Redogör ... betyder" men behåller relaterade frågor med olika
  svarsmål, inklusive hastighet kontra energiproduktion i samma cellandning.
- [x] Oberoende kvalitetsgranskning hittade att semantiska stoppord kunde få
  "bärförmåga och hur påverkas den" att slå ut en fråga om påverkande faktorer.
  Svensk verb-/småordsnormalisering och regressioner skiljer nu dessa åt utan
  att släppa igenom rena förklaringsparafraser. Normaliseringen är avgränsad
  till den semantiska grinden; den äldre exakta signaturen och betydelsebärande
  "eller/or"-token ändras inte. Semantisk matchning kräver även samma ordnade
  sekvens av konjunktioner/disjunktioner, samma parentesgruppering och samma
  ordnade betydelsebärande token när logiska operatorer finns. Redundanta
  parenteser normaliseras bara där grupperingen är ekvivalent; operatorer utan
  operand på båda sidor stängs ute från semantisk dubblettmatchning. Motexempel
  med ändrad operatorordning, gruppering, operandplacering och trasiga uttryck
  testas.
- [x] Granskarfeedback med vanliga varianter som "samma begrepp", "same skill"
  och "overlaps with an existing question" mappas till den fasta
  reparationskategorin `repeated_learning_objective`.
- [x] En syntetisk HTTP-regression tvingar fram verifieraravslag för
  `repeated_learning_objective`, bekräftar att endast den fasta kategorin
  sparas i privat checkpoint och att nästa reparationsprompt kräver ett annat
  lärandemål. Den levererar exakt 12/12 verifierade frågor via verklig intern
  generator och autentiserad HTTP/PGlite, med en issuance och en
  kvotförbrukning; avvisad fråga utfärdas inte. Slutcheckpointens 12 `verified`
  poster måste matcha utfärdade ID:n exakt.
- [x] Framåtmigrationen lägger till kategorin i checkpointens fasta allowlist.
  Rollback återställer äldre allowlist men vägrar medan jobb är `queued` eller
  `running`; operativ ordning är att rulla tillbaka apprevisionen som skickar
  kategorin, stoppa ny generering, dränera kön och hålla trafiken stoppad tills
  SQL-rollbacken är klar. Guard är en punktkontroll, inte ett trafiklås; ingen
  hosted migration utfördes.
- [x] Den riktade fyrfiliga API-/HTTP-/PGlite-sviten passerade 25/25. Därefter
  avslutades den fulla seriella offline-sviten över 193 testfiler med exitkod 0
  på den slutliga lokala diffen (katalogen för explicita liveprov exkluderad).
  `node --check` för bedömningsmodulen och dess offline-test samt
  `git diff --check` passerade.
- [x] Oberoende säkerhets-/kvotgranskning fann inga blockerare i diffen.
  Den noterade att rollbackens aktiva-jobbkontroll inte synkroniserar trafik;
  operativt stopp och dränering måste ske före rollback. Granskaren verifierade
  inga hostade ACL/RLS-förhållanden. En separat granskning av logiknormalisering
  hittade ett ogiltigt uttryck som kunde jämföras med en giltig fråga; det är nu
  täckt av regression och uteslutet från semantisk matchning.
- [x] Read-only Vercel-kontroll: senaste READY Previewn på feature-branchen är
  deployment `dpl_2GdDg83hDTZVsLMdvf46QJEkUNJs`, commit
  `3b7dcfb12c1a989e050880b3935b8153ea80ba55`, samma som lokal HEAD före lokala
  ändringar. Previewn öppnades synligt i sidebrowserflik 75 och visar
  inloggningsgrinden. Lokala dirty ändringar ingår inte. Den tidigare
  obesvarade syntetiska provfliken lämnades orörd.
- [x] Read-only Supabase-kontroll bekräftade stagingprojektet
  `exgen-pilot-staging` som `ACTIVE_HEALTHY`; senast applicerade migration är
  `20261022172446_checkpoint_exam_repair_feedback`. Den lokala nya
  `repeated_learning_objective`-migrationen saknas i staging.
- [!] Read-only stagingkontroll 2026-10-23 bekräftar projektet
  `exgen-pilot-staging` som `ACTIVE_HEALTHY`; den nya lokala
  `repeated_learning_objective`-migrationen saknas fortfarande. Budgettabellen
  visar tak `$5.000000`, spenderat `$0.581394`, reserverat `$0.225728` och
  beräknat saldo `$4.192878`, men `updated_at` är 2026-10-22 21:50 UTC. Detta är
  en gammal intern bokföring, inte ett aktuellt tillstånd eller en
  leverantörsfaktura; ingen betald förfrågan får utgå från den.
- [x] Efter den senaste regressionsfixen passerade den riktade fyrfiliga
  API-/HTTP-/PGlite-sviten 25/25. En utökad körning av 12 relevanta testfiler,
  en kostnadsfri ämnesroutningskontroll och fyra eval-delivery-tester avslutades
  utan fel. Den bredare seriella offline-sviten passerade i samtliga 193
  testfiler.
  `node --check` för bedömningsmodulen och offline-testet samt
  `git diff --check` passerade efter dokumentuppdateringen.
- [!] Ingen push, deploy, stagingmigration, produktions-/main-ändring eller ny
  modellförfrågan gjordes.

**PILOT NOT READY.** Lokala flöden och kontrakt är testade, men den här
revisionen har inte körts mot en versionssynkad stagingmiljö eller verifierats
med verklig modellutmatning. Enstaka framgångar räcker inte för stabil
12-frågeyield.

## Lokal dubblett- och språkgrind för provfrågor — 2026-10-22 22:05 UTC

- [x] `api/_assessment.js` kompletterar exakt signatur och befintlig
  matematikintent med en försiktig semantisk jämförelse. Den kräver gemensamma
  innehållsord, samma frågeintent och Jaccard-likhet; samma begreppstagg får en
  lägre minsta ordgräns. Offline-motexempel stoppar nära parafraser om
  bärförmåga och biologisk mångfald men behåller två olika frågor om syres
  effekt på cellandningens hastighet respektive energiproduktion.
- [x] `api/_verifier.js` skickar en max-100-teckens `concept_tag` endast som
  jämförelsekontekst till tidigare godkända frågor; överskridna taggar failar
  stängt. Granskarprompten betonar upprepade lärandemål och avslag på tydliga
  grammatikfel, inklusive regressionsfrasen `den viktigt`. Godkännandetrösklar,
  verifiering, blind lösare, källstöd och utfärdandeflöde ändrades inte.
- [x] `api/generate-exam.js` tillåter en fast, integritetsbevarande
  `repeated_learning_objective`-reparationskategori. Reparationen måste byta
  lärandemål och får inte bara formulera om kandidaten.
- [x] Oberoende API-/återhämtningsgranskning hittade att SQL-checkpointens
  allowlist saknade kategorin. En framåtriktad migration lägger till enbart
  denna fasta kategori; rollbacken återställer tidigare allowlist och vägrar
  köras medan aktiva jobb fortfarande innehåller kategorin. PGlite accepterar
  och lagrar feedbacken, avvisar den efter rollback, testar rollbackskyddet och
  bekräftar att `anon`/`authenticated` fortfarande inte får köra funktionen.
- [x] Oberoende granskning identifierade en falsk-positiv risk när delad
  ordmängd dividerades med den mindre frågan. Jaccard-måttet och ett syskonfråge-
  regressionstest hanterar det fallet; granskaren bekräftade att motexemplet
  behålls och bärförmågeparafrasen fortfarande stoppas.
- [x] Fokuserad offline-svit för pipeline unit/HTTP/PGlite, recovery, budget,
  idempotens, verifierare, 3/6/12 UI/progress/delprov och pilot-readiness
  avslutades med exitkod 0 efter SQL-fixen och rollbackskyddet. PGlite-testfilen
  passerade 21/21; syntaxkontroller och `git diff --check` passerade.
- [!] Ändringarna är lokala ovanpå `3b7dcfb`; ingen push, deploy, staging-
  migration eller ny modellförfrågan gjordes. Den öppna sidebrowsern visar den
  tidigare deployade Previewn och dess obesvarade syntetiska 12-frågeprov.
  Förra stagingens budgetbokning är historisk och duger inte som nytt budget- eller
  liveverifieringsbesked.

**PILOT NOT READY.** Lokal dubblett- och språkgrind är starkare, men upprepade
stagingkörningar på exakt denna kodrevision och verifiering mot verklig
modellutmatning återstår.

## Live staging-verifiering efter recovery-release — 2026-10-22 21:50 UTC

- [x] Den branch-scopade Previewn för commit
  `3b7dcfb12c1a989e050880b3935b8153ea80ba55` körde ett enda godkänt,
  syntetiskt Biologi 1-prov på C-nivå. Begäran var 12 kortsvarsfrågor.
- [x] Previewn utfärdade provvyn med exakt 12 frågeknappar. Den öppna vyn står
  kvar på fråga 2 av 12; samtliga 12 är obesvarade. Ingen rättning, inlämning,
  avbrytning eller ytterligare generering gjordes. En visad fråga handlar om
  ekosystemets bärförmåga. Detta är inte en fullständig manuell innehållsreview
  av alla frågor.
- [x] Läsning av stagingens interna budgetbokföring kl. 21:50 UTC: tak
  `$5.000000`, spenderat `$0.581394`, reserverat `$0.225728`, återstående
  `$4.192878`. Före testet var spenderat `$0.528050`; förändringen är
  appens interna bokföring, inte en verifierad leverantörsfaktura.
- [!] Detta är en lyckad liveleverans för en syntetisk begäran, inte belägg för
  stabil yield över upprepade körningar eller en full kvalitetsgranskning av
  frågorna. Produktionssystem, `main`, staging-schema, konton och kvoter ändrades
  inte i denna verifiering.

**PILOT NOT READY.** Exakt 12/12 levererades i detta enda stagingprov. Behåll
provet öppet för användarens inspektion; upprepad yield och granskning av
frågekvalitet återstår.

## Staging release: request identity and recovery — 2026-10-22 21:44 UTC

- [x] Committed the scoped app/recovery change as `3b7dcfb12c1a989e050880b3935b8153ea80ba55` and pushed only to `codex/exgen-generation-quality-2026-10-20`.
- [x] Vercel Preview deployment `dpl_2GdDg83hDTZVsLMdvf46QJEkUNJs` is READY for that exact SHA. Its branch alias remains the open side-browser URL. Branch-only staging environment-variable metadata was verified without reading values.
- [x] Focused API/PGlite/browser identity tests passed (23 tests); the browser exam-flow regression passed 192/192 on the diagnostic rerun. Syntax checks and `git diff --check` passed before commit.
- [x] The refreshed Preview returned to the signed-in app start screen in the sidebrowser. No exam was generated during this verification.
- [!] This release hardens verified-session binding, idempotency-key durability and safe retry/cleanup; it does not change generator quality gates or prove improved 12-question yield. No Supabase migration, production/main change, or paid model call was made.
- [!] Separate XelioV playbook/learning files and unrelated local changes remain uncommitted and outside this app release. `supabase/.temp/cli-latest` remains untouched.

**PILOT NOT READY.** The deployed client recovery changes are visible in Preview, but hosted generation and repeatable 12-question acceptance remain unverified.

## Recovery hardening and final offline test pass — 2026-10-22 21:33 UTC

- [x] Malformed durable request metadata now fails closed when its valid
  fingerprint matches the pending request but its idempotency UUID or expiry
  is invalid. This check runs before legacy-session migration can rewrite the
  record. The regression asserts that no replacement key is written and the
  damaged record remains available for safe resolution.
- [x] Supabase identity is bound to one captured session token: the token is
  verified once against Auth, its verified user ID binds the request
  fingerprint, and the same token is used for graph, start, advance and status
  requests. Missing or mismatched identity stops before generation.
- [x] Mixed retry partial rules now cover 3, 6 and 12 requested questions,
  including the approved-count floor, one below it, and missing-format cases.
  The mixed deadline HTTP cases verify terminal payload/checkpoint scrubbing,
  exact response replay, one issuance/refund and unchanged quota on replay.
- [x] The real two-tab browser test now waits until both tabs have requested the
  Web Lock before asserting that creation and cleanup remain blocked behind the
  lock holder. Synthetic auth fixtures for partial delivery, graph navigation
  and quota denial now return the same verified user as their seeded session.
- [x] Final affected API/PGlite/browser-identity tests passed 23/23 after the
  last coverage additions. `node --check` for modified JS/test files and
  `git diff --check` passed. The serial repository suite exited 0 across 193
  test files before the last two test-only coverage additions; the added cases
  themselves are included in the 23/23 final affected-file run. The standalone
  Playwright exam-flow regression passed 192/192.
- [x] The independent security reviewer confirmed the malformed-key P2 is
  closed. The test/recovery reviewer found no blocker in the updated lock
  handshake and mixed retry work; their suggested boundary cases are now
  covered by the focused passing run.
- [!] No code was pushed or deployed, no Supabase migration or staging mutation
  was made, and no live model call was made. The open side-browser Preview still
  shows the pilot login gate; the local dirty changes are not in that Preview.
  The last staging budget read is historical and must be refreshed before any
  new live request.

**PILOT NOT READY.** Offline coverage is stronger, but a revision-synced,
authenticated staging run is still needed to verify current 12-question yield.

## Preview, staging readout and offline verification — 2026-10-22 21:02 UTC

- [x] Read-only Vercel listing confirms the latest READY Preview on the feature
  branch is deployment `dpl_9JzibJsjf78pTXNfcUy1wAtSqc26`, created 19:29 UTC,
  at commit `1ff86e1e7fb9309871a6949a0ffca5b718ef056b`. This matches local HEAD.
- [!] The current dirty worktree changes are not part of that deployment.
  In particular, the open browser URL that previously showed `b3c147` is older;
  a separate side-browser tab now shows the latest READY Preview. This Preview
  is behind the local unstaged request-recovery changes and cannot verify them.
- [x] Browser request identity also fails closed if shared `localStorage`
  becomes unavailable between capability detection and storage selection; it
  never falls back to tab-scoped storage in a browser. The UI explains the
  required capability, and a regression exercises the intermittent failure.
- [x] The latest focused local command covered generation pipeline unit/HTTP,
  PGlite/issuance, recovery/progress, browser-backed request identity, and
  mixed-format deadline partials: 58/58 tests passed. The full Playwright
  exam-flow regression passed 192/192, including a browser without Web Locks
  stopping before the generation API or quota reservation. No live provider
  call was made in this check.
- [x] Read-only staging inspection found no active queued/running/retryable
  generation job. In the four newest synthetic 12-question jobs, one completed
  12/12, two stopped at 2/12 with `STAGE_RETRY_LIMIT`, and one ended with
  `OPERATION_DEADLINE` before any model-usage event. These jobs predate telemetry
  commit `af37cfa`; their nullable `verification_passed` values therefore do
  not diagnose individual candidate rejection or the current Preview behavior.
- [x] The staging spend ledger reports a $5.00 cap, $0.528050 spent and
  $0.225728 reserved at its last update (2026-10-22 17:59:47 UTC). This is the
  application ledger, not a provider invoice or proof of current provider
  balance. No live AI request or staging mutation was made in this check.
- [!] The visible current Preview still shows the login gate, so there is no
  authenticated session for a revision-synced live generation check. No schema,
  account, role, quota, spend-ledger or exam-row state was changed. No active
  queued/running/retryable generation job was present in the read-only check.
  Refresh budget and job state immediately before any separately approved live
  request.
- [x] The broad serial command `node --test --test-concurrency=1
  --test-reporter=dot $(rg --files tests -g '*.test.mjs' -g '*.test.js')`
  completed with exit code 0 across 192 test files before the latest focused
  edits. After those edits, auth-snapshot/progress/idempotency tests passed
  14/14; the HTTP pipeline test file passed 2/2; and the full browser exam-flow
  regression passed 192/192. The preceding focused generation suite passed
  58/58 and supplemental issuance/quota tests passed 12/12.
- [x] Follow-up coverage now checks mixed-format deadline partial floors for
  3, 6 and 12 questions, including missing-format and one-below-floor failures.
  Request cleanup also verifies read-back after deleting the final key, with a
  regression for storage implementations that silently ignore `removeItem`.
- [x] Generation now captures one Supabase session token, verifies the user
  against that exact token, and binds both owner fingerprint and all start,
  advance, status and graph requests to the same snapshot. A verified-user
  mismatch or missing session stops before a generation request. Tests cover
  snapshot/token wiring and reuse through status recovery.
- [x] Migration of legacy session-scoped request keys now fails closed when the
  old storage cannot be read or parsed, instead of treating an unreadable
  pending key as absent and creating a second quota claim. Synthetic regressions
  verify no durable key is written in either failure case.
- [x] Independent read-only security review confirmed both P2 findings are
  closed by the local changes and their tests. The independent test/recovery
  review confirmed the new mixed 3/6/12 cases match the server's 60% partial
  floor and require both formats. No remaining blocker was found in these
  reviewed scopes; this does not verify hosted Supabase or live-model behavior.

**PILOT NOT READY.** Before claiming
repeatable live yield, run a synthetic test against a revision-synced Preview
after confirming the active exam is safely resolved and the current staging
budget remains within the approved cap.

## Keep resumable generation identity across tab closure — 2026-10-22

- [x] `js/generation-request.js` now keeps only a request fingerprint, UUID
  idempotency key and expiry in browser storage; it does not store study text
  or the account ID. With Web Locks, same-origin tabs serialize the lookup and
  creation. If Web Locks or accessible shared local storage is unavailable,
  browser generation fails closed before starting a job; tab-scoped keys cannot
  prevent another tab from charging quota twice.
- [x] Legacy same-tab request metadata is merged into existing durable records.
  The registry is bounded at five; a sixth request fails closed instead of
  evicting a key that may still identify an active server job. Malformed UUIDs
  are ignored and unreadable storage blocks generation rather than reusing stale
  in-memory state.
- [x] Creation and cleanup both use the same Web Lock when shared local storage
  is enabled. The app waits for cleanup; if durable cleanup fails after a
  successful exam, the student is warned that identical settings may replay the
  prior result. Cleanup failures are no longer silently reported as success.
- [x] If migration finds distinct keys for the same account-bound request
  fingerprint, both keys are preserved and generation fails closed with a clear
  support message instead of silently selecting one possibly active job.
- [x] `app.html` now tells a returning student that resumption requires the
  exact same material and exam settings. It only supports closing the tab when
  Web Locks plus local storage are available; otherwise it tells the student
  to keep/reload the same tab. Server replay of the same key avoids another
  quota reservation.
- [x] Offline verification: request identity and migration tests cover reload,
  concurrent key creation, locked cleanup, account-bound fingerprints, bounded
  storage, malformed/corrupt state, legacy migration collisions and the
  no-Web-Locks and intermittent-localStorage fail-closed behavior. A two-tab Playwright test exercises actual
  same-origin Web Locks, concurrent create/cleanup and reload persistence. The
  focused generation/API/PGlite/recovery suite including the browser
  request-identity test passed 58/58; browser exam-flow regression passed
  192/192; syntax and `git diff --check` passed.
- [!] The source text is intentionally not recovered from browser storage.
  After closing a supported tab, the student must paste identical material and
  use the same settings to reconnect. Browsers without Web Locks cannot start a
  generation until browser capabilities are restored. These are offline tests; no
  live provider request, staging deployment or hosted recovery was run.

**PILOT NOT READY.** Repeatable hosted 12-question yield and live resume still
need a separately approved, revision-synced staging test after the open exam is
safely completed or cleared by its owner.

## Accumulate bounded repair feedback across retries — 2026-10-22

- [x] `api/_exam-generation-pipeline.cjs` now merges the prior job feedback
  with the latest batch before checkpointing. Only existing allowlisted review
  and solver categories survive normalization; counts cap at 20 and duplicate
  count at 3, matching the private RPC constraints. Candidate acceptance,
  independent verification, solver checks, source support and deduplication
  are unchanged.
- [x] Unit coverage verifies cross-attempt category accumulation, ignored raw
  fields/categories and saturation at the SQL bounds. HTTP/PGlite recovery
  coverage seeds an earlier `answer_alignment` signal, observes a later
  `low_source_alignment` signal, and verifies the next repair prompt retains
  both. The focused nine-file suite passed 72/72; the HTTP suite passed 2/2;
  `node --check api/_exam-generation-pipeline.cjs` and `git diff --check` passed.
- [x] Independent generation and security reviewers found no blocker in the
  local diff. The security review confirms the merge stays bounded and behind
  the existing fenced private checkpoint.
- [!] This is offline evidence only. No source/material text is added to
  feedback, but no new staging model run has shown improved yield. The active
  staging exam remains untouched; no push, deploy, migration, provider call,
  production change or `main` change was made.

**PILOT NOT READY.** After the open staging exam is safely completed or cleared
by its owner, rerun a synthetic 12-question test on the exact Preview and
inspect the persisted diagnostics and accepted-count progression.

## Read-only staging yield diagnosis — 2026-10-22 19:06 UTC

- [x] Rechecked the exact READY branch Preview: deployment
  `dpl_GiBqY9VJCDwVt8sVdYf5wVQo7axb`, SHA `6e0fbe2c6eb28cda2adbd34225fa924ca7365a55`,
  created 18:58 UTC. It is the same generation code as `af37cfa` plus docs.
- [x] Read only sanitized job columns and aggregates from staging
  `yhcinqejsocpmmetazpz`. In four recent 12-question jobs, one succeeded at
  12/12 after five generation events (mean 20.1s, max 23.4s) and eleven
  comparison-review events (mean 4.3s, max 6.3s). Two failed at 2/12 with
  `STAGE_RETRY_LIMIT`: their generation means were 18.6s/22.2s and comparison
  review means 5.1s/6.7s. One failed at 0/12 with `OPERATION_DEADLINE` before
  any model event.
- [!] The older jobs have no persisted `verification_passed` outcome flags.
  Their aggregates do not expose candidate-level reject reasons, so they
  confirm underfilled/retry and preflight-deadline paths, not the exact cause
  for each rejected candidate. The new telemetry still needs a run on the
  deployed revision to test hosted persistence and explain new outcomes.
- [!] Vercel runtime-log lookup for the 17:26 UTC failure was rejected because
  the project plan retains runtime logs for one hour; no historical per-batch
  console diagnosis can be recovered from that interval. Persisted, sanitized
  outcome metrics and a fresh post-deploy run are the available route forward.
- [x] The currently open browser session corresponds to a 12-question exam
  with all answers unanswered; it was not submitted, abandoned, or modified.
  The staging budget was reread at 19:06 UTC: cap `$5.000000`, spent
  `$0.528050`, reserved `$0.225728`, remaining `$4.246222`; its ledger row's
  last update remains 17:59 UTC. Recheck immediately before another provider
  request.

**PILOT NOT READY.** Preserve the active exam. Once its owner finishes or
leaves it, run another synthetic 12-question job on the current Preview and
compare accepted counts, generation/review latency, persisted outcome flags,
and retry stage against this baseline.

## Staging quality-diagnostic package deployed — 2026-10-22

- [x] The approved generation diagnostic package is on feature branch
  `codex/exgen-generation-quality-2026-10-20`, commit
  `af37cfa40924f1c09d9b3e54300706457bbabef0`. Vercel deployment
  `dpl_GjZgfGUr6wTxssvPi1Sp1RSwoTHu` is READY as a branch Preview. No
  Production or `main` change was made.
- [x] Added nullable, batch-level `verification_passed` diagnostics to
  verifier/blind-solver usage events, including initial and repair checks.
  Completed checks record true only when all checked candidates pass, false
  when any are rejected, and null/omitted when the check is unavailable or
  has no usable candidates. No candidate acceptance or quality gate changed.
- [x] Corrected the reported failure stage when normalized repair output has
  no structurally valid candidates: it now records
  `repair_structural_validation`, not the stale `repair_normalization` stage.
  Added HTTP-path coverage proving rejected repair candidates do not reach the
  verifier or solver, plus serialization and privacy assertions.
- [x] The existing staging schema already has nullable boolean
  `ai_usage_events.verification_passed`; no migration was required or applied.
  Preview variable metadata is branch-scoped to the feature branch; values
  were not read. No account, role, quota or secret was changed.
- [x] Focused nine-file generation/API/PGlite/budget/recovery/progress tests
  passed 71/71. Browser exam-flow regression passed 191/191. Relevant
  `node --check` and `git diff --check` passed. Independent API/time and
  security/idempotency reviewers found no blocker in the reviewed scope.
- [!] No new paid/live model request was made for this commit. The existing
  browser session still contains an active 12-question exam with unanswered
  questions; it was left untouched. The prior staging ledger snapshot showed
  one successful 12/12 job among four recent jobs, which is insufficient to
  establish repeat reliability. The earlier recorded budget balance is a
  point-in-time snapshot, not a current balance or authorization.

**PILOT NOT READY.** The next live evidence requires a clean, signed-in
staging session after the existing exam is safely completed or cleared by its
owner. Then run one bounded synthetic 12-question test and inspect its
sanitized quality outcomes, progress and spend. Do not claim that the new
telemetry has been verified in hosted persistence until that test succeeds.

## Local quality-gate outcome telemetry — 2026-10-22

- [x] Added batch-level `verification_passed` usage metadata for completed
  verifier and blind-solver checks. A completed check with any rejected
  candidate records `false`; a fully accepted checked batch records `true`.
  Unavailable calls, empty checks and invalid counts remain `null`/omitted.
- [x] Confirmed the staging `ai_usage_events.verification_passed` column is
  nullable boolean, so this change needs no migration. The serializer accepts
  strict booleans only, and the helper does not alter candidate acceptance or
  quality gates.
- [x] Focused offline suite passed 58/58. The actual HTTP generator path for
  3/6/12 asserts `true` for fully approved verifier and solver batches, while
  the rejected repair fixture asserts `false`; source-privacy assertions still
  exclude question and study text. This does not prove hosted persistence.
- [x] Repair-budget assertions now pin both sides of the strict minimum:
  26,000ms declines ordinary repair while 26,001ms allows 4,001ms generation;
  internal repair similarly transitions at 16,001ms. The budget itself is
  unchanged.
- [x] The browser exam-flow regression passed 191/191 with mocked APIs. The
  separate budget/recovery suite passed 14/14 before the two exact-boundary
  assertions were added; the updated budget test then passed again.
- [!] The telemetry change is local and not deployed. Staging persistence and
  aggregate diagnosis remain to be verified after a separately approved,
  revision-synced Preview test.

## Staging package revalidated — 2026-10-22

- [x] Read-only Vercel check found the latest READY Preview on the approved
  feature branch at `9fedd1029d1f88ad9b4287b77665da53961d5163`. The Supabase
  migration ledger contains the resumable pipeline, owner-scoped claim,
  retention, scheduled cleanup, preflight-budget release and repair-feedback
  migrations. No migration needed to be applied in this pass.
- [x] The protected staging budget currently reports cap `$5.000000`, spent
  `$0.528050`, reserved `$0.225728`, remaining `$4.246222` at 17:59 UTC. This
  internal ledger is not a provider invoice and is not additional authorization.
- [x] A fresh focused offline run passed 49/49 across the pipeline unit/HTTP,
  Postgres-emulation, issuance-idempotency and progress-recovery tests.
- [x] Sanitized staging aggregates for the last 14 days show four 12-question
  jobs: one succeeded at 12/12 on the current Preview, two terminalized at 2/12
  with `STAGE_RETRY_LIMIT`, and one hit `OPERATION_DEADLINE` at 0/12 before any
  model event. For the retry-exhausted jobs, the stored usage aggregate shows
  23 model events (9 generation, 14 comparison-verifier), mean latency 11.3s
  and max 24.2s. The successful job shows 16 model events, mean latency 9.2s
  and max 23.4s. This supports quality/retry and latency/setup failure paths,
  but does not reveal individual candidate rejection reasons.
- [!] The staging browser still has an active 12-question exam with all
  questions unanswered; its branch alias resolves to the latest READY Preview
  at `9fedd10`. The matching staging job succeeded at 12/12 at 17:59:48 UTC.
  The exam was left untouched and no additional paid model call was started.
  A 6-hour runtime-log query was unavailable under the current Vercel retention,
  and narrower queries returned no runtime events, so per-batch rejection
  reasons cannot be recovered from hosted logs.
- [x] Latest independent API/time and security/idempotency review found no
  blocker in the widened repair test. Added explicit assertions for all five
  repair candidate stems and private payload markers absent from batch
  telemetry, exactly one quota increment on initial issuance, and no second
  issuance or quota charge on replay. The focused HTTP test passed 2/2.

**PILOT NOT READY.** After the active exam is completed or safely cleared by
its owner, run another bounded synthetic 12-question test to assess repeat
yield, then inspect spend and any new sanitized failure aggregates. Current
live evidence is one success in four recent staging jobs; do not describe this
as reliable repeatability.

## Staging refresh and deadline assertion — 2026-10-22

- [x] Read-only refresh confirmed the READY feature Preview at commit `9fedd10`
  uses the approved staging project and branch. The staging migration list
  includes the resumable pipeline, repair-feedback and budget-guard migrations.
- [x] The generation implementation at `9fedd10` is identical to successful
  live-run commit `a607edc`; the intervening diff contains only these status
  documents. Existing staging UI showed an already-open 12-question exam, so
  it was left untouched and no additional paid model request was started.
- [x] Current protected staging spend row: cap `$5.000000`, spent `$0.528050`,
  reserved `$0.225728`, remaining `$4.246222`. This internal ledger is not a
  provider invoice and the remaining amount is not a new allowance.
- [x] Focused nine-file generation/API/PGlite/recovery/budget/progress/runtime
  suite passed 67/67. Reused API/time and independent security reviewers found
  no implementation blocker. A test-evidence finding was fixed: the simulated
  remaining-time assertion now uses the actual `deadlineAt` passed to the
  generator rather than a hard-coded route duration. The HTTP test passed 2/2;
  syntax and diff checks passed.
- [x] Browser-backed exam-flow regression passed 191/191 with zero failures,
  including visible progress, resume, incomplete-answer states, mobile layout
  and P.E.R context. This is local UI evidence with mocked APIs.
- [x] Rechecked the 4-second streamed-repair minimum: the helper starts repair
  only when the minimum generation window plus independent-review and
  finalization reserves fit. Truncated repair output is normalized and gated;
  verifier approval and the MC blind solver remain required before acceptance.
  Budget and offline-pipeline tests passed 2/2 in this follow-up.
- [x] Postgres/PGlite ownership, lease-fencing, 3/6/12 partial floors,
  idempotent issuance/replay, quota commit/refund and private ACL tests passed
  20/20. This is local database-emulation evidence, not hosted RLS proof.
- [!] The timing test remains fake-clock arithmetic with mocked provider
  responses; it is not measured live latency or real timeout-abort evidence.
  This refresh does not add another live model run or prove repeated yield.

**PILOT NOT READY.** Keep the existing staging exam intact. After it is
completed or otherwise safely cleared by its owner, run another bounded,
synthetic 12-question test to measure repeatability under the existing cap.

## Offline HTTP coverage for widened repair boundary — 2026-10-22

- [x] Extended `tests/api/exam-generation-pipeline-http.test.mjs` to reach the
  five-candidate repair batch through authenticated HTTP start/advance and
  PGlite-backed claim/checkpoint operations. The path begins with three
  independently verified questions, preserves them across a failed first
  repair attempt, and confirms the subsequent persisted claim requests exactly
  five candidates.
- [x] The actual generator, verifier, blind solver, and issuance logic run
  against deterministic synthetic provider responses. The five-question
  verifier request is asserted between 54,000 and 60,000 serialized characters.
  One verifier-rejected question and one exact solver/key-mismatch candidate
  are both excluded; only verified candidates checkpoint. The same job then
  resumes to 12/12, issues once, and replays without new provider calls or a
  second quota charge.
- [x] Synthetic Date.now advancement covers setup, three model endpoints, and
  the checkpoint RPC, leaving at least 12 seconds by arithmetic. This is a
  fake-clock budget test, not measured wall-clock latency or a timeout/abort
  experiment.
- [x] Focused eight-file pipeline/API/PGlite/recovery/budget/progress suite
  passed 63/63. The HTTP test passed 2/2; `node --check` and `git diff --check`
  passed. API/timeout and security/idempotency reviewers found no blocker after
  the follow-up assertions.
- [!] Provider/reviewer/solver outputs remain mocks and database behavior is
  local PGlite. No staging, live-model, concurrency, Vercel, production, push,
  migration, or paid verification was performed. Earlier staging evidence is
  one successful 12/12 run, not general yield reliability.

**PILOT NOT READY.** Next evidence step remains a separately approved,
budget-checked staging run on a revision-synced Preview; this local test does
not establish real model latency, quality or yield.

## Repair feedback, batch identities and visible progress prepared locally — 2026-10-22

- [x] Confirmed a source-level cause of lost approved questions: model IDs are
  local to a generation batch, but pipeline accumulation previously treated
  their reuse as an exam-wide duplicate. Reviewed candidates now receive IDs
  scoped to the server job/lease before checkpointing. Content-based duplicate
  checks remain unchanged; telemetry distinguishes content duplicates from
  within-batch ID collisions. This does not prove which duplicate category
  caused the older hosted run, whose private candidates were already scrubbed.
- [x] Also fixed raw ID collisions between first-round and inline repair
  candidates: rename only after independent verifier/solver acceptance and
  preserve the matching verifier-map entry used for final validation metadata.
  Rejected candidates remain excluded.
- [x] Underfilled reviewed batches now enter the existing repair stage for a
  fresh request budget. A new service-only checkpoint wrapper atomically writes
  bounded, allowlisted review/solver counts into the private job payload;
  zero-progress retries retain the existing attempt limit. Existing terminal
  and retention scrubbing clears the feedback with the rest of the payload.
  No rejected candidate text, source excerpts or answer keys are added to it.
- [x] Added an engine progress callback to the visible exam flow, a polite
  status beside the generation button and accurate multi-minute waiting copy.
  The result-screen regenerate path reuses the same status component.
- [x] Focused eight-file offline suite passed 62/62. Actual generator HTTP tests
  use mocked provider/reviewer/solver responses, deliberately reuse q1/q2/q3
  across 3/6/12 runs and within inline repair, assert cross-request feedback
  prompts, reject old question stems, preserve verified checkpoints and exercise
  issuance/replay/quota invariants. SQL/PGlite tests also reject invalid feedback,
  wrong/expired leases, wrong stages and client-role reads/execution; preserve
  bounded retries and terminal cleanup. These are sequential local checks.
- [x] Reused API and independent safety reviewers found no remaining blocker
  in the local implementation; both reran the HTTP test. Server JS syntax,
  all four inline app scripts and diff whitespace checks passed.
- [x] Browser regression passed 191 checks with zero failures. Reviewed desktop
  and 390px mobile progress screenshots; the count is inside the viewport beside
  the generation button and is announced politely. The language fixture now
  reuses its already-open start screen rather than aborting a pending mocked
  Auth request with an unnecessary reload; Auth errors are still checked.
- [!] Migration `20261022170148_checkpoint_exam_repair_feedback.sql` and the
  new code remain local. Apply the migration before the matching feature
  Preview; old code does not require the new function. No new hosted write,
  push/deploy, paid test, account/role/quota change, main or production change
  was made during this follow-up. A corrected live 12-question run is still
  required. Read-only refresh confirms the enabled USD 5 cap and remaining
  USD 4.530004; the latest hosted migration is still the preflight-release
  migration, so the new repair-feedback function is not installed.

Commands executed for this follow-up:

```sh
node --test --test-reporter=spec tests/api/exam-generation-pipeline.test.mjs tests/api/exam-generation-pipeline-http.test.mjs tests/api/exam-generation-pipeline-postgres.test.mjs tests/frontend/exam-generation-progress.test.mjs tests/api/exam-pipeline-offline.test.mjs tests/api/exam-generation-recovery.test.mjs tests/api/exam-regeneration-budget.test.mjs tests/api/ai-budget.test.mjs
node tests/frontend/exam-flow.regression.mjs
node --check api/generate-exam.js
node --check api/_exam-generation-pipeline.cjs
node --check api/_exam-generation-operations.cjs
node --check js/exam-flow.js
git diff --check
```

Additionally parsed the four inline app scripts with `vm.Script`. The exact
14-file release scope is in `17_GENERATION_STAGING_CHECKLIST.md`.

## Approved staging package executed; live 12-question acceptance failed — 2026-10-22

This section supersedes earlier pending-approval/deployment snapshots below.

- [x] User approved the staging package. Committed generation changes as
  `f06ad7df27162f4f29dac3c0710db342f679ad59` and pushed the existing feature
  branch only. Vercel deployment `dpl_5iw7aHseSpgXNaYXLkZqQ5bm9i1V` is READY
  at that SHA. Its automatic branch alias retained a usable staging session;
  no credentials or alias configuration were changed.
- [x] Applied the four checklist migrations in order to staging
  `yhcinqejsocpmmetazpz` only. Hosted checks deny anon/authenticated execution
  of all four new RPCs and grant service_role execution. Pipeline and schedule
  ownership tables have RLS enabled and deny client SELECT; retention cron is
  active every 15 minutes. The ownership migration does not itself enable RLS,
  so its observed hosted RLS state is not proof of portable migration behavior.
- [x] Verified Preview branch-scoped variable metadata without reading values,
  and fetched deployed public runtime configuration: staging project present,
  production project absent. Post-commit sitemap test passed. Independent
  release reviewer reran 22 local pipeline/HTTP/PGlite tests successfully.
- [!] One synthetic Mathematics 2b/C/short-answer/12-question UI test ran as
  job `080ceb86-2647-46da-8399-2c9dd3d4ee2b`, 16:54:51–16:57:04 UTC.
  Four batches requested three candidates each; reviewer approved 2/1/1/1
  and rejected 1/2/2/2. Each later approved candidate hit the duplicate guard.
  Progress remained 2/12; terminal code was `STAGE_RETRY_LIMIT`. No exam was
  issued, ledger is retryable with no response, private checkpoints were
  scrubbed on terminal failure. UI correctly reported 2/12 and no issued exam.
  This is a failed full-count acceptance test, not pilot readiness.
- [!] Batch latencies were 29.605/30.441/32.329/33.093 seconds. Inline repair
  did not start in the first three batches; the last attempted repair failed
  normalization. Review failures included answer_alignment and required_changes.
  Source review confirms the repair time gate needs more than 16 seconds
  remaining within the roughly 45-second worker budget. No rejected-candidate
  feedback is persisted for the next batch; the repair stage is not entered.
  Duplicate telemetry combines ID collisions and semantic matches, so this
  evidence does not distinguish their contributions.
- [!] Visible exam-flow UI kept the static under-a-minute promise; progress
  updates currently target the hidden legacy status element. Bridge progress
  into the visible flow and implement reviewed cross-request repair next.
- [x] Budget before/after: spent USD 0.208611 -> 0.244268, reserved unchanged
  at 0.225728, remaining USD 4.530004 of total cap 5. Delta USD 0.035657 is
  application budget accounting, not a verified provider invoice. No further
  live attempt, account/role/quota/secrets change, main merge or production write.
- [!] Successful live issuance/replay, hosted concurrent claims and full-count
  acceptance remain unverified. Do not restart paid attempts on unchanged code.

## Failed AI-cost settlement preserves the cap — 2026-10-22

- [x] Added a PGlite integration test connecting the actual budgeted-fetch and
  settlement helpers to the existing SQL migration. A provider transport error
  followed by unavailable settlement leaves the reservation held at the cap;
  the next request is rejected before another provider call. Later conservative
  settlement, repeated twice, leaves spent at USD 5 and reserved at zero.
- [x] Budget unit/stream and migration tests passed 9/9. Independent read-only
  review found no blocker; syntax and diff checks passed. Renamed the existing
  sequential cap test to avoid implying concurrency evidence.
- [!] This proves sequential local SQL/client behavior with synthetic provider
  and RPC routing. It does not establish hosted behavior, concurrency, or an
  automatic recovery mechanism for historical held reservations. The already
  requested staging-package approval remains pending; no external writes made.

## Repair-stream timeout and conservative staging spend settlement — 2026-10-22

- [x] Added a real-generator HTTP/PGlite scenario in which independent review
  rejects one candidate and the subsequent repair stream aborts. Both approved
  initial candidates survive; the same operation resumes to 12 verified
  questions, issues once, charges exactly one exam quota unit, and replays
  without new provider calls or quota use.
- [x] Fixed handled provider failures leaving AI spend indefinitely reserved.
  Generation stream finalization settles measured usage when available and
  explicitly uses the full reservation estimate when usage is unknown. Fetch
  exceptions settle conservatively before rethrowing. Non-stream structural
  repair also settles in a finally block after response reading/parsing.
  The cap is unchanged;
  estimated settlement must not be reported as an exact provider invoice.
- [x] Eight-file generation/budget/recovery/progress suite passed 59/59. The
  repair-abort case uses actual generator logic and mocked provider streams;
  budget tests enable the staging guard with synthetic requests and check abort,
  fetch failure, HTTP failure, missing usage and measured usage.
- [x] Reused independent reviewers checked the repair-abort assertions and
  settlement changes. Follow-up assertions establish all 12 checkpointed
  questions are verified and the entire operation uses one exam quota unit.
  Final safety review found no blocker in the handled settlement paths.
- [!] Process termination or a failed settlement RPC can still leave a safe
  held reservation. Historical held amounts were not changed. No automatic
  release of unknown provider costs is permitted by this fix.
- [!] Read-only refresh confirms remote branch and latest READY Preview remain
  at `a66a7f1`; local HEAD is `dd0b4f1` plus this diff. Hosted migrations still
  stop at `20261022092012`. No current-code live yield is established.

See `17_GENERATION_STAGING_CHECKLIST.md` for the scoped release and remaining
live evidence. No push, deploy, migration, or production action was performed.

## Correlate batch quality events with the pipeline job — 2026-10-22

- [x] Successful and failed batch events now use the same strictly allowlisted
  `exam-pipeline:<job UUID>` correlation key as pipeline setup and model-usage
  events. Per-batch idempotency keys remain internal and are not confused with
  the parent job. The event still excludes user ID, source material and question
  text.
- [x] Added sanitizer and end-to-end assertions for the shared correlation ID.
  The focused seven-file generation/API/PGlite/recovery/budget/UI suite passed
  52 tests; independent generation reviewer found no local blocker in the
  reviewed changes.
- [!] This enables future diagnosis only when the exact code reaches a synced
  Preview and telemetry is captured. Current offline tests do not explain the
  historical hosted zero-progress job or prove model yield.

## Back off polling while a worker lease is active — 2026-10-22

- [x] The browser now uses bounded exponential backoff (1.2, 2.4, 4.8, 9.6,
  then 15 seconds) while an operation reports `working`, instead of repeatedly
  calling the advance endpoint every 1.2 seconds during another worker's lease.
  Newly approved progress or a transport failure resets the wait to 1.2 seconds.
- [x] Added a UI regression proving the same operation resumes and returns its
  complete exam after the lease clears. The focused seven-file pipeline/API/
  PGlite/recovery/budget/UI suite passed 52 tests; the XelioV context-loader
  suite passed 3/3; test syntax and `git diff --check` passed.
- [!] This reduces polling pressure but does not make the job server-driven:
  progress can still pause if the browser closes. Tests remain offline and do
  not establish hosted lease behavior or live model yield.

## Correlate generation setup failures — 2026-10-22

- [x] The advance handler now emits one allowlisted setup event before every
  claim-result branch, including RPC-unavailable responses. It records a
  pipeline correlation UUID, outcome, and numeric auth/claim/remaining-time
  measurements without database error text, user identity, or study content.
- [x] HTTP/PGlite regression covers both failure boundaries. A pre-execution
  RPC rejection returns 503 without state mutation. A committed claim whose
  response is lost returns 503 with a running lease; immediate replay reports
  `working` without a second stage attempt or quota effect, and the job issues
  exactly once after lease expiry and recovery. Setup timing uses the earlier
  of route and job deadlines.
- [x] The focused seven-file generation/recovery/budget/UI suite passed 49
  tests; the XelioV context-loader suite passed 3/3. Both reused reviewers
  confirmed the retry lifecycle and found no new local blocker.
- [!] Offline-only diagnostic coverage. It can distinguish a future claim/RPC
  failure from time spent after claim, but cannot retrospectively identify the
  cause of the old zero-progress staging job because its deployed code had no
  correlated setup event.

## Task-specific agent context loader — 2026-10-22

- [x] Added `npm run xeliov:context -- --task "<task>"` to print a bounded
  packet with relevant reusable reviewer roles and matching reviewed lessons.
  It is deterministic, local, stdout-only, and does not invoke agents or write
  into XelioV. `AGENTS.md` now asks substantive sessions to use it; full ledger
  reads remain appropriate for broad audits.
- [x] Added CLI regression tests for role/lesson selection and missing-task
  usage. The independent read-only workflow review confirmed the existing
  role-card/curated-ledger model and cautioned that snapshots can be stale and
  captured agent claims require source verification.
- [x] Applied the loader to the active generation task and changed it to surface
  only `VERIFIED` ledger entries. A fixture confirms `PROPOSED` and `REJECTED`
  lessons stay out of the reviewed-learning section; focused loader tests pass
  3/3. The ExGen role packet and task-specific verified lessons were emitted
  locally for this session.
- [!] The packet is a lexical navigation aid, not automatic memory learning.
  Status, source, Git state, live services, and each proposed ledger lesson must
  still be checked; historical agent instances and private reasoning are not
  preserved.

## Make the project brain safer and usable in every coding session — 2026-10-22

- [x] Codex and Claude project instructions now point to the same task-context
  loader and closeout rules. The role cards, curated ledger, and task-ranked
  packet are usable in this checkout; this is role reuse, not persistence of
  historical agent instances.
- [x] The loader no longer echoes the task argument, prints only allowlisted
  status/evidence/finding/limitation fields for reviewed lessons, and redacts
  common key, bearer, private-key, and email patterns. Added
  `npm run xeliov:context:test`; the privacy/selection suite passed 4/4.
- [x] Independent workflow and privacy reviews confirmed current usability and
  identified the task echo/full-entry output risk; tests cover the mitigation.
- [!] Redaction catches common patterns, not arbitrary sensitive content. Keep
  task arguments and ledger entries free of secrets/private learner data; stale
  lessons must still be checked against current source.

**Next:** continue offline reliability work using the selected generation,
quality, and recovery roles. Live staging/Preview steps remain subject to the
existing explicit approval and version/schema synchronization gates.

## Real generator through resumable HTTP issuance — 2026-10-22

- [x] Added a synthetic Responses API fixture to the HTTP/PGlite harness and
  exercised real `start → advance → issuance` flows for 3, 6 and 12 MC questions
  through `generateVerifiedBatch`, structural checks, independent verifier,
  blind solver, checkpoints and the existing quota/issuance path.
- [x] Each requested count must complete exactly, checkpoint only
  `validation_status=verified` questions, consume one reservation and issue
  once. Replay returns the exact result without new generation, finalization,
  usage events, quota consumption or issuance. Correlated generation/review
  telemetry excludes question and source text; successful completion clears
  private payload/checkpoint data.
- [x] A read-only test/recovery reviewer independently identified the prior gap:
  3/6/12 start/advance coverage used pre-verified generator stubs, while actual
  internal generator coverage only exercised provider abort. The new fixture
  closes that integration gap without calling a provider.
- [x] The real-generator HTTP fixture now includes a verifier rejection and a
  bounded repair batch for the 12-question request. The rejected candidate is
  not issued; all final 12 pass the structural gate, independent verifier and
  blind solver. This extends mocked/offline coverage, not live-model evidence.
- [x] An independent security/idempotency/quota review found no weakened quality
  gates. It also noted that sequential replay tests do not prove concurrent
  claim contention or hosted RLS/ACL isolation. The focused seven-file offline
  suite passed 49/49 in the latest rerun.
- [!] Offline integration only. Mocked model outputs are predetermined and do
  not establish real-model semantic quality, 12-question yield, hosted behavior,
  or provider latency. The PGlite/fetch harness also does not establish hosted
  Supabase RLS/ACL behavior or two-connection contention. Existing
  staging/Preview synchronization and approvals remain prerequisites for live
  verification.

## Repair recovery and response-budget review — 2026-10-22

- [x] Extended the actual-generator HTTP fixture with a verifier-rejected
  low-source-alignment question. The real bounded repair runs, the rejected
  question is absent from issuance, and all 12 replacement/retained questions
  reaching the final checkpoint are verified by the structural gate, verifier,
  and blind solver.
- [x] Fixed a response-state mismatch after retry exhaustion: when the database
  moves an eligible partial job to `assemble`, the API now reports
  `state=assembling`, `stage=assemble`, and exact approved/requested counts
  instead of incorrectly saying `retrying`. The HTTP test checks the
  intermediate response before the final partial issuance.
- [x] Clarified and tested the internal verifier's 18-second timeout cap. The
  3-second response/usage margin is deducted separately from remaining time;
  it is not part of the verifier cap. Existing generation and finalization
  margins are unchanged.
- [x] The API/timeout reviewer rechecked the follow-up corrections; the
  security/idempotency reviewer found no blocker in the updated response/budget
  paths. Focused tests and syntax checks passed; see this session's handoff for
  exact commands.
- [x] The standalone Playwright exam-flow regression now waits for the active
  wizard panel's entrance animation before its next click; it passed 186/186.
  Reduced-motion emulation was not retained because it masks animation-related
  assertions. No live provider, staging, deployment, migration, or production
  action was performed.

## Fresh read-only Preview and staging verification — 2026-10-22

- [x] Re-read the current branch and external state. Local HEAD is `dd0b4f1`
  with an existing dirty worktree; the latest READY branch Preview remains
  `a66a7f1` (`dpl_CGLkFkw6u6XRYkq5YUgH3fgczVd5`).
- [x] Staging project `yhcinqejsocpmmetazpz` is `ACTIVE_HEALTHY`. Hosted
  migrations end at `20261022092012`; local migrations `20261022140100` through
  `20261022140400` are not applied there.
- [x] Read-only budget aggregate: cap **$5.000000**, spent **$0.208611**,
  reserved **$0.225728**, remaining **$4.565661**. This is a snapshot, not
  authorization for a provider request.
- [x] In the last seven days, one 12-question pipeline job failed with
  `OPERATION_DEADLINE`, 0/12 progress, parent request `retryable`, and quota
  enforcement false. No `exam-pipeline:` usage events exist for the period.
- [!] Same-owner/time-window usage had 11 `generate` events (mean 22.619 s,
  p95 25.712 s) and 16 `verify_compare` events (mean 5.447 s, p95 8.997 s).
  The deployed `a66a7f1` predates the new job correlation; these nearby events
  cannot be assigned to the failed job and contain no verified/rejected counts.
  Exact zero-progress cause remains unresolved; do not infer model under-yield.
- [!] Vercel runtime-log lookup for that historical window returned a retention
  error: the project's Hobby plan only retains one hour. This is not evidence
  that no logs existed; capture the correlated events immediately after the next
  authorized Preview test.
- [!] No push, deploy, migration or paid call was performed. The hosted project
  cannot validate current local code until exact revision/schema sync is approved.

## Reusable agent workflow applied to end-to-end generation — 2026-10-22

- [x] Loaded the project role cards and ledger, then reused three read-only
  reviewers for API/timeout, tests/recovery, and security/idempotency/quota.
  One writer kept sole ownership of the test file.
- [x] Test/recovery review found that 3/6/12 worker completion and 12-question
  start replay were covered separately, but real HTTP `start -> advance ->
  issue` was not covered for every requested count. Added that integration path
  for 3, 6 and 12, checking exact final count, one quota consumption and one
  issuance per run.
- [x] Focused seven-file pipeline/API/PGlite/recovery/budget/progress suite
  passed 49/49 after the addition. The HTTP/PGlite file passes 2/2; the browser
  exam-flow regression passes 186/186; syntax check and `git diff --check` pass.
- [x] Independent security review found no actionable local issue in
  ownership, claim fencing, retry, quota or migration order. API/timeout review
  confirmed setup beyond the six-second preflight allowance safely releases
  the worker without consuming a generation attempt.
- [!] Offline evidence only. Hosted setup latency, migration/ACL/cron behavior,
  and real-model 12-question yield remain unverified. Keep the quality window
  and gates unchanged; investigate setup latency from sanitized hosted metrics.

## Persistent agent knowledge loop and current verification — 2026-10-22

- [x] Made the reusable knowledge loop actionable in `AGENTS.md`: substantive
  sessions load current status, role cards and the curated ledger; reviewers are
  read-only by default; material status is recorded at closeout; only reusable,
  independently checked findings enter the ledger. Replaced the unsafe default
  `git add -A`/commit-before-feature instruction with exact-file staging and
  explicit commit authorization.
- [x] Reused the security/idempotency reviewer role on local HEAD `dd0b4f1` plus
  the dirty diff. It reported no actionable local blocker. Its offline review
  covered owner-scoped claims, lease fencing, preflight release, retention,
  quota settlement and telemetry correlation; hosted ACLs, cron and deployment
  behavior remain unverified.
- [x] The complete serial offline test-file run exited 0:
  `node --test --test-concurrency=1 --test-reporter=dot $(rg --files tests -g '*.test.mjs' -g '*.test.js' | rg -v '^tests/live/')`.
  The focused generation/API/Postgres-emulation/recovery/budget/progress suite
  also exited 0; `git diff --check` and syntax checks passed.
- [!] No push, deployment, hosted migration, quota change or paid provider call
  occurred. The current local worktree is ahead of the READY Preview and the
  new owner-scoped migration is not in staging; no live 12-question improvement
  is claimed.

## Backoff and retry-exhaustion boundaries — 2026-10-22

- [x] Applied the reusable ExGen role cards in this work session: API/timeout, tests/recovery, and security/idempotency/quota reviewers worked read-only on the same local branch. One writer integrated fixes; follow-up reviews checked the resulting narrow diffs.
- [x] Added bounded exponential client backoff for repeated `GENERATION_BUDGET_INSUFFICIENT` responses: 1.2s, 2.4s, 4.8s, 9.6s, capped at 15s. The same operation resumes after the miss clears. Frontend progress suite passes 8/8.
- [x] Added HTTP/PGlite retry-exhaustion salvage boundaries for 3/6/12 questions: 2/3, 4/6 and 8/12 can be finalized as explicitly partial; one below each floor returns a safe 502, refunds once and issues nothing. Replay asserts response, generation/finalization count, quota reservation/profile count and issuance count.
- [x] Added whole-row and parent-request before/after assertions that expired lease or persistent deadline rejects preflight release without mutating the job/request; reservation and profile quota count remain unchanged.
- [x] Final focused generation pipeline/API/database/recovery/budget/progress/partial-delivery suite exited 0; the same suite previously reported **49/49**. `git diff --check` passed after the changes.
- [!] Offline/synthetic only. A local mocked SSE stream now proves the actual internal generator's abort signal reaches the provider-fetch boundary; the pipeline preserves its prior checkpoint and resumes. The stream contains no usable SSE content, and recovery uses a stub generator, so partial stream salvage and live model yield remain unverified. The current READY Preview remains behind the dirty local worktree and staging migration `20261022140100` remains absent; no provider/staging request was made.

**Next:** use the separately approved Preview/staging path only after exact branch/deployment/schema and current spend cap are reverified. Do not claim live 12-question yield improvement yet.

## Fresh branch and staging readback — 2026-10-22

- [x] Local branch is `codex/exgen-generation-quality-2026-10-20`, HEAD `dd0b4f1`; `origin/codex/exgen-generation-quality-2026-10-20` is an ancestor at `a66a7f1`, so local HEAD is two commits ahead (`c2b39f5`, `dd0b4f1`). The dirty working tree has additional local edits. Preserve them; do not force-push or assume the current Preview contains these changes.
- [x] Vercel read-only lookup found the latest branch deployment READY at commit `a66a7f1`, URL `https://provia-854p66c3v-eltons-projects-4adfb1a3.vercel.app/app.html`. It is two commits and the dirty local edits behind the current local HEAD/worktree.
- [x] Supabase read-only verification identifies `yhcinqejsocpmmetazpz` (`exgen-pilot-staging`) as `ACTIVE_HEALTHY`. Hosted migrations currently end at `20261022092012`; local owner-scoped claim migration `20261022140100` is absent.
- [x] The read-only staging spend row is enabled with cap **$5.000000**, spent **$0.208611**, reserved **$0.225728**, remaining **$4.565661**. No provider call or schema change occurred in this readback.
- [x] Sanitized last-seven-day model telemetry: `gpt-4o-mini-2024-07-18` initial generation 46 calls, average 14.024 s / p95 24.292 s / max 26.026 s; repair 25 calls, average 13.754 s / p95 20.382 s / max 22.896 s; comparison verification p95 6.393 s; blind solver p95 2.662 s. These aggregates are from the hosted period, not correlated to local HEAD.
- [x] One hosted 12-question pipeline job ended `OPERATION_DEADLINE` at **0 approved questions**, after 1,558 seconds; its parent request was `retryable` and `quota_enforced=false`. This confirms a real no-progress deadline failure, but current safe aggregates do not establish whether model under-yield, quality rejection, or orchestration caused that individual job.
- [!] Live verification remains blocked for the current local revision: the owner-scoped migration is absent, the existing READY Preview is two commits behind the local base plus dirty changes, and the current push/deploy/migration approval request has not been answered.

## Reusable reviewer workflow applied to exam generation — 2026-10-22

- [x] Loaded the project role cards and learning ledger, then used the existing security/idempotency/quota and test/recovery reviewers plus the exam-quality reviewer on the current local HEAD `dd0b4f1` and dirty diff. Security review found no concrete local blocker but left hosted ACL and true concurrent-connection contention unverified. Test/recovery review passed its focused suite and requested an integrated all-rejected HTTP regression. Exam-quality review found the terminal retry status bug fixed below, optional verifier/solver model separation, and a 3/6/12 gap in the all-rejected HTTP matrix. No agent edited code; one writer integrated and verified the changes.
- [x] Added an integrated all-rejected HTTP/PGlite matrix for requested counts 3, 6 and 12. The terminal retry now returns `502 incomplete_exam` on the same final request after job terminalization/refund, with the actual requested/approved counts and no issued exam. Intermediate retries remain resumable.
- [x] Propagated the same terminal response for repeated batch/transport failures, not only HTTP-200 batches whose candidates fail review. Added 3/6/12 coverage for terminal response, payload cleanup, exact quota refund, no issuance and stable terminal replay. The updated HTTP/PGlite file passes **2/2**.
- [x] Follow-up test/recovery review identified residual gaps: replay after terminal all-rejected failure, exact `profiles.mock_quota_count` restoration, and the browser's 0/N failure state. Added coverage including exact terminal-response replay equality, no second generation/refund, and a disabled grade action. The HTTP/PGlite test passes **2/2**; `node tests/frontend/exam-flow.regression.mjs` passes **186/186**. One preceding browser run had a transient Supabase auth `ERR_ABORTED`; the immediate rerun passed all 186 checks.
- [x] The focused pipeline, database-emulation, recovery, budget, progress and partial-delivery command passed **44/44** before those additional assertions; the changed HTTP/PGlite file was rerun afterward and passed **2/2**. A separate 17-file quality/assessment/UI run passed **36/36** before these test-only additions. This remains offline evidence; no model provider or staging request has run against local HEAD.
- [x] The focused resumable-pipeline HTTP/PGlite/API suite passed **35/35**, including 3/6/12-question completion, partial eligibility/counts, retry/replay, quota/issuance gates, setup deadline and owner-scoped lease tests.
- [x] A second targeted run of 12 verifier, solver, grounding, assessment, delivery and frontend-progress test files exited successfully. Node's test runner reported **26/26** formal subtests; the repository's assertion-script tests also printed their success markers. The partial-delivery browser test verified correct 2/3, 4/6 and 8/12 labels and rendering only approved questions.
- [x] Fresh full serial run across **190** test files completed. All passed except the unrelated `tests/frontend/sitemap-lastmod.test.mjs`. The failure was reproduced alone: `sitemap.xml` says `app.html` was last modified on 2026-10-21, while the current Git date is 2026-10-22. `app-auth-gate` passed in this full run; the earlier full-run failure was not reproduced. The sitemap was left unchanged as out of scope.
- [x] `node --check` passed on the four changed generation modules; `git diff --check` passed.
- [!] This is offline evidence using mocked/model-independent fixtures. No live OpenAI generation was performed. The hosted staging schema still lacks the local owner-scoped claim migration, so this revision is not ready for provider-backed staging verification until the migration and exact Preview are separately authorized and present.
- [!] The reviewers identified that model separation is configuration-dependent: verifier and solver can fall back to the generator model if their dedicated environment settings are absent. Runtime configuration was not inspected in this review; do not claim independent model weights until the exact Preview configuration is verified.
- [x] The follow-up test/recovery reviewer verified the replay, exact quota baseline, and zero-count UI assertions in source. A final precision pass also verified exact response equality and disabled grading. Reviewer did not rerun tests; local commands above are the direct test evidence, not hosted behavior.

**Next:** the outstanding approval for commit/push, exact Preview, staging migration and one bounded synthetic 12-question run is still required. Do not infer improved live-model yield from these offline results.

## Retry-limit propagation follow-up — 2026-10-22

- [x] Used the existing role cards and ledger as the working agent system; the playbook/ledger are loaded by `AGENTS.md` for each substantive ExGen task. Creating a separate Spaces spreadsheet was attempted, but the service rejected it with `invalid_page_schema`; no workbook was created, and the repository Markdown remains the source of truth.
- [x] A second exam-quality review found two paths that could flatten terminal `retry_limit` to an ordinary retry: final assembly validation and the defensive invalid-stage branch. Both now preserve `retry_limit`, allowing the advance handler to return its existing `502 incomplete_exam` contract.
- [x] Added HTTP/PGlite coverage for repeated finalization failure through terminalization, quota refund, payload/question cleanup, safe replay, and no duplicate generation; added a unit test for invalid-stage terminal propagation. The invalid stage cannot be seeded through the schema because its CHECK constraint rejects it, so that defensive branch is unit-tested only.
- [x] Added no-repeat generation/finalization and unchanged quota/reservation assertions to successful full, partial, and eligible-partial replays. Focused five-file pipeline/HTTP/PGlite/recovery/budget suite passed **35/35** after the final assertions. The independent test reviewer confirmed the quota assertions match the migration semantics.
- [x] Independent exam-quality reviewer confirmed all four `retryPipelineStep` callers preserve terminal status and found no remaining blocker in the reviewed return paths. No reviewer edited files.
- [!] `node tests/frontend/exam-flow.regression.mjs` did not complete: after more than 90 seconds it was stopped while Chromium remained active, with no assertions emitted. This is not a passing result; earlier 186/186 evidence remains from the prior run only.
- [!] All current evidence is offline with PGlite/stubs. No model provider or hosted staging request was made.

**Next:** isolate and rerun the browser regression if its timeout proves generation-related; then seek/confirm the separate approval for the exact Preview, staging migration, and one synthetic 12-question model run before making a live-yield claim.

## Owner-scoped resumable generation and reusable agent workflow — 2026-10-22

- [x] The reusable agent system is now usable in this project: `AGENTS.md` loads `08_CURRENT_STATUS.md`, role cards in `15_AGENT_PLAYBOOK.md`, and the curated learning ledger at each substantive task. Earlier work applied API/timeout, test/recovery, and independent security roles with one writer. Historical agents are not persistent workers, and this is not an archive of every historical invocation. This turn could not obtain new reviewer capacity, so the latest fixture diagnosis and validation are local, not agent-reviewed.
- [x] Replaced the advance route's separate owner GET and pipeline/parent lease round trips with a new owner-scoped, service-role-only claim RPC in `20261022140100_owner_scoped_pipeline_claim.sql`. It locks by both job and authenticated user, claims and renews the exact parent lease in one transaction, and fails closed on identity mismatch without mutating another attempt. Its rollback removes only the two new functions.
- [x] The request deadline remains anchored to handler entry and clamped to the persisted job deadline. Content-free setup timing now measures auth + the combined claim RPC. No identities, source text or credentials enter these events. Question structure, independent review, solver, repair, quota and issuance gates were not weakened.
- [x] HTTP/PGlite tests cover owner isolation, parent renewal, mismatch terminalization and payload cleanup, mismatch quota isolation, setup delays at 39s/38s, and resumable full 3/6/12 flows with retry/replay/issuance. The focused six-file suite passed **35/35** after the final mismatch change. Syntax checks and `git diff --check` passed.
- [x] A focused browser run passed **8/8** checks for partial delivery and resumable progress. The UI renders only approved questions and labels the correct 2/3, 4/6, and 8/12 counts.
- [x] Updated ten browser-test fixtures to intercept the real `?pipeline=start` route for ordinary exams; kept graph-only generation on its direct route. All ten targeted frontend files now pass (**10/10**), including auth/account-switch, graph flow and keyboard isolation, math rendering, P.E.R. context/ladder/mobile, quota copy, and solution-photo OCR UI. This repairs stale tests, not production behavior.
- [!] The latest complete offline suite is still **not green**: `sitemap-lastmod` fails because `app.html`'s Git date is `2026-10-22` while the sitemap entry is `2026-10-21`; this unrelated failure was left unchanged. The previous `app-auth-gate` full-run failure did not recur in the fresh 190-file run. The sitemap failure remains outside the exam-generation scope.
- [!] Read-only staging verification on 2026-10-22: `exgen-pilot-staging` (`yhcinqejsocpmmetazpz`) is `ACTIVE_HEALTHY`; its 5 USD pilot budget had 0.208611 spent and 0.225728 reserved, leaving **4.565661 USD at the time of that read**. The resumable-pipeline migration is present, but local `20261022140100_owner_scoped_pipeline_claim` is not listed in hosted migrations. No provider request was made. Current local code cannot be live-verified until the exact migrations and Preview are separately approved and available.
- [!] Evidence is local offline/PGlite with synthetic questions and mocked generation. PGlite uses one serialized client, so it does not prove true two-connection claim contention. No live provider yield or hosted ACL/migration state was verified. The new migration is local only; no Supabase migration, OpenAI request, push, deploy, merge, account/quota change, `main`, or Production action occurred. Existing dirty `supabase/.temp/cli-latest` was preserved.

**PILOT NOT READY.** Next: capture the full-suite `app-auth-gate` failure detail and decide whether it is a real timing race; the sitemap date mismatch is unrelated. Then verify the new migration and exact Preview in authorized staging before a bounded synthetic 12-question live test. A passing local 12-question fixture is not live-model improvement evidence.

## P.E.R all-app chat and bounded zero-pass repair — 2026-10-22

- [x] Fresh staging latency aggregates (last 7 days, previous code) show p95: initial generation 15.6 s; repair 20.4 s; comparison verifier 4.6 s; blind solver 2.7 s; grading 5.1 s. The verifier and solver run concurrently for the retry review. This supports an offline-tested local adjustment reducing only the optional retry-review timeout from 10 s to 8 s, potentially returning 2 s to repair generation; the 14 s post-review reserve, 8 s minimum generation window, and all acceptance gates are unchanged. It is not yet pushed or live-verified.
- [x] Focused budget/pipeline/static/verifier checks passed, then the full serial API suite passed 181/181 tests with `--test-timeout=60000`. One existing all-app P.E.R exam-review test took about 56 s; it passed. `node --check api/generate-exam.js` and `git diff --check` passed.
- [x] P.E.R general study chat is restored while server-side exam gating remains: generic study questions are allowed with a restricted help level; current exam questions, answer-bearing routes, and unverified full solutions remain gated. Commit `0a3b6f2` is deployed as READY Preview `dpl_78nq9m4h5xaRUz6SpnZCAUWjxn9q` on the existing feature branch. Focused P.E.R tests passed 52/52.
- [x] A 0/3 quality-repair request now asks for three candidates plus one spare instead of up to six. Mixed repairs retain one spare for each missing question type; no verifier, solver, source, delivery, or grading threshold was relaxed. Commit `f48119e` is pushed; exact Preview `dpl_C2Ls8YbNiamdaCmm4Jdiax1NKTfh` is READY. `/app.html` returns HTTP 200 and the client runtime identifies `exgen-pilot-staging`.
- [x] Generator pipeline, repair-budget, verifier, solver and assessment-focused tests passed 13/13. Full serial offline suite passed with exit 0 across 183 discovered test files after both changes. `node --check api/generate-exam.js` and `git diff --check` passed.
- [!] No model-backed request was made. On 2026-10-22, the current Chrome tab on the stable feature alias showed the authenticated ExGen app; this confirms that this browser session works, not that fresh sessions work. The staging project is `ACTIVE_HEALTHY`; a read-only check of the synthetic test account showed Gratis, exam quota count `3`, and P.E.R. quota count `5` in `2026-W43`, so live requests remain blocked before model execution. No role, quota, account, database, Production or `main` change was made. The 0/3 repair change is not live-quality proof.
- [!] Read-only, content-free staging aggregates for the preceding seven days show 15 `mock_exam_generation_requests` rows: 14 `retryable`, 1 `succeeded`. Five issued exams had saved graded results and one was abandoned. On 2026-10-20, `ai_usage_events` recorded 24 initial generation calls, 17 repair calls (mean 14.7 s, max 22.9 s), 21 blind-solver calls and 35 comparison-verifier calls, all on `gpt-4o-mini-2024-07-18`. These historical aggregate rows do not map individual outcomes to the current `f48119e` code and do not identify the root cause.
- [!] Vercel runtime-log search for `generate-exam` returned no rows for the latest 30 minutes; a 60-minute query was rejected because the Hobby retention window was exceeded. This is not evidence that older failure events do not exist.
- [x] Re-ran the focused exam-pipeline, verifier-contract, subject-overlay and solver suites on this checkpoint; all 4 test files passed, including the `Kesäkten` distractor rejection and 0/3 repair-budget regression.
- [x] The free subject-routing preflight passed all 15 fixture/counterexample cases; the delivery fail-closed checks passed all 4 tests. No provider API call was made.

**PILOT NOT READY.** Next: wait for the staging period to reset or obtain separate approval for a bounded quota change before a synthetic model-backed test. Then verify accepted count/content, grading, persistence and P.E.R both outside and during an active exam. Keep `main` and Production untouched.

## Latest pilot checkpoint — 2026-10-21

This is the current checkpoint. Older entries below are chronological snapshots; where they conflict with this section, this section is newer.

Read-only staging quota snapshot, 2026-10-21: profile role `gratis`, exam quota count `3`, and P.E.R. quota count `5`, both in `2026-W43`. This confirms the exhausted quota has not reset. No role, quota, or account data was changed; no email or profile ID is recorded.

- [x] Current feature Preview `dpl_EeUdRtWVXviNd6JsZYzfCzMb4pX1` is `READY` from SHA `2fffb5fdf0181838b2e27a097177bb9fec3f5fa2` on `codex/exgen-generation-quality-2026-10-20`; its stable alias is `provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app`. Commits `6e77bdd`, `786bf73`, and `2fffb5f` are pushed; `main` and Production are untouched.
- [x] Vercel CLI fallback confirmed branch-scoped Preview metadata for the pilot runtime/config variables on that exact branch. Values remained encrypted; metadata presence does not independently prove which server-side Supabase URL an executing function used.
- [x] The startup-race cleanup is included in the current Preview: it removes a redundant early quota/Auth lookup, leaving the existing final quota refresh after `window.ExGenEngine` registration. The delayed-Auth test and the full exam-flow regression pass locally.
- [x] Current focused checks passed: frontend/pilot boundary 11/11, generation/P.E.R./issuance/quota API tests 62/62, delayed-Auth browser test, complete exam-flow regression 184/184, and sitemap lastmod test. The complete offline suite passed sequentially with `--test-timeout=60000` (exit 0). An earlier run hit the default timeout in `app-auth-gate.test.mjs`; that test passed alone (22.4 s) and in the longer-timeout full run. This is local/mock evidence only.
- [!] Authenticated read-only Preview inspection confirms the pilot runtime `appOrigin` is `https://provia-ai-git-codex-exgen-schoo-1725d7-eltons-projects-4adfb1a3.vercel.app`. Vercel alias lookup maps that callback host to old READY deployment `dpl_7jos5URBMRAY8pyREffo4V1RMRch`, SHA `303b3c6`; the current stable feature Preview alias maps to `dpl_SgpVo9TTiaGTkTPYBAuqWXteePsU`, SHA `2fffb5f`. This is a confirmed callback/deployment mismatch; it may cause recovery to serve stale code, but does not by itself establish the cause of the earlier session mismatch. No alias or Supabase redirect setting was changed.
- [x] Free, model-less quality preflights passed: subject-routing fixtures plus nine counterexamples, and all 25 structural P.E.R. gold-set checks. The paid model-comparison runner was not run; these checks do not establish live model quality.
- [!] After deploying current SHA `2fffb5f` to the stable feature Preview, the synthetic staging session was recognized and the app opened normally. A synthetic 3-question Matematik 2b exam was stopped with `Provkvoten är slut`; the UI maps this from `/api/generate-exam` HTTP 429 `Quota exceeded`, returned before `streamGeneration`, so no OpenAI generation ran. A separate synthetic P.E.R. request was stopped with `P.E.R-kvoten är slut`, so no answer was generated. The exact remaining counts/caps were not independently read. No role, quota, account, database, Production or `main` change was made.
- [x] Added a local browser regression for signed-in account-page → Mockprov navigation; it passes with the synthetic Auth/profile mocks. This proves the ordinary same-origin flow in the local harness only, not the Preview failure.
- [x] The authenticated current feature Preview visibly offers generic focus chips `övningsmaterial` and `testunderlag`. A local follow-up filters these labels and the split English label “Study guide” from learner focus choices and server-side model instructions, while preserving `guide` when it also occurs in subject content. Focus-term/API tests and a focused local browser smoke passed; the broad browser regression hung on this run and was stopped. The follow-up is not pushed/deployed.
- [x] A second local UI follow-up now uses `meta.partial` to tell the learner how many requested questions passed review, and keeps that notice visible in the exam guide; the old UI showed only a generic success toast, which the P.E.R.-led surface suppresses. A focused browser test verified “2 av 3” with exactly two rendered questions. Not pushed/deployed.
- [x] Fresh serial offline suite on app-code commit `f82a67e`, before this docs-only checkpoint: all 182 discovered `tests/**/*.test.mjs` files completed with exit code 0 using `node --test --test-concurrency=1 --test-reporter=dot $(rg --files tests -g '*.test.mjs')`. This excludes standalone regression scripts, live provider calls, and hosted database checks.
- [x] Local P.E.R. voice-state fix localizes the input placeholder while speech recognition starts/ends. Browser tests passed: 6 voice-localization assertions, 12 error-announcement assertions, and 17 mobile/axe assertions. Fresh full serial suite passed all 183 discovered `tests/**/*.test.mjs` files on this local code with `--test-timeout=60000`. This remains offline/mock evidence; the change is unpushed.
- [!] Pilot still needs a current-Preview live generation with all requested questions and acceptable content, P.E.R. outside/inside active exam, grading and verified persistence/recovery, plus hosted two-JWT RLS/IDOR and school privacy/operational approval. Prior saved staging results belong to an older Preview only, not this SHA.

**PILOT NOT READY.** Current feature Preview is `READY` at `2fffb5f`, and the staging session was recognized in this browser run. The latest local serial offline suite passed all 183 test files after focus-term filtering, partial-delivery disclosure, and P.E.R. voice-language localization; these newest changes are not deployed. The runtime recovery callback points at an older deployment; get explicit approval before moving only the approved Vercel aliases to a matching READY Preview. New live model-backed checks remain blocked by exhausted staging exam and P.E.R. quotas. Keep Production and `main` untouched.

## Local P.E.R. quota failure-settlement — 2026-10-21

> Historical snapshot: the later `5fccaff` commit is an ancestor of the current READY Preview at `1c06b91`; the local-only/deployment statements in this snapshot are superseded by the latest checkpoint above.

- [x] Replaced the API's direct `consume_per_chat_quota` increment with a request-ID-bound reservation flow for P.E.R. routes. Successful model responses commit the reservation; provider/stream failures refund it. Explain-cache hits are checked before quota reservation.
- [x] Added a local forward migration with a service-role-only reservation ledger, profile-row locking, period-aware counters, idempotent commit/refund, two-minute stale-reservation cleanup, RLS, and restricted grants.
- [x] Added PGlite execution coverage for the actual migration: application, quota cap, repeated reservation/refund, commit protection, period reset, stale cleanup, and table/function privileges passed. The first full serial run found one stale static assertion in `tips-prompt-security.test.mjs`; it now requires refund plus the unchanged generic error. The focused eight-file API/P.E.R./quota suite passed **71/71** after correction. The full suite was not rerun afterward.
- [x] `node --check api/explain.js` and `git diff --check` passed.
- [!] The migration has not been applied to staging and the code has not been pushed or deployed. PGlite is local PostgreSQL evidence, not hosted Supabase drift/RLS verification. The existing `04e542a` Preview still uses the previous quota behavior.
- [!] Live generation remains blocked because the exact `04e542a` Preview shows the invited-account sign-in gate. The already approved one-time Premium staging test remains unused; no role, quota, provider, staging database, or Production action occurred.

**PILOT NOT READY.** Review this migration against the hosted schema/migration history, obtain separate staging-DDL approval, deploy the code only to the existing Preview branch, then authenticate and run the approved single synthetic generation on the exact new READY Preview. Keep `main` and Production untouched.

## Latest bounded staging attempt — 2026-10-21

- [x] Re-read the active pilot objective and verified the exact Vercel deployment `dpl_4wYECkQiFV83ch1xHnfkJG6k2AXR`: `READY`, branch `codex/exgen-generation-quality-2026-10-20`, SHA `04e542aa1fb1452fd4433d2d4c730bf1f82a67a2`. Its deployment-specific URL is `https://provia-igzpkctdv-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [x] The deployment opens at the invited-school-account sign-in gate. No authenticated session was present; the approved synthetic three-question request was therefore not submitted.
- [x] A read-only staging profile check before and after confirmed one matching synthetic profile still has role `gratis` and quota count `5`. No role, quota, account, database, or production data was changed; no OpenAI request or model cost occurred.
- [x] The user has approved exactly one synthetic three-question generation using temporary staging Premium, with immediate restoration to Gratis. This approval remains unused and narrowly scoped to the verified deployment/test.
- [x] Offline source-reference, exam-pipeline, verifier-contract, assessment, and solver tests passed (5 test files; exit 0). This does not substitute for provider-backed generation evidence.
- [x] Additional P.E.R. offline checks passed: review/completion-proof/error/stream tests (4 test files), quota-contract test, and the pedagogy/help-ladder suite. The quota-contract test proves ordering/fail-closed behavior, not refund after provider failure; that staging risk remains open.

**PILOT NOT READY.** Next: the user signs into the exact deployment-specific Preview linked above and reports when ExGen is visible. Then perform the one approved synthetic generation, restore Gratis immediately, and verify the resulting question count and quality without issuing a second model request.

## Current pilot checkpoint — 2026-10-21

- [x] The approved eight-commit range through `04e542a` is pushed to `codex/exgen-generation-quality-2026-10-20`. Git readback confirmed remote and local HEAD at `04e542aa1fb1452fd4433d2d4c730bf1f82a67a2`; the worktree was clean.
- [x] Vercel deployment `dpl_4wYECkQiFV83ch1xHnfkJG6k2AXR` is `READY` for that exact SHA and branch. Preview: `https://provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app/app.html`. No `main` merge or Production action was performed.
- [x] The exact-HEAD offline evidence recorded below includes exam-flow **184/184**, P.E.R./exam-context **66/66**, and the selected P.E.R./assessment/exam matrix **112/112**. These are offline regressions, not provider-backed quality evidence.
- [x] Fresh full sequential run on `04e542a`: all **178 discovered test files** completed with exit code 0 using `node --test --test-concurrency=1 --test-reporter=dot $(rg --files tests -g '*.test.mjs' -g '*.test.js')`.
- [!] Staging exam and P.E.R. requests were previously rejected at exhausted quota before model generation. No successful live model response has been verified on this code; do not present the Preview as live-quality validated.
- [!] P.E.R. quota review: read-only SQL inspection of staging confirmed `consume_per_chat_quota` locks the profile row and increments `profiles.per_quota_count`; it accepts no request/idempotency key. `api/explain.js` consumes this before provider work, and provider-error branches return without a refund call. Thus a provider failure can consume a learner's P.E.R. quota. The forward migration defining this RPC is absent from the checked-in migration set (only its rollback is present). Do not add a blind counter decrement; a fix needs a reviewed idempotent reservation/refund contract, migration source, and separate approval before staging DDL.
- [!] Pilot acceptance remains open for model-backed generation, grading/persistence and P.E.R. verification, plus the previously identified two-account RLS/IDOR and school operational/privacy approvals. No quota/account, database, `main`, Production, or staging-data changes were made in this increment.

**PILOT NOT READY.** A later, separate approval now permits temporary Premium for exactly one synthetic staging generation, followed by immediate restoration to Gratis; it remains unused because the exact Preview requires sign-in. No quota change is authorized. See the latest bounded-attempt checkpoint above.

## Result recovery after reload — 2026-10-21

> The deployment/push statements in this checkpoint were accurate before the approved push recorded above; treat them as historical, not current release status.

- [x] A successful exam grade now retains the user-bound signed exam snapshot, answers, and P.E.R-used flags as a short-lived local recovery draft. If the server confirms the issuance is completed after reload, the student can explicitly restore the result through the existing exact-answer, idempotent server replay; the UI still requires a verified result/proof before showing the result or P.E.R answer-review actions.
- [x] Starting a new topic still clears the recovery draft. Failed or unverifiable recovery keeps the saved answers and offers retry; it does not show local/unverified answer keys.
- [x] Added a browser regression for grade -> reload -> one recovery replay -> restored submitted answers and P.E.R review actions. The latest `EXAM_FLOW_ONLY_RESULT_RECOVERY=1 node tests/frontend/exam-flow.regression.mjs` run passed **120 checks, 0 failures**; an earlier repeat was flaky at 119/1 and should be watched. `node tests/frontend/per-exam-context.test.mjs` passed **66/66**. The broader selected P.E.R, exam-pipeline, assessment, completion-proof, grade-to-review, and P.E.R review-handler matrix passed **112/112 Node tests**. `node --check` on changed JavaScript and `git diff --check` passed.
- [x] The complete `node tests/frontend/exam-flow.regression.mjs` browser regression passed **184 checks, 0 failures** on the latest run. One earlier focused-only repetition was flaky at 119/1; its subsequent rerun passed 120/120, so retain this as a watch item rather than treating the flake as resolved.
- [!] The authenticated READY branch Preview still reports exhausted exam quota; the synthetic P.E.R check also returned “P.E.R-kvoten är slut.” Both handlers reject at their quota gates before model generation (`api/generate-exam.js` before `pickModel`, `api/explain.js` before the chat model call). No successful provider-backed response was observed. No account, role, quota, Supabase, `main`, or Production change was made.
- [!] The explicitly approved range of eight commits through `b46bd55` is pushed and its Vercel Preview is READY at `https://provia-3eyj9tgac-eltons-projects-4adfb1a3.vercel.app`. Later local generation-quality commits and the current result-recovery changes are not in that Preview. No further push/deploy was authorized.

**PILOT NOT READY.** Next: once ordinary staging quotas are available, run the bounded synthetic generation and P.E.R checks, then verify grading persistence on the READY Preview. Review the later local generation-quality and result-recovery changes; obtain explicit approval for the exact additional commit range before pushing/deploying. Do not widen quota or clean staging data without separate approval.

## Shortened exam notice clarity — 2026-10-21

- [x] A delivered exam with fewer questions than requested already had an inline, mobile-layout-tested notice. Its wording now explicitly says that the included questions passed quality review, in Swedish and English; singular/plural English grammar is covered by the browser test.
- [x] `node tests/frontend/exam-result-language-and-note.test.mjs` passed, `node tests/frontend/exam-question-count-minimum.test.mjs` passed (7 assertions), and `git diff --check` passed.
- [x] The first standalone `node tests/frontend/exam-flow.regression.mjs` run reported 177 checks passing and one browser-side `TypeError: Failed to fetch` from external Supabase auth initialization in the English-first-load fixture. A scoped listener now records only failed `/auth/v1/` requests to the synthetic `.invalid` test host, making this failure diagnosable without logging credentials or response bodies.
- [x] A rerun of `node tests/frontend/exam-flow.regression.mjs` after that instrumentation passed **178/178**. The full sequential `node --test --test-concurrency=1 --test-reporter=dot $(rg --files tests -g '*.test.mjs' -g '*.test.js')` run also exited 0 across 178 test files.
- [!] A later repeat of the standalone browser test was manually interrupted after it remained in the simulated browser flow for over two minutes; it is not counted as a pass and did not complete. The earlier 178/178 run remains the last completed result.
- [!] Current local code changes are not on the READY deployment. Vercel's accessible READY deployment remains exactly `63533b6`. The authenticated branch-alias tab is now confirmed in the app, but shows “Provkvoten är slut” for the staging account; no live model request was made and no account/role/quota was changed.

**PILOT NOT READY.** The wording improvement and browser flow are covered offline. The approved synthetic live test is blocked by the visible exhausted staging quota. Next: wait for normal quota reset or obtain separate approval for one bounded staging entitlement change; do not change role/quota, production, `main`, or database settings in the meantime.

## Objective corrupted option guard — 2026-10-21

- [x] The deterministic assessment gate now blocks multiple-choice options containing Unicode replacement characters or C0/C1 control characters, reported as `corrupted_option_text`. It allows ordinary spaces, tabs, line breaks and carriage returns; it does not try to decide whether unfamiliar vocabulary is a real word.
- [x] Regression cases cover a damaged non-math science distractor, C0 and C1 controls, ordinary whitespace, and valid technical terms absent from the source. This preserves model review for semantic/plausibility questions rather than adding a brittle dictionary heuristic.
- [x] `node --check api/_assessment.js`, `node tests/assessment/subject-overlays.test.mjs`, `node tests/api/exam-pipeline-offline.test.mjs`, `node tests/api/solver-contract.test.mjs`, `node tests/api/verifier-output-contract.test.mjs`, `node tests/frontend/exam-flow.regression.mjs` (178/178), `git diff --check`, and the full sequential 178-file test run passed.
- [!] This is deterministic protection against corrupted text only. It does not prove that verifier and solver will identify semantic nonsense when both models incorrectly approve it; no model-backed live generation was run.

**PILOT NOT READY.** Continue with a safely bounded semantic regression fixture and live staging verification only after the exact Preview session is demonstrably authenticated. No `main`, Production, staging role/quota, or database changes.

## Provider error safety and grading deadline reserve — 2026-10-21

- [x] Exam-generation failures no longer return an upstream OpenAI response body or raw provider details to the browser. The client receives a localized retry-safe message, request ID and stage; server telemetry records only a bounded category and upstream HTTP status.
- [x] Grading now computes its provider timeout from the 60-second route budget and reserves 30 seconds for validation, result persistence, recovery bookkeeping and cleanup. It refuses to start model work when fewer than four provider seconds remain. The optional learner-loop feature-flag lookup is bounded to one second and remains fail-closed.
- [x] Regression coverage includes a synthetic provider body sentinel, safe failure telemetry, and provider-budget boundary cases. The three focused grading/generation tests passed. Syntax checks and `git diff --check` passed; the complete sequential suite passed **324/324 test files**.
- [!] These changes are local and have not been pushed or deployed. The accessible Preview tab currently shows the sign-in gate, despite the user's report of being logged in, so no live generation or grading attempt was made. No new provider call, role/quota change, Supabase mutation, `main` merge or Production action was made.

**PILOT NOT READY.** Next: confirm the authenticated session in the exact staging Preview, then request/confirm approval to push these new code changes and create a Preview before any bounded synthetic live request. Keep production and `main` untouched.

## Non-blocking review hint for all-word distractors — 2026-10-21

- [x] Swedish multiple-choice exams now add `mixed_source_support_single_word_options_review` when every option is a standalone word and only some options match terms in the supplied source. The signal is passed to both first-pass and repair verification.
- [x] When none of the standalone-word options has a direct source-term match, the verifier now receives `all_single_word_options_unmatched_source_review`. Both signals are review-only; neither treats source absence alone as proof that a valid synonym or technical term is wrong.
- [x] Regression confirms the all-unmatched signal survives verifier hint filtering and that the gate retains the question for review. Subject-overlay, verifier-contract and offline generation-pipeline tests passed; changed JavaScript syntax checks and the complete sequential `tests/**/*.test.mjs` suite passed after this change.
- [x] The verifier is explicitly told to inspect each option, not reject on the signal or source absence alone, and retain valid names/technical terms. The rule does not drop questions, alter solver checks, delivery thresholds, or quota behavior.
- [x] Regression tests cover mixed, uniformly supported, and uniformly unsupported all-word options. The pipeline tests confirm the hint reaches the verifier and that a valid mixed-support technical-options question can still be delivered. Subject overlays and offline exam pipeline passed, and the complete sequential test suite passed.
- [x] When no first-pass question survives review, the bounded repair requests up to six candidates. Its prompt receives only allowlisted numeric counts from reviewer and blind-solver failure categories, with category-specific static guidance; rejected stems, answer keys, and free-form reviewer/solver text are never passed. A fixture-driven 0/3 biology integration regression confirms the repair path can return three unique candidates when stubs provide approvals after solver-only first-pass rejection. This tests application flow, not real-model recovery or question quality.
- [x] Source-term matching no longer treats a truncated prefix such as `Kloropla` as the same term as `Kloroplasterna`; bounded Swedish inflection matching includes the `-or`/`-a` pair (`cellkärnor`/`cellkärna`) and has regression coverage.
- [x] Independent review found and reproduced the missing `-or`/`-a` inflection case; the new regression failed before the fix and passes after it. Subject-overlay plus generation-pipeline tests passed, changed JavaScript syntax checks passed, and the complete sequential `tests/**/*.test.mjs` suite exited 0 after the correction.
- [x] P.E.R now persists the current pilot question while a response is in flight, so a reload restores it for an explicit retry without resending automatically. If the account changes before token lookup completes, only the old account's pending question is cleared. The browser regression covers reload recovery, completion cleanup, and account isolation.
- [x] Verification after these changes: focused P.E.R browser test passed; subject-overlay and offline generation-pipeline tests passed; all changed JavaScript files passed `node --check`; complete sequential `tests/**/*.test.mjs` suite exited 0.
- [x] Fresh verification at local HEAD `8c0a256`: `node --test --test-concurrency=1 --test-reporter=dot $(rg --files tests -g '*.test.mjs')` exited 0. An independent read-only review of the current generation/verifier/P.E.R. diff found no actionable issue; its four focused regression files passed.
- [x] Current browser verification at `8c0a256`: `node tests/frontend/exam-flow.regression.mjs` passed **178/178** with 0 failures. Separate grading recovery/provider timeout, completion-proof, grade-to-P.E.R integration, post-exam review, and active-exam P.E.R. context regressions passed **67/67** at `ee86fe3`. These are offline/browser regressions with stubbed APIs, not live provider or staging evidence; this successful rerun supersedes the older Playwright-browser-closed attempts below.
- [x] `node scripts/a11y-audit.mjs` passed on the current local tree: zero axe violations on the audited pages/cookie banner, zero console errors, and no horizontal overflow on the 390px privacy-page check.
- [!] This is a review-quality signal, not a deterministic nonsense detector. A fresh browser check found the signed-in branch alias at the exhausted Gratis quota; the separate `provia-98q3pstsi-...` Preview tab showed the auth gate. Vercel identifies that deployment as READY at `63533b6`, while local HEAD `8c0a256` is not deployed. No model-backed yield was measured in this turn. No account/role/quota, Supabase, Preview, `main`, or Production change was made.
- [!] These bounded repair, source-matching and P.E.R recovery changes are local and have not been deployed. Their effect on real model yield, latency and token usage is unverified.

**PILOT NOT READY.** Next: after normal quota reset or separately approved temporary test access, compare generated/reviewed question yield with this signal enabled. Continue the remaining live generation, grading/P.E.R., two-account RLS/IDOR, and school-operation checks.

## Matteprov: poängmatris i linje med frågan — 2026-10-21

- [x] Granskning av liveutfallet och den verkliga produktionsprompten hittade en motsägelse: kortsvarsinstruktionen säger att matrisen bara får bedöma uttryckligen efterfrågat arbete, medan matteprompten generellt krävde att varje uppgift delar poäng mellan metod och slutsvar. Det kunde skapa poängmatriser med metodkrav som frågetexten inte ställde.
- [x] Svensk och engelsk matteprompt kräver nu metodpoäng endast när frågan uttryckligen ber eleven visa eller förklara metoden. Frågor som bara begär slutsvar poängsätter bara slutsvaret. Modellsvar får fortfarande innehålla en full lösning, men utökar inte elevens poängkrav.
- [x] Regression täcker båda språken och kontrollerar att uppgiftskrav, matris och fullständigt modellsvar inte motsäger varandra. `node tests/api/exam-pipeline-offline.test.mjs`, hela sekventiella API-sviten, `node --check api/generate-exam.js` och `git diff --check` passerade.
- [x] Commit `63533b6` är pushad till `codex/exgen-generation-quality-2026-10-20` och deployment `dpl_435wsREUvHjTk2vBDfGfoG99wdmq` är `READY` från exakt commit och branch. Den stabila Preview-aliasen pekar på samma deployment; `main` och Production ändrades inte.
- [x] Offlinekontrollerna för exam-pipeline, verifierarens beslut, ämnesöverlägg och kostnadsfri ämnesroutning passerade. Hela testsviten passerade seriellt med `--test-concurrency=1` och exitkod 0. En tidigare standardkörning rapporterade 323/324 när `class-join-a11y` timeade ut; samma test passerade isolerat och i den seriella fullkörningen.
- [!] Ett nytt godkänt syntetiskt försök på den READY Previewn stoppades av Gratis-kvoten före modellval/OpenAI-anrop. Det gav ingen livekvalitetsmätning. Ingen kvot-/rolländring eller Supabase-ändring gjordes.

**PILOT NOT READY.** Nästa steg för att mäta scoringändringen är att invänta ordinarie stagingkvotreset eller få separat uttryckligt godkännande för ett nytt, avgränsat stagingtest. Därefter återstår liveverifiering av generering, rättning/sparning och P.E.R., tvåkontos-RLS/IDOR samt skolans operativa godkännanden. Ändra inte roll eller kvot utan separat godkännande.

## Approved live generation attempt stopped at quota — 2026-10-21

- [x] The user authenticated in the exact READY staging Preview. One approved attempt used only synthetic Matematik 2b notes, the existing `gratis` role/quota, level A and three short-answer questions.
- [x] The UI returned **“Provkvoten är slut”** before any exam was delivered. No second request was made and no account role/quota was changed.
- [x] Source inspection confirms the handler returns HTTP 429 from the quota check (`api/generate-exam.js`) before `pickModel()` and `streamGeneration()`. This attempt did not call OpenAI; it provides no evidence about current live question quality.
- [!] Whether the rejected attempt changed any quota counter was not independently queried. No quota or account mutation was made by the operator.

**PILOT NOT READY.** The approved live generation was blocked before the model call by the exhausted weekly quota. Next: wait for the normal quota reset or obtain separate approval for one explicitly bounded staging entitlement change, then repeat a synthetic generation. Do not alter role/quota without that approval.

## Staging security advisor snapshot — 2026-10-21

- [x] The read-only Supabase Security Advisor returned 30 `RLS enabled, no policy` informational findings, two mutable-search-path warnings (`match_knowledge_chunks`, `sync_report_count`), one `pg_trgm`-in-public warning, four client-executable `SECURITY DEFINER` findings, and leaked-password protection disabled. No database/Auth setting was changed.
- [!] RLS-enabled tables without policies are not evidence of public row access; they commonly represent server-only tables. Advisor function warnings also need source/ACL review, especially trigger-returning functions. No exploitability conclusion or two-user runtime IDOR result is established by this snapshot.
- [ ] Before widening a school pilot, review and remediate applicable function/extension warnings, decide whether leaked-password protection should be enabled for staging, and complete authenticated two-account RLS/IDOR tests. Any Auth or database setting/migration change needs separate approval.

**PILOT NOT READY.** Security Advisor findings are documented as review items, not silently modified. Runtime access isolation and school-level data-handling approval remain unverified.

## Full offline regression and Preview recheck — 2026-10-21

> Historical checkpoint; superseded by the current pilot checkpoint at the top of this file.

- [x] The complete repository test run passed **324/324** (`node --test 'tests/**/*.test.mjs' 'tests/**/*.test.js'`); duration was 91.6 s. No failures, cancellations, skips, or todos.
- [x] Read-only GitHub/Vercel verification confirms feature branch `codex/exgen-generation-quality-2026-10-20` remains at `adc5e0b41f3849789c683864036337e22ab6a2ac`; deployment `dpl_AVPF16aWsaWkgeHQwFiMzZxs5dVv` is `READY` from that exact branch and SHA.
- [x] Reopened the exact Preview in the browser. It still displays the invited-pilot login gate, so this is not an authenticated runtime test.
- [!] The user approved exactly one synthetic 3-question generation using the existing staging role/quota. No model-backed request has been made in this check because the Preview session is logged out. No credentials were requested or used; no quota, role, staging data, `main`, Production, or deployment settings were changed.
- [!] The current local branch includes two status-only commits (`526e46c`, `1c72e42`) beyond the deployed remote SHA; they do not change app code. This status update is local and has not been pushed.

**PILOT NOT READY.** Offline tests and the Preview build are verified, but generator quality and the full generation -> grading -> persistence -> P.E.R. live flow remain unverified on this deployment. Next: the user signs in directly to the exact Preview URL and confirms “inloggad”; then run only the already-approved synthetic 3-question test at the current staging role/quota. Stop if auth or quota blocks before a model call.

## Staging target and Preview secret-scope recheck — 2026-10-21

- [x] Supabase read-only project metadata identifies `yhcinqejsocpmmetazpz` as `exgen-pilot-staging`, region `eu-west-1`, status `ACTIVE_HEALTHY`. The migration ledger includes the grading-fencing, verified-abandonment, and mock-generation-idempotency migrations. No SQL or data was changed.
- [x] The Vercel MCP returned 403 for environment metadata; the documented CLI read-only fallback succeeded against the explicitly verified `provia-ai` project and exact feature branch. It confirmed `EXGEN_PILOT_APP_ORIGIN`, `EXGEN_PILOT_PUBLISHABLE_KEY`, `EXGEN_PILOT_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`, `EXAM_SIGNING_SECRET`, `EXGEN_PILOT_MODE`, and `SUPABASE_URL` are encrypted and Preview-scoped to `codex/exgen-generation-quality-2026-10-20`. No values were decrypted or read.
- [!] These configuration checks do not prove that the browser has a valid Supabase session or that an AI request succeeds. The exact deployment remains at the login gate.

**PILOT NOT READY.** The staging target and Preview secret scope are verified, but authenticated runtime behavior remains unverified. Next: user sign-in to the exact Preview, then the already-approved single synthetic generation request; make no role/quota changes.

## Grading recovery regression audit — 2026-10-21

- [x] Focused grading/API recovery and frontend timeout suite passed **15/15**. Coverage includes injected upstream HTTP 502, retry recovery, concurrent claim fencing, lost HTTP response replay, conflicting answers, result persistence, and no result/mastery writes when provider transport times out.
- [x] The handler releases a retry-safe grading claim after an upstream failure; the same submission/answer fingerprint can then be retried, while completed requests replay the saved result and do not grade or persist twice.
- [!] This verifies offline handler behavior only. The cause of the historical live 502 is still unknown because no matching live runtime event has been freshly retrieved for that request.

**PILOT NOT READY.** Grading recovery has focused offline evidence, but the new streamed-repair Preview has not had a generation request. Continue with the separately approved one-request staging check when its approval arrives; keep the test account role/quota unchanged.

## Streamed repair Preview — 2026-10-21

- [x] After explicit approval, pushed exactly `807a4d9`, `2adfe18`, `b974478`, and `adc5e0b` to `codex/exgen-generation-quality-2026-10-20`. Remote branch readback confirmed exact tip `adc5e0b41f3849789c683864036337e22ab6a2ac`.
- [x] Vercel deployment `dpl_AVPF16aWsaWkgeHQwFiMzZxs5dVv` reached `READY` from that exact SHA and branch in the existing `provia-ai` project. Preview URL: `https://provia-dcf0wih06-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [!] This approval covered only the branch push and Preview build. No model-backed request, staging database change, role/quota change, `main` merge, or Production action was made. Runtime authentication and Supabase target have not been newly verified for this deployment.

**PILOT NOT READY.** The streamed-repair code has a READY Preview but no live generation evidence. Next: obtain fresh, bounded approval for one synthetic generation request; do not change the staging account role/quota unless separately approved. If authentication or the existing staging quota blocks before a provider call, stop and report that exact blocker.

## P.E.R regression audit — 2026-10-21

- [x] Ran `node --test tests/per/*.test.mjs`: **25/25** passed, covering P.E.R guidance, evidence selection, answer-leak protection, and usage-event privacy.
- [x] Ran `node --test tests/frontend/per-*.test.mjs tests/frontend/pilot-session-recovery.test.mjs`: **15/15** passed on the clean rerun, including active-exam answer gating, preserving an unsent question through reauthentication, accessible error announcements, widget suppression, and focus/layout behavior.
- [!] One earlier parallel frontend run reported a failure in `per-felbank-collision.test.mjs`; that test passed in isolation and the full focused suite passed on rerun. Treat as a transient timing flake, not proof that the behavior is failure-free in live browsers.
- [!] These are offline regressions only; they do not constitute authenticated staging verification or school-pilot acceptance.

**PILOT NOT READY.** P.E.R's offline regression suite is green. The latest live exam-generation attempt still failed closed at 0/3, and the local streamed-repair fix has not been deployed or live-verified. The two local commits remain unpushed; obtain fresh approval before Preview deployment or another provider-backed staging request.

## Bounded streamed quality repair — 2026-10-21

- [x] The verifier-driven quality-repair request now uses the existing bounded Responses stream reader, matching the initial generation path. A timeout can retain complete question objects emitted before a partial JSON tail; those candidates still pass normalization, source checks, independent verifier, and the existing fail-closed delivery gate.
- [x] Added offline coverage for an actual abort-signal timeout preserving streamed bytes, JSON salvage of complete candidates before an incomplete tail, and a full synthetic repair where salvaged candidates must pass independent review. When all first-round items fail, two salvaged and verified replacements may use the existing explicit 2-of-3 partial-exam floor; rejected first-round questions remain excluded. Telemetry marks a salvaged/truncated repair response as incomplete. No extra repair attempt or quality-threshold relaxation was added.
- [x] Verification: `node tests/api/exam-pipeline-offline.test.mjs` passed; full API suite **176/176**; `node --check api/generate-exam.js` and `git diff --check` passed.
- [!] This is offline evidence only. The latest live run on commit `7f2a067` timed out before repair candidates were returned; it does not prove partial candidate text reached the server, nor does this change prove that a live repair will produce or pass review.

**PILOT NOT READY.** Next: continue offline analysis of the reviewer rejection pattern and inspect model-call timing/stream behavior under controlled fixtures. A new staging model call and Preview deployment require fresh explicit approval; do not weaken the quality gate.

## Verifier repair feedback — 2026-10-21

- [x] Pushed only approved commit `7f2a067df4585f9a8820bec9fc36feac802356eb` to `codex/exgen-generation-quality-2026-10-20`. Preview `dpl_rpqu8moGNyjqm4ZgXGidqaDyA5Cr` is `READY` from that exact SHA and branch. Required Preview variables remain encrypted and scoped to the branch; no values were read.
- [x] Ran exactly one approved synthetic A-level Mathematics 2b generation attempt with three short-answer questions and worked quadratic examples; no learner data was used. The API failed closed at **0/3 approved** and issued no exam. Sanitized telemetry: verifier checked 3 and rejected all 3 (`low_factual_accuracy`, `low_source_alignment`, `low_scoring_quality`); the bounded repair attempt timed out before producing candidates (`repairTransportError=timeout`, `repairCandidateCount=0`). Total elapsed time was 33.0 s; generation time was 15.4 s. No study-material, question, or answer text appeared in the diagnostic event.
- [x] The test account was changed only from `gratis` to `premium` for this approved request and immediately restored to `gratis`. Readback confirmed `mock_quota_count=3` and `mock_quota_period=2026-W43`. No other profile, quota, staging data, schema, `main`, or Production was changed.
- [x] The new verifier-category repair mapping is now live on the exact tested deployment, but this run shows it is not sufficient: all initial candidates failed and the repair model call timed out. The quality gate remained intact.
- [x] Offline API suite at code commit `7f2a067`: **176/176** passed; focused source-reference suite **6/6**; exam-pipeline regression, `node --check api/generate-exam.js`, and `git diff --check` passed before push.
- [!] Further model-backed attempts are not approved. The next useful step is offline diagnosis of repair timeout budgeting, provider latency, and why the reviewer rejects every candidate. Use synthetic fixtures and sanitized logs; do not weaken acceptance thresholds based on this single run.

**PILOT NOT READY.** The app still cannot reliably produce the requested three-question exam. Do not make another provider call, change quota/role, weaken quality controls, touch `main`/Production, or alter staging data without fresh bounded approval.

## Local source-reference recovery and scoring diagnostics — 2026-10-21

- [x] Added a conservative source-excerpt fallback for non-graph questions when the model's supplied citation is absent or paraphrased. It derives only a literal excerpt from the student's submitted material after multiple meaningful terms overlap with question/answer context; weak or unrelated matches return no citation. The independent reviewer, solver and existing quality gate still decide whether a question is accepted.
- [x] Added bounded verifier failure categories so scoring, answer alignment, source support, clarity, language and difficulty issues can guide repair without storing free-form reviewer notes or generated/student content in telemetry.
- [x] Added Swedish and English repair guidance for short-answer scoring alignment: method points must be explicitly requested, rubric parts must sum to the stated points, and the solution must be checked again.
- [x] Added a deterministic elapsed-budget regression for the two-repair path: when structural repair leaves less than the protected generation/review/finalization window, quality repair is not started and no unreviewed/rejected question is issued.
- [x] Fixed two browser-suite fixtures: the quota test now waits on the visible quota status row, and the graph-flow mock now implements the server's idempotency claim/completion/failure RPC contract. Both previously failing tests pass in isolation and in the full run.
- [x] Offline verification: focused source/pipeline/verifier tests **8/8**; pilot candidate builder **10/10**; complete API/P.E.R. suite **201/201**; all discovered repository tests **324/324**. `node --check` for all changed JavaScript files and `git diff --check` passed.
- [!] These are local/offline improvements only. They do not overturn the live **0/3** generation outcome or prove that the requested number of questions will be generated. The user approved one more synthetic staging run with temporary Premium, but the open signed-in Preview is an older deployment and does not contain these local changes. No new provider call, push, deployment, role/quota change, database change, `main` merge or Production operation was made in this update.

**PILOT NOT READY.** Next: get explicit approval to publish the exact reviewed local commit to the existing feature branch and create a staging-only Preview. Then use the already approved one-shot synthetic test on that exact READY deployment, temporarily set only the staging test account to Premium, and restore it immediately after the attempt. Keep `main`, Production and unrelated staging data unchanged.

## Approved second synthetic generation test — 2026-10-20 21:38 UTC

- [x] Ran exactly one additional synthetic staging request on READY deployment `dpl_FQy7czAN2fnnX2swogy1af6R4Zoo` (branch `codex/exgen-generation-quality-2026-10-20`, SHA `679e6350cb7603668e4b37d844c48da665e8e3a5`). Vercel's env-list API returned 403; the explicit CLI fallback verified the needed pilot variables remain encrypted and Preview-scoped to this branch. No values were read.
- [x] Replaced the short source with a clearer synthetic Mathematics 2b source containing two fully worked quadratic examples and explicit rules. The authenticated UI remained set to A-level, three short-answer questions. No real learner material was used.
- [x] The request reached generation and failed closed: **0/3** approved, no exam issued; elapsed time 36.2 s and initial generation 12.7 s. Content-free telemetry shows all 3 initial candidates were structurally rejected for `source_reference_missing`. Structural repair returned 4 candidates, all passed structural checks; the reviewer checked 3 and rejected all 3 with `required_changes` / `low_scoring_quality`.
- [x] No quality repair followed: telemetry says `qualityRepairAttempted=false` and `qualityRepairGenerationTimeoutMs=null` with about 20.8 s left. The configured repair gate requires 32 s (8 s generation + 10 s review + 14 s finalization), so it correctly withheld a second repair rather than risk an unreviewed result. This is a bounded-budget tradeoff, not evidence of a provider outage.
- [x] The synthetic account was verified Gratis before the run, changed temporarily to Premium only for this approved attempt, and immediately restored to Gratis. Post-run profile read showed `mock_quota_count=3`, period `2026-W43`, role `gratis`; Premium's code path bypasses the quota RPC. Production and `main` were untouched.
- [!] The richer material did not fix candidate quality. The evidence points to two generation-pipeline weaknesses: exact source excerpts are not consistently emitted/retained, and the initial math candidates failed the independent scoring-quality review. Runtime logs deliberately contain no generated question or source text, so the precise reviewer objections are unknown. Do not weaken the review gate or conclude a stronger model is the fix from this run alone.

**PILOT NOT READY.** Next: improve and test the generator's exact source-reference behavior and short-answer rubric/scoring alignment using synthetic fixtures; add a regression for the structural-repair path leaving insufficient time for a quality repair. Then seek a separate bounded approval before another model-backed staging request.

## Local verifier diagnosis and targeted scoring repair — 2026-10-20

- [x] The verifier now maps free-form `required_changes` to a fixed allowlist of diagnostic categories. Raw reviewer notes remain out of logs and repair telemetry; the quality gate is unchanged.
- [x] When a rejection is categorized as a question/rubric scoring mismatch, the bounded repair prompt now requires method points to be explicitly requested, rubric parts to sum to the question's points, and the answer to be independently re-solved. This is a targeted repair instruction, not a claim that the model will necessarily comply.
- [x] Added offline regression coverage for safe categorization, multi-category findings, verifier output, and targeted math scoring repair. A false-positive clarity classification was caught and narrowed during testing.
- [x] Focused pipeline/verifier tests passed **2/2**. Full API and P.E.R. suites passed **199/199**. `node --check` on both changed API files and `git diff --check` passed.
- [!] The live **0/3** outcome is not repaired or overturned by this local change. Exact source-reference generation remains unaddressed; this improvement has not been deployed or live-tested, and the previously approved staging request is consumed. No provider call, push, deployment, role/quota change, database change, `main` merge or Production operation was made here.

**PILOT NOT READY.** Next: add synthetic fixtures that reproduce missing source references and verify the generator/structural-repair contract, then exercise the repair-budget edge case offline. Request separate approval before any further model-backed staging request or push/deploy.

## Approved staging generation after temporary entitlement — 2026-10-20 21:33 UTC

- [x] The user approved exactly one synthetic 3-question Mathematics 2b attempt using temporary Premium on the existing staging account. Before changing the role, a read-only query found exactly one matching profile and confirmed it was `gratis`; the role was changed only in staging project `yhcinqejsocpmmetazpz`.
- [x] Rechecked the READY Preview `dpl_FQy7czAN2fnnX2swogy1af6R4Zoo` and its alias. Vercel environment-variable metadata confirmed the pilot URL, publishable key, Supabase server key, OpenAI key, signing secret and pilot flag are Preview-scoped to `codex/exgen-generation-quality-2026-10-20`; encrypted values were not read.
- [x] The request reached `POST /api/generate-exam` at 2026-10-20 21:32:55 UTC. The UI failed closed with **1/3** questions passing and no exam issued.
- [x] Sanitized runtime telemetry explains the rejection path: initial generation took 12.3 s; the reviewer checked 3 questions, approved 1 and rejected 2 with `low_factual_accuracy` / `required_changes`. One bounded quality repair returned 3 candidates; one was structurally dropped for `source_reference_missing`, and both reviewed candidates were rejected with `required_changes`. Final verified question count: 1. Total elapsed time: 36.3 s. No question text or study material was logged or retrieved.
- [x] The staging profile was immediately restored from `premium` to `gratis`; a fresh query confirmed exactly one matching profile and role `gratis`. No quota counter/period, other account, production, `main`, or student data was changed.
- [!] The run exposes a real reliability issue: for this synthetic material and request, one bounded repair still failed to reach the requested count. The failure categories do not expose enough content to determine whether the issue was source grounding, question formulation, or reviewer calibration. Do not weaken the quality gate without inspecting safe synthetic question evidence and adding targeted tests.
- [x] Fresh offline verification at code commit `679e635`: API suite **174/174**; exam-flow browser regression **178/178**; P.E.R. completion-proof/review **55/55**; P.E.R. browser context **66/66**; P.E.R. help ladder **28/28**; pedagogy test passed; `git diff --check` passed.

**PILOT NOT READY.** The one newly approved live attempt is consumed. Next: investigate why the initial and repair candidates were rejected using only sanitized synthetic evidence, implement a targeted correction with regression coverage, then seek a separate bounded approval before another provider-backed staging test. Keep the account Gratis and do not touch `main` or Production.

## Previous staging attempt stopped at quota — 2026-10-20 21:26 UTC

- [x] The user approved exactly one synthetic 3-question Mathematics 2b short-answer attempt on the READY Preview `dpl_FQy7czAN2fnnX2swogy1af6R4Zoo`, using the existing synthetic quadratic-function source. Deployment SHA and branch were rechecked first; encrypted pilot variables are scoped to the exact feature branch. No variable values were read.
- [x] The authenticated Preview returned the learner-facing state **“Provkvoten är slut”** and said the test version's weekly allowance was used. No role or quota setting was changed and no additional attempt was made.
- [x] Source inspection confirms `generate-exam.js` handles `!quota.ok` with HTTP 429 and returns before `pickModel()` and `streamGeneration()`. Therefore this attempt did not reach a model call. The Vercel runtime-log query returned no records in its requested five-minute window, so no runtime event corroboration was available.
- [!] At that time, the prompt and repair-telemetry changes remained unverified against live model output; the last allowed live generation still yielded **0/3** before this commit. The later 21:32 attempt is documented above.
- [x] The fresh API suite (174/174), frontend exam-flow regression (178/178), P.E.R pedagogy, active-exam gate (55/55), P.E.R browser context (66/66), and help ladder (28/28) remain green at code commit `679e635`; status-only commits do not alter deployed app code.

**PILOT NOT READY.** This quota-denial checkpoint is historical; the single separately approved Premium-assisted attempt is documented above. Do not change staging role/quota or make another model call without fresh bounded approval.

## Preview and offline verification — 2026-10-20 21:22 UTC

- [x] Commit `679e6350cb7603668e4b37d844c48da665e8e3a5` is pushed to `codex/exgen-generation-quality-2026-10-20`. Vercel Preview `dpl_FQy7czAN2fnnX2swogy1af6R4Zoo` is `READY` for that exact SHA and branch at `https://provia-jgnflaa89-eltons-projects-4adfb1a3.vercel.app/app.html`; its branch alias is `provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app`.
- [x] Fresh local verification at the same HEAD: full sequential API suite **174/174**; frontend exam-flow browser regression **178/178**; `git diff --check` passed. The first browser run was manually interrupted and is not counted; the completed rerun passed.
- [x] An attempted independent agent review could not start because the agent thread limit was reached. No independent agent review is claimed.
- [!] The latest live 3-question Mathematics 2b request on the prior deployment failed closed at **0/3** after ambiguous reviewer feedback and a repair transport timeout. Commit `679e635` clarifies bounded math tasks and records repair budget/timeout telemetry, but its effect on live question yield and latency has not been measured.
- [!] No new provider-backed request was run on this Preview. The previously approved single live test was consumed; another staging model call requires fresh, bounded approval. No quota/role change, staging cleanup, `main` merge, Production deployment, or production-data change was made in this increment.

**PILOT NOT READY.** Next: obtain separate approval for one synthetic staging generation on the exact READY Preview, without changing role/quota; stop before the provider if staging denies it. Capture only sanitized telemetry and compare candidate yield, repair duration and final questions with the previous 0/3 run. Keep `main`, Production and staging data unchanged.

## Latest live generation check — 2026-10-20 21:13 UTC

- [x] The user approved exactly one synthetic staging exam with temporary Premium access. The signed-in feature Preview `dpl_CYcK7LWidAyog31TXN7zkCJmq7xN` (branch `codex/exgen-generation-quality-2026-10-20`, SHA `a70092b8bbede3a9467d4f7c70d07bc7bd9814a6`) was verified before the request; no login was needed.
- [x] Generated a 3-question short-answer Mathematics 2b exam from synthetic quadratic-function notes. The request reached the live model pipeline but failed closed: **0/3** questions passed review, so no exam was issued.
- [x] Privacy-minimized Vercel telemetry shows all three initial items were rejected for reviewer rejection, required changes, and high ambiguity. The bounded repair request timed out before returning HTTP headers (`repairTransportError=timeout`); the first generation took 16.9 s and the full request reached 33.0 s. This confirms both weak first-pass question clarity and an unhelpful repair outcome, but the exact repair timeout allowance was not logged.
- [x] The staging test profile was restored immediately to `gratis`; `mock_quota_count=3` and `mock_quota_period=2026-W43` remain unchanged. No production, `main`, or student data was touched.
- [x] Local follow-up now makes A-level math short answers explicitly bounded multi-step tasks with one checkable answer target. Repair telemetry now records only the remaining milliseconds and provider timeout allowance, without question or study-material content.
- [x] Focused offline tests for the exam pipeline and regeneration budget pass **2/2**; `git diff --check` passes.
- [!] The prompt and telemetry changes are local only and have not been pushed, deployed, or live-tested. A second provider-backed request needs separate authorization; no further live generation was sent.

**PILOT NOT READY.** Next: finish the offline suite, review the local diff, then get a bounded approval before deploying and performing one more staging-only generation check. Keep the staging profile free and Production/`main` unchanged.

## Single-pass repair after partial generation — 2026-10-20

- [x] One explicitly approved synthetic staging request on Preview commit `b401b6b` requested three short-answer Mathematics 2b questions. It failed closed with **1/3** approved; no incomplete exam was delivered.
- [x] Content-free runtime diagnostics showed one initial structural drop (`source_reference_missing`) and two verifier rejections (`low_scoring_quality`). A structural repair returned two candidates, but the later quality repair did not run.
- [x] Root cause: the partial batch triggered a structural repair before first review, spending generation time before the verifier-driven repair could run inside the 60-second function budget.
- [x] The pipeline now reserves pre-review structural repair for the zero-valid-candidate case. A partial batch is reviewed first; the existing single verifier-driven repair can then fill structural gaps and replace rejected questions.
- [x] The staging profile was temporarily Premium for the one approved request and immediately restored to `gratis`; its recorded count/period was not modified. No second model request was made.
- [x] Focused generation-pipeline and budget tests passed; full sequential API suite passed **174/174**; P.E.R. pedagogy regression and exam answer-gate tests also passed.
- [x] Commit `1778d97` is pushed to the feature branch; Preview `dpl_37J7CEM4Pd9sRzNJJw56QTXzMLhB` is `READY` from that exact SHA, and the stable branch alias points to it. The existing signed-in session restored after the page's brief auth-state check.
- [!] The new repair flow has **not** been live-tested. The single approved request was consumed on the preceding deployment; no retry was sent.

**PILOT NOT READY.** Next: request separate approval for another bounded staging generation to verify the single-repair fix. Preserve the staging account at `gratis`, and keep `main` and Production unchanged.

## P.E.R. help-level consistency — 2026-10-20

- [x] P.E.R.'s pedagogy prompt now follows the selected help level: guided practice at levels 0-1, requested step-by-step work at level 2, and a full explanation with answer at level 3. The generic instruction no longer overrides levels 2-3.
- [x] Added regression coverage for levels 0, 2 and 3, exact task values, and the guided-practice answer boundary.
- [x] `node tests/per/per-pedagogy.test.mjs` passed; `node --test tests/api/per-exam-review-handler.test.mjs tests/api/grade-to-explain-completion-proof.integration.test.mjs` passed **55/55**; full sequential API suite passed **174/174**.
- [!] User confirmed the Preview session is already signed in; no further login is needed. The P.E.R. prompt change is still local and has not been deployed or live-tested.

**PILOT NOT READY.** Next: commit the reviewed local change, update the branch Preview, and verify normal study help at levels 0-3 without changing the active-exam answer gate. Live generation still needs a permitted staging test entitlement.

## Bounded quality-repair follow-up — 2026-10-20

- [x] Quality repair now requests one extra candidate beyond the missing slots instead of `2 * missing slots + 2`, reducing repair output while retaining a spare for independent review. Mixed repairs reserve one extra candidate for each missing question type so the requested balance cannot be lost.
- [x] Both first-pass generation and repair prompts now require bounded short-answer tasks, complete mathematical givens, and scoring criteria limited to the work the question asks for (Swedish and English).
- [x] Offline exam-pipeline regression, independent-verifier contract and regeneration-budget tests passed; full sequential API suite passed **174/174**; `git diff --check` passed.
- [x] Commit `86aacb4153b49f7ba458912078c47ddec8db04a8` is on `codex/exgen-generation-quality-2026-10-20`; Vercel Preview `dpl_2qR8ZTm4YdPEKgnDvqgnQhCtDCSt` is READY and carries the branch Preview alias.
- [x] The signed-in Preview restored its session after the initial reload. One synthetic run was attempted, but staging returned the test account's weekly quota-exhausted state before model generation; no live model result was produced.
- [x] The first-pass refinement is included in commit `e33b0010e89a9a9a535a2efaf26d6bc009e80c74`; Preview `dpl_79yFTWprTFK1kcqbSMZZfLWXtUH5` is READY from that exact SHA.
- [!] Neither change has established its effect on real model-backed question yield or repair latency.
- [!] No model default was changed. `OPENAI_MODEL_EXAM` remains the controlled exam-only comparison path; stronger-model quality, latency and cost have not been measured against the default.

**PILOT NOT READY.** Next: with separate authorization, temporarily enable one bounded synthetic test for the staging account (or wait for its quota reset); compare candidate count, repair duration, and verified question yield to the last 0/3 run. Do not change model defaults until a controlled candidate-model comparison is measured.

## Live generation and repair diagnostics — 2026-10-20

- [x] The authenticated stable feature Preview session was already active after its brief restoration delay; no password was used or requested.
- [x] The quota-denial UI fix is live on deployment `dpl_D5f6AT7BHNJ2HVk7yyYNU3EF22HR` from commit `7feb6ac9cff9c0907cd936165d4fb08df96ca30f`. One synthetic 429 request verified the exhausted-quota message and that no question skeleton remains. The fix also has a frontend integration regression.
- [!] A separate synthetic 3-question Mathematics 2b generation reached the model pipeline but failed closed with **0/3** questions delivered. Safe telemetry showed two candidates rejected for missing source references and the remaining reviewed candidate rejected for option quality. Repair was attempted but its structural-repair response diagnostics were absent, so timeout/network/HTTP/parse cause is not yet known. No generated content was delivered.
- [!] Two more synthetic 3-question runs failed closed with **0/3**. One had three verifier rejections for `high_ambiguity`; another had three rejections across `high_ambiguity` and `low_scoring_quality`. No generated content was delivered.
- [x] The bounded, content-free diagnostics and shared tolerant Responses JSON parser were pushed in commits `5ec3e64` and `577923f`. Preview deployment `dpl_2G18qf3qpHWUC3jfAFhoZmgM31GX` is `READY` from exact SHA `577923f89a52b6b78b09b5617b57ff291f291636`.
- [x] One final bounded synthetic request on that deployment exposed the exact repair failure: `repairTransportError: timeout`, with no HTTP response. The repeated run confirms that the existing repair window is too short for this workload after generation and review. No generated content was delivered.
- [x] The shared tolerant Responses JSON parser now handles structural repair; both repair paths record bounded HTTP status, response/parse status, output count, normalization category and coarse transport-error class. The raw provider error/body and study material are not logged.
- [x] `node tests/api/exam-pipeline-offline.test.mjs` passed; `node --test tests/api/*.test.mjs` passed **174/174**; `git diff --check` passed.
- [!] `node tests/frontend/exam-flow.regression.mjs` did not complete in this run: it remained in a Playwright wait and was interrupted, producing a browser-closed error. No pass is claimed. Prior UI behavior was independently verified on Preview.
- [x] Staging test account role was restored from temporary `premium` to `gratis` after the approved bounded tests. No production account or quota was changed.
- [ ] The diagnostic change makes failures actionable but does **not** improve the observed question pass rate by itself. Next: fix the repair-time budget/streaming path and tighten prompts against ambiguous short-answer tasks, then compare the default model with a stronger exam-only candidate on the existing controlled eval before changing provider settings.

**PILOT NOT READY.** The latest live generation failed quality checks; grading/P.E.R. and broader security and school-operation gates remain separate. No `main`, Production or production database action was made.

## Quota messaging follow-up — 2026-10-20

- [x] The exam wizard now treats an API quota response as a distinct learner state: it says the quota is exhausted and shows the existing reset/limit message instead of presenting a generic generation failure or suggesting fewer questions.
- [x] Browser coverage drives the real wizard-to-`runGenerate()` bridge with a synthetic HTTP 429 and verifies the dedicated heading, reset guidance, and absence of the misleading retry hint.
- [x] Focused generation/verifier/solver checks passed. The complete `tests/frontend/exam-flow.regression.mjs` passed **178/178** on the final rerun; an earlier run had one transient Supabase mock fetch failure. `EXAM_FLOW_LANGUAGE_ONLY=1` also passed 58/58; syntax and diff checks passed.
- [x] Commit `4fc2122` was pushed only to `codex/exgen-generation-quality-2026-10-20`; Vercel Preview `dpl_ApBoVAqpGLqFhVnzGyHuZ5xqqvw7` is READY from that exact SHA at `https://provia-q6w46eyau-eltons-projects-4adfb1a3.vercel.app/app.html`. The existing stable branch Preview alias points to this deployment; `main` and Production were not changed.
- [!] After reloading the stable alias, the app showed the sign-in gate. The prior browser session is no longer active, so no model-backed generation/P.E.R./grading check was run against this deployment. Earlier authenticated live checks were stopped by exhausted staging quotas. No quota/role or staging data was changed in this increment.

**PILOT NOT READY.** Next: reauthenticate once on the stable feature Preview, verify its staging runtime, then run the bounded synthetic generation/P.E.R./grading checks if the approved staging test entitlement allows them. Preserve all staging data and keep `main`/Production unchanged.

## Generation reliability follow-up — 2026-10-20

- [x] The endpoint now delivers a shortened exam only when at least 60% of the requested questions (minimum 2) have passed every existing quality gate. Mixed exams must retain both MC and short-answer types. Rejected or unchecked questions are never included; smaller sets still fail closed and release the reserved quota.
- [x] The student sees the safe `received/requested` count when too few questions pass; a delivered shortened exam uses the existing visible question-count note. Privacy-safe partial-delivery telemetry records counts and quality outcomes without source material or question text.
- [x] Added an isolated `OPENAI_MODEL_EXAM` override so candidate models can be compared for exam generation without changing P.E.R. or other model-backed features. Current default remains unchanged until a measured model evaluation.
- [x] Offline checks: full sequential API suite 174/174; exam-flow Playwright regression 177/177; question-count UI checks 7 assertions. No paid model evaluation or live staging generation was run in this follow-up.
- [x] The changes were pushed to `codex/exgen-generation-quality-2026-10-20` as commit `51a9e3c6d9cd6665d6b699f125c85aad09508aa5`. Vercel Preview `dpl_3QQzvrKwMQeA3V9zjCLVMZJKxff6` is READY at `https://provia-dmfpfaob8-eltons-projects-4adfb1a3.vercel.app/app.html`; its stable branch alias is `https://provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [x] Authenticated Vercel fetch of the new Preview's `app.html` returned HTTP 200. The Preview is deployed, but its live model-backed generation flow has not yet been exercised.
- [!] Do not merge the current generation-idempotency code to `main` until its database migration is reviewed/applied to Production under separate approval. The idempotency ledger migration is currently verified only in staging.

**PILOT NOT READY.** Next: sign in once using the stable branch alias, run a bounded synthetic generation there, and diagnose the resulting request immediately in retained runtime logs. Keep Production schema and account data unchanged until their explicit release gates are met.

## Prior pilot checkpoint — 2026-10-20 19:19 UTC

- [x] Commit `73029ffffd7959f9b672a15b85989cf34c2c4d70` was pushed to `codex/exgen-generation-quality-2026-10-20`. Vercel Preview `dpl_CM5vdB7ZiXcJzoJYu6Fvsivai8u8` is READY from that exact SHA at `https://provia-qhzyjiw2a-eltons-projects-4adfb1a3.vercel.app/app.html`; only the branch Preview alias is attached. No `main`, Production, or stable alias change.
- [x] Authenticated Vercel fetch returned `app.html` and `js/exgen-runtime.js` with HTTP 200; runtime metadata says `environment: pilot` and project ref `yhcinqejsocpmmetazpz`. Raw unauthenticated HTTP receives Vercel's 302 protection redirect; this is not an app-level auth failure.
- [x] After read-only schema verification confirmed the required quota RPCs and app tables, the approved idempotency migration was applied only to staging `yhcinqejsocpmmetazpz`. Supabase recorded version `20261020190719`; the local migration and rollback filenames now use that actual version, with SQL content unchanged. Read-only verification confirms the ledger table exists, RLS is enabled with no client policies, and the three RPCs exist. No Production schema/data was changed.
- [x] Staging ACL readback confirms `anon` and `authenticated` have no SELECT/INSERT on the request ledger and cannot execute the claim RPC; `service_role` has the required table privileges and RPC execution.
- [x] Local P.E.R streaming now requires a terminal provider signal; explicit truncation and clean EOF without a terminal event are returned as interrupted and are not saved or marked `done`. Focused streaming tests pass 10/10; the full sequential API suite passes 174/174; P.E.R. error-announcement and help-ladder checks pass 12/12 and 28/28.
- [x] Browser exam-flow regression passed 177/177 on rerun. The immediately preceding run had one transient mocked-Supabase `Failed to fetch` page error; it did not reproduce on the full rerun.
- [x] At this checkpoint, the P.E.R stream fix and migration-filename reconciliation were local only; they were later pushed with commits `54ec2c5` and `51a9e3c` to the feature branch.
- [!] Authentication and synthetic live testing had not occurred on the Preview origin at this checkpoint. No generation, grading, P.E.R. or provider request had been made after the migration.
- [!] Independent review found that cache replay expiry is seven days but physical payload deletion is only opportunistic on a later claim; there is no scheduled cleanup. Other residuals: ordinary study-mode levels 0–1 rely on model/self-review behavior, and DB idempotency tests stub the quota RPCs rather than proving full quota semantics/concurrency. Address/document retention before actual learner content is used.

**PILOT NOT READY.** Next: authenticate in the exact Preview above, run only the approved bounded synthetic flow, and keep `main`, Production, and staging-account/data cleanup untouched.

## Generation idempotency implementation — 2026-10-20

- [x] The generation endpoint now binds each authenticated request to a UUID idempotency key and a server-computed hash of the normalized settings and study material. A different payload cannot reuse the same key.
- [x] A server-only request ledger provides fenced attempts, a bounded lease, exact successful-response replay, and atomic quota commit + exam issuance + cached response. The client reuses the key for the same account and exact payload without storing the study material in `sessionStorage`.
- [x] The full API Node suite passed 171/171. Targeted frontend checks passed for durable request-key storage/privacy, auth gate, and pilot session recovery. PGlite checks covered replay, payload binding, retries, stale-attempt fencing, quota commit/refund, and service-only access; the lost-response API test confirmed exact replay without a second AI or quota call. `git diff --check` passed.
- [!] The broader `tests/frontend/exam-flow.regression.mjs` still terminates with Playwright `Target page, context or browser has been closed`; this is not counted as a pass.
- [!] At the time this checkpoint was written, the changes and migration had not yet been pushed, deployed, or applied. This historical checkpoint is superseded by the current pilot checkpoint above. The newly deployed implementation still needs authenticated synthetic generate/retry/grade/P.E.R. verification. Two-account live RLS/IDOR and school operational approval also remain open.

**PILOT NOT READY.** No production or `main` change was made. Keep the staging account/data intact.

## Local generation-quality follow-up — 2026-10-20

- [x] The client-side source-word picker now excludes the generic discourse word `alltså`; the API independently filters it even when a client submits it directly. Focus-term tests pass.
- [x] Swedish generation and independent review prompts now explicitly check idiomatic grammar, technical-term inflection, definite forms and prepositions. They include the observed bad form `linjären` as a negative example and `linjens ekvation` as the natural alternative. The API prompt/pipeline and verifier contract tests pass.
- [x] Local checks passed: `tests/api/exam-focus-terms.test.mjs`, `tests/api/exam-pipeline-offline.test.mjs`, `tests/api/verifier-output-contract.test.mjs`, and `git diff --check`.
- [!] `tests/frontend/exam-flow.regression.mjs` did not complete on two attempts; both ended with Playwright reporting that its page/context/browser had been closed during later navigation. No browser-suite pass is claimed.
- [!] These edits are local to the feature worktree and have not been pushed or deployed. No additional live AI request was made; the user-authenticated Preview does not yet contain these local edits.
- [!] At this checkpoint, generation replay was still open. It is addressed by the later local implementation documented above, but awaits a reviewed and separately approved staging migration and Preview verification.

**PILOT NOT READY.** The observed Swedish wording and generic focus-term issues have local fixes and regression coverage, but updated Preview verification, generation idempotency, security isolation, telemetry/security review and school operational approval remain outstanding.

## Latest authenticated staging verification — 2026-10-20 18:39 UTC

- [x] The user confirmed login to Preview `dpl_4mKdmQiWLmbXwMeh9cgrLKwm9tqS` (`4b6b75c`, `https://provia-1z24mdnqu-eltons-projects-4adfb1a3.vercel.app`). The browser showed the authenticated ExGen app; account history and server-backed exam results were visible.
- [x] First generation click was rejected before model work because the staging test account was `gratis` with `mock_quota_count=3` for `2026-W43` (3/3 weekly quota). With the previously approved temporary staging test entitlement, its role was changed to `premium`, then restored to `gratis` after verification. The stored quota count and period remain 3 and `2026-W43`. No production account or setting changed.
- [x] A 348-character synthetic Mathematics 2b source at A-level requesting 3 mixed questions reached generation but failed the verifier's unique-question threshold. No exam was issued. The UI's retry message was generic, but the failure detail correctly explained that enough unique questions could not be verified.
- [x] A richer 632-character synthetic Mathematics 2b source, C-level and 2 short answers, generated successfully. It produced one slope question and one y-intercept question. Both synthetic answers were submitted; grading returned 4/4, with rubric evidence and full-credit answers shown after verified grading. Account history increased from 2 to 3 scored exams, confirming persistence.
- [x] During the active exam, P.E.R gave a concept-level prompt and then a process-check hint without disclosing the answer. “Ge mig svaret” was disabled with the explanation that answers open only after submission. After verified grading, the result page showed complete explanations/answers.
- [!] Live generation quality has a small but concrete issue: the accepted question said “Vad är lutningen för linjären …” (awkward Swedish). The topic extractor also offered the generic word “alltså” as a priority term. Improve prompt/term filtering and add regressions before broader pilot testing.
- [!] The test account is restored to `gratis` and remains at its weekly 3/3 quota. No test account or result data was deleted. No `main`, Production, stable alias, or database schema/migration change occurred.

**PILOT NOT READY.** Live generation, grading, persistence, and answer-gated P.E.R. are now verified on staging. Remaining gates include improving generation language/keyword quality, two-account RLS/IDOR runtime checks, usage telemetry diagnosis, secrets/security review, and school operational approval. Historical status notes below describe prior checkpoints and may be superseded by this section.

## Local verification follow-up — 2026-10-20

- [x] Grading now classifies provider transport, response-body, HTTP, and output-contract failures with an opaque request ID and content-free server diagnostic; response-body interruptions release the grading claim and can be retried. A regression proves no question, answer, or study context enters the diagnostic. The all-single-word `Kesäkten` case is also covered through the independent reviewer + blind solver + bounded repair path. The complete sequential API suite passes 170/170. These remain local/mocked changes, not live provider verification.
- [x] Added an integrated mixed-exam regression where both the MC question and short answer fail independent review in the same pass. The repair prompt must request candidates for both missing types, and the returned exam must retain the requested one-MC/one-short distribution.
- [x] Generic multiple-choice options are now compared after Unicode compatibility normalization, whitespace/case normalization, and removal of terminal sentence punctuation. Math-profile options retain their existing syntax-sensitive comparison and numeric-equivalence check. A regression covers `Stockholm` versus full-width lowercase `stockholm.`.
- [x] Assessment checks and the full sequential API suite passed: 170/170. Focused API and frontend P.E.R. session-recovery tests passed 8/8. These offline/mocked tests do not verify live model output or Preview behavior. The earlier full offline suite was started but its final exit status was not captured; it is not claimed green.
- [x] Serious P.E.R. corrections now update the saved assistant history when the corrected-history write succeeds; the streaming client also replaces its local history from that event. The answer still streams before optional self-review, so this improves future-turn context but does not hide an initial answer before a correction.
- [!] Commits `ae2cd1d` and `781dd10` were pushed to the approved feature branch. Vercel Preview `dpl_GfQx4ukSwAwakZyTy6TCvqES57vT` is READY from exact SHA `781dd10` at `https://provia-oj6r2zfao-eltons-projects-4adfb1a3.vercel.app`. Local commit `e3b427f` and the current P.E.R. history changes are not in that deployment. No alias movement, `main` merge, Production operation, or staging-data change was made.
- [!] Password changes must be entered and submitted by the user. The Supabase staging users page and the latest Preview login are the next manual handoff; after the user signs in, run only the previously approved bounded synthetic staging checks.

**PILOT NOT READY.** Authenticated Preview verification, telemetry diagnosis, two-account RLS/IDOR runtime checks, and school operational approval remain outstanding.

## Latest staging verification and local follow-up — 2026-10-20

- [x] After explicit approval, applied both grading-state migrations only to Supabase staging `yhcinqejsocpmmetazpz`; hosted ledger records `20261020170419` and `20261020170431`. Schema/RPC ACL checks and isolated PostgreSQL migration tests passed.
- [x] Authenticated Preview deployment `dpl_7jos5URBMRAY8pyREffo4V1RMRch` ran a synthetic Mathematics 2b exam end-to-end: three questions generated, active-exam P.E.R withheld answer-bearing help, submission graded 6/6, and the verified result plus account-history row were saved. Post-grade P.E.R. produced a verified-evidence explanation. Its answer included an unsolicited follow-up practice question, which may be refined.
- [!] The student selected mixed questions, but the live exam delivered three MC questions. Current prompt text requests a mix; prior server validation did not enforce the final distribution. Local code now targets one MC plus one short answer for 2 questions, and one MC plus two short answers for 3, with type-specific bounded repair in both structural and verifier-driven repair paths. Integrated 2- and 3-question regressions cover both repair paths and confirm fail-closed behavior when the model ignores the missing-type instruction; not yet deployed or live-verified.
- [!] Preview emitted `ai_usage_event_write_failed` for a four-event batch. Read-only staging metadata confirms the event table columns and constraints are compatible with the repository payload shape; an aggregate over the exact test window found no corresponding batch rows. The actual HTTP/database/network cause remains unknown because the old logger discarded status and error class. Local telemetry now logs only bounded HTTP status, database code, timeout/network category and safe class; no response body, secret or study text is logged. This diagnostic change needs a Preview run before cause can be confirmed.
- [x] The remaining grading claim metadata stays attached to the issuance after a verified save, preserving the answer fingerprint for recovery; the claim RPC checks the verified result before treating that row as pending. The observed row is therefore not by itself evidence of an unfinished grade.
- [x] The complete API test directory passed sequentially in this follow-up: 169/169 tests, including the two new ordinary-study P.E.R. handler tests. The migration regression set also passed 3/3. These are local/mocked tests, not provider-quality evidence.
- [x] Commit `edb02e4` was pushed to the approved feature branch and Vercel Preview `dpl_E565jdnYDqi1sMd8fDEdWz6CUFEK` reached `READY` from that exact SHA. Its deployment URL is `https://provia-3ctbcd5ra-eltons-projects-4adfb1a3.vercel.app`.
- [!] The new Preview opens at the staging login gate. No authenticated generation/P.E.R. request was made in this follow-up. The branch now points to `edb02e4`; local HEAD is `c0949a9` with the new P.E.R. test changes, so those later local changes are not in the Preview.
- [!] The full sequential suite previously had one `pilot-session-recovery` navigation timeout; the same test passed alone (1/1). The full suite is not claimed green.
- [ ] No `main`, Production, Preview alias or staging data was changed in this follow-up.
- [ ] Two-account RLS/IDOR runtime checks and school operational approvals (student-data scope, retention, teacher access, support and incident handling) remain open. Preserve the synthetic staging account and its data absent separate approval.

**PILOT NOT READY.** Live generation, answer-gated P.E.R., grading and result persistence now have staging evidence. Mixed-type fulfillment and usage telemetry remain unverified live; security isolation and school approvals are also open.

## Historical pre-migration staging schema/security snapshot — 2026-10-20 17:00 UTC

- [x] Current feature branch is `codex/exgen-generation-quality-2026-10-20`, HEAD `303b3c6dbd5d5f087a235f8a6dc6ced4e82f3a68`. Vercel Preview `dpl_7jos5URBMRAY8pyREffo4V1RMRch` is `READY` from that exact SHA; the approved stable Preview alias resolves to this deployment. No push, alias change, `main` merge, Production deploy, or database write was made during this audit.
- [x] Read-only metadata queries against staging `yhcinqejsocpmmetazpz` found RLS enabled on every `public` table. Reviewed student-owned policies use `auth.uid()` ownership checks; `user_exams` also has restrictive owner policies, so its permissive `true` policies do not by themselves permit cross-user reads/inserts. This is catalog evidence only, not a two-user authenticated IDOR test.
- [x] The public view found, `concept_collective_stats`, grants no `SELECT` to `anon` or `authenticated`. Supabase Security Advisor reports 40 public `SECURITY DEFINER` functions and flags four as executable by client roles (`handle_new_user`, `rls_auto_enable`, `student_error_events_consistency`, `sync_report_count`). Catalog inspection shows these return `trigger`/`event_trigger`; three are bound to triggers and `rls_auto_enable` is an event-trigger function. Direct RPC invocation was not tested. `sync_report_count` is `SECURITY DEFINER`, has no fixed `search_path`, and references `question_reports`/`driving_questions` without schema qualification; prepare and review a hardening migration before broader pilot access. The advisor also flags mutable `search_path` for invoker `match_knowledge_chunks` and disabled leaked-password protection; no database/Auth setting was changed.
- [x] Security Advisor lists 29 public tables with RLS enabled and no policies. Many are intended server-only tables; the exposed-table/RLS metadata query found no RLS-disabled public table. Per-table client access was not runtime-tested.
- [!] Metadata shows broad `TRUNCATE` table grants to `anon` and `authenticated` on multiple `public` tables, alongside RLS. RLS does not govern `TRUNCATE`; direct exploitability through the Supabase Data API was not tested. Review/revoke unnecessary client grants before widening pilot access; no grants were changed.
- [!] The deployed API and staging grading schema are incompatible. Current API code sends `p_claim_id` to `claim_exam_grading`, `release_exam_grading`, and `persist_graded_exam_result`; staging exposes only the old 3-argument claim/release and 10-argument persist signatures. Staging also lacks `exam_issuances.grading_claim_id`. Read-only migration-ledger check did not find versions `20261019130000` or `20261020091748`.
- [x] A privacy-minimized aggregate found 2 issuance rows with active grading claims; both are older than the 2-minute stale threshold and there are no claims newer than that threshold. No row identifiers or student content were read. The fencing migration will backfill claim IDs for these two stale rows; do not apply it during a live grading run.
- [x] Local isolated PostgreSQL/PGlite regression tests passed for the fencing and verified-abandonment migrations: `grading-claim-fencing-postgres`, `grading-claim-fencing-migration`, `verified-exam-abandonment-migration`, and `grading-attempt-contract` (4/4 files). These do not prove hosted staging behavior.
- [ ] Applying `20261019130000_fence_stale_exam_grading_claims.sql` then `20261020091748_fix_unverified_exam_abandonment_state.sql` to staging remains a separate schema change requiring explicit approval. The first adds a column, backfills any active grading claims and replaces/overloads grading RPCs; the second replaces abandonment RPC logic. Both have rollback files that intentionally refuse unsafe rollback.
- [ ] Authenticated live generation, grading/save, P.E.R. (normal and exam mode), and two-user RLS/IDOR verification remain incomplete. Preserve the synthetic staging account/data. Production and `main` remain untouched.

**PILOT NOT READY.** The staging grading contract is definitively behind the Preview API; obtain approval for the exact staging migrations, apply and verify them, then perform the bounded synthetic live flow once the user is authenticated.

## ExGen school pilot — verified status 2026-10-20 16:55 UTC

- Auth-fix application commit `15a95880d49a9f54430e47ef2b508317c5c00c7f` and status-doc commit `691cd290a4b8fc50ec4347d33abe5cfca8764f73` are pushed to feature branch `codex/exgen-generation-quality-2026-10-20`.
- Vercel deployment `dpl_7adHe5wkw7rf5VEpDa5HV97PMLaD` is `READY` from exact docs commit `691cd29`; its app code includes `15a9588`. The stable Preview alias `provia-ai-git-codex-exgen-schoo-1725d7-eltons-projects-4adfb1a3.vercel.app` resolves to this deployment. No `main` merge, Production deployment or database change was made.
- The preceding live generation attempt on deployment `dpl_83i2yFcRadJDSN3DVecMyVF8irz4` logged `exam_auth_rejected`, stage `auth_user_lookup`, `TimeoutError`, after the old 5-second timeout. The new code performs one bounded retry (8 seconds per request), distinguishes invalid user token (401) from Auth service unavailability (503), and shows an appropriate retry message in the UI. This is not yet live-verified.
- Offline verification passed: 196 Node tests across 95 API, assessment and P.E.R. test files; focused auth/pipeline/Supabase-key tests passed 10/10; 10 browser/UI/eval files completed, with Node reporting 13/13 subtests and specific P.E.R. exam-context 66/66, ladder 28/28 and error-announcement 12/12; `git diff --check` passed. These are code/mock tests, not live provider evidence.
- Vercel metadata shows encrypted staging-scoped variables on the feature branch, including pilot URL, server secret, OpenAI key, exam signing secret and pilot flag. Values were not read or exposed.
- The new Preview tab currently shows the sign-in gate. In the exact 2026-10-20 16:37-16:40 UTC staging Auth log window, 13 successful `GET /user` requests had `referer=http://localhost:3000`; no request from the Preview was present in the returned aggregate. This does not establish why the Vercel request timed out. The underlying cause is unknown, and no live generation, grading, persistence or P.E.R. test was possible after the latest deployment.
- The latest Preview emitted a Node.js `DEP0169` `url.parse()` deprecation warning while serving an unauthenticated `/api/abandon-exam` request. The route returns 401 when unauthenticated by design; the observed stderr warning is from a dependency and is not evidence of an application exception.

**PILOT NOT READY.** Next: authenticate in the stable staging Preview, then run the bounded synthetic generation -> grade/save -> P.E.R. checks. Preserve staging account/data; do not touch Production or `main`.

## Implementerat och verifierat i kod

- Statiskt HTML/JS-frontend med ExGen-skal, landing, app, pricing, konto och lärarsida.
- Mockprov från eget material via `api/generate-exam.js`.
- Server-side mockprovskvot via `consume_mock_exam_quota`.
- Strikt JSON-schema för genererade prov.
- Deterministisk strukturell gate.
- Generator -> granskare -> lösare-kedja för kvalitetskontroll.
- Rättning via `api/grade.js` med deterministisk MC och AI för fritext.
- Mastery-uppdatering via `apply_mock_mastery` och `user_profiles.mastery`.
- P.E.R-chat via `api/explain.js`.
- Serverstyrd hjälptrappa/anti-facit via `api/_per-help.js`.
- P.E.R-långtidsminne och elevkontext via `_per-memory`, `_learner-context`, `_mastery-view`.
- Onboarding/elevprofil via `js/per-onboarding.js` och `/api/check-role`.
- Teacher dashboard backend actions via `/api/check-role`.
- Stripe checkout, portal och webhook.
- Knowledge engine/RAG som feature-flaggad pilotinfrastruktur.
- Admin passkeys/step-up/recovery.

## Implementerat men ej verifierat live i denna genomgång

- Faktisk Supabase live-RLS och policies.
- Faktiska Vercel env values och deploymentstatus.
- Stripe Dashboard products/prices.
- Fullt auth/signup UX från ny användare till första prov.
- Teacher dashboard med riktiga två-konto-scenarion.
- Checkout end-to-end med Stripe test/live.
- P.E.R memory update över flera riktiga sessioner.

## Delvis implementerat

- Knowledge/RAG/elevloop: byggt, men feature-flaggat och inte generellt exponerat.
- School/pilotstöd: klass/lärardashboard finns, men saknar skolpilot-operationalisering.
- Felbank/minne: data finns, men flera tabeller och källor samexisterar (`user_exams`, `mock_results`, `student_*`).
- AI usage/cost tracking: tabell finns, men äldre dokument säger kostnadsfält inte är fullt tillförlitliga.
- HP/körkort: tekniskt kvar men inte kärnpositionering; `MODULES.korkort=false`.

## Planerat / vision

- ExGen Impact: ingen verifierad implementation.
- Public impact page, impact campaigns, impact pool, elevmånader: planerat/produktkontext.
- Egen tränad språkmodell som runtime-provider: ej verifierad i repo.
- Anthropic/Claude/Gemini provider-routing: ej implementerad.
- Alléskolan: plan/ambition, inte samarbete.

## Mock/demo/gammalt

- `index.html` demo är lokal/förskriven och inte riktig modellrättning.
- `instagram/*`, `live-demo.html` är marketing/demo.
- `korkortet.html` och HP-delar är tekniska moduler men bör inte blandas in i skolproduktens huvudberättelse utan beslut.
- Äldre docs/CLAUDE/AGENTS har ProviaAI/ProvKlarUF-termer och vissa gamla påståenden.

## Tekniska problem - prioriterade

### Critical

1. Secrets-audit nämner historiskt läckt Supabase service role i script. Verifiera rotation innan produktion/skolpilot.
2. RLS/live-databas är inte verifierad i denna onboarding. Kör live RLS-audit innan riktiga elever.
3. Betalningsflöde måste testas mot Stripe testmode: webhook-idempotens finns, men Dashboard-konfiguration är okänd.
4. Teacher dashboard behöver IDOR-/klassåtkomsttest med flera riktiga konton.

### High

5. UI/server-plantext måste fortsätta hållas synkad med `api/_provia-rules.js`.
6. P.E.R/generator kvalitetskedjan fail-open: verifier/solver kan hoppas över vid tidsbrist/fel.
7. Duplicerade auth helpers ökar risken att framtida fixar bara görs i `_auth.js`.
8. Knowledge engine är komplext och feature-flaggat; nya agenter kan lätt tro att RAG är allmänt live.
9. Alléskolan-text måste hållas strikt som plan, inte samarbete.
10. `mock_results` är best-effort och kodkommentar säger att `user_exams` är mer tillförlitlig.

### Medium

11. Blandning av CommonJS/ESM är driftkänslig.
12. Många routes samlas i `check-role.js`, vilket gör filen svår att granska.
13. Plan/pricing-text är spridd i flera filer.
14. HP/körkort kvar i kodbasen kan störa ExGens skolfokus.
15. Testsviter saknar tydligt top-level npm-script.

### Low

16. Namngivning ProviaAI/ProvKlarUF/ExGen bör standardiseras.
17. Gamla demo/rapportfiler i root gör repo svårare att navigera.
18. Vissa docs verkar historiska och behöver "stale" märkning.

## Rekommenderat nästa bygge

1. Gör en säkerhets- och pilotsäkringsfas innan nya featurebyggen.
2. Samla planfakta ännu hårdare så pris/kvot bara behöver ändras på ett ställe.
3. Kör RLS/live verifiering.
4. Kör kontrollerad testbaslinje utan betalda AI-anrop.
5. Bygg en skolpilot-checklista: 1-5 klasser, lärarroll, elevjoin, samtycke/GDPR, export/reporting, support.
6. Därefter: förbättra kärnflödet mockprov -> rättning -> felbank -> P.E.R-rekommendation, eftersom det är ExGens huvudloop.

## Liveuppdatering — kvotreservation och trefrågeprov — 2026-10-21

- [x] Commit `5fccaff6bfedfbbb4831f8a293e40d71fa44f8a3` är pushad till `codex/exgen-generation-quality-2026-10-20`. Vercel Preview `dpl_DjHaHgpC1Fu5e3W2rBJVeD2bPQ73` är `READY` från exakt denna SHA; projektets publika runtime visar pilotläge och stagingref `yhcinqejsocpmmetazpz`. Ingen merge till `main` eller Production-deploy har gjorts.
- [x] Efter uttryckligt godkännande tillämpades endast `per_chat_quota_reservations` i Supabase-staging. Migreringen registrerades som `20261021122219`. Read-only kontroll bekräftar RLS på reservationstabellen, ingen tabell-SELECT för `anon`/`authenticated`, samt att reserve/commit/refund/reap-RPC:erna endast kan köras av `service_role`.
- [x] Staginginloggning lyckades i den nya Previewn. Ett godkänt syntetiskt Matematik 2b-prov med 3 kortsvarsfrågor genererades på nivå A. Alla tre visades i UI: kostnadsstruktur med fasta/rörliga kostnader, totalkostnad vid 15 biljetter, samt kostnadsfunktionens lutning och tolkning. Detta bekräftar endast att ett prov med begärt antal frågor kunde genereras i just detta försök; det bevisar inte allmän kvalitet eller stabilitet.
- [x] Testkontots roll ändrades tillfälligt från Gratis till Premium för det godkända genereringsförsöket och återställdes direkt till Gratis. Ingen kvot ändrades. Det genererade syntetiska provet ligger kvar i staging; det har inte rättats eller raderats.
- [x] Den kompletta seriala Node-sviten avslutades, men rapporterade två timeoutfel i webbläsartesterna `tests/frontend/solution-photo.test.mjs` och `tests/frontend/stale-session.test.mjs`. Båda passerade när de kördes isolerat. Därför räknas fullsviten inte som helt grön. Den fokuserade kvot/P.E.R.-sviten hade passerat 71/71 före denna stagingkörning.
- [ ] Live-rättning och verifierad resultatsparning är ännu inte testade. Live-P.E.R. utanför och under ett aktivt prov är ännu inte testat. Stagingkonto och provdata ska bevaras tills separat godkänd städning.
- [ ] Stagingadvisories innehåller även befintliga säkerhets-/prestandafynd. Den nya reservationstabellen syns i RLS-no-policy-linten; direkt tabellåtkomst är samtidigt borttagen för `anon`/`authenticated` och RLS är aktiv. Övriga project-wide fynd har inte ändrats eller åtgärdats i denna ändring.

**PILOT NOT READY.** En aktuell Preview och stagingmigration är verifierade och ett syntetiskt 3-frågeprov genererades. Rättning/sparning, P.E.R.-beteende, RLS/IDOR med två konton och skolans operativa godkännanden återstår.

## Uppföljning av liveprov, rättning och P.E.R. — 2026-10-21

- [x] I samma staging-Preview och med syntetiskt Matematik 2b-material färdigställdes provet med exakt 3 frågor. Vercel-loggen visar `finalQuestionCount: 3`, 3 av 3 granskade frågor godkända och en reparations-timeout; hela provet levererades ändå efter 35,7 sekunder. Det verifierar ett lyckat försök, inte stabil svarstid eller allmän kvalitet.
- [x] Det syntetiska provet lämnades in och gav ett synligt rättat resultat: 5/7 poäng, inklusive full poäng på kostnadsresonemang och beräkning samt delpoäng på lutningsförklaringen. Resultatsidan visade frågespecifik återkoppling och nästa träningsområde.
- [ ] P.E.R. under aktivt prov gav endast en säker statusvägledning: den kunde inte verifiera provstatus och gav varken facit eller vanlig modellsvarshjälp. Källgranskningen bekräftade ett kontraktsfel: API:t utfärdade `v1.<antal-frågor>.<signatur>`, medan klienten bara extraherade ID ur `v2.<submissionId>.<signatur>`. Därför hoppades exakt-issuance-kontrollen över och klienten använde den bredare statusvägen. Stagingens `exam_issuance_state(uuid,text)` finns och har `SECURITY INVOKER` plus tom `search_path`. Vercels Hobby-retention gav ingen P.E.R.-requestlogg, så kontraktsfelet är bekräftat i koden men dess andel i varje observerat livefel är inte fullt bevisad.
- [x] Riktade offlineprov `tests/api/per-exam-review-handler.test.mjs` och `tests/frontend/per-exam-context.test.mjs` passerade tillsammans: 52/52. Den tidigare fulla sviten är fortsatt inte grön som helhet eftersom två timeoutande frontend-filer endast passerade isolerat.
- [x] Gratisrollen lämnades oförändrad under rättning och P.E.R.-kontrollerna. Ingen kvotändring, radering, produktionsåtgärd eller elevdata användes.

### Lokala P.E.R.-status- och kontextfixar — ej Preview-verifierade

- [x] Nya provmanifest är nu `v2.<submissionId>.<signatur>`; signaturen binder det synliga ID:t till användare, kurs, material och frågemängd. Verifieraren accepterar även äldre v1-manifest så redan utfärdade prov kan rättas och avbrytas.
- [x] `stepSubject()` rensar dessutom resultat-/frågekontext före vanlig studiehjälp. Browser-regressionen använder serverns `submissionId()` och kontrollerar att exakt ID skickas till `/api/explain`.
- [x] Riktad verifiering: completion/issuance/grade-review/recovery API 23/23; exam-pipeline offline passerade; P.E.R.-kontext 68/68; verifierare/solver-kontrakt 3/3; syntax och `git diff --check` passerade.
- [x] Cachead idempotent provåterspelning får nu ett nytt v2-manifest utan att frågor, grade-task eller metadata ändras. Ogiltig replay-payload failar stängt i stället för att returnera gammalt manifest.
- [x] Giltiga äldre v1-utkast kan nu statuskontrolleras efter omladdning: klienten skickar hela signerade provkontexten, servern verifierar den, härleder kontoägt ID och gör enbart en statusläsning. Browser-testet verifierar att återupptaget äldre prov för vidare exakt ID till P.E.R.
- [x] Uppdaterad riktad verifiering efter återhämtningsfixen: issuance/completion API 19/19 och P.E.R.-browser 69/69; offline generation pipeline passerade, syntaxkontroll och `git diff --check` passerade.
- [x] Bredare offline-regression på samma kod: samtliga API-tester 180/180; exam browser 9/9 filer (huvudflöde 184/184, inklusive viewport); P.E.R. browser 16/16 filer; grade browser 2/2; pilot-session recovery 1/1. Inga provideranrop i dessa tester.
- [x] Fixarna är deployade till feature-Preview `https://provia-m7ws1q3sa-eltons-projects-4adfb1a3.vercel.app/app.html`, deployment `dpl_8QyRVKihvp5oFmXk8cW1rDYE1HLe`, exakt SHA `c82914e` på `codex/exgen-generation-quality-2026-10-20` (`target=null`).
- [ ] Inget nytt live P.E.R.-anrop har körts efter deployen; livebekräftelse av fixen återstår och kräver separat godkännande. Aktiva och oavslutade prov ska fortsatt verifieras fail-closed.

**PILOT NOT READY.** En generering med tre frågor samt rättning/resultatvisning verifierades live. P.E.R:s live-statusgrind hindrar fortfarande normal hjälp i appens provflöde; dessutom återstår fullsvitsstabilitet, RLS/IDOR-tvåkonto, och skolans operativa godkännanden.

## Exekverad RLS-regression — 2026-10-21

- [x] `tests/api/user-exams-rls-postgres.test.mjs` kör den riktiga `lock_user_exams_to_owner`-migreringen i isolerad PostgreSQL via PGlite med två användar-ID:n och rollen `authenticated`.
- [x] Testet bekräftar att konto A endast läser egna provrader, kan infoga en egen rad, inte kan infoga med konto B:s ägar-ID och saknar direkt UPDATE/DELETE. Slutlig tabellkontroll bekräftar att det nekade försöket inte sparades.
- [x] Samma ändringars närliggande regressionskontroller passerade: RLS/pilot-scope/route-boundary 13/13; resultatpersistens/completion-proof plus PostgreSQL grading fencing 5/5.
- [x] Read-only katalogkontroll i aktuellt Supabase staging bekräftade `user_exams` med RLS aktiv, ägarbegränsade SELECT/INSERT-policyer och ingen authenticated UPDATE/DELETE-grant. `mock_results`, `exam_issuances` och `per_chat_quota_reservations` har RLS aktiv och saknar browser-rollernas tabellgrants. Migreringshistoriken innehåller de väntade ägar-/exam-skyddsmigreringarna.
- [ ] Varken PGlite-testet eller katalogkontrollen bevisar två separata autentiserade JWT-sessioners faktiska radåtkomst via staging Data API. Inga stagingrader eller konton lästes eller ändrades.

**PILOT NOT READY.** En central ägarpolicy har nu ett exekverat tvåkontotest lokalt. Hosted staging-RLS/IDOR och skolans operativa godkännanden är fortfarande öppna.

## Offlineuppföljning av återupptagbar provgenerering — 2026-10-22

- [x] Den HTTP/PGlite-baserade regressionskontrollen täcker nu deadline med 8/12 godkända frågor: API:t utfärdar tydligt 8/12 som delprov, använder den godkända kvoten exakt en gång och återspelning varken genererar eller utfärdar igen.
- [x] Samma gränstest täcker 7/12 under delprovsgränsen: API:t returnerar `incomplete_exam` med faktiskt antal, rensar terminalt innehåll, återbetalar reservationen exakt en gång och utfärdar inget prov.
- [x] Pipeline-enhetstestet har en övre gräns på tio steg, så fel i progressionen misslyckas tydligt i stället för att hänga.
- [x] Riktade API- och UI-regressioner passerade: 43/43 över `exam-generation-pipeline-http`, `exam-generation-pipeline-postgres`, `exam-generation-pipeline`, `exam-generation-recovery`, `exam-regeneration-budget`, `exam-generation-progress` och `exam-partial-delivery`.
- [x] Oberoende read-only-granskning fann inga blockerare; granskaren föreslog en extra assertion för att bekräfta att quota-reservationen förblir `consumed` efter replay. Assertionen lades till och hela riktade paketet passerade igen 43/43.
- [ ] Detta är offlineverifiering med PGlite/mockad modell, inte bevis på verkligt modellutbyte, hosted migration/ACL eller förbättrad live-yield för 12 frågor. Den fulla webbläsarsviten kördes inte i denna uppföljning.

**PILOT NOT READY.** Nästa tekniska bevis kräver att exakt Preview och staging-schema är synkade; därefter behövs ett kostnadsbegränsat syntetiskt provanrop. Ingen push, deploy, migration eller providerförfrågan gjordes här.

## Read-only staging-/Preview-kontroll — 2026-10-22 13:32 UTC

- [x] Supabase staging `yhcinqejsocpmmetazpz` rapporterar migrationsversioner endast till `20261022092012_resumable_mock_exam_pipeline`; lokala migrationer för owner-claim, retention och cron (`20261022140100`–`20261022140300`) saknas fortfarande.
- [x] Den skyddade stagingbudgeten har en rad, cap `$5.000000`, spenderat `$0.208611`, reserverat `$0.225728`, kvar `$4.565661`, aktiv. Read-only-kontrollen läste inga användar-/provdata.
- [x] Senaste READY Vercel Preview för målbranchen är `dpl_CGLkFkw6u6XRYkq5YUgH3fgczVd5`, SHA `a66a7f1`; aktuell lokal HEAD är `dd0b4f1` med ändringar. Den Previewn är därför inte exakt arbetskoden och staging saknar dess nya RPC.
- [ ] Ingen schemaändring, push, deploy, merge eller modellförfrågan utfördes. En ny budgetavläsning krävs precis före ett godkänt liveanrop.

**LIVEVERIFIERING BLOCKERAD AV VERSIONSSKEVHET.** Först behövs separat godkännande för migration i staging och push/Preview; därefter kan ett syntetiskt 12-frågeförsök göras om budgeten fortfarande medger det.

## Intern reparationsbudget och migreringshärdning — 2026-10-22

- [x] Interna verifierade batchar använder nu en 4-sekunders efterreserv efter reparationsgranskning i stället för den vanliga 14-sekundersreserven för kvot/utfärdande. Vanliga elevanrop behåller 14 sekunder; oberoende verifiering och blindlösare är fortsatt obligatoriska.
- [x] Både strukturell reparation och verifierarstyrd reparation skickar rätt internbudget. Offline-regressionen kör en intern strukturell reparation med syntetisk tid där 14-sekundersreserven hade nekat försöket, och verifierar 3 av 3 kandidater oberoende.
- [x] Migrationerna är ordnade efter pipelinekärnan: `20261022140100` owner-claim, `20261022140200` cleanup och `20261022140300` cron-schedule. Cron-rollback avregistrerar bara det exakta job-ID som migrationen själv skapade; ett förbefintligt jobb med samma namn lämnas kvar.
- [x] Retentiontexten säger nu att jobb blir berättigade efter 24 timmar, medan 15-minuters schemaläggning är best effort med högst 100 poster per körning. Fördröjning/kö kan alltså överskrida 24 timmar; policy är fortfarande preliminär och måste godkännas av skolan.
- [x] PGlite-testet verifierar retentionströskeln, exakt quota-settlement, cron-schedule ownership, rollback samt avslag för inaktivt jobb eller fel database/user/kommando. Den slutliga riktade provsviten passerade 45/45; offlinepipeline och regenereringsbudgettest passerade.
- [!] Allt ovan är lokalt offlinebevis. Ingen Supabase-migration, push, Preview-deploy eller modellförfrågan gjordes. PGlite simulerar cron-katalogen; verklig `pg_cron`, hosted ACL, concurrency och providerlatens är inte verifierade.

**PILOT NOT READY.** Slutför riktad regressionssvit och oberoende review. Därefter krävs separat godkännande för exakt push/Preview och stagingmigrationer, färsk kostnadsavläsning och ett syntetiskt 12-frågeprov.

## Agent- och lärandearbetsflöde samt abortåterhämtning — 2026-10-22

- [x] Projektets agent-playbook och lärandelogg användes i den här sessionen: en huvudskribent, återanvända skrivskyddade timeout- och testgranskare, verifiering mot kod/test och en kort evidensmärkt lärdom. Detta återanvänder rollkort; det återställer inte alla historiska agentinstanser eller privata resonemang.
- [x] HTTP/PGlite-timeoutfallet kör nu ett steg genom den faktiska interna `generateVerifiedBatch`/`streamGeneration`-vägen. Den lokala fejkade OpenAI-strömmen avbryts endast när generatorns riktiga `AbortSignal` avbryter den; API:t behåller 2 redan checkpointade frågor och samma jobb kan därefter återupptas till 3 frågor.
- [x] Den oberoende API-/timeoutgranskaren fann inga blockerare eller väsentlig testkontaminering. Timer- och testnyckeloverride återställs i `finally`.
- [x] Fokuserad HTTP/PGlite-fil passerade 2/2; den fokuserade 7-fils pipeline-/UI-sviten passerade med exitkod 0; `git diff --check` passerade.
- [!] Detta är fortfarande offlinebevis. Strömmen avbryts innan SSE-innehåll anländer och återhämtningsbatchen använder befintlig mockgenerator. Det bevisar abortpropagering, bevarande av tidigare checkpoint och återupptagbar pipeline, inte partiell JSON-salvage, modellens 12-frågeyield eller liveförbättring.
- [ ] Ingen push, deploy, Supabase-ändring eller live-modellförfrågan gjordes. Exakt stagingversion/migreringssynk och kostnadsgräns måste verifieras innan tidigare godkänd liveverifiering kan utföras.

**PILOT NOT READY.** Nästa steg är att kontrollera exakt aktuell Preview/staging-synk och, om det fortfarande är godkänt och inom kostnadsramen, mäta ett syntetiskt 12-frågeprov. Behåll tydlig skillnad mellan lokala tester och liveutfall.

## Jobbkorrelerad telemetri och återhämtningsregression — 2026-10-22

- [x] Resumable pipeline skickar parent-jobbets UUID vidare till den interna verifierade batchen. Händelserna korreleras i befintliga textfältet `request_id` med prefixet `exam-pipeline:`; pipeline-id skrivs inte i `job_id`, eftersom den kolumnens FK pekar på den separata `generation_jobs`-tabellen.
- [x] Offlineintegrationen kontrollerar att generering, jämförande granskning och blindlösare loggas med samma pipeline-ID och att loggposterna saknar syntetiskt material och frågetext.
- [x] Reparationstestet ger nu generatorn 39 sekunder, vilket modellerar 6 sekunders setup inom worker-vägens 45-sekundersdeadline. En 14-sekunders första generering följs av 5 sekunders strukturell reparation och oberoende verifiering i offline-fixturen.
- [x] HTTP-regressionen täcker nu avbruten 12-frågegenerering med återupptagning, samt att terminalt prov under minsta delprovsgräns rensar payload/accepted questions och inte lämnar ett skenbart komplett prov.
- [x] Offlinepipeline-testet passerade. Den fokuserade 9-fils API/UI-sviten avslutades med exitkod 0. Syntaxkontroll för `generate-exam.js`, `_ai-usage.cjs` och `_exam-generation-pipeline.cjs` samt `git diff --check` passerade.
- [x] Tre oberoende read-only-roller granskade timeout/reparationsbudget, återhämtningsassertions samt säkerhet/idempotens/telemetri. Deras fynd verifierades och åtgärdades lokalt; slutgranskningen fann inga återstående blockers inom granskad kod.
- [!] Detta bevisar korrelation och återhämtning i lokal/offline-mockad körning, inte att en verklig modell konsekvent producerar 12 kvalitetsgodkända frågor. Nya jobbkorrelerade telemetrirader finns inte förrän kodrevisionen är deployad och körd.
- [!] Reparationsfixturen modellerar 6 sekunders route-setup genom att ge generatorn 39 sekunder av worker-vägens 45. Den går direkt in i generatorn och mockad provider svarar direkt; verklig setup- och modelllatens är inte mätt.
- [x] Senaste read-only stagingkontroll: projektet `yhcinqejsocpmmetazpz` var `ACTIVE_HEALTHY`; migrationshistoriken slutade vid `20261022092012`, medan owner-scoped claim-migration `20261022140100` saknades. Senaste READY Preview var SHA `a66a7f1`, före aktuell lokal HEAD `dd0b4f1`. Budgetläsningen visade `$4.565661` kvar under stagingtaket `$5`; detta är en ögonblicksbild, inte ny tillåtelse till kostnad.
- [ ] Push, Preview, migration och live-AI-anrop är inte gjorda i denna uppföljning. Liveverifiering är fortsatt blockerad av versions-/schema-skevhet.

**PILOT NOT READY.** Nästa steg kräver separat godkänd push/Preview och stagingmigration, därefter kontroll av exakt SHA/schema och endast då ett syntetiskt 12-frågetest inom en färsk kostnadskontroll.

## Full offline-regression och aktuell extern synk — 2026-10-22

- [x] Efter att `sitemap.xml`-posten för `app.html` uppdaterats till senaste Git-datumet passerade `tests/frontend/sitemap-lastmod.test.mjs`.
- [x] Hela upptäckta `*.test.mjs`/`*.test.js`-sviten under `tests/`, exklusive den uttryckligen livebaserade katalogen, kördes serialt och avslutades med exitkod 0. Detta inkluderar API-, PGlite-, bedömnings-, frontend- och examensgeneratorregressioner; inga live-provideranrop ingick.
- [x] Färsk read-only Supabase-kontroll: staging `yhcinqejsocpmmetazpz` är `ACTIVE_HEALTHY`, men migrationerna slutar vid `20261022092012`. Owner-scoped claim `20261022140100` och senare lokala pipeline-migrationer saknas.
- [x] Färsk read-only Vercel-kontroll: senaste READY branchtillhöriga deployment är fortfarande SHA `a66a7f1` (`dpl_CGLkFkw6u6XRYkq5YUgH3fgczVd5`), inte lokal HEAD `dd0b4f1` eller dess dirty ändringar.
- [x] Budgetläsningen visade cap `$5.000000`, spenderat `$0.208611`, reserverat `$0.225728`, kvar `$4.565661`, aktiv. Ingen modellförfrågan, migration, push eller deploy utfördes.
- [x] En aggregerad read-only join av de senaste 20 12-frågejobben mot `ai_usage_events.request_id` med både kvotreserv-ID och det nya pipeline-prefixet gav noll events för det observerade `OPERATION_DEADLINE`-jobbet med 0/12. Historiska AI-steg kan alltså inte kopplas till just det jobbet.
- [!] Offline-sviten visar att repo-regressionerna passerar; den bevisar inte hosted RPC/ACL, stagingtelemetri eller 12-frågeyield med den verkliga modellen. Live-test kräver att exakt revision och schema synkas efter separat godkännande.

**PILOT NOT READY.** Kod- och testsidan är starkare verifierad lokalt. Nästa nödvändiga evidens är ett syntetiskt stagingprov på exakt aktuell kodrevision och migrationskedja, inom en färsk budgetkontroll.

## Start-replay och reparationsfelgränser — 2026-10-22

- [x] HTTP/PGlite-testet kastar nu bort första handler-svaret i testklienten, hämtar operationen från beständig lagring och provar sedan samma idempotensnyckel igen: samma operation återanvänds, den riktiga `reserve_mock_exam_quota`-SQL-funktionen har skapat exakt en reservation och profilkvoten har bara ökats en gång. Kandidatdata och intern payload exponeras inte i retry-svaret.
- [x] Testmatrisen täcker uttömda batchförsök från både `generate` och `repair` för 3, 6 och 12 frågor, exakt vid och under delprovsgränsen. Den verifierar tydligt delprov eller terminalt fel, exakt en issuance/refund samt replay utan ny generering, finalisering eller kvoteffekt.
- [x] Den fokuserade sjufilssviten för pipeline, HTTP/PGlite, recovery, budget och progress avslutades med exitkod 0. `node --check` för HTTP-testet och advance-handlern samt `git diff --check` passerade.
- [x] Återupptagen read-only test-/recoverygranskare bekräftade efter testförstärkningen att den riktiga SQL-kvotfunktionen lämnar en reservation och en profilökning vid sekventiell start-replay; inget blockerande fynd. Harnessen modellerar inte verkligt nätverksbortfall eller samtidiga starter. Repair-matrisen börjar med seedade repair-jobb och bevisar inte övergången generate→repair. Framgångsreplay mäter wrapperanrop, inte OpenAI-anrop.
- [!] Evidensen är lokal/offline och säger inget om verklig modell-yield eller hosted RPC.
- [!] Ingen push, deploy, migration eller modellförfrågan utfördes. READY Preview och staging-schemat är fortsatt äldre än lokal arbetskopia enligt senaste read-only-kontrollen ovan.

**PILOT NOT READY.** Nästa bevissteg är oberoende granskning av testerna och därefter separat godkänd, versionssynkad Preview/staging-verifiering.

## Browser-återupptagning och gräns för klientens väntetid — 2026-10-22

- [x] Oberoende API-/timeoutgranskning följde klienten från `pipeline=start` genom advance/status och verifierade att samma användar-/payloadnyckel återupptar operationen, att bara ett svar med ett färdigställt prov räknas som success, samt att delprov och terminalt `incomplete_exam` visas separat.
- [x] Granskaren noterade att klientens 14-minutersgräns är mjuk: ett redan startat advance kan ta upp till 62 sekunder och en statuskontroll upp till 10 sekunder extra. Det kan förlänga vänteläget men visar inte provet som klart eller lämnar UI:t fast; klienten returnerar i stället återupptagningsstatus. Ingen ändring bedömdes nödvändig.
- [x] `tests/frontend/exam-generation-progress.test.mjs` och `tests/frontend/exam-flow.regression.mjs` passerade i samma riktade körning: 9/9 Node-tester och 186/186 browserregressioner.
- [!] Browserharnessen använder lokala/mokade scenarier och mäter inte riktig 14-minutersdrift eller live-Supabase. Den senaste read-only staging-/Preview-synken står kvar enligt tidigare status; inget provideranrop gjordes.

**PILOT NOT READY.** Lokal UI-/återupptagningsverifiering är grön. Kvar för att bekräfta riktig 12-frågeyield är versionssynkad Preview/staging och ett godkänt syntetiskt modellanrop.

## Reparationstelemetri och verifierarbudget — 2026-10-22

- [x] 12-fråge-HTTP-fixturen fångar nu sanerad `exam_generation_pipeline_batch`-telemetri och kräver både `repairAttempted=true` och `repairOutcomeStage=repair_combined`. Testet bevisar därmed den faktiska reparationsövergången i den integrerade mockade modellen, inte enbart att slutresultatet innehåller 12 frågor.
- [x] Oberoende API-/timeoutgranskning hittade en missvisande kommentar: 18 sekunder är internverifierarens maxtak, medan svarsmarginalen på 3 sekunder dras separat från återstående budget. Kommentar och budgettesternas beskrivningar är korrigerade; runtime-budgeten är oförändrad.
- [x] Riktad pipeline-/HTTP/PGlite-/recovery-/offline-/budgetsvit passerade 41/41. Syntaxkontroller och `git diff --check` passerade. Den fulla seriala sviten rapporterade ett fel i `tests/frontend/app-auth-gate.test.mjs`; samma test passerade 1/1 när det kördes isolerat efteråt, så ordnings-/miljöflakighet återstår att utreda.
- [!] Reparationstestets provider-, verifierar- och lösarsvar är deterministiska mockar. Det bevisar kodväg, telemetri och oförsvagade grindar, inte verklig modellkvalitet eller 12-frågeyield.
- [!] Ingen push, Preview, migration eller live-modellförfrågan utfördes. Senaste verifierade externa synk ovan visar fortfarande att staging/Preview ligger efter arbetskopian.

**PILOT NOT READY.** Nästa steg är att reda ut auth-gate-svitens flakighet och först därefter synka exakt revision och schema för ett separat godkänt stagingprov.

## Ny staging-Preview och syntetiskt 12-frågeprov — 2026-10-22

- [x] Tillämpade enbart repair-feedback-RPC-migreringen i staging
  `yhcinqejsocpmmetazpz`. Supabase registrerade den som version
  `20261022172446` (`checkpoint_exam_repair_feedback`). ACL-kontrollen visar
  `EXECUTE` för `service_role` och databasägaren; `anon` och `authenticated`
  saknar rättigheten.
- [x] Pushade endast `fadbb3a` och `d95daa8` till den befintliga
  feature-branchen. Vercel Preview `dpl_EKKRoewXkvjv2fzh6ryr95MA6qrN` blev
  READY på SHA `d95daa84c2919127e6631521bea5b081fbd9cd93`. Branchens variabler
  verifierades som Preview-scope utan att läsa värden; den publika runtime
  pekade på staging och innehöll inte produktionsprojektets URL.
- [!] Ett syntetiskt Matematik 2b/C/kortsvar-jobb, ID
  `3509275b-2696-44c7-a45f-a6e16e27acff`, bad om 12 frågor. Fem genererings-
  och reparationsbatchar tog cirka 30–38 sekunder vardera. Första batchen
  godkände 0/2; därefter steg godkända frågor till 1 och 2. Två senare
  reparationsbatchar godkände inga nya frågor. Totalt: 2/12, terminalt
  `STAGE_RETRY_LIMIT`; inget prov eller någon submission utfärdades.
- [x] UI:t visade progressräknaren och slutligen korrekt text: 2 av 12
  klarade kontrollen, inget prov lämnades ut. Telemetrin rapporterade inga
  strukturellt bortsorterade eller dubbla kandidater. De vanligaste
  granskningsfelen var källstöd, svarsalignment och scoring alignment.
- [x] Terminalkontroll visade att jobbpåslaget och accepterade checkpoints var
  rensade, idempotensraden var `retryable`, svarspayload saknades och
  `submission_id` var null. Ingen ny generering gjordes efter terminalstatus.
- [x] Stagingbudgeten ändrades från spenderat `$0.244268` till `$0.367660`;
  reserverat belopp låg kvar på `$0.225728`. Återstående av den befintliga
  totala `$5`-gränsen är `$4.406612`. Delta `$0.123392` är appens budgetbokning,
  inte en verifierad faktura från modellleverantören.
- [!] Livekörningen bekräftar att serverns reparationssteg startar, feedbacken
  påverkar fortsatta omgångar och felaktigt prov inte utfärdas. Den bekräftar
  inte tillförlitlig 12-frågeyield. Nästa förbättring måste öka andelen
  källförankrade och svarskorrekta kandidater utan att sänka granskningskraven.
  Ytterligare liveanrop kräver ny uttrycklig bekräftelse och en ny budgetkontroll.

**PILOT NOT READY.** Hosted version är nu uppdaterad, men detta accepterade
12-frågeprov misslyckades med 2/12 och använde cirka `$0.123392` av appens
stagingbudget. Fortsätt med kod-/promptanalys och offlinebevis innan en ny
begäran om stagingtest.

## Lokal reparationskvalitet efter stagingresultatet — 2026-10-22

- [x] Källgranskning fann en konkret promptinkonsekvens i reparationsvägar som
  översamplar: JSON-schemat och reparationsinstruktionen begärde `repairCount`,
  medan den ursprungliga användarprompten fortfarande angav `numQuestions`.
  Detta kan förvirra kandidatantalet i strukturell och inline-kvalitetsrepair.
  Det är inte bevisat som orsaken till stagingresultatet 2/12; de sparade,
  sanerade uppgifterna innehåller inte det ursprungliga prompt-/frågeinnehållet.
- [x] `buildExamPrompts` returnerar nu offset för sin genererade antalrad.
  Reparationen ändrar bara raden på exakt offset till `repairCount`; explicit
  saknad/felaktig offset avbryter fail-closed. Kursfält och studiematerial,
  även när de innehåller en liknande rad, lämnas oförändrade.
- [x] Den lokala pipelineändringen breddar endast senare repair-batcher efter
  upprepade resultatlösa försök från 3 till högst 5 kandidater. Den fortsätter
  att acceptera endast `verified`, avvisa dubbletter/fel typer och begränsa
  lagrade frågor till begärt antal. Kvalitetsgrindar och quota-/issueflöde är
  oförändrade.
- [x] `reviewer_other` gav tidigare ingen konkret reparationsväg trots att
  kategorin överlevde den säkra checkpointen. Svensk och engelsk repair-prompt
  ber nu om en annan direkt källstödd uppgift, bibehållen nivå, självständig
  lösning och en matris som motsvarar frågan. Råa reviewer-kommentarer sparas
  eller skickas fortfarande inte mellan batchar.
- [x] Fokuserad 9-filerssvit passerade 64/64; syntaxkontroll för generator och
  test, samt `git diff --check`, passerade. Oberoende API- och säkerhetsgranskare
  bekräftade att offsetkorrigeringen bevarar material och grindar; inga
  blockerare återstår i den granskade lokala diffen.
- [!] Denna kod är lokal ovanpå `d95daa8`; den har inte committats, pushats,
  deployats eller körts mot staging. Inget nytt modellanrop gjordes. Föregående
  stagingacceptans står kvar som 2/12; inget förbättrat live-utfall är visat.

**PILOT NOT READY.** Nästa evidenssteg kräver en separat godkänd push/Preview
och ett färskt stagingbudgetbesked före ett nytt syntetiskt modellanrop.

## Stagingverifiering av repair-prompt och adaptiv batch — 2026-10-22

- [x] Commit `a607edc608bebf80923aa88db3c612593f0e0534` pushades endast till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_GmjwwREV1JEPbrVcPx7nsXSkkF9m` blev READY på exakt denna SHA. Den
  befintliga branch-aliasen återanvände staginginloggningen; publikt runtime-
  config bekräftade `environment=pilot` och stagingref
  `yhcinqejsocpmmetazpz`, utan produktionsref.
- [x] Migrationslistan visade redan pipeline-, retention-, budget- och
  repair-feedback-migrationerna. Ingen migration tillämpades på nytt i denna
  körning; ingen produktionsdatabas ändrades.
- [x] Ett syntetiskt Matematik 2b-prov på C-nivå begärde 12 kortsvarsfrågor.
  UI:t öppnade ett prov med exakt 12 frågor. Genomgång av samtliga frågor i
  UI visade varierade uppgifter om nollställen, vertex, symmetrilinje,
  parabelriktning och linjära funktioner, inom det syntetiska materialets
  ämnesområde. Inga svar lämnades in och ingen rättning kördes.
- [x] Sanerad runtime-telemetri visar nio batcher: 12 frågor godkändes av
  oberoende granskning och accepterades successivt. Efter en batch utan
  framsteg växte reparationsbredden från 3 till 5 kandidater; nästa batch
  accepterade 3 frågor och den sista 3, vilket gav 12/12. Två tidigare
  repair-batcher rapporterade `insufficient_unique_repair` och en
  `repair_normalization`; inga underkända eller o-verifierade kandidater
  accepterades. Samlad batchlatens var cirka 286 sekunder över nio separata
  requests.
- [x] Appens stagingbudget före körningen var `$0.367660` spenderat och
  `$0.225728` reserverat. Efteråt: `$0.528050` spenderat, `$0.225728`
  reserverat, `$4.246222` kvar av det befintliga `$5`-taket. Delta
  `$0.160390` är intern appbokföring, inte leverantörsfaktura. Konto, roll,
  kvotkonfiguration och produktionsresurser ändrades inte.
- [x] Fokuserad lokal svit passerade 64/64, syntaxkontroll och
  `git diff --check` passerade. Oberoende granskning fann ingen blockerare;
  dess egen niofilssvit rapporterades som 65/65. Granskningen bekräftar att
  ägarskap, lease fencing, idempotens, kvotavräkning och utfärdandespärrar
  inte ändrades.
- [!] En lyckad livekörning visar att den här 12-frågebegäran kan fullföljas,
  inte att yield eller kvalitet är tillförlitlig i allmänhet. Adaptiv
  breddning ökar möjliga utdata inom oförändrad 45-sekunders arbetstid;
  agentgranskningen noterar att större payload kan nå verifierarens fasta
  60 000-teckensgräns. Det lokala HTTP-testet täcker nu en riktig 5-kandidat-
  reparationsbatch med en cirka 54–60k teckens verifierar-payload, simulerad
  ungefär 30-sekunders arbetstid och minst 12 sekunders deadline-reserv. Det
  använder mockade provider-/granskarresultat och fake clock; det bevisar inte
  live-yield, verklig latens eller timeoutbeteende.
- [!] Stagingprovet står öppet i testkontot och har inte lämnats in. Ingen
  cleanup eller ytterligare AI-körning utfördes.

**PILOT NOT READY.** Första färska livekörningen på `a607edc` nådde 12/12
utan att försvaga kvalitetsgrindarna. Nästa tekniska steg är att täcka
5-kandidatbatchens timeout-/payloadgränser offline och samla fler fristående
stagingresultat först efter ny budgetkontroll och uttryckligt godkännande.

## HTTP-reparation verifierad för 3, 6 och 12 — 2026-10-23

- [x] Den integrerade HTTP/PGlite-fixturen kör nu verifieraravslag och inline-
  reparation genom den riktiga interna generatorn för samtliga begärda antal:
  3, 6 och 12. Varje scenario kräver exakt fullständigt antal, verifierad
  slutcheckpoint, frånvaro av den avvisade frågan samt exakt en kvotförbrukning
  och issuance.
- [x] Riktad pipeline-, HTTP/PGlite-, recovery-, budget- och UI-svit passerade
  60/60. Separata verifierar-, lösar-, källstöds-, bedömnings- och
  idempotenskontroller passerade 22/22. `node --check` på HTTP-testet och
  `git diff --check` passerade. Hela seriella offline-sviten passerade 407/407
  tester på cirka 10 minuter. Efter sista granskarfeedbacken lade vi till
  replaykontroll av reservationsstatus samt en intern 4 001 ms-reparationstest
  med samtidiga verifierar-/lösar-timeouts; slutlig fokuserad omkörning av de
  tre berörda API-/generatorfilerna passerade 4/4, båda `node --check` och
  `git diff --check` passerade. Testgranskningen fann inga blockerare;
  timeoutgranskningen verifierar nu att fejkad parallell latens inte förkortar
  lösarens beräknade tidsfönster.
- [!] Provider-/granskarresultaten är mockade. Detta stärker offlinebevis för
  den count-känsliga `generate -> repair -> issue`-vägen men bevisar inte
  modellens live-yield, hosted schema/ACL eller beteende på staging.
- [x] Boundary-regressionen kör den interna reparationsströmmen med exakt
  4 001 ms generationstid; båda granskningsrollerna verifieras fortfarande,
  med fångade timeoutfönster 18 000/8 000 ms för verifieraren och
  19 001/8 000 ms för lösaren mellan första och reparationsrundan.
- [x] Replay efter 3/6/12-frågereparation returnerar samma svar utan nya
  modell-/usage-händelser, ytterligare kvot, ändrad reservationsstatus eller
  duplicerad utfärdning.
- [x] Test-/statusändringen pushades som `683d841` till
  `codex/exgen-generation-quality-2026-10-20`; PR #123 är fortsatt draft och
  Vercel Preview för exakt commiten blev `READY`. Ingen `main`-merge,
  produktionsdeploy, migration eller live-modellförfrågan utfördes.
- [!] Färsk read-only stagingkontroll i denna fortsättning: migrationshistoriken
  slutar vid `20261022172446_checkpoint_exam_repair_feedback`; migrationen
  `20261022220521_add_repeated_learning_objective_checkpoint_feedback.sql`
  saknas. Budgettabellen har en rad med tak `$5.000000`, bokfört `$0.581394`
  spenderat och `$0.225728` reserverat, men senaste `updated_at` var
  `2026-10-22 21:50 UTC`. Dessa värden är inte färska nog för att tillåta ett
  nytt liveanrop; inget liveanrop gjordes.

**PILOT NOT READY.** Nästa steg är fortsatt kod-/offlinegranskning och därefter
versionssynkad stagingverifiering efter godkänd stagingmigration och färsk
kostnadsavläsning. En ny read-only produktionsfråga i denna session fann inte
`public.mock_exam_generation_pipeline_jobs` eller de förväntade claim-,
checkpoint- och P.E.R.-kvots-RPC-signaturerna. Merge/deploy till produktion är
spärrad tills databasschemat är versionssynkat och verifierat.

## Salvage av kandidat före stream-timeout — 2026-10-23

- [x] Offline-regressionen i `tests/api/exam-pipeline-offline.test.mjs` kör
  repair-stream-timeout för begäranden om 3 och 6 frågor: strömmen lämnar en
  hel kandidat och hänger tills dess faktiska AbortSignal avbryter. Timern för
  startgenereringen behålls; endast repair-timern kortas i fixturen. HTTP-
  timeoutvägen för 12 frågor täcks separat i PGlite.
- [x] Båda scenarierna visar att kandidaten går till oberoende verifierare och blind
  lösare, båda usage-händelserna rapporterar godkänd kvalitetsgrind, den
  tidigare avslagna frågan förblir utesluten och provet endast utfärdas efter
  att repair-kandidaten fyllt sista platsen. Transporttelemetrin anger timeout.
- [x] Relevant pipeline-, PGlite/Postgres-, HTTP-, offlinegenerator-, budget-
  och progress-UI-svit passerade 54/54 efter ändringen; syntax- och diffkontroll
  passerade. Oberoende timeoutgranskare fann och fick åtgärdat en risk med
  globalt förkortad timer, och verifierade den avgränsade slutversionen utan
  kvarstående testfynd. Säkerhetsgranskningen fann inga åtgärdbara fynd i koden.
- [!] Alla provider-/granskarresultat är syntetiska mocks. Detta testar den
  integrerade timeout-/salvage-kontrollvägen, inte verklig modellyield,
  hostad RLS/ACL eller staging.
- [x] Status- och teständringarna committades som `00cace9` och pushades till
  feature-branchen. PR #123 pekar på den commiten; dess Vercel Preview byggs.
  `supabase/.temp/cli-latest` är en separat befintlig användarändring och har
  lämnats orörd.
- [!] GitHub PR #123 är fortfarande draft. Produktionskontrollen visar att
  `mock_exam_generation_pipeline_jobs`, `mock_exam_generation_requests` och
  pipeline-/kvots-RPC:erna saknas. Merge till `main`/Production görs därför
  inte innan separat, godkänd schemahantering och verifiering.

**PILOT NOT READY.** Kvar är färsk stagingmigrations-/budgetkontroll,
versionssynkad stagingverifiering och därefter säker produktionsschema-plan
innan PR #123 kan mergas.

## Fortsatt offline- och stagingaudit — 2026-10-23

- [x] Seriell offline-svit `node --test --test-concurrency=1 --test-reporter=dot $(rg --files tests -g '*.test.mjs' -g '*.test.js')`
  avslutades med exitkod 0 över samtliga 193 testfiler på den aktuella
  12-fråge full-/delprovssalvagediffen. Den riktade sviten passerade 54/54.
- [x] Tre återupptagna, read-only granskarroller (generering/timeout,
  teståterhämtning och säkerhet/kvot) fann ingen ny blockerare i aktuell kod.
  12-frågeflödet täcks genom HTTP/PGlite. Det interna repair-stream-
  salvagetestet täcker nu även 12 frågor genom två kompletta ersättningar före
  timeout efter att två ursprungsfrågor underkänts; samtliga utfärdade frågor
  måste vara unika och passera verifierare och blind lösare. Ett separat
  abortscenario med endast en av två ersättningar kräver exakt 11/12 och
  `meta.partial=true`; full 12/12 kräver `meta.partial=false`. Den slutliga
  teständringen passerade 54/54, syntax- och diffkontroll samt en oberoende
  read-only testgranskning utan blockerare. Granskningarna är statiska
  respektive offline och bevisar inte live-modellbeteende.
- [x] Färsk stagingläsning: pipeline-jobb-/requesttabeller samt claim,
  ägarskapsclaim, 7-arguments checkpoint och quota-reservation RPC finns.
  Migrationshistoriken slutar ändå vid `20261022172446`; migrationen
  `20261022220521_add_repeated_learning_objective_checkpoint_feedback.sql`
  saknas fortfarande.
- [!] Stagingbudgetens rad visar cap `$5.000000`, spenderat `$0.581394`,
  reserverat `$0.225728` och `updated_at=2026-10-22 21:50:17 UTC`. Den är inte
  färsk nog för ett nytt live-modellanrop; inget anrop eller någon migration
  utfördes.
- [!] PR #123 är öppen som draft. Preview för `96aa89f` blev `READY` och
  GitHub/Vercel-kontrollen är grön. Produktionsschemat saknar fortfarande
  pipelinekontrakten enligt separat read-only kontroll; ingen merge, deploy
  eller produktionsändring utfördes. Den befintliga ändringen i
  `supabase/.temp/cli-latest` är orörd.

**PILOT NOT READY.** Kvar är versionssynkad stagingmigration och ett nytt
syntetiskt end-to-end-prov inom färsk kostnadsgräns. Produktionsschema och
releaseordning måste granskas och godkännas separat före merge.

## P.E.R stale provvy och matteekvivalenta dubbletter — 2026-10-24

- [x] `api/explain.js` hanterar nu kvarlämnad `page=prov` när servern
  auktoritativt säger att inget prov finns: tydligt generell, orelaterad
  studiehjälp kan gå vidare efter att gammal fråge-/facitkontext rensats.
  Uttryckliga facitfrågor, okänd/obunden provstatus och övriga spärrade lägen
  förblir stängda; serverns atomiska svarslås används fortfarande.
- [x] `api/_assessment.js` deduplicerar samma normaliserade andragradspolynom
  när frågorna ber om att lösa ekvationen respektive hitta nollställena/rötterna.
  Olika ekvationer, andra färdigheter och uttryckligen olika lösningsmetoder
  (pq-formel/faktorisering/kvadratkomplettering/grafiskt) behålls som skilda.
- [x] API-regressioner för gammel provvy/facitspärr och matteekvivalens,
  skillnader i ekvation/färdighet/metod passerade. Den riktade kombinerade
  API-sviten passerade **109/109**; partial-delivery UI och P.E.R-kontext
  passerade; bred webbläsarregression passerade **188/188**. Syntaxkontroller
  och `git diff --check` passerade.
- [x] Oberoende slutgranskning kördes iterativt och avslutades utan blockerare.
  Metodnekningar, tillämpning kontra jämförelse, extra jämförelsekriterier och
  ordningen före generiska dubblettgenvägar granskades. Jämförelseparafraser
  med olik uppgiftstext behålls avsiktligt som separata; detta kan lämna kvar
  vissa matematiskt likvärdiga jämförelsefrågor men undviker att tappa extra
  kriterier.
- [x] Efter den sista granskningsjusteringen kördes `exam-pipeline-offline`
  igen; den passerade. Den kombinerade 109-testssviten och 188-kontrollers
  webbläsarsvit passerade strax före den sista jämförelsespärrens ordningsflytt.
- [!] Alla dessa tester är offline/mockade; ingen hosted stagingmigration,
  live-modellanvändning eller produktionsbeteende är verifierat. Den tidigare
  godkända stagingmigrationsåtgärden saknar bekräftelse i denna session och
  lämnas därför orörd. Budgeten och `appOrigin` behöver färsk kontroll före
  senare syntetiska liveprov.

**PILOT NOT READY.** Nästa steg efter slutgranskning är feature-Preview av
verifierad kod och sedan stagingmigration/liveprov endast efter bekräftad
stagingauktorisation, aktuell kostnadsavläsning och versionssynkad deployment.

## Kvotstädare och återupptagbar assembly — 2026-10-24

- [x] Read-only kontroll av `20261024140557` och efterföljande
  `20261024151433`: den första reaper-versionen kunde fatta beslut från en
  gammal progress-snapshot. Den senare ersätter villkoret och skyddar en
  reservation så länge tillhörande jobb är `queued` eller `running`, oavsett
  deadline, progress eller assembly-stage. Därför hittades ingen kvarstående
  kvotrace i den installerade SQL-logiken.
- [x] Oberoende SQL-/kvotgranskning kom till samma slutsats. Terminala
  completion-, failure- och retentionvägar låser jobbet och reglerar dess
  reservation inom samma transaktion; cleanup använder `FOR UPDATE SKIP
  LOCKED`. Detta är källgranskning, inte ett bevis från två samtidiga
  PostgreSQL-sessioner.
- [x] `node --test tests/api/exam-generation-pipeline-postgres.test.mjs`
  passerade **25/25**. Det inkluderar expired eligible partial, aktiva
  icke-deliverbara jobb, atomisk konsumtion vid issuance samt exakt återbetalning
  vid terminal failure. PGlite-fallet är sekventiellt och reproducerar inte en
  verklig konkurrerande session.
- [x] Färskare än föregående status men inte realtid: stagingbudgetraden visar
  cap `$5.000000`, spenderat `$1.379071`, reserverat `$0.263628`, aktiverad,
  `updated_at=2026-10-23 19:43:02 UTC`. Eftersom värdet nu är äldre än ett dygn
  och liveanrop har en separat `$2`-gräns kördes inget modelltest.
- [x] Stagingmigrationslistan slutar vid
  `20261024151433_protect_active_pipeline_quota_reaper`. Den lokala senare
  recovery-window-cleanup-migreringen `20261024165536` saknas där. Den ändrar
  inte den verifierade reaper-predicate men stagingens retentionbeteende är
  därför inte helt versionssynkat; migreringen tillämpades inte.
- [!] Sammanräknade Supabase-loggar för 2026-10-23 innehöll 452
  `postgres_logs`-rader, men ingen sanerad, specifik korrelation mellan ett
  provförsök och eventuell reaperhändelse har verifierats. Råa loggar eller
  användartext används inte som bevis.

**PILOT NOT READY.** Kvotreaper-felet är inte reproducerat i aktuell SQL och
skyddet finns i staging. Kvar före stark liveverifiering: ett reproducerbart
två-sessionstest eller motsvarande hostad stagingevidens, färsk budgetkontroll,
versionssynkad Preview/Auth-origin och det godkända syntetiska end-to-end-testet.

## Live 12-frågeprov och mattebredd — 2026-10-24

- [x] På Preview `dpl_HFV1vM54dy6S8oeXkHn2FZdabhYR` / commit `c63f04c`
  genomfördes det godkända syntetiska Matematik 2b-provet. Jobbet nådde terminalt
  tillstånd med **9/12** godkända frågor. Appen visade `9 AV 12 BEGÄRDA` och
  märkte resultatet uttryckligen som delprov; inget ofullständigt prov visades
  som komplett.
- [x] Sanerad runtime-telemetri visar initialt 3 godkända frågor och därefter
  reparation 3→6→7→9. Kvarvarande kandidater stoppades främst av
  `source_support`, `option_quality_failed`, faktagranskarens avslag och
  lösarkontroll (`solver_disagrees_on_key` / `solver_multiple_correct_options`).
  En reparationsbegäran misslyckades med `independent_check_unavailable`.
  Kvalitetsgrindarna fungerade; denna körning bevisar inte att 12/12 kan nås.
- [x] Granskning av de nio visade frågorna fann upprepning av samma linjära
  nollställesbegrepp med formuleringarna “representerar” och “beskriver”. Det
  stöds av den exakta visade frågetexten; orsaken i klassificeraren var att
  `representerar` inte normaliserades till samma förklaringsintent.
- [x] Lokalt, ännu ej deployat: `api/_assessment.js` normaliserar nu den
  observerade parafrasen men behåller en beräkningsfråga som separat uppgift.
  `api/generate-exam.js` ger vanliga matteprov konkreta ungefärliga mål för
  problemlösning/tillämpning/begrepp (12 frågor: 9/2/1); instruktionen används
  inte för grafprov eller prov med verifierat felträningsfokus. Inga grindar,
  kvoter eller authflöden har ändrats.
- [x] Oberoende granskning fann ingen blockerare. Efter granskning tillkom ett
  test som hindrar generell mattebalans från att konkurrera med felträningsfokus.
  Riktad svit för pipeline, HTTP, offlinegenerering och recovery passerade
  **35/35**; syntaxkontroll och `git diff --check` passerade.
- [!] Efter stagingkörningen lästes budgetraden som cap `$3.379071`, spenderat
  `$1.503307`, reserverat `$0.263628`, aktiverad. Före körningen var spenderat
  `$1.379071`; ökningen i redovisad spend var `$0.124236`. Ingen ytterligare
  modellkörning är verifierad efter den lokala prompt-/dubblettändringen.
- [!] De tre kod-/testfilerna är lokala, ocommittade ändringar på branchen
  `codex/exgen-school-pilot-integration-20261024`; Previewn motsvarar därför
  inte de nya ändringarna. `main`, Vercel Production och produktionsdatabasen
  är orörda.

**PILOT NOT READY.** Den rapporterade roten till att ett 12-frågeprov blev
ofullständigt är kandidatunderkännande i oberoende granskning/lösarkontroll,
inte ett falskt komplettresultat. Ny promptstyrning och dubblettnormalisering
är offline-verifierade men behöver pushad Preview och separat, godkänd
syntetisk liveverifiering innan modellförbättring kan bekräftas.

## Separat livekontroll av P.E.R. och bevarat delprov — 2026-10-24

- [x] Ny deployment `dpl_35gXL2AxsrfyB7oGbxStYDBB6L64` är `READY` på commit
  `6986b3491a67fa8a608550ed14f579355af54cb4`; branch-aliasen pekar på denna
  Preview. Branch-scopade Preview-variabler verifierades endast till namn,
  aldrig till värden.
- [x] I det befintliga syntetiska stagingprovet står 9/12 fortfarande
  obesvarade. Inga svar skickades in, provet avbröts inte och dess state är
  bevarat enligt användarens uttryckliga val.
- [x] Aktivt provläge: P.E.R. gav facitfria ledtrådar och metodstöd; direkt
  svar var låst tills verifierad inlämning. Startvyns allmänna hjälpsvar var
  däremot generiskt. Detta verifierar svarsspärren i just denna UI-session,
  inte ämnesrelevans eller modellkvalitet.
- [x] Read-only stagingkontroll fann tre bekräftade Auth-konton totalt. Ingen
  annan aktiv staginginloggning kunde säkert identifieras. En separat
  utloggad Preview-session är öppen för att användaren ska logga in med ett
  annat befintligt konto; inga konton, lösenord, roller eller kvoter ändrades.
- [!] Senast verifierad hård budget: cap `$3.379071`, spent `$1.616745`,
  reserved `$0.263628`, kvar efter reservation `$1.498698`. Detta ryms inom
  godkända maximala `$2`, men måste läsas om före ny modellkörning.
- [!] Live 12-frågeprov på den nya koden, vanlig P.E.R. med modellens
  ämnesgrundning och P.E.R. efter verifierad rättning återstår. Budget- och
  kontogränser lämnas oförändrade.

**PILOT NOT READY.** Nästa säkra steg är att användaren loggar in på den
separata Previewn med ett annat befintligt stagingkonto. Bevara det nuvarande
9/12-provet; kör därefter högst ett syntetiskt liveprov efter ny kontroll av
deployment, stagingkoppling och budget.

## Källspårning av P.E.R:s generiska svar — 2026-10-24

- [x] Kodspårningen bekräftar två olika beteenden. Utan giltig session skickar
  `shared.js` `landingMode`; utanför skolpilot svarar `api/explain.js` med den
  fasta publika guiden i `_per-public-guide.cjs` och anropar inte studiemodellen.
  I skolpilot sparas frågan lokalt och UI:t ber användaren logga in.
- [x] Med session går vanlig studiehjälp via teach-läget. `getPageContext()`
  skickar vald kurs och, när den finns i den aktiva studieytan, materialet;
  `_per-context.js` begränsar och paketerar detta, och `_per-core.js` placerar
  det i prompten som källdata. Befintliga test bekräftar att material når
  modellen escaped, medan saknad grafdata inte hittas på.
- [x] Källan för felträning kräver verifierat, ägarbundet och rättat prov samt
  matchande kurs/fråga; klientändringar av källan avvisas. Källtesterna täcker
  även operatorer i mattefrågor och felaktig kursblandning.
- [x] Riktade regressionssviter passerade **92/92**:
  `node --test tests/api/per-exam-review-handler.test.mjs tests/api/per-usage-stream.test.mjs tests/api/mistake-training-source.test.mjs tests/api/mistake-training-context.test.mjs tests/api/mistake-training-source-rest.test.mjs`.
  Testerna är offline/mockade och bevisar inte live-modellens relevans.
- [x] Prov-/återhämtningssviten passerade **54/54**:
  `node --test tests/api/exam-generation-pipeline.test.mjs tests/api/exam-generation-pipeline-postgres.test.mjs tests/api/exam-generation-pipeline-http.test.mjs tests/frontend/exam-partial-delivery.test.mjs tests/frontend/mistake-selection-identity.test.mjs tests/frontend/per-felbank-collision.test.mjs`.
  Den täcker bland annat exakt 3/6/12-frågeackumulering, fokustäckning i
  felträning, assembly-/kvotgränser och synlig delprovsstatus. Även dessa tester
  är lokala/offline.
- [x] `node --check` passerade för `api/explain.js`, `api/_per-core.js`,
  `api/_per-context.js`, `api/_exam-generation-pipeline.cjs`,
  `api/generate-exam.js` och `shared.js`; `git diff --check` passerade.
- [!] I staging-Preview `dpl_35gXL2AxsrfyB7oGbxStYDBB6L64` visas fortfarande
  inloggningsrutan. Den exakta Previewn öppnades på nytt i synlig webbläsarflik
  och inloggningsformuläret visas; ingen autentiserad startsida har verifierats.
  Ingen live-AI-körning utfördes. Senast kända budget är inte färsk nog för ett
  nytt anrop.
- [!] Ingen ny kodändring gjordes. Oberoende agentutrymme saknades under denna
  fortsättning; befintliga tidigare reviews finns dokumenterade ovan.

**PILOT NOT READY.** Nästa steg: verifiera att separat staging-Preview visar
autentiserad startsida; därefter färsk kontroll av deployment, stagingbudget och
konto utan aktivt prov innan någon syntetisk liveverifiering.

## Preview-inloggning verifierad — 2026-10-24

- [x] Fortsättningskontroll i synlig sidbrowser: Preview
  `https://provia-8i6mh5nrf-eltons-projects-4adfb1a3.vercel.app/app.html`
  visar den autentiserade ExGen-startvyn (`Skapa prov`), inte inloggningsgrinden.
- [x] Vercel bekräftar att deployment `dpl_35gXL2AxsrfyB7oGbxStYDBB6L64`
  är `READY` på commit `6986b3491a67fa8a608550ed14f579355af54cb4` i
  `codex/exgen-generation-quality-2026-10-20`.
- [!] Detta verifierar endast den aktuella webbläsarsessionens inloggning; det
  verifierar inte att övriga sessioner är inloggade eller att P.E.R./prov-AI
  fungerar live. Inget AI-anrop gjordes och inget prov ändrades.

**PILOT NOT READY.** Previewn kan nu användas i den öppna, autentiserade
sessionen. Före syntetiska liveanrop ska stagingbudgeten läsas färskt och
testkontot kontrolleras utan att röra befintliga öppna prov.

## P.E.R fail-closed recovery och pipeline deadline-reserve — 2026-10-24

- [x] Vanlig P.E.R-studiehjälp fungerar nu även om servern hittar ett gammalt
  avbrutet/utgånget prov, men bara efter att tillståndet verifierats igen vid
  leasespärren. Aktivt, graderande eller okänt tillstånd fortsätter att fallera
  stängt. Gamla provfrågor, material, historik, misstag och osäkra klientfält
  tas bort från fallback-prompten.
- [x] Oberoende P.E.R-review fann och testerna täcker nu en omskriven fråga som
  kunde se ut som allmän förklaring. Tre gemensamma innehållsord från en
  oavslutad fråga håller den bakom provgrinden; en bredare ämnesfråga med två
  gemensamma ord fortsätter att fungera. Aktiva prov använder fortsatt
  facitfria ledtrådar.
- [x] Pipeline-batcher lämnar nu 12 sekunders finaliseringsmarginal även mot
  jobbets sparade deadline, så en redan godkänd batch inte förloras före
  kvotavräkning/checkpoint. Ett jobb utan arbetsmarginal startar inte en ny
  modellbatch.
- [x] Offline-sviter passerade: P.E.R **56/56**;
  provgenerering/HTTP/PGlite **51/51**; material, felträning och P.E.R stream
  **39/39**. Syntaxkontroll för ändrade JS-filer och `git diff --check`
  passerade. Oberoende P.E.R-review fann ingen blockerande kvarvarande fråga
  i sin avgränsade granskning; pipeline-review fann ingen blockerare.
- [!] Ingen live-AI-körning gjordes. De ändrade filerna är fortfarande
  ocommittade. Inget ändrades i Supabase, Vercel Production, `main`, kvoter,
  konton eller hemligheter. Det befintliga syntetiska 9/12-provet är orört.
- [!] Staging-Previewn för de nya ändringarna och den färska kostnadsbudgeten
  behöver verifieras före syntetisk livekontroll. Offline-resultat bekräftar
  kodvägarna, inte modellrelevans eller att Previewn använder staging.

**PILOT NOT READY.** Nästa steg är att committa och pusha endast dessa
granskade ändringar till den godkända feature-branchen, verifiera exakt READY
Preview/stagingkoppling och därefter invänta inloggning på Previewn med ett
separat stagingkonto innan eventuellt syntetiskt AI-test inom färskt verifierad
budget.

## Feature-Preview publicerad — 2026-10-24

- [x] Ändringarna ovan är committade som `eba80345c64c18fd030e5d5988b72c58b42ad5b4`
  och pushade till `codex/exgen-generation-quality-2026-10-20`.
- [x] Vercel deployment `dpl_Cjq55BgXv1pxpd1vdYVv3xmGH7td` är `READY` på exakt
  denna commit. Preview URL:
  `https://provia-5tyiv6irc-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [x] Vercel API-env-listning svarade 403; read-only CLI-fallback bekräftade
  att Preview-variabler är branch-scope:ade till den avsedda branchen. Endast
  namn och krypterad status visades, aldrig värden.
- [!] Previewn är öppnad i synlig webbläsarflik men visar inloggningsgrinden.
  Ingen autentiserad session eller live-AI-körning är verifierad i denna nya
  Preview. Inget Supabase-/produktions-/kontotillstånd har ändrats.

**PILOT NOT READY.** Invanta att användaren loggar in i den öppna Previewn med
ett separat stagingkonto. Kontrollera därefter budgeten färskt och säkerställ
att kontot inte äger det bevarade 9/12-provet innan något syntetiskt AI-test.
