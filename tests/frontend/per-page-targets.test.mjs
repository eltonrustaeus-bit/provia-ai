import { ROOT, serve, openPage, report } from "./_harness.mjs";
// Bevisar att målregistret har mer än en konsument: P.E.R kan skicka en
// besökare till rätt PLANKORT på prissidan, inte bara till prissidan — och
// öppna rätt sektion på förbättringssidan.
//
// Användning:  node tests/frontend/per-page-targets.test.mjs

const { chromium } = await import(ROOT + "/node_modules/playwright/index.mjs");
const srv = await serve(ROOT, { indexFile: "pricing.html" });

const R = report("per-page-targets");
const ok = (n, c, d = "") => R.ok(n, c, d);

const browser = await chromium.launch();

// Servern, ruttmockarna, sessionen och splash-förbikopplingen kommer från
// _harness.mjs. Det som står kvar här är det enda den här filen behöver som
// ingen annan gör: user_exams-raden nedan.
async function mk(path, { explainHandler, additionalMocks = [], waitUntil = "networkidle", settle = 600 } = {}) {
  const extra = [["**/rest/v1/user_exams**", r => {
    const userId = new URL(r.request().url()).searchParams.get("user_id");
    return r.fulfill({ json: [
      { id: 1, created_at: new Date().toISOString(), course: userId === "eq.u2" ? "Matematik 2b" : "Biologi 1", level: "C", qtype: "mix", material: "", exam: {}, answers: {}, result: { total_points: 62, max_points: 100 } }
    ] });
  }]];
  if (explainHandler) extra.push(["**/api/explain", explainHandler]);
  extra.push(...additionalMocks);
  return openPage(browser, srv.url + path, {
    waitUntil,
    settle,
    mocks: {
      // förbättring.html synkar historik från user_exams innan sidan är klar
      // (shared.js laddas med defer, så det första setPerContext-anropet hinner
      // köras innan window.setPerContext ens finns — synken vinner racet).
      // Utan en rad här skulle synken skriva över den seedade historiken med en
      // tom lista och userScore aldrig hinna sättas; då testar vi inte längre
      // att gamla fält överlever utökningen, bara att de aldrig fanns.
      // Registreras via `extra` och hamnar därmed SIST — den generella
      // **/rest/v1/** hade annars ätit upp den.
      extra,
    },
    state: {
      storage: { proviaai_history: [{ percent: 62, course: "Biologi 1", level: "C", ts: Date.now() }] },
    },
  });
}

// ── T1: prissidan deklarerar tre mål ──────────────────────────────────────
{
  const { ctx, page } = await mk("/pricing.html");
  const t1 = await page.evaluate(() => (window.__perTestCtx().targets || []).map(t => t.id));
  ok("T1a tre plan-mål", t1.length === 3, JSON.stringify(t1));
  ok("T1b rätt id", t1.join(",") === "gratis,basic,premium", t1.join(","));

  // korten har id att hoppa till
  const ids = await page.evaluate(() => ["plan-gratis", "plan-basic", "plan-premium"].map(i => !!document.getElementById(i)));
  ok("T1c plankorten har id", ids.every(Boolean), JSON.stringify(ids));

  // P.E.R:s knapp rullar till rätt kort. Panelen måste vara öppen för att
  // knappen ska vara klickbar — #perPanel har display:none tills #perBubble
  // klickas (toggle() i shared.js). app.html:s eget test öppnar panelen
  // indirekt via ".xf-ask"; här finns ingen sådan genväg, så vi klickar
  // bubblan direkt.
  const controls = await page.locator("#perBubble").getAttribute("aria-controls");
  ok("T1d1 P.E.R-knappen pekar ut panelen", controls === "perPanel" && controls === await page.locator("#perPanel").getAttribute("id"));
  ok("T1d2 panelen börjar stängd enligt ARIA", await page.locator("#perBubble").getAttribute("aria-expanded") === "false");
  await page.click("#perBubble");
  const opened = await page.locator("#perPanel").evaluate(el => el.classList.contains("per-open"));
  ok("T1d3 öppnad panel annonseras", await page.locator("#perBubble").getAttribute("aria-expanded") === "true" && opened);
  ok("T1d4 slutligt svar har en artig, atomisk statusregion", await page.locator("#perAnnouncement").getAttribute("role") === "status" && await page.locator("#perAnnouncement").getAttribute("aria-live") === "polite" && await page.locator("#perAnnouncement").getAttribute("aria-atomic") === "true");
  ok("T1d4a statusregion finns kvar utanför den dolda panelen", await page.locator("#perAnnouncement").evaluate(el => el.parentElement.id === "perWidget"));
  ok("T1d5 meddelandelistan annonserar inte varje token", await page.locator("#perMessages").getAttribute("aria-live") === null);
  await page.evaluate(() => {
    const partial = document.createElement("div");
    partial.id = "perPartialTest";
    partial.className = "per-msg teacher typing";
    partial.textContent = "Del av svaret";
    document.getElementById("perMessages").appendChild(partial);
  });
  ok("T1d6 delvis svar annonseras inte", (await page.locator("#perAnnouncement").textContent()) === "");
  await page.click("#perBubble");
  const closed = await page.locator("#perPanel").evaluate(el => el.classList.contains("per-open"));
  ok("T1d7 stängd panel annonseras", await page.locator("#perBubble").getAttribute("aria-expanded") === "false" && !closed);
  ok("T1d7a statusregion är fortfarande tillgänglig när panelen stängs", await page.locator("#perAnnouncement").evaluate(el => getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0));
  await page.click("#perBubble");
  await page.evaluate(() => {
    window.__perFinalize(document.getElementById("perPartialTest"), "Premium kostar 79 kr i månaden.\n[GOTO:#premium]");
  });
  ok("T1d8 färdigt svar annonseras", (await page.locator("#perAnnouncement").innerText()).includes("Premium kostar 79 kr i månaden."));
  ok("T1d8a navigeringsknapp blandas inte in i uppläsningen", !(await page.locator("#perAnnouncement").innerText()).includes("Premium →"));
  const label = await page.textContent("#perMessages .per-nav-cta >> nth=-1");
  ok("T1d knappen bär planens namn", label === "Premium →", String(label));
  await page.click("#perMessages .per-nav-cta >> nth=-1");
  await page.waitForTimeout(900);
  const flashed = await page.evaluate(() => document.getElementById("plan-premium").classList.contains("planCard--flash"));
  ok("T1e målkortet markeras", flashed === true);
  await ctx.close();
}

