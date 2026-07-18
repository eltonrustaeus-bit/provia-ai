# Kvalitetsbaslinje — ProviaAI körkortsfrågor

Genererad genom genomgång av befintliga QA/audit-rapporter i repo-roten samt frågedatabasen `final_questions.json`. Allt underlag nedan är redan de-identifierat, genererat innehåll (körkortsteorifrågor med facit/förklaring) — **ingen privat elevdata, inga riktiga elevsvar eller personuppgifter förekommer i dessa filer eller i denna rapport.** Frågorna är författade/kuraterade innehåll för produkten, inte insamlad användardata.

## 1. Befintliga QA-rapporter som hittades

| Fil | Datum (från filens egen header) | Innehåll |
|---|---|---|
| `validation_report.md` | 2026-06-01 | Schemavalidering av källfilerna `scripts/questions.json` (225 frågor) + `scripts/q_351_390.json` (40 frågor): saknade fält, kategoribalans, svårighetsfördelning |
| `korkort_quality_audit.md` | 2026-06-02 | Automatiserad kvalitetsaudit av 350 frågor: dubbletter, AI-stil-fraser, bildstatus |
| `manual_image_review_report.md` | 2026-06-02 | Manuell granskning av 13 aktiva bildfrågor mot Transportstyrelsens officiella vägmärkesaffisch |
| `manual_text_review_report.md` | 2026-06-02 | Manuell granskning av 24 textfrågor, 10 blockerade med motivering |
| `road_sign_audit_report.md` | 2026-06-02 | Automatiserad matchning av alla 83 bildfrågor mot officiella VMF-skyltkoder |
| `blocked_questions_repair_report.md` | 2026-06-02 | Reparationslogg: 71 vägmärkesfrågor + 13 textfrågor reparerade efter tidigare blockering |
| `bildfix_rapport.md` | 2026-06-01 | Bildbeskrivnings-omarbetning: 109 "OMFORMULERA"-frågor, 42 "LÄGG TILL BILD"-frågor, före/efter-exempel |
| `audit_report.json` | — | Strukturerad audit-data (`summary`, `imageCoverage`, `issues`) — samma underliggande audit som `korkort_quality_audit.md`, maskinläsbart format |

Dessa rapporter visar en tydlig **iterativ QA-pipeline**: validering → automatiserad audit → manuell bild-/textgranskning → reparation → bildbeskrivnings-uppgradering. Aktuell produktionsdatabas är `final_questions.json` (356 frågor, `metadata.validation_status: "REVIEWED_CRITICAL_FIXES_APPLIED"`, senast uppdaterad 2026-06-19) — nyare än de daterade audit-rapporterna (2026-06-01/02), vilket betyder några ID:n som nämns i äldre rapporter (t.ex. dubbletter 77, 150) inte längre finns i den aktuella databasen (sannolikt borttagna i senare rensning).

## 2. Manuellt granskade exempel (7 st, dragna direkt ur `final_questions.json`)

### Exempel 1 — ID 1 (Vägmärken / Väjning och stopp, easy) — GODKÄND
- Fråga: "Vad betyder detta märke?" (B1 Väjningsplikt)
- Facit: B — "Väjningsplikt"
- Bedömning: Formatfel: inga. Facit: korrekt (bekräftat mot officiell VMF-affisch i `manual_image_review_report.md`, "ID 1: APPROVED"). Tvetydighet: ingen. Läroplansförankring: `TF 3 kap 5 §` angivet. Svårighetsgrad rimlig för "easy".

### Exempel 2 — ID 7 (Vägmärken / Anvisning, normal) — GODKÄND, tidigare flaggad som dubblett
- Fråga: "Vad gäller efter att du passerat detta märke?" (E2 Motorväg upphör)
- Facit: D — "Motorväg upphör"
- Bedömning: `korkort_quality_audit.md` flaggade ursprungligen ID 77 och 152 som dubbletter av ID 7 ("ID 77 duplicates ID 7", "ID 152 duplicates ID 7"). Dessa ID:n finns inte längre i `final_questions.json`, vilket tyder på att dubbletterna städats bort i senare revision. ID 7 självt är korrekt formaterat och matchar officiell skyltbetydelse.

### Exempel 3 — ID 148 (Vägmärken / Förbud, easy) — GODKÄND
- Fråga: "Vad innebär detta märke?" (C35 Förbud mot att parkera fordon)
- Facit: A. Bekräftad mot officiell källa i `manual_image_review_report.md` ("ID 148: APPROVED... distinguishes it from C39" — dvs. granskaren kontrollerade explicit att frågan inte förväxlar C35 med det snarlika C39-märket).
- Bedömning: Bra exempel på QA-processen som fångar en verklig förväxlingsrisk mellan snarlika skyltar.

