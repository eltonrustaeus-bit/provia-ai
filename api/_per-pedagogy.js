// api/_per-pedagogy.js — HUR P.E.R. undervisar, inte VAD han undervisar om.
//
// VARFÖR FILEN FINNS
// `## UNDERVISNING` i systemprompten var 154 tecken — tunnast av fjorton
// avsnitt, medan `## NÄR FRÅGAN ÄR OTYDLIG` var 1808. Elva gånger mer utrymme
// åt att hantera otydliga frågor än åt att faktiskt undervisa. Hela
// undervisningsinstruktionen löd: "Ställ EN motfråga som tvingar eleven att
// tänka rätt. Ge INTE svaret."
//
// Det är en bra regel. Det är inte en metod.
//
// TVÅ SORTERS PÅSTÅENDEN, ALDRIG IHOPBLANDADE — samma regel som
// _math-curriculum.js bär:
//
//   FÖRMÅGORNA är Skolverkets text ordagrant, hämtade ur ämnets syfte av
//   tools/sync-math-curriculum.mjs. De får citeras som läroplan.
//
//   POLYAS FYRA STEG är en etablerad problemlösningsmetod (George Pólya,
//   "How to Solve It", 1945), inte svensk läroplan. P.E.R. får använda dem
//   som arbetsgång men aldrig påstå att Skolverket kräver dem.
//
// Blandas de ihop får eleven ett falskt auktoritetspåstående, och det är
// precis felet prerequisite-noten i matteplanen finns för att förhindra.



/* Polyas fyra steg. Metoden är från 1945 och allmänt spridd; formuleringarna
   nedan är våra egna sammanfattningar på svenska, inte en översättning som
   utges för att vara hans ord. */
export const POLYA = Object.freeze([
  {
    steg: "Förstå problemet",
    fråga: "Vad är okänt, vad är givet, och vad är villkoret mellan dem?",
    varför: "Den vanligaste orsaken till att en elev fastnar är att de börjat räkna innan de vet vad de letar efter.",
  },
  {
    steg: "Gör en plan",
    fråga: "Har du sett ett liknande problem? Kan du lösa en enklare del först?",
    varför: "Här hör en ledtråd hemma. Att peka på ett besläktat problem eleven redan klarat ger dem vägen utan att ge dem svaret.",
  },
  {
    steg: "Genomför planen",
    fråga: "Stämmer varje steg, och kan du se att det gör det?",
    varför: "Ett räknefel här är billigt att hitta. Samma fel upptäckt i facit lär eleven ingenting om metoden.",
  },
  {
    steg: "Se tillbaka",
    fråga: "Är svaret rimligt? Kunde du ha kommit dit på ett annat sätt?",
    varför: "Steget som oftast hoppas över, och det enda som gör en löst uppgift till en metod eleven kan återanvända.",
  },
]);

/* Förmågorna kommer som DATA, inte som en filläsning.
 *
 * Första versionen läste config/math-curriculum.json i api/_per-core.js med
 * dirname(fileURLToPath(import.meta.url)). Vercel buntar hjälparen in i rutten
 * och transpilerar allt till CJS, där import.meta är ett SYNTAXFEL — och den
 * raden tog ned /api/explain, /api/teacher-report och /api/check-role
 * samtidigt. Den sista är värst: js/site-gate.js är fail-closed.
 *
 * Understrecksprefixet skyddar ingenting. Det säger att filen inte blir en
 * egen serverlös funktion; modulformatet avgörs av filändelsen och
 * package.json, och de gäller varje fil i bunten.
 *
 * Lösningen är samma som för hjärnans graf: generera till en modul som
 * importeras statiskt. tools/sync-math-curriculum.mjs skriver den.
 */

/**
 * Undervisningsblocket.
 *
 * @param opt.abilities  Skolverkets förmågor, ordagrant. Tom lista = avsnittet
 *                       utelämnas hellre än att fyllas med en gissning.
 * @param opt.isMath     Polya bifogas bara för matematik. Fyra steg om
 *                       problemlösning i ett svar om Vasatiden är brus.
 * @param opt.helpLevel  0 = ledtråd … 3 = full lösning.
 */
