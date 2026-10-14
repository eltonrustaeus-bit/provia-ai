import { ROOT, serve, openPage, report } from "./_harness.mjs";
// Beteendekontrakt för pricing.html.
//
// Behavior contract for pricing.html: published prices and capabilities stay
// visible, local cache data cannot misstate server-controlled quota, every
// plan leads somewhere, and payment failures keep a usable support path.
//
// Fällor, alla bekräftade i projektet tidigare:
//   1. js/site-gate.js POSTar /api/check-role och gör location.replace("/snart.html")
//      om svaret inte är {allow:true}. Den generella **/api/**-mocken räcker inte —
//      check-role måste registreras EFTER den (sist registrerad vinner).
//   2. js/intro-splash.js håller body > * på opacity:0 i ~4,5 s via JS-timer.
//      animation:none biter inte. sessionStorage pi_splash_shown=1 gör det.
//   3. Sidan animerar in .planCard med GSAP + ScrollTrigger från opacity:0.
//      Kontexten körs därför med reducedMotion:"reduce" — sidans egen
//      rm-gren hoppar över både GSAP, sifferräknaren och muspekaren, och
//      korten står stilla på sina riktiga värden från första bildrutan.
//   4. Session state is seeded before navigation because app scripts read it
//      during initial document parsing.
//
// Användning:  node tests/frontend/pricing-behaviour.mjs

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const srv = await serve(ROOT, { indexFile: "pricing.html" });

const R = report("pricing-behaviour");
const ok = (n, c, d = "") => R.ok(n, c, d);

