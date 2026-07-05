// Playwright journey runner — drives the live site as one persona and
// captures everything a real user would experience: what they saw, what
// broke, console errors, failed network calls. Interaction is best-effort
// and never throws out of a step — a broken flow IS the signal we want.
import { chromium, devices } from "playwright";
import { join } from "node:path";

const NAV_TIMEOUT = 25000;
const SOFT_TIMEOUT = 4000;
const MAX_TEXT = 4000;

const MOBILE = devices["Pixel 7"];

// Maps a journey step name -> page path on the site.
const STEP_PATH = {
  app: "/app.html",
  korkortet: "/korkortet.html",
  forbattring: "/f%C3%B6rb%C3%A4ttring.html",
  larare: "/larare.html",
  pricing: "/pricing.html",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Real study material so exam generation actually has something to work with.
const SAMPLE_MATERIAL = `Derivata — sammanfattning
Definition: derivatan f'(x) beskriver funktionens momentana förändringshastighet.
Deriveringsregler:
- Konstant: d/dx(c) = 0
- Potens: d/dx(x^n) = n·x^(n-1)
- Summa: (f+g)' = f' + g'
- Produkt: (f·g)' = f'·g + f·g'
- Kedjeregeln: (f(g(x)))' = f'(g(x))·g'(x)
Exempel: f(x) = 3x^2 + 2x - 5 ger f'(x) = 6x + 2.
Tillämpning: sätt f'(x) = 0 för att hitta extrempunkter (max/min).
Andraderivatan f''(x) avgör om punkten är max (f''<0) eller min (f''>0).`;

// Robust click: reveal animations + section headers on the app page steal
// pointer events, so a normal click flakes. Scroll in, try real click, then
// fall back to a JS .click() that ignores overlays.
async function robustClick(page, selector, timeout = 5000) {
  const el = page.locator(selector).first();
  try {
    if (!(await el.isVisible({ timeout: 2000 }))) return false;
    await el.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
    await sleep(400); // let reveal animation finish (element "not stable")
    await el.click({ timeout });
    return true;
  } catch {
    try {
      await el.evaluate((node) => node.click());
      return true;
    } catch {
      return false;
    }
  }
}

async function settle(page) {
  // Wait for network to go quiet so in-flight fetches aren't aborted by the
  // next navigation (that abort was polluting feedback as a fake "bug").
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {
    /* good enough */
  }
}

async function grabText(page) {
  try {
    const t = await page.evaluate(() => {
      const el = document.querySelector("main") || document.body;
      return (el.innerText || "").replace(/\n{3,}/g, "\n\n").trim();
    });
    return t.slice(0, MAX_TEXT);
  } catch {
    return "";
  }
}

async function shot(page, outDir, name) {
  const file = join(outDir, `${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
    return file;
  } catch {
    return null;
  }
}

// --- per-step interactions (all best-effort) ---

async function acceptCookies(page) {
  // Consent banner blocks clicks; accept once (persists per origin).
  try {
    const btn = page.locator("#ckAcceptBtn");
    if (await btn.isVisible({ timeout: 1500 })) {
      await btn.click({ timeout: SOFT_TIMEOUT });
      await sleep(400);
    }
  } catch {
    /* no banner */
  }
}

async function isSignupModalVisible(page) {
  try {
    return await page.locator("#pvRE").isVisible({ timeout: 1000 });
  } catch {
    return false;
  }
}

async function doSignup(page, baseUrl, account) {
  const started = Date.now();
  let ok = false;
  let note = "";
  try {
    await page.goto(baseUrl + "/app.html", { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await sleep(1500);
    await acceptCookies(page);

    // Live signup modal: #pvRE (email) / #pvRP (pass) / #pvRBtn ("Skapa konto").
    // If it isn't showing, distinguish "already logged in" (app shell loaded)
    // from "page never loaded" (403/auth-wall/network) — the latter is a real
    // failure, not a pass.
    if (!(await isSignupModalVisible(page))) {
      const shellLoaded = await page
        .locator("#pastedText, #wStep0, #generateExamBtn")
        .first()
        .count()
        .then((c) => c > 0)
        .catch(() => false);
      if (shellLoaded) {
        note = "Signup-modal visades inte (app-shell laddad → redan inloggad).";
        ok = true;
      } else {
        const body = await page.evaluate(() => (document.body?.innerText || "").slice(0, 200)).catch(() => "");
        note = "Sidan laddade inte appen (protection/403/nätverk?). Sidtext: " + body.replace(/\n+/g, " ");
        ok = false;
      }
      return { ok, note, durationMs: Date.now() - started };
    }
    await page.fill("#pvRE", account.email, { timeout: SOFT_TIMEOUT });
    await page.fill("#pvRP", account.password, { timeout: SOFT_TIMEOUT });
    await page.click("#pvRBtn", { timeout: SOFT_TIMEOUT });

    // Success = modal closes. Failure = modal stays + shows an error.
    const closed = await page
      .waitForFunction(
        () => {
          const e = document.querySelector("#pvRE");
          if (!e) return true;
          const s = getComputedStyle(e);
          const r = e.getBoundingClientRect();
          return s.display === "none" || s.visibility === "hidden" || r.width === 0;
        },
        { timeout: 15000 }
      )
      .then(() => true)
      .catch(() => false);

    if (closed) {
      ok = true;
      note = "Konto skapat, signup-modal stängdes.";
    } else {
      // Grab whatever error text the modal is now showing.
      const errText = await page.evaluate(() => {
        const modal = document.querySelector("#pvRE")?.closest("[class],[id]");
        return (modal?.innerText || "").slice(0, 300);
      });
      note = "Signup-modal kvar efter klick. Modaltext: " + errText.replace(/\n+/g, " ");
    }
  } catch (e) {
    note = "Signup kraschade: " + (e?.message || String(e));
  }
  await sleep(1200);
  return { ok, note, durationMs: Date.now() - started };
}

async function interactGeneric(page, stepName) {
  // Best-effort: nudge the primary flow so the persona sees more than a
  // landing screen. Clicks the most prominent action, then a follow-up.
  const notes = [];
  const primary = [
    "button:has-text('Starta')",
    "button:has-text('Börja')",
    "button:has-text('Nytt prov')",
    "button:has-text('Kör')",
    "button:has-text('Öva')",
    "button:has-text('Teoriprov')",
    "button:has-text('Generera')",
    "button:has-text('Rätta')",
    ".btnP",
  ];
  for (const sel of primary) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 800 })) {
        await el.click({ timeout: SOFT_TIMEOUT });
        notes.push(`klickade "${sel}"`);
        await sleep(1500);
        break;
      }
    } catch {
      /* keep trying */
    }
  }
  // For quiz-like pages, try to answer a couple of questions generically.
  if (stepName === "korkortet") {
    for (let i = 0; i < 3; i++) {
      try {
        const opt = page.locator("[class*='opt'],[class*='alt'],[class*='answer'],[class*='choice']").filter({ hasText: /\S/ }).first();
        if (await opt.isVisible({ timeout: 1000 })) {
          await opt.click({ timeout: SOFT_TIMEOUT });
          await sleep(600);
          const next = page.locator("button:has-text('Nästa'),button:has-text('Fortsätt'),button:has-text('Rätta')").first();
          if (await next.isVisible({ timeout: 800 })) {
            await next.click({ timeout: SOFT_TIMEOUT });
            await sleep(800);
          }
          notes.push(`svarade på fråga ${i + 1}`);
        } else break;
      } catch {
        break;
      }
    }
  }
  return notes.join("; ");
}

// Drives the real mockprov wizard end-to-end: paste material -> pick course
// -> generate (OpenAI) -> answer -> grade. This is the core loop, so we let
// it wait for the slow AI round-trips instead of bailing early.
async function doMockprov(page, persona) {
  const notes = [];
  const course =
    persona.primaryMode === "matte"
      ? persona.role.includes("åk 1") || persona.age <= 16
        ? "Matematik 1c"
        : "Matematik 3c"
      : "Matematik 2b";
  try {
    // Step 0 — material. Prefer the guided onboarding path (the new
    // "Fyll i exempeltext" button) exactly as a clueless first-timer would;
    // only paste manually if that affordance isn't there.
    const ta = page.locator("#pastedText").first();
    if (await ta.isVisible({ timeout: 4000 })) {
      const usedExample = await robustClick(page, "#fillExampleBtn", 2500);
      if (usedExample) await sleep(600);
      const hasText = await ta.inputValue().then((v) => v.trim().length > 0).catch(() => false);
      if (usedExample && hasText) {
        notes.push("använde exempeltext-knappen");
      } else {
        await ta.fill(SAMPLE_MATERIAL, { timeout: SOFT_TIMEOUT });
        notes.push(usedExample ? "exempel-knapp fyllde inget, klistrade manuellt" : "ingen exempel-knapp, klistrade manuellt");
      }
      await robustClick(page, "#wNext0");
      await sleep(1000);
    } else {
      notes.push("hittade inte materialrutan (#pastedText)");
    }
    // Step 1 — course + generate
    const cs = page.locator("#courseSearch").first();
    if (await cs.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cs.fill(course, { timeout: SOFT_TIMEOUT }).catch(() => {});
      notes.push(`valde kurs "${course}"`);
    }
    const clickedGen = await robustClick(page, "#generateExamBtn");
    if (clickedGen) {
      notes.push("tryckte Skapa mockprov");
      // Wait for AI generation: step 2 becomes active OR questions render.
      const generated = await page
        .waitForFunction(
          () => {
            const s2 = document.querySelector("#wStep2");
            const active = s2 && s2.classList.contains("active");
            const hasQ = document.body.innerText.match(/fråga|uppgift|question/i);
            const bank = document.querySelector("[id*='exam'],[id*='quiz'],[class*='question']");
            return Boolean(active || (hasQ && bank));
          },
          { timeout: 45000 }
        )
        .then(() => true)
        .catch(() => false);
      notes.push(generated ? "prov genererades" : "provet genererades ALDRIG (timeout 45s)");
      await sleep(1500);
    } else {
      notes.push("hittade inte Skapa mockprov-knappen");
    }
    // Step 2 -> grade (best effort; second AI round-trip)
    const clickedGrade = await robustClick(page, "#gradeBtn, #wNext2, button:has-text('Rätta prov')");
    if (clickedGrade) {
      const graded = await page
        .waitForFunction(() => /rätt|poäng|resultat|feedback/i.test(document.body.innerText), { timeout: 40000 })
        .then(() => true)
        .catch(() => false);
      notes.push(graded ? "provet rättades" : "rättning gav inget resultat (timeout)");
    }
  } catch (e) {
    notes.push("mockprov-fel: " + (e?.message || String(e)));
  }
  return notes.join("; ");
}

/**
 * Runs one persona through its journey against baseUrl.
 * @returns full observation record for the persona-agent to react to.
 */
export async function runJourney(persona, { baseUrl, headless, account, outDir }) {
  const browser = await chromium.launch({ headless });
  const ctxOpts = persona.device === "mobile" ? { ...MOBILE } : { viewport: { width: 1280, height: 800 } };
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  let currentStep = "init";

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ step: currentStep, text: msg.text().slice(0, 300) });
  });
  page.on("requestfailed", (req) => {
    failedRequests.push({ step: currentStep, url: req.url().slice(0, 200), reason: req.failure()?.errorText || "" });
  });
  page.on("response", (res) => {
    const s = res.status();
    if (s >= 400) httpErrors.push({ step: currentStep, url: res.url().slice(0, 200), status: s });
  });

  const steps = [];
  const journey = Array.isArray(persona.journey) && persona.journey.length ? persona.journey : ["signup", "app", "pricing"];

  for (const stepName of journey) {
    currentStep = stepName;
    if (stepName === "signup") {
      const r = await doSignup(page, baseUrl, account);
      const text = await grabText(page);
      const screenshot = await shot(page, outDir, `${persona.id}_signup`);
      steps.push({ name: "signup", url: baseUrl + "/app.html", ok: r.ok, durationMs: r.durationMs, note: r.note, visibleText: text, screenshot });
      if (!r.ok) break; // no point continuing if the account never got in
      continue;
    }
    const path = STEP_PATH[stepName];
    if (!path) continue;
    const started = Date.now();
    let ok = false;
    let note = "";
    try {
      if (stepName !== "app") {
        // 'app' is already loaded after signup; others need navigation.
        await page.goto(baseUrl + path, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
        await sleep(1200);
        await acceptCookies(page);
      }
      // Matte personas run the real mockprov wizard on the app step;
      // everything else uses the best-effort generic nudge.
      if (stepName === "app" && persona.primaryMode === "matte") {
        note = await doMockprov(page, persona);
      } else {
        note = await interactGeneric(page, stepName);
      }
      await settle(page);
      ok = true;
    } catch (e) {
      note = "Steg-fel: " + (e?.message || String(e));
    }
    const text = await grabText(page);
    const screenshot = await shot(page, outDir, `${persona.id}_${stepName}`);
    steps.push({ name: stepName, url: baseUrl + path, ok, durationMs: Date.now() - started, note, visibleText: text, screenshot });
  }

  await context.close();
  await browser.close();
  return { persona, account: { email: account.email }, steps, consoleErrors, failedRequests, httpErrors };
}
