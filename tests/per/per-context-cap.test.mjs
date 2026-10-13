/* Kontrakt över GRÄNSEN: klientens kropp → buildPERContextPack() → helpCapFor().
 *
 * Varför filen finns.
 *
 * Klientens phase överlever saneringen, men får inte ensam öppna facit.
 * En rättad fråga kräver ett separat signerat bevis från rättningsservern.
 *
 * Varje test låg på fel sida om gränsen:
 *
 *   tests/per/per-pedagogy.test.mjs   anropar helpCapFor() med ett HANDBYGGT
 *                                     pageContext — hoppar över saneringen
 *   tests/frontend/per-*.mjs          mäter kroppen som SKICKAS — ser aldrig
 *                                     vad servern gör med den
 *
 * Ingen korsade gränsen. Den här filen gör bara det: matar in exakt vad
 * klienten skickar, kör den genom serverns egen sanering, och mäter taket på
 * andra sidan.
 *
 * Fyndet kommer från spår B.
 *
 * Användning:  node tests/per/per-context-cap.test.mjs
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { buildPERContextPack } = await import(ROOT + "/api/_per-context.js");
const { helpCapFor, defaultHelpLevel } = await import(ROOT + "/api/_per-help.js");

let pass = 0;
const fail = [];
const ok = (namn, villkor, detalj = "") => {
  if (villkor) { pass++; console.log("  ok   " + namn + (detalj ? " — " + detalj : "")); }
  else { fail.push(namn); console.log("  FAIL " + namn + (detalj ? " — " + detalj : "")); }
};

/* Hela vägen: rå klientkropp in, tak ut. */
const tak = (råPageContext, options) => {
  const { pageContext } = buildPERContextPack({ rawPageContext: råPageContext });
  return { tak: helpCapFor(pageContext, options), pageContext };
};

/* Kropparna nedan är formade som js/exam-flow.js:publish() och shared.js
   faktiskt bygger dem — inte som helpCapFor vill ha dem. Det är hela poängen. */

// ── G1: prov pågår, eleven har inte skrivit ett tecken → 1. ───────────────
//        Den raden var oåtkomlig i produktion. Den är också den enda
//        designdetaljen i specen som kommer ur forskningen snarare än ur
//        produktkänsla: LAK26 finner att oproduktiv ledtrådsanvändning hänger
//        ihop med sämre lärande, så steget kräver ett försök.
{
  const r = tak({
    page: "prov",
    currentQuestion: { text: "Vad är derivatan av x²?", number: 3 },
    examState: { answered: 2, remaining: 10, elapsed: "04:12", phase: "exam" },
  });
  ok("G1 prov pågår utan försök ger tak 1", r.tak === 1, `tak ${r.tak}, phase ${JSON.stringify(r.pageContext?.examState?.phase)}`);
}

// ── G2: ett påbörjat svar ger fortfarande inte rätt till lösningen. ────────
{
  const r = tak({
    page: "prov",
    currentQuestion: { text: "Vad är derivatan av x²?", number: 3, answered: true },
    examState: { answered: 3, remaining: 9, elapsed: "05:01", phase: "exam" },
  });
  ok("G2 prov pågår med försök ger tak 1", r.tak === 1, `tak ${r.tak}`);
}

// ── G3: klienten kan inte själv hävda att provet är rättat. ───────────────
//        closeExam() nollställer manifestet, så skärmen skickar bara phase.
//        Fasfältet överlever saneringen, men är fortfarande klientdata.
{
  const r = tak({ page: "resultat", examState: { phase: "result" } });
  ok("G3 påstådd resultatskärm utan bevis ger tak 1", r.tak === 1, `tak ${r.tak}`);
  ok("G3 och phase överlever saneringen", r.pageContext?.examState?.phase === "result",
    JSON.stringify(r.pageContext?.examState));
}

// ── G4: påstått inlämnat prov SOM BÄR EN FRÅGA. ───────────────────────────
//        Även med en fråga i fokus måste klientpåståendet förbli otillräckligt.
{
  const r = tak({
    page: "resultat",
    currentQuestion: { text: "Vad är derivatan av x²?", number: 4 },
    examState: { phase: "result" },
  });
  ok("G4 påstått inlämnat prov med fråga ger tak 1", r.tak === 1, `tak ${r.tak}`);
}

// ── G5: saneringen släpper bara de två tillåtna värdena. ──────────────────
//        En klient som hittar på ett läge ska falla till det säkra taket, inte
//        till det lösaste.
{
  for (const [namn, phase] of [
    ["påhittad sträng", "klar"],
    ["objekt med toString", { toString: () => "result" }],
    ["tal", 3],
    ["versaler", "RESULT"],
  ]) {
    const r = tak({
      page: "prov",
      currentQuestion: { text: "q", answered: true },
      examState: { phase },
    });
    ok(`G5 phase "${namn}" faller till säkert tak`, r.tak === 1 && r.pageContext?.examState?.phase === undefined,
      `tak ${r.tak}, phase ${JSON.stringify(r.pageContext?.examState?.phase)}`);
  }
}

// ── G6: startnivån räknas på samma sanerade kontext som taket. ────────────
//        Räknades den på den rååa hade de två kunnat vara oense om vad eleven
//        gör just nu.
{
  const { pageContext } = buildPERContextPack({
    rawPageContext: { page: "prov", currentQuestion: { text: "q" }, examState: { phase: "exam" } },
  });
  const start = defaultHelpLevel(pageContext);
  const cap = helpCapFor(pageContext);
  ok("G6 startnivån ryms under taket efter sanering", Math.min(start, cap) === start,
    `start ${start}, tak ${cap}`);
}

// ── G7: fri fråga utan provkontext → fullt tak, och inget påhittat ────────
//        examState-objekt som senare kan läsas som ett prov.
{
  const r = tak({ page: "förbättring" });
  ok("G7 fri fråga ger fullt tak", r.tak === 3, `tak ${r.tak}`);
  ok("G7 och inget examState uppfinns", r.pageContext?.examState === undefined,
    JSON.stringify(r.pageContext?.examState));
}

{
  const r = tak({ page: "förbättring" }, { pilotMode: true });
  ok("G8 pilot utan provkontext ger inte direktfacit", r.tak === 1, `tak ${r.tak}`);
}

console.log(`\nper-context-cap: ${pass} ok, ${fail.length} fail`);
if (fail.length) console.log("röda: " + fail.join(", "));
process.exit(fail.length ? 1 : 0);