const browser = await chromium.launch();
let crash = null;
try {

const DAY = 864e5;
const now = Date.now();
// Måndag 00:00 i samma vecka, svensk konvention — samma räkning som sidan gör.
const wd = (new Date(now).getDay() + 6) % 7;
const weekStart = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime() - wd * DAY;

// Prov "n dagar in i den här veckan", alltid efter weekStart och aldrig i
// framtiden — annars beror testet på vilken veckodag det körs.
const inWeek = n => Array.from({ length: n }, (_, i) => ({ ts: weekStart + 3600e3 + i * 60e3, course: "Biologi 1", pct: 70 }));

/* seed: { role, history, profileRole, profile, session, width }
   Servern, mockarna, sessionen och splash-förbikopplingen kommer från
   _harness.mjs; det som står kvar här är sidans egna data. */
async function mk(s = {}) {
  const signedIn = !!s.session || !!s.role || !!s.history?.length;
  const extra = s.backendDisabled ? [
    ["**/js/exgen-runtime.js", route => route.fulfill({
      contentType: "application/javascript",
      body: `window.ExGenRuntime = Object.freeze({ environment: "pilot", projectRef: "", supabaseUrl: "", publishableKey: "", appOrigin: "http://localhost", authStorageKey: "exgen-test-auth-token" });`,
    })],
    ["**/supabase.min.js", route => route.fulfill({
      contentType: "application/javascript",
      body: "window.supabase = { createClient() { throw new Error('client created without runtime config'); } };",
    })],
  ] : [];
  return openPage(browser, `${srv.url}/pricing.html`, {
    width: s.width || 1280, height: 900, reducedMotion: "reduce", settle: 900,
    mocks: {
      role: s.role || "gratis",
      // Registreras efter den generella **/rest/v1/**, annars äts den upp.
      profiles: s.profile ? [{ id: "u1", ...s.profile }] : s.profileRole ? [{ id: "u1", role: s.profileRole }] : null,
      extra,
    },
    state: {
      signedIn,
      role: s.role || null,
      storage: { proviaai_history: s.history || [], ...(signedIn ? { exgen_local_data_owner: "u1" } : {}) },
    },
  });
}

const PLANS = [
  { id: "plan-gratis", name: "Gratis", amount: "0" },
  { id: "plan-basic", name: "Basic", amount: "29" },
  { id: "plan-premium", name: "Premium", amount: "79" },
];

// Public pricing must remain readable in isolated previews without backend credentials.
{
  const { ctx, page } = await mk({ backendDisabled: true });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.waitForTimeout(100);
  const content = await page.locator("main").innerText();
  ok("0e backend-avstängd plansida visar priser", content.includes("Premium") && content.includes("Basic"));
  const impact = await page.locator("#zonImpact").innerText();
  const impactHeading = await page.locator("#zonImpact").getAttribute("aria-labelledby");
  ok("0h Impact skiljer plan från nuläge", /plan för att på sikt bredda tillgången.*via skolor/i.test(impact) && /Under utveckling/i.test(impact));
  ok("0i Impact lovar inte elevmånader eller effektresultat", /inte kopplade till köp eller uppmätta/i.test(impact) && /inga Impact-siffror/i.test(impact) && !/2 elevmånader|10 elevmånader/i.test(impact));
  ok("0j Impact-sektionen har en tillgänglig rubrik", impactHeading === "impact-title" && await page.locator(`#${impactHeading}`).isVisible());
  ok("0k planpriser och checkoutknappar finns kvar", await page.locator("#plan-basic .planAmt").innerText() === "29" && await page.locator("#plan-premium .planAmt").innerText() === "79" && await page.locator("#btn-basic").count() === 1 && await page.locator("#btn-premium").count() === 1);
  ok("0f backend-avstängd plansida släpper laddaren", await page.locator("#ldr").evaluate(el => el.classList.contains("out")));
  ok("0g backend-avstängd plansida initierar ingen Supabase-klient", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// Priset utan att veta vilket element som bär det. Sidan renderar "0 kr för
// alltid" respektive "29 kr / månad"; kontrollen är att beloppet står i
// kortet som ett eget tal, inte att .planAmt finns.
const amountIn = (page, id) => page.evaluate(cid => {
  const el = document.getElementById(cid);
  return el ? (el.innerText || "").replace(/\s+/g, " ") : "";
}, id);

// ── 0: sidan har de tre planerna, synliga, med rätt pris ─────────────────
// Utan den här kan varje kontroll nedanför vara grön på en tom sida.
{
  const { ctx, page } = await mk();
  for (const p of PLANS) {
    const box = await page.locator("#" + p.id).boundingBox();
    ok(`0a ${p.name} finns och har yta`, !!box && box.width > 0 && box.height > 0, JSON.stringify(box));
    const txt = await amountIn(page, p.id);
    ok(`0b ${p.name} kostar ${p.amount}`, new RegExp("(^|[^0-9])" + p.amount + "([^0-9]|$)").test(txt), txt.slice(0, 90));
    ok(`0c ${p.name} bär sitt namn`, txt.includes(p.name), txt.slice(0, 60));
  }
  // Sidan öppnar med P.E.R:s röst, inte med en rubrik. Samma öppning som
  // app.html och förbättring.html — det är vad "samma format" betyder.
  const voice = await page.evaluate(() => {
    const per = document.querySelector(".xf-per");
    if (!per) return null;
    const say = per.querySelector(".xf-say"), orb = per.querySelector(".xf-orb");
    return { say: (say && say.textContent || "").trim(), orb: !!orb, first: per === document.querySelector("main .xf-per") };
  });
  ok("0d sidan öppnar med P.E.R:s röst", !!voice && voice.orb && voice.say.length > 0, JSON.stringify(voice));
  await ctx.close();
}

// Signed-in plan buttons retain their exact server checkout contract.
{
  for (const plan of ["basic", "premium"]) {
    const { ctx, page } = await mk({ session: true, role: "gratis" });
    let requestedPlan = null;
    page.on("dialog", dialog => dialog.dismiss());
    await page.route("**/api/create-checkout-session", async route => {
      requestedPlan = route.request().postDataJSON()?.plan ?? null;
      await route.fulfill({ json: { message: "synthetic checkout test" } });
    });
    const response = page.waitForResponse(res => res.url().endsWith("/api/create-checkout-session"));
    await page.locator(`#btn-${plan}`).click();
    await response;
    ok(`4d inloggad ${plan}-knapp skickar rätt checkout-plan`, requestedPlan === plan, String(requestedPlan));
    await ctx.close();
  }
}

// ── 1: P.E.R kan skicka besökaren till en enskild plan ───────────────────
// Drivs genom den riktiga vägen: [GOTO:#id] i ett svar, sedan klick på knappen
// som dyker upp. __perTestCtx().targets bär id och etikett men inte go() —
// den funktionen överlever inte kontextpaketeringen, så ett test som anropar
// den direkt testar något ingen besökare kan göra.
{
  const { ctx, page } = await mk();
  const ids = await page.evaluate(() => (window.__perTestCtx().targets || []).map(t => t.id));
  ok("1a tre mål deklareras", ids.length === 3, JSON.stringify(ids));
  ok("1b rätt id", ["gratis", "basic", "premium"].every(i => ids.includes(i)), JSON.stringify(ids));

  await page.click("#perBubble");
  for (const id of ids) {
    const res = await page.evaluate(async tid => {
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 100));
      const msgs = document.getElementById("perMessages");
      const div = document.createElement("div");
      msgs.appendChild(div);
      window.__perFinalize(div, "Här är den.\n[GOTO:#" + tid + "]");
      const cta = msgs.querySelectorAll(".per-nav-cta");
      const btn = cta[cta.length - 1];
      if (!btn) return { err: "ingen knapp" };
      btn.click();
      await new Promise(r => setTimeout(r, 1200));
      const card = document.getElementById("plan-" + tid);
      if (!card) return { err: "inget kort" };
      const r = card.getBoundingClientRect();
      // Svagaste kravet som ändå utesluter en no-op: kortet har yta OCH
      // ligger inom fönstret efter hoppet.
      return { h: Math.round(r.height), top: Math.round(r.top), inView: r.height > 0 && r.top < innerHeight && r.bottom > 0 };
    }, id);
    ok(`1c målet "${id}" tar besökaren till kortet`, !res.err && res.inView, JSON.stringify(res));
  }
  await ctx.close();
}

// ── 2: pricing never treats local history as authoritative quota ─────────
const voiceOf = page => page.evaluate(() => {
  const m = document.querySelector("main");
  return ((m && m.innerText) || "").replace(/\s+/g, " ").slice(0, 600);
});

{
  const { ctx, page } = await mk({ history: inWeek(3) });
  const baseline = await voiceOf(page);
  ok("2a prissidans huvudbudskap är generellt och begripligt", /Välj stödet som passar din studietakt/i.test(baseline));
  ok("2b lokal historik visas inte som återstående veckokvot", !/\d+ prov den här veckan|\d+ kvar|slagit i taket/i.test(baseline), baseline.slice(0, 200));
  ok("2c lokal historik visas inte som kontosäker månadsräkning", !/\d+ av 30 prov/i.test(baseline), baseline.slice(0, 200));
  await ctx.close();
}
{
  const { ctx, page } = await mk({ role: "basic", history: inWeek(28) });
  const t = await voiceOf(page);
  ok("2d inloggad Basic får samma neutrala huvudbudskap", /Välj stödet som passar din studietakt/i.test(t), t.slice(0, 180));
  ok("2e browserhistorik ändrar inte planrekommendationer", !/rekommenderas för dig|du närmar dig taket/i.test(t), t.slice(0, 240));
  await ctx.close();
}
{
  const { ctx, page } = await mk({ role: "premium", history: inWeek(30) });
  const t = await voiceOf(page);
  ok("2f Premium får samma neutrala huvudbudskap", /Välj stödet som passar din studietakt/i.test(t), t.slice(0, 180));
  await ctx.close();
}

// ── 3: plan facts are consistent across the cards and comparison ─────────
const cardText = (page, id) => page.evaluate(cid => {
  const el = document.getElementById(cid);
  return el ? (el.innerText || "").replace(/\s+/g, " ") : "";
}, id);

{
  const { ctx, page } = await mk({ role: "basic", history: inWeek(30) });
  const plans = await Promise.all(["plan-gratis", "plan-basic", "plan-premium"].map(id => cardText(page, id)));
  ok("3a inga kort påstår sig vara personligt rekommenderade", !plans.some(text => /rekommenderas för dig|— rekommenderas/i.test(text)), plans.join(" | ").slice(0, 240));
  const rows = await page.locator("main table tbody tr").allInnerTexts();
  const accountHistory = rows.find(row => row.startsWith("Kontohistorik när du är inloggad")) || "";
  const deviceSync = rows.find(row => row.startsWith("Synk mellan enheter när du är inloggad")) || "";
  ok("3b kontohistorik visas för alla tre planer", (accountHistory.match(/✓/g) || []).length === 3, accountHistory);
  ok("3c enhetssynk är tydligt villkorad av inloggning", (deviceSync.match(/✓/g) || []).length === 3, deviceSync);
  ok("3d kvot förklaras som serverstyrd och skild från lokal historik", /Provkvoten kontrolleras av ExGen[\s\S]*historiken som visas på den här enheten/i.test(await page.locator("#zonJamfor").innerText()));
  await ctx.close();
}

// ── 4: varje plan har en väg vidare, och den leder någonstans ────────────
{
  const { ctx, page } = await mk();
  // Gratis går rakt in i appen. Kontrollen letar efter en länk till app.html
  // inuti kortet, inte efter .planCta.
  const gratisHref = await page.evaluate(() => {
    const a = document.querySelector("#plan-gratis a[href]");
    return a ? a.getAttribute("href") : null;
  });
  ok("4a Gratis leder in i appen", gratisHref === "app.html", String(gratisHref));

  for (const id of ["basic", "premium"]) {
    const has = await page.evaluate(cid => !!document.getElementById("btn-" + cid), id);
    ok(`4b ${id} har en köpknapp`, has);
  }

  // Utan session ska köpknappen ta besökaren till appen för att skapa konto,
  // inte tyst göra ingenting. startCheckout gör location.href = "app.html".
  await page.evaluate(() => document.getElementById("btn-basic").scrollIntoView({ block: "center" }));
  await page.click("#btn-basic");
  await page.waitForTimeout(1200);
  ok("4c utan konto leder köpknappen till appen", page.url().includes("app.html"), page.url());
  await ctx.close();
}

// ── 5: hantera prenumeration visas bara för betalande ────────────────────
{
  const { ctx, page } = await mk();
  ok("5a dold utan konto", !(await page.locator("#manageSubSection").isVisible()));
  await ctx.close();
}
{
  const { ctx, page } = await mk({ session: true, role: "basic", profileRole: "basic" });
  await page.waitForTimeout(1200);
  ok("5b synlig för betalande", await page.locator("#manageSubSection").isVisible());
  ok("5c utan Stripe-kund visas supportväg i stället för trasig portal", await page.locator("#manageSubSupport").isVisible() && !(await page.locator("#manageSubBtn").isVisible()));
  await ctx.close();
}
{
  const { ctx, page } = await mk({ session: true, role: "basic", profile: { role: "basic", stripe_customer_id: "cus_test" } });
  await page.waitForTimeout(1200);
  ok("5d Stripe-kund får portal-knappen", await page.locator("#manageSubBtn").isVisible() && !(await page.locator("#manageSubSupport").isVisible()));
  await ctx.close();
}
{
  const { ctx, page } = await mk({ session: true, role: "basic", profile: { role: "basic", stripe_customer_id: "cus_test" } });
  await page.waitForTimeout(1200);
  await page.route("**/api/check-role", route => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "portal_unavailable", message: "Kunde inte öppna betalningsportalen just nu. Försök igen senare." }) }));
  await page.locator("#manageSubBtn").click();
  await page.waitForFunction(() => document.getElementById("manageSubSupport")?.getBoundingClientRect().height > 0);
  ok("5e portal-API-fel visar betalningshjälp direkt", await page.locator("#manageSubSupport").isVisible());
  ok("5f portalfelet är uppläst via statusregion", /Kunde inte öppna betalningsportalen/i.test(await page.locator("#manageSubMessage").innerText()));
  await ctx.close();
}

