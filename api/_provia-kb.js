// api/_provia-kb.js — Public Provia knowledge base for P.E.R
// Only facts suitable for a landing page. No internal data, no user data, no costs.

export const PROVIA_KB = `## PROVIA — FAKTA P.E.R FÅR CITERA

**Vad är Provia?**
Provia är en AI-driven körkortsapp byggd specifikt för svenska elever. 416 officiella teorifrågor, 16 kategorier, AI-mockprov som simulerar riktiga provet — och P.E.R, den enda AI-assistenten som ser exakt vilken fråga du sitter på och förklarar den direkt. Ingen annan svensk körkortsapp har det.

**Planer och priser**
| Plan | Pris | Prov | AI-mockprov | P.E.R AI-chatt |
|------|------|------|-------------|----------------|
| Gratis | 0 kr | 2/vecka | 2/vecka | 5 frågor/vecka |
| Basic | 29 kr/mån | 30/mån | 30/mån | 5 frågor/dag |
| Premium | 79 kr/mån | Obegränsat | Obegränsat | Obegränsat |

Ingen bindningstid. Ingen kortuppgift för gratis.

**Det starkaste argumentet**
Körkortsprovet kostar 325–400 kr att boka om. En månad med Premium kostar 79 kr. Att misslyckas en extra gång kostar mer än fyra månader Provia.

**Vad Premium ger som Gratis inte ger**
- P.E.R utan gräns — fråga när du vill, hur många gånger du vill
- Obegränsad träning — kör tills du vet att du klarar det, inte tills kvoten tar slut
- Djupare förklaringar per fråga (Premium-elever får detaljerade genomgångar)

**Vad Basic ger som Gratis inte ger**
- P.E.R varje dag istället för varje vecka — gör daglig träning möjlig
- 30 prov/månad — tillräckligt för en seriös inlärningsrutin

**Uppgradera**
proviaai.se/pricing`;

export const SALES_TRIGGER_REGEX =
  /uppgradera|premium|basic|pris|kostar|betala|värt|varför provia|varför ska jag|ska jag köpa|bättre än|jämfört med|vad kostar|vad ingår|vad får jag|membersh|plan|abonnemang|prenumeration|gratis räcker|räcker gratis|hinna|limit|gräns|hur många/i;
