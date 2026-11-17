// api/_per-review.js — P.E.R. granskar sitt eget svar innan eleven litar på det.
//
// ROLLÅTSKILLNADEN ÄR HELA POÄNGEN, och den är kopierad från api/_verifier.js:
// granskaren RÄTTAR ALDRIG, den flaggar. En modell som ombeds "fixa" sitt eget
// svar skriver om det till något som låter bättre, och tappar då både felet och
// spåret av att felet fanns. En som bara får poängsätta måste peka på texten.
//
// VARFÖR DEN INTE KÖR PÅ ALLT
// Ett extra modellanrop per granskat svar kostar pengar och väntetid.
// needsReview() är därför en ren funktion som prioriterar matematik, rättning,
// påståenden om vad som gäller och långa ledtrådar, men hoppar över "hej" och
// navigering.
//
// NÄR SVARET VISAS
// Vanlig chatt håller tillbaka svaret tills en obligatorisk granskning är klar.
// Vid ett allvarligt fynd visas den korta rättelsen i samma bubbla. Om granskaren
// inte kan ge ett giltigt resultat visas en säker retry-text i stället för det
// ogranskade svaret. Den aktiva provhjälpens separata pedagogiska flöde behålls.

/** Vad granskaren får säga om allvaret. Ordningen är stigande. */
export const ALLVAR = Object.freeze(["ingen", "mindre", "allvarlig"]);

/** Bara det här allvaret når eleven. Se filhuvudet. */
export const VISA_FRÅN = "allvarlig";

/* Ämnen där ett fel kostar eleven något konkret: fel svar på ett prov, en
   missad poäng, ett påstående de bygger vidare på. */
const MATTE_RE = /\b(ekvation\w*|derivat\w*|integral\w*|bråk|procent|funktion\w*|geometri\w*|algebra\w*|sannolikhet\w*|statistik|formel\w*|beräkn\w*|räkn\w*)\b/i;
const RÄTTNING_RE = /\b(rättning\w*|poäng\w*|bedöm\w*|kunskapskrav\w*|betyg\w*|rubric\w*|facit)\b/i;
/* Påståenden om vad som GÄLLER — läroplan, regler, plangränser. Det är där ett
   självsäkert fel är farligast, för eleven har ingen anledning att tvivla. */
const PÅSTÅENDE_RE = /\b(läroplan\w*|kursplan\w*|skolverket|enligt|regeln?|kravet|måste|krävs|gäller|ingår|kostar|gräns\w*)\b/i;

/* Korta, sociala eller rent navigerande svar. Ett granskningsanrop på "hej"
   är bortkastade pengar och sekunder. */
const TRIVIALT_RE = /^\s*(hej|tja|tack|okej|ok|ja|nej|bra|mm+|hallå)\b[\s!.?]*$/i;

/**
 * Ska det här svaret granskas?
 *
 * REN FUNKTION med flit — hela urvalet går att testa utan modell och utan
 * databas, och det är den delen som avgör vad granskningen kostar.
 *
 * @param fråga   elevens fråga
 * @param svar    P.E.R:s färdiga svar
 * @param opt.helpLevel  0 = ledtråd … 3 = full lösning
 * @param opt.isMath     ämnesdetektorn sa matematik
 */
export function needsReview(fråga = "", svar = "", { helpLevel = null, isMath = false } = {}) {
  const f = String(fråga || "");
  const s = String(svar || "");

  // Inget att granska.
  if (!s.trim()) return false;
  // En ren hälsning är inget påstående.
  if (TRIVIALT_RE.test(f) && s.length < 400) return false;
  // En motfråga innehåller per definition inget svar att ha fel om.
  if (/\[CLARIFY:/.test(s)) return false;

  // Ämnesdetektorn väger tyngst — den är redan uppmätt, till skillnad från
  // ett ord i frågan.
  if (isMath) return true;

  // En begärd ledtråd som blev lång är i sig misstänkt: det vanligaste
  // brottet mot hjälptrappan är att lösa uppgiften åt eleven ändå.
  if (helpLevel === 0 && s.length > 600) return true;

  const text = `${f}\n${s}`;
  if (MATTE_RE.test(text)) return true;
  if (RÄTTNING_RE.test(text)) return true;
  // Påståendemönstret kräver dessutom viss längd: "det gäller" i en
  // artighetsfras är inget påstående om världen.
  if (PÅSTÅENDE_RE.test(text) && s.length > 250) return true;

  return false;
}

/* Strukturerat svar. Fri text hade gett en granskare som skriver essäer om
   sina intryck; ett schema tvingar fram citat ur svaret och en klassificering
   som går att räkna på. */
export const REVIEW_SCHEMA = {
  type: "json_schema",
  name: "per_review",
  strict: true,
  schema: {
    type: "object",
    properties: {
      allvar: { type: "string", enum: ["ingen", "mindre", "allvarlig"] },
      fynd: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            typ: {
              type: "string",
              enum: ["faktafel", "löste_uppgiften", "röjde_hemlighet", "räknefel", "obelagt_om_eleven"],
            },
            citat: { type: "string" },
            varför: { type: "string" },
          },
          required: ["typ", "citat", "varför"],
          additionalProperties: false,
        },
      },
      rättelse: { type: ["string", "null"] },
    },
    required: ["allvar", "fynd", "rättelse"],
    additionalProperties: false,
  },
};

