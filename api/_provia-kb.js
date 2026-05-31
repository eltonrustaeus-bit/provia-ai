// api/_provia-kb.js — Public Provia knowledge base for P.E.R
// Only facts suitable for a landing page. No internal data, no user data, no costs.

export const PROVIA_KB = `## PROVIA — FAKTA P.E.R FÅR CITERA

**Vad är Provia?**
Provia är Sveriges smartaste körkortsapp. AI-driven träning med P.E.R — din personliga studiepartner, coach och examinator. 416 teorifrågor, 16 kategorier, AI-mockprov och djupa förklaringar. Allt för att du ska klara körkortsprovet på första försöket.

**Planer och priser**
| Plan | Pris | Prov | AI-mockprov | P.E.R AI-chatt |
|------|------|------|-------------|----------------|
| Gratis | 0 kr | 2/vecka | 2/vecka | 5 frågor/vecka |
| Basic | 29 kr/mån | 30/mån | 30/mån | 5 frågor/dag |
| Premium | 79 kr/mån | Obegränsat | Obegränsat | Obegränsat |

Ingen bindningstid. Inget kort krävs för gratis.

**Varför Provia — de starkaste argumenten**
- P.E.R ser din aktuella fråga och förklarar *just det* du kör fast på — inte ett generiskt svar
- AI-mockprov simulerar riktiga körkortsprovet — inte bara flashcards
- Körkortsprovet kostar 325–400 kr att boka om. Premium kostar 79 kr/mån. Räkna själv.
- Gratis att prova — inget kort, inga löften
- Allt på svenska, gjort för svenska elever

**Vad Premium ger som Gratis inte ger**
- P.E.R utan tidsgräns — ställ hur många frågor du vill, när du vill
- Obegränsad provträning — kör tills du är redo, inte tills kvoten tar slut
- P.E.R ser hela din skärm och förklarar varje fråga i detalj

**Vad Basic ger som Gratis inte ger**
- P.E.R 5 gånger *per dag* istället för per vecka — daglig rutin möjlig
- 30 prov/månad — tillräckligt för seriös träning

**Uppgradera**
Gå till provia.se/pricing — tar 30 sekunder.`;

export const SALES_TRIGGER_REGEX =
  /uppgradera|premium|basic|pris|kostar|betala|värt|varför provia|varför ska jag|ska jag köpa|bättre än|jämfört med|vad kostar|vad ingår|vad får jag|membersh|plan|abonnemang|prenumeration|gratis räcker|räcker gratis|hinna|limit|gräns|hur många/i;