// ── 6: varje FAQ-svar går att nå ─────────────────────────────────────────
// Frågetexten står kvar i båda formerna; svaret ligger idag bakom ett klick
// och kan efter ombyggnaden ligga öppet. Kontrollen tål båda: syns svaret
// redan är det nått, annars klickas frågan först.
const FAQ = [
  ["Kan jag testa gratis", "kortuppgifter"],
  ["Hur avbokar jag", "betalningsportalen"],
  ["om jag nedgraderar", "finns kvar"],
  ["hela klassen eller skolan", "skolpaket"],
];
{
  const { ctx, page } = await mk();
  ok("6b FAQ-frågor har rubriksemantik", await page.getByRole("heading", { name: "Hur avbokar jag mitt medlemskap?", level: 3 }).count() === 1);
  for (const [q, a] of FAQ) {
    const shown = await page.evaluate(async ([qq, aa]) => {
      const vis = t => Array.from(document.querySelectorAll("main *")).some(el => {
        if (!(el.textContent || "").includes(t)) return false;
        if (Array.from(el.children).some(c => (c.textContent || "").includes(t))) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (vis(aa)) return true;
      const head = Array.from(document.querySelectorAll("main *")).find(el =>
        (el.textContent || "").includes(qq) && !Array.from(el.children).some(c => (c.textContent || "").includes(qq)));
      if (!head) return false;
      head.click();
      await new Promise(r => setTimeout(r, 500));
      return vis(aa);
    }, [q, a]);
    ok(`6a svaret på "${q}…" går att nå`, shown);
  }
  await ctx.close();
}

// ── 7: borttagna moduler läcker inte in i jämförelsen ────────────────────
// Jämförelsetabellen ska bara sälja skolprodukten. Gamla produktgrenar får
// inte ligga kvar i markupen och döljas med CSS.
{
  const { ctx, page } = await mk();
  const t = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("main table tbody tr"));
    const vis = rows.filter(r => r.getBoundingClientRect().height > 0);
    return {
      total: rows.length,
      visible: vis.length,
      text: vis.map(r => r.innerText.replace(/\s+/g, " ")).join(" | "),
      allText: rows.map(r => r.innerText.replace(/\s+/g, " ")).join(" | "),
      cols: (rows[0] ? rows[0].children.length : 0),
    };
  });
  ok("7a jämförelsen har rader", t.visible > 0, JSON.stringify({ total: t.total, visible: t.visible }));
  ok("7b fyra kolumner: funktion + tre planer", t.cols === 4, String(t.cols));
  ok("7c gamla produktgrenar finns inte i tabellen", !/Repetitionsläge|Vägmärken|Teoriprov/i.test(t.allText), t.allText.slice(0, 160));
  ok("7d studieraderna finns kvar", /Lärarrapport/.test(t.text) && /Felbank/.test(t.text), t.text.slice(0, 200));
  await ctx.close();
}

