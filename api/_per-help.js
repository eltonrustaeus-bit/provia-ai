// api/_per-help.js — hur mycket hjälp P.E.R får ge, avgjort på servern.
//
// `_`-prefixet betyder hjälpare, inte rutt. Vercel Hobby-taket på 12 rutter är
// orört (se API-tabellen i CLAUDE.md).
//
// VARFÖR EN EGEN FIL
// Taket hörde logiskt hemma i api/explain.js, men den filen skapar en
// Supabase-klient på modulnivå och kastar "supabaseUrl is required" vid import
// utan env. Ett tak som bara går att köra med en riktig databas bakom sig är
// ett tak ingen testar — och det här är den enda kod som står mellan en elev
// och facit mitt i ett prov.
//
// VARFÖR SERVERN
// helpLevel från klienten är ett önskemål, inte ett beslut. Att låta klienten
// avgöra vore att låta den part som har intresse av att kringgå spärren
// bestämma om den gäller.
//
// Kontrakt och hela taktabellen: tests/per/per-pedagogy.test.mjs (C1-C9) och
// docs/superpowers/specs/2026-08-14-per-som-larare-design.md.

/** Högsta hjälpnivå som får ges i den här sidkontexten.
 *
 *  0 motfråga · 1 begreppet · 2 metoden steg för steg · 3 fullständig lösning
 *
 *  | Läge                          | Tak |
 *  |-------------------------------|-----|
 *  | provkontext eller oklar pilotstatus | 1 |
 *  | fri studiefråga utanför pilot      | 3 |
 *
 *  Fullständig hjälp om en rättad fråga hanteras separat efter att servern
 *  verifierat ett bevis från rättningen. Klientens phase är inte ett sådant bevis.
 */
export function helpCapFor(pageContext, { pilotMode = false } = {}) {
  if (pilotMode) return 1;
  const q = pageContext?.currentQuestion;
  const phase = pageContext?.examState?.phase;
  if (phase === "exam" || phase === "result" ||
      pageContext?.page === "prov" || pageContext?.page === "resultat" ||
      (typeof q?.text === "string" && q.text.trim())) return 1;
  return 3;
}

/** Startnivån när klienten inte skickar någon.
 *
 *  Väljs 0 överallt blir P.E.R sokratisk även mot "vad betyder derivata" — och
 *  en motfråga där är friktion utan värde, samma slutsats som regeln om
 *  klargörande frågor bygger på. Stegknapparna att klättra med finns dessutom
 *  inte förrän klientspåret landat, så en elev som hamnar för lågt sitter fast.
 *
 *  Sitter eleven på en provfråga är motfrågan däremot precis rätt öppning.
 *
 *  Nivån är ett FÖRSLAG och kläms mot helpCapFor() som allt annat.
 */
export function defaultHelpLevel(pageContext) {
  const q = pageContext && pageContext.currentQuestion;
  const påFråga = q && typeof q.text === "string" && q.text.trim();
  return påFråga ? 0 : 1;
}
