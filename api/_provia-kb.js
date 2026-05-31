// api/_provia-kb.js — Public Provia knowledge base for P.E.R
// Only facts suitable for a landing page. No internal data, no user data, no costs.

export const PROVIA_KB = `## PROVIA — FAKTA P.E.R FÅR CITERA

**Vad är ProviaAI?**
ProviaAI (proviaai.se) är en AI-driven studieapp för svenska elever. Innehåller körkortsteorin med 368 officiella frågor, AI-genererade mockprov från eget material, förbättringssida med AI-coach, och P.E.R — den enda svenska studieassistenten som ser exakt vilken fråga du sitter på.

**Sidor och vad de gör**
- **Startsida** (proviaai.se) — översikt, demo-knapp, "Starta ProviaAI"-launcher med alla funktioner
- **Körkortsteorin** (proviaai.se/korkortet.html) — 368 frågor, 16 kategorier, adaptivt lärande, simulerat teoriprov
- **Mockprov** (proviaai.se/app.html) — klistra in eget material → AI genererar prov → rättning med feedback
- **Förbättring / AI-coach** (proviaai.se/förbättring.html) — historik, felbank, träna misstag, personlig studieplan
- **Live-demo** (proviaai.se/live-demo.html) — se hur ProviaAI fungerar i en komplett genomgång utan konto
- **Mitt konto** (proviaai.se/konto.html) — hantera prenumeration, uppgradera plan, avsluta abonnemang, logga ut
- **Priser** (proviaai.se/pricing.html) — jämför Gratis / Basic / Premium

**Hur man avlustar (avslutar) sin prenumeration**
1. Gå till proviaai.se/konto.html (eller menyn i appen → "Hantera prenumeration")
2. Klicka "Hantera prenumeration" — knappen visas om du har Basic eller Premium
3. Du skickas till Stripes säkra portal
4. Välj "Avbryt prenumeration" — du behåller access till perioden du betalt för, inget dras efter det
Alternativ väg: app.html → öppna ☰-menyn → "Hantera prenumeration" → samma Stripe-portal

**Hur man uppgraderar**
Gå till proviaai.se/konto.html → "Uppgradera"-kortet visas för gratisanvändare → välj Basic eller Premium.
Eller direkt via proviaai.se/pricing.html → klicka på valfri plan.

**Planer och priser**
| Plan | Pris | Körkortstest | Mockprov | P.E.R AI-chatt |
|------|------|-------------|----------|----------------|
| Gratis | 0 kr | 2/vecka | 2/vecka | 5 frågor/vecka |
| Basic | 29 kr/mån | 30/mån | 30/mån | 5 frågor/dag |
| Premium | 79 kr/mån | Obegränsat | Obegränsat | Obegränsat |
Ingen bindningstid. Ingen kortuppgift krävs för Gratis.

**Det starkaste argumentet**
Körkortsprovet kostar 325–400 kr att boka om. En månad Premium = 79 kr. Att misslyckas en gång extra kostar mer än fyra månader Provia.

**Varför Provia och inte ChatGPT / Gemini / Copilot?**
ChatGPT, Gemini och Copilot är bra på det mesta — men inte på att hjälpa dig med just ditt körkortsprov:
- De vet inte vilken fråga du sitter på just nu
- De minns inte dina misstag och svagheter mellan sessioner
- De kan hitta på trafikregler (AI-hallucination) — farligt när du tränar inför ett prov som kräver exakt kunskap
- De är inte anpassade för svenska teoriprov med Transportstyrelsens 368 officiella frågor
P.E.R är kontextmedveten: ser din aktuella fråga, vilka kategorier du fastnar på, din provhistorik. Det är kärnaskillnaden.

**Varför inte bara googla?**
Google ger blandade källor av varierande kvalitet. P.E.R svarar direkt, vet exakt vilken fråga du sitter på, och minns vad du tränat på tidigare.

**Körkortsteorin — specifikt**
368 frågor, 16 kategorier (vägmärken, trafikregler, korsningar, alkohol, mörker, nödsituationer, miljö m.fl.).
Adaptivt lärande fokuserar automatiskt på dina svagheter.
Simulerat teoriprov: 65 frågor på 50 minuter, 52 rätt = godkänt — exakt som Transportstyrelsens riktiga prov.
AI-förklaring direkt efter varje svar.

**Mockprov — specifikt**
Klistra in studiematerial → välj nivå (E/C/A) och frågetyp → AI genererar prov → svara direkt → AI rättar med feedback och modellsvar. Stöder OCR (bild → text).

**Förbättring / AI-coach**
Visar historik, felbank med AI-tips per misstag, träningsläge som genererar nytt prov från just dina svaga delar.`;

export const SALES_TRIGGER_REGEX =
  /uppgradera|premium|basic|pris|kostar|betala|värt|varför provia|varför ska jag|ska jag köpa|bättre än|jämfört med|vad kostar|vad ingår|vad får jag|membersh|plan|abonnemang|prenumeration|gratis räcker|räcker gratis|hinna|limit|gräns|hur många|avsluta|avbryta|avslutar|avlustar|cancel|säga upp|säg upp|konto|logga ut|byta plan|hantera|portal|stripe|chatgpt|chat gpt|gpt-?[0-9]?o?|gemini|copilot|openai|öppen ai|generell.{0,6}ai|annan.{0,6}ai|ai.{0,8}istäl|jämföra med|skillnad mot|google.{0,6}det/i;