// ── 8: varje --exgen-token sidan hänvisar till finns faktiskt ────────────
// CSS är tyst om okända custom properties. var(--exgen-space-10) — som inte
// finns i skalan (1/2/3/4/6/8/12/16) — gör inte deklarationen ogiltig med ett
// felmeddelande; den gör hela raden ogiltig utan ett ljud. Zonavståndet mättes
// till 0px på både prissidan och förbättringssidan innan det upptäcktes, och
// ingen körning, ingen konsol och inget test hade sagt något.
//
// Kontrollen letar därför upp varje var(--exgen-…) UTAN reservvärde i sidans
// egna stilmallar och kräver att namnet är definierat. Den dödar klassen, inte
// bara de nio raderna som råkade vara fel den här gången.
{
  const { ctx, page } = await mk();
  const bad = await page.evaluate(() => {
    const names = new Set();
    const scan = css => {
      // Utan komma efter namnet finns inget reservvärde att falla tillbaka på.
      const re = /var\(\s*(--exgen-[a-z0-9-]+)\s*\)/gi;
      let m; while ((m = re.exec(css))) names.add(m[1]);
    };
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }   // korsdomän, t.ex. Google Fonts
      if (!rules) continue;
      const walk = list => {
        for (const r of list) {
          if (r.cssText) scan(r.cssText);
          if (r.cssRules) walk(r.cssRules);
        }
      };
      walk(rules);
    }
    const root = getComputedStyle(document.documentElement);
    return [...names].filter(n => !root.getPropertyValue(n).trim()).sort();
  });
  ok("8a inga hänvisningar till tokens som inte finns", bad.length === 0, bad.join(" "));
  await ctx.close();
}