// ── T2: förbättringssidan deklarerar sina sektioner ───────────────────────
{
  const { ctx, page } = await mk("/förbättring.html");
  const t2 = await page.evaluate(() => (window.__perTestCtx().targets || []).map(t => t.id));
  // Fyra sedan Del E, ett per skärm. Av de gamla fem pekade "trana" och
  // "felbank" på samma zon — ett mål som inte kunde skilja sig från ett annat.
  ok("T2a fyra sektionsmål, ett per skärm", t2.length === 4, JSON.stringify(t2));
  ok("T2b felbank finns med", t2.indexOf("felbank") !== -1, JSON.stringify(t2));

  // Förbättringssidan får inte skicka lokala historikaggregat som verifierade
  // elevresultat eller märka tidigare prov som ett pågående prov.
  const t2b = await page.evaluate(() => window.__perTestCtx());
  ok("T2c historik skickas inte som verifierad userScore", t2b.userScore === undefined, String(t2b.userScore));
  ok("T2c1 svaga områden hämtas inte från lokal historik", t2b.weakAreas === undefined, JSON.stringify(t2b.weakAreas));
  ok("T2d sidan är förbättring", t2b.page === "förbättring", t2b.page);
  ok("T2d1 provhistorik beskrivs inte som aktiv provstatus", t2b.examState === undefined);

  await page.evaluate(() => localStorage.setItem("proviaai_per_coach_cache", JSON.stringify({
    ownerId: "another-account", ts: Date.now(), text: "PRIVATE_OTHER_ACCOUNT_COACH_MARKER",
  })));
  await page.click('[data-go="coach"]');
  await page.waitForTimeout(300);
  ok("T2d2 coachcache från ett annat konto visas inte",
    !(await page.locator("#coachText").textContent()).includes("PRIVATE_OTHER_ACCOUNT_COACH_MARKER"));

  // Målet tar eleven till felbanken. Kontrollerade tidigare att #mistakeSection
  // tappade sin .collapsed — men Del B tog bort dragspelen, så det finns inget
  await page.click("#perBubble");
  await page.evaluate(() => {
    const msgs = document.getElementById("perMessages");
    const div = document.createElement("div");
    msgs.appendChild(div);
    window.__perFinalize(div, "Dina misstag ligger i felbanken.\n[GOTO:#felbank]");
  });
  await page.click("#perMessages .per-nav-cta >> nth=-1");
  await page.waitForTimeout(400);
  // Sidan är ett skärmflöde sedan Del E. Målet markerar inte längre en zon som
  // ligger framme — det NAVIGERAR, vilket är ett skarpare krav: exakt en skärm
  // syns, och det är felbanken.
  const v = await page.evaluate(() => ({
    på: [...document.querySelectorAll(".xf-screen")]
      .filter(s => s.getBoundingClientRect().height > 0).map(s => s.dataset.screen),
    hash: location.hash,
  }));
  ok("T2e målet öppnar felbanksskärmen", v.på.length === 1 && v.på[0] === "felbank" && v.hash === "#felbank",
    JSON.stringify(v));

  await page.evaluate(async () => {
    const client = window.supabase.createClient(
      window.ExGenRuntime.supabaseUrl,
      window.ExGenRuntime.publishableKey,
      { auth: { storageKey: window.ExGenRuntime.authStorageKey } },
    );
    await client.auth.signOut();
  });
  await page.waitForTimeout(300);
  const afterSignOut = await page.locator("#xf").textContent();
  ok("T2f utloggning rensar redan ritad provhistorik direkt",
    !afterSignOut.includes("Biologi 1") && !afterSignOut.includes("3 prov"));
  await ctx.close();
}