/**
 * Prompten till granskaren.
 *
 * Skriven i andra person mot en GRANSKARE, inte mot P.E.R. Att be samma
 * personlighet titta på sitt eget svar ger ett svar om hur bra det var.
 */
export function buildReviewPrompt({ fråga = "", svar = "", helpLevel = null, läroplan = "" } = {}) {
  const nivå = helpLevel === null ? "" : `\nBegärd hjälpnivå: ${helpLevel} (0 = bara ledtråd, 1 = förklaring, 2 = steg för steg, 3 = full lösning).`;
  const plan = läroplan ? `\n\n## LÄROPLANEN FÖR OMRÅDET\n${läroplan}` : "";

  return `Du granskar ett svar som en studie-AI just gav en elev i svensk grundskola eller gymnasium. Eleverna är till stor del minderåriga.

DU RÄTTAR ALDRIG SVARET. Du pekar ut vad som är fel och citerar det ordagrant. Att skriva om texten åt någon annan döljer både felet och att det fanns.

## VAD DU LETAR EFTER

**faktafel** — ett påstående som motsägs av läroplanen nedan, eller som är kontrollerbart falskt. Osäkerhet är inte ett fel; ett självsäkert felaktigt påstående är det.

**löste_uppgiften** — hjälpnivån var 0 eller 1 men svaret ger bort lösningen ändå. Det är det vanligaste brottet, och det tar ifrån eleven själva övningen.

**röjde_hemlighet** — svaret nämner en intern kunskapssiffra (skalan 0–100), lovar något om hur länge uppgifter sparas, eller påstår att Alléskolan är involverad, tillfrågad eller positiv. Inget av det får sägas.

**räknefel** — ett tal, ett steg eller en formel som är fel. Räkna efter innan du påstår det.

**obelagt_om_eleven** — svaret säger vad eleven är bra eller dålig på utan att underlaget står i frågan.

## ALLVAR

- **ingen** — inget av ovanstående.
- **mindre** — otympligt, upprepande eller onödigt långt, men inget som vilseleder.
- **allvarlig** — eleven kan ta skada av att tro på det: fel svar, röjd hemlighet, eller en lösning de skulle ha gjort själva.

Bara "allvarlig" visas för eleven, så var sparsam med den. Ett stilistiskt klagomål är aldrig allvarligt.

## RÄTTELSEN

Sätt \`rättelse\` bara vid allvarlig. En eller två meningar, skrivna direkt till eleven, som säger vad som var fel och vad som gäller i stället. Ingen ursäkt, ingen förklaring av processen.

Är allvaret "ingen" eller "mindre" ska \`rättelse\` vara null.${plan}

## ELEVENS FRÅGA
${fråga}${nivå}

## SVARET SOM SKA GRANSKAS
${svar}`;
}

/**
 * Läser granskarens svar. `valid` skiljer ett giltigt "ingen anmärkning" från
 * en trasig eller ofullständig granskning. Vanlig chatt håller tillbaka svar
 * som kräver granskning när `valid` är falskt.
 */
export function parseReview(data) {
  const tomt = { allvar: "ingen", fynd: [], rättelse: null, visas: false, valid: false };
  try {
    const o = typeof data === "string" ? JSON.parse(data) : data;
    if (!o || typeof o !== "object" || Array.isArray(o) || !ALLVAR.includes(o.allvar)) return tomt;

    /* SCHEMABROTT SLÄCKER HELA SVARET.
       `fynd` som inte är en lista betyder att modellen inte följde kontraktet,
       och då går det inte att lita på `allvar` eller `rättelse` heller. Det är
       en annan sak än en lista med trasiga POSTER: där är kontraktet hållet och
       bara underlaget tunt, och rättelsen — det eleven behöver — står kvar. */
    if (!Array.isArray(o.fynd) || !Object.hasOwn(o, "rättelse") ||
        (o.rättelse !== null && typeof o.rättelse !== "string")) return tomt;

    const fynd = Array.isArray(o.fynd)
      ? o.fynd
          .filter(f => f && typeof f.typ === "string" && typeof f.citat === "string")
          .slice(0, 4)
          .map(f => ({
            typ: f.typ,
            citat: String(f.citat).slice(0, 300),
            varför: String(f.varför || "").slice(0, 300),
          }))
      : [];

    const allvarlig = o.allvar === VISA_FRÅN;
    const rättelse = allvarlig && typeof o.rättelse === "string" && o.rättelse.trim()
      ? o.rättelse.trim().slice(0, 600)
      : null;

    /* En allvarlig varning utan rättelse är inte ett säkert godkännande.
       Markera den som ogiltig så att vanliga svar hålls tillbaka. */
    const valid = !(allvarlig && !rättelse);
    return { allvar: o.allvar, fynd, rättelse, visas: !!rättelse, valid };
  } catch {
    return tomt;
  }
}