### Exempel 4 — ID 354 (Vägmärken / Varning – backig väg, normal) — REPARERAD, illustrerar pipeline-värde
- Fråga: "Vad innebär detta märke?" (A6 Varning för bro)
- `manual_image_review_report.md` (2026-06-02) flaggade ursprungligen: *"ID 354: BLOCKED - A6 Varning för bro. A6 is Varning för bro, but the question/explanation concerns a steep downhill. Blocked instead of pretending the image fits."*
- I nuvarande `final_questions.json` är facit och förklaring korrigerade och matchar nu bron-temat korrekt ("Märket betyder varning för bro... anpassa farten efter väg- och mötesförhållanden").
- Bedömning: Konkret bevis på att blockerings-/reparationsflödet fungerar — en felaktig fråga (fel skylttema i förklaringen) fångades innan publicering och åtgärdades.

### Exempel 5 — ID 368 (Vägmärken / Hastighetsbegränsning, normal) — OMSKRIVEN
- `manual_image_review_report.md`: *"ID 368: REWRITE - C31-3 Hastighetsbegränsning 30 km/h. Image is a C31 speed limit sign. Original wording was incomplete; rewritten to match image and concept."*
- Nuvarande version är komplett och konsekvent (fråga/bild/facit/förklaring stämmer överens).
- Bedömning: Ytterligare exempel på fångad tvetydighet (ofullständig ursprunglig formulering) som åtgärdats innan produktion.

### Exempel 6 — ID 19 (Trafikregler / Vägmarkeringar, easy) — BLOCKERAD, kvarstår som exempel på gränsdragning
- Fråga: "Vad innebär en heldragen linje på din sida av körbanan?"
- `manual_text_review_report.md`: blockerad med motivering: *"Heldragna gula mittlinjer beskrivs som absolut körförbud utan verifierad modern svensk källa i denna QA-runda."*
- Frågan finns kvar i `final_questions.json` (med `imageStatus: missing`), vilket är i linje med audit-policyn: *"Questions with ai_generated, irrelevant, broken, or needs_verified_image image status are kept in the dataset for review but excluded from the live module"* (från `korkort_quality_audit.md`).
- Bedömning: Bra exempel på hur pipelinen medvetet håller kvar juridiskt osäkra frågor för granskning istället för att antingen radera eller publicera dem direkt — men det betyder att **denna specifika fråga inte bör användas som kvalitetsreferens för "korrekt facit"**, eftersom den själv är under omprövning.

### Exempel 7 — ID 174 (Korsningar / Trafiksignaler, normal) — GODKÄND, exempel på tydlig facit-logik
- Fråga: "Får du svänga höger mot rött ljus om det inte finns någon särskild signal som tillåter svängen?"
- Facit: C — "Nej, du får inte köra mot rött"
- Bedömning: Otvetydig fråga, korrekt facit, tydlig förklaring med källhänvisning. Bra referensexempel på hög kvalitet i "Korsningar"-kategorin.

## 3. Sammanfattande bedömning av kategorierna som efterfrågades

- **Formatfel:** `korkort_quality_audit.md` fann 0 frågor med saknade obligatoriska fält, 0 dubbletter inom svarsalternativ, 0 för korta förklaringar. De formatfel som fanns var strukturella (image_description-kvalitet, se `bildfix_rapport.md`) och är åtgärdade i senare revision.
- **Fel facit:** Inga fall av direkt felaktigt facit hittades i de granskade rapporterna — de fel som identifierades var i **förklaringstexten** (t.ex. ID 354, fel skylttema i motiveringen) eller i **bildmatchning**, inte i själva svarsnyckeln.
- **Tvetydighet:** Huvudkategorin av kvarstående problem. `manual_text_review_report.md` blockerade 10 frågor specifikt för tvetydighet/överdriven generalisering (t.ex. ID 22, 173: blandar fotgängare/cyklister för brett; ID 165: beror på lokal skyltning).
- **Läroplansförankring:** Samtliga granskade frågor har `law_reference`-fält ifyllt (TF-paragraf eller VMF-skyltkod). `validation_report.md` visar att 48 `law_reference`-fält lades till i en tidigare revision där de saknades.
- **Svårighetsgrad:** Fördelning easy 28% / normal 49% / hard 23% (från `final_questions.json`-metadata), nära men inte identisk med det uppsatta målet (~30/50/20) i `validation_report.md`.
- **Duplicering:** 20 textdubbletter identifierade i `korkort_quality_audit.md` mot den då 350-frågor stora databasen. Flera av de specifika dubblett-ID:na (77, 150) finns inte längre i den nuvarande 356-frågors `final_questions.json`, vilket indikerar att städning skett — men detta kunde inte 100% bekräftas för alla 20 flaggade par inom ramen för denna analys och bör dubbelkollas separat med ett fullständigt dublett-scan av den aktuella databasen.

## 4. Vad som INTE användes

Ingen elevdata (faktiska provsvar, kontouppgifter, personnamn) förekommer i någon av de granskade rapporterna eller i `final_questions.json` — samtliga är genererat/kuraterat frågeinnehåll. Ingen sådan data samlades in eller genererades för denna rapport.