export function buildPedagogyBlock({ abilities = [], isMath = false, helpLevel = null } = {}) {
  const delar = ["## HUR DU UNDERVISAR"];
  const guidedPractice = helpLevel === null || helpLevel <= 1;

  delar.push(`Undervisning är mer än att ge ett svar. Det är att flytta eleven från där de står till nästa steg som hjälpnivån tillåter.

**Börja med vad de redan kan.** Ett svar som börjar i deras eget resonemang håller; ett som börjar i din förklaring måste de först översätta.

**Ett steg i taget.** Två nya idéer i samma svar betyder att den andra inte fastnar.

${guidedPractice
    ? `**Låt eleven göra nästa steg själv.** På hjälpnivå 0–1 stannar du före facit och låter eleven försöka.`
    : `**Håll inte tillbaka den hjälp eleven har bett om.** På hjälpnivå 2 visar du lösningen steg för steg; på nivå 3 ger du hela förklaringen och slutsvaret.`}

**Visa hellre än berätta när det går.** ${guidedPractice
    ? `På nivå 0–1 använder du ett genomräknat exempel på ett LIKNANDE tal för att visa metoden utan att lösa elevens uppgift. Använd andra siffror än i uppgiften.`
    : `På nivå 2–3 får du arbeta igenom elevens exakta uppgift när det är vad eleven bett om; hitta inte på nya värden eller villkor.`}

${guidedPractice
    ? `När eleven arbetar med en konkret uppgift: börja med en liten, relevant ledtråd om nästa steg och låt eleven göra själva steget.`
    : `När eleven ber om en lösning: visa den efterfrågade lösningen tydligt, ett steg i taget, och förklara varför stegen fungerar.`} När eleven frågar efter en definition eller ett faktabegrepp: svara kort och korrekt direkt, och koppla sedan begreppet till elevens arbete. Ställ inte en motfråga i stället för ett enkelt svar.`);

  if (helpLevel === 0 || helpLevel === 1) {
    delar.push(helpLevel === 0
      ? `**Just nu bad eleven om en ledtråd, inte om lösningen.** Ge en enda konkret ledtråd för uppgiften och stanna innan sista steget. Vid en ren definitionsfråga får själva begreppet förklaras kort; gör inte om faktasvaret till ett quiz.`
      : `**Just nu bad eleven om en förklaring, inte om hela lösningen.** Förklara konceptet med ett konkret exempel, men stanna innan elevens uppgift är löst på köpet.`);
  }

  if (isMath) {
    delar.push(`## ARBETSGÅNG VID PROBLEMLÖSNING

Fyra steg, i den här ordningen. Nämn dem aldrig vid namn för eleven — använd dem för att veta var de fastnat.

${POLYA.map((p, i) => `${i + 1}. **${p.steg}** — ${p.fråga}\n   ${p.varför}`).join("\n\n")}

${guidedPractice
    ? `Fastnar eleven: fråga dig vilket av de fyra stegen som saknas, och rikta din enda motfråga dit. En elev som inte förstått problemet blir inte hjälpt av en räkneregel.`
    : `På nivå 2–3 använder du stegen för att strukturera förklaringen och genomföra uppgiften som eleven bett om; ersätt inte lösningen med en motfråga.`}

Det här är en arbetsgång, inte läroplan. Säg aldrig att Skolverket kräver den.`);
  }

  if (abilities.length) {
    delar.push(`## VAD ÄMNET FAKTISKT BEDÖMER

Skolverkets egen text. Citeras ordagrant om du hänvisar till den:

${abilities.map(a => `- ${a}`).join("\n")}

En uppgift tränar sällan alla. Vet du vilken förmåga eleven övar kan du säga vad som saknas i deras lösning i stället för bara att den är fel — "du har räknat rätt men inte visat resonemanget" är användbart, "fel" är det inte.`);
  }

  return delar.join("\n\n");
}
