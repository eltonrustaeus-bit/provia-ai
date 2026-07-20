# Utvecklingsdagbok — ProviaAI

Kronologisk logg över större arbeten. Nyaste överst. Skriven för människor: *vad*, *varför* och *hur det gör produkten bättre*.

---

## 2026-07-20 — Robust ämnesoberoende provrättning + kvalitetskärna

**Utlösare:** Kritiska fel upptäckta i ett juridikprov — rättningen fastnade och gav aldrig resultat, tveksamma/tvetydiga frågor, teknisk metadata syntes för eleven, och mobilproblem. Slutsatsen: symptomen var *generella arkitekturfel*, inte juridik-specifika. Lösningen fick därför inte hårdkodas mot juridik.

### Vad jag gjorde

**1. Löste rättningshänget (produktionskritiskt).**
- `postJson` i `app.html` fick timeout via `AbortController` (62s, strax över serverns 60s-tak i `vercel.json`) och returnerar nu alltid ett strukturerat resultat (`timedOut`/`networkError`) — den kastar aldrig.
- `gradeBtn`-handlern kapslades i `try/catch/finally`: dubbelkörnings-spärr, garanterad återställning av overlay/knappläge, retry, delresultat-säkert. Elevens svar sparas i `localStorage` *innan* anropet.
- `api/grade.js` fick `req.on("error"/"aborted")` + en `responded`-spärr så en stallad request-ström svarar 400 i stället för att hänga.

**2. Byggde en generell bedömningskärna** (`api/_assessment.js`, delad CJS):
- `detectSubjectProfile()` + profilregister (generic / mathematics / law / languages / natural_sciences / social_sciences / programming).
- `gateExam()` — en ämnesoberoende kvalitetsgate som droppar frågor som är osäkra att visa/rätta (tomt facit, dubbla alternativ, facit utanför intervall, ograderbara öppna frågor) och lägger på ämnesspecifika regler (matte: numeriskt lika alternativ; juridik: kategoriska formuleringar).
- Inkopplad server-side i `generate-exam.js`. Ny ämne = en rad i registret; kärnan skrivs aldrig om.

**3. Stängde fusk-hålet med facit-signering.**
- Facit HMAC-signeras vid generering (`signAnswerKey`) och verifieras vid rättning (`verifyAnswerKey`). Ett manipulerat `correct_index` från webbläsaren ger nu 0 poäng i stället för gratis full pott. Stateless — ingen databas. Dedikerad `EXAM_SIGNING_SECRET` satt i Vercel (Production + Preview).

**4. Städade elevgränssnittet.**
- Dold intern metadata (`ID`/`Typ`) → visar `Fråga N av M · X poäng`.
- Vald flervalsmarkering är neutral före rättning (såg tidigare "rätt-grön" ut). Efter rättning: rätt = grönt ✓, fel valt = rött ✗, alternativ låsta — färg *och* symbol.
- Mobil: `env(safe-area-inset-bottom)` på rätta-baren, P.E.R lyfts så den inte täcker knappen.
- Ämnesoberoende `isRenderableQuestion`-guard som sista skydd i klienten.

### Varför

De ursprungliga felen låg i *det generella lagret* — timeout-hantering, rendering, facit-hantering — inte i ämnesinnehållet. En juridik-patch hade lämnat exakt samma buggar kvar i matte, språk, historia osv. Genom att fixa kärnan och lägga ämnesskillnader i utbytbara profiler gäller kvaliteten alla nuvarande och framtida ämnen utan omskrivning.

### Hur det gör allt bättre

- **Eleven blir aldrig fast.** Rättningen ger alltid resultat, ett tydligt fel, eller möjlighet att försöka igen — och svaren försvinner aldrig.
- **Färre dåliga frågor når fram**, i alla ämnen, eftersom gaten är generell.
- **Rättvisare rättning** — inget fusk via manipulerat facit; markeringen missleder inte längre.
- **Bättre mobilupplevelse** — knappar nåbara, inget överlappar.
- **Lätt att utöka** — nya ämnen och regler kräver bara en profilrad, inte en refaktor.
- **Verifierbart** — 8 testsviter (inkl. riktig browser-smoke i chromium) skyddar mot regression.

### Verifiering & leverans

- Tester: `assessment-core`, `render-guard`, `grade-hang`, `exam-ui.smoke` (chromium, iPhone-viewport), `schemas`, `prompt-modules`, `legal-retrieval`, `legal-generation` — 8/8 gröna.
- Mergad till `main` (PR #3, `d334dd0`), live-verifierad på `proviaai.se`: gammal metadata-läcka borta, nya render/anti-häng-markörer live, API:er 401:ar utan auth.
- Miljö: `EXAM_SIGNING_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` + `OPENAI_API_KEY` bekräftade i Vercel.
- Inga DB-migreringar, inga hemligheter exponerade.

**Kvarstående (kräver live-session):** end-to-end skarpt inloggat prov för att bekräfta hela generate→answer→grade-kedjan mot riktig backend.