// ── 9: jämförelsen ryms på en telefon ───────────────────────────────────
// Tabellen låg i en .compareWrap med overflow-x:auto och en min-width på
// 420px. Vid 390px finns 358px, så Premium-kolumnen — den enda som är värd
// att sälja på — låg 62px utanför kanten, och ingenting antydde att man kunde
// dra. Uppmätt före fixen, vid tre bredder:
//
//   390px  wrap 358  tabell 420  behöver scroll
//   360px  wrap 328  tabell 420  behöver scroll
//   430px  wrap 398  tabell 420  behöver scroll
//
// Inga celler var klippta invändigt — det var min-width som höll isär dem, så
// tabellen kunde smalna utan att texten går sönder.
//
// .compareWrap behåller sin overflow-x som skyddsnät (en framtida rad kan bli
// bredare än den här mätningen), men kravet är att skyddsnätet inte ska
// behövas vid vanliga telefonbredder. Kravet gäller sidan också: <body> får
// aldrig scrolla i sidled.
for (const width of [360, 390, 430]) {
  const { ctx, page } = await mk({ width });
  const t = await page.evaluate(() => {
    const wrap = document.querySelector("main table").closest("div");
    const clipped = [...document.querySelectorAll("main table td, main table th")]
      .filter(e => e.scrollWidth > e.getBoundingClientRect().width + 1)
      .map(e => e.textContent.trim().slice(0, 24));
    return {
      wrap: Math.round(wrap.clientWidth),
      table: Math.round(document.querySelector("main table").getBoundingClientRect().width),
      needsScroll: wrap.scrollWidth > wrap.clientWidth + 1,
      bodyScrolls: document.documentElement.scrollWidth > innerWidth + 1,
      clipped,
    };
  });
  ok(`9a jämförelsen ryms vid ${width}px`, !t.needsScroll, JSON.stringify(t));
  ok(`9b sidan scrollar inte i sidled vid ${width}px`, !t.bodyScrolls, JSON.stringify(t));
  ok(`9c ingen cell är klippt vid ${width}px`, t.clipped.length === 0, t.clipped.join(" | "));
  const impact = await page.locator("#zonImpact").boundingBox();
  const impactBounds = await page.evaluate(() => {
    const section = document.querySelector("#zonImpact");
    const parts = [...section.querySelectorAll("h2,.impactCopy,.impactStatus")];
    const rects = parts.map(el => {
      const rect = el.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, clipped: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1 };
    });
    return { rects, viewport: innerWidth };
  });
  ok(`9d hela Impact-sektionen ryms vid ${width}px`, !!impact && impactBounds.rects.length === 3 && impactBounds.rects.every(r => r.left >= 0 && r.right <= impactBounds.viewport + 1 && r.width > 0 && !r.clipped), JSON.stringify(impactBounds));
  await ctx.close();
}

// ── 10: sidfotens år räknas fram, inte skrivs in ─────────────────────────
{
  const { ctx, page } = await mk();
  const y = await page.evaluate(() => (document.querySelector("footer").innerText || ""));
  ok("10a året är i år", y.includes(String(new Date().getFullYear())), y.slice(0, 80));
  await ctx.close();
}

} catch (e) { crash = e; }

await browser.close();
await srv.close();
process.exit(R.finish(crash));