// En coachförfrågan som startade för konto A får aldrig ritas eller cachelagras
// efter ett byte till konto B. Håll servern svaret tills B:s data visas.
{
  let notifyStarted;
  const started = new Promise(resolve => { notifyStarted = resolve; });
  let releaseResponse;
  const responseGate = new Promise(resolve => { releaseResponse = resolve; });
  let coachCalls = 0;
  const tokenB = `e30.${Buffer.from(JSON.stringify({ sub: "u2", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.sig`;
  const { ctx, page } = await mk("/förbättring.html", {
    waitUntil: "domcontentloaded",
    settle: 250,
    additionalMocks: [["**/auth/v1/user**", route => route.fulfill({ json:
      route.request().headers().authorization === `Bearer ${tokenB}`
        ? { id: "u2", email: "u2@t.se" }
        : { id: "u1", email: "u1@t.se" }
    })]],
    explainHandler: async route => {
      const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
      if (body?.topic === "studiecoach") {
        coachCalls++;
        if (coachCalls === 1) {
          notifyStarted(body);
          await responseGate;
          await route.fulfill({ json: { answer: "PRIVATE_OLD_ACCOUNT_COACH_MARKER" } });
        } else {
          await route.fulfill({ json: { answer: "PRIVATE_ACCOUNT_B_COACH_MARKER" } });
        }
      } else {
        await route.fulfill({ json: { ok: true } });
      }
    },
  });
  const coachBody = await Promise.race([
    started,
    new Promise((_, reject) => setTimeout(() => reject(new Error("coach request did not start")), 5000)),
  ]);
  ok("T3a coachanropet saknar klientens obekräftade historikaggregat",
    coachBody.pageContext?.page === "förbättring" && coachBody.context === undefined
      && coachBody.weakAreas === undefined && coachBody.userScore === undefined,
    JSON.stringify(coachBody));

  await page.evaluate(async secondAccessToken => {
    const client = window.supabase.createClient(
      window.ExGenRuntime.supabaseUrl,
      window.ExGenRuntime.publishableKey,
      { auth: { storageKey: window.ExGenRuntime.authStorageKey } },
    );
    const { error } = await client.auth.setSession({ access_token: secondAccessToken, refresh_token: "refresh-u2" });
    if (error) throw error;
  }, tokenB);
  await page.waitForFunction(() => document.getElementById("xf")?.textContent.includes("Matematik 2b"), null, { timeout: 5000 });
  await page.waitForFunction(() => document.getElementById("coachText")?.textContent.includes("PRIVATE_ACCOUNT_B_COACH_MARKER"), null, { timeout: 5000 });
  const afterSwitch = await page.locator("#xf").textContent();
  ok("T3b byte A→B visar B:s historik medan A:s coachsvar väntar",
    afterSwitch.includes("Matematik 2b") && !afterSwitch.includes("Biologi 1"));

  releaseResponse();
  await page.waitForTimeout(300);
  const afterOldResponse = await page.evaluate(() => ({
    text: document.getElementById("xf")?.textContent || "",
    cache: localStorage.getItem("proviaai_per_coach_cache"),
    owner: localStorage.getItem("exgen_local_data_owner"),
  }));
  ok("T3c sent coachsvar från föregående konto visas eller cachelagras inte",
    !afterOldResponse.text.includes("PRIVATE_OLD_ACCOUNT_COACH_MARKER")
      && !String(afterOldResponse.cache || "").includes("PRIVATE_OLD_ACCOUNT_COACH_MARKER"),
    JSON.stringify(afterOldResponse));
  ok("T3d det aktuella kontots egna coachsvar bevaras",
    afterOldResponse.text.includes("PRIVATE_ACCOUNT_B_COACH_MARKER")
      && String(afterOldResponse.cache || "").includes("PRIVATE_ACCOUNT_B_COACH_MARKER")
      && afterOldResponse.owner === "u2");
  await ctx.close();
}

await browser.close();
await srv.close();
process.exit(R.finish());
