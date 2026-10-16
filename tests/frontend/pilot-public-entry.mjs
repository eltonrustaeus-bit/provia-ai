import { AUTH_KEY, ROOT, serve, openPage, report } from "./_harness.mjs";
import { readFile } from "node:fs/promises";
const { chromium } = await import(`${ROOT}/node_modules/playwright/index.mjs`);

const srv = await serve(ROOT);
const browser = await chromium.launch();
const R = report("pilot-public-entry");
const ok = (name, condition, detail = "") => R.ok(name, condition, detail);
const axeSource = await readFile(`${ROOT}/node_modules/axe-core/axe.min.js`, "utf8");
let crash = null;

const runtime = environment => `window.ExGenRuntime = Object.freeze({
  environment: ${JSON.stringify(environment)}, projectRef: "exgen-test-project",
  supabaseUrl: "https://exgen-test-project.invalid", publishableKey: "sb_publishable_synthetic_frontend_test_key_only_000000",
  appOrigin: "http://localhost", authStorageKey: ${JSON.stringify(AUTH_KEY)}
});`;

async function open(path, environment, width = 1280, state = { signedIn: false, role: null }) {
  return openPage(browser, `${srv.url}/${path}`, {
    width, height: 900, reducedMotion: "reduce", settle: 500,
    state,
    mocks: {
      role: state.role || "gratis",
      extra: [
        ["**/js/exgen-runtime.js", route => route.fulfill({ contentType: "application/javascript", body: runtime(environment) })],
        ["**ungdrive.se/**", route => route.abort()],
      ],
    },
  });
}

try {
  {
    const { page, close } = await open("index.html", "pilot", 390);
    const pilotCta = page.getByRole("link", { name: "Logga in med skolpilotkonto" }).first();
    ok("startsidan visar skolpilotinloggning på mobil", await pilotCta.isVisible());
    ok("publik gratiskonto-CTA är dold", !(await page.locator(".heroBtns .publicOnly").isVisible()));
    ok("pilotvillkoret ersätter gratisregistreringsbudskapet", await page.locator(".heroMeta").innerText().then(text => /endast för inbjudna skolpilotkonton/i.test(text)));
    ok("pristrappa och pris-FAQ är inte synliga i pilotläget", !(await page.locator("#pricingStrip").isVisible()) && !(await page.locator("#faq-1").isVisible()) && await page.locator("#faq-4").count() === 1 && !(await page.locator("#faq-4").isVisible()) && !(await page.locator("#faq-6").isVisible()));
    ok("prislänk tas bort ur sidfoten", !(await page.locator(".xg-footer a[href='pricing.html']").isVisible()));
    ok("pilotdelning får noindex och saknar publik canonical/JSON-LD", await page.locator('meta[name="robots"]').getAttribute("content") === "noindex, nofollow" && await page.locator('link[rel="canonical"]').count() === 0 && await page.locator('script[type="application/ld+json"]').count() === 0);
    await page.addScriptTag({ content: axeSource });
    const landingA11y = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } })).violations.map(v => `${v.id}: ${v.nodes.map(n => `${n.target.join(" ")} ${n.failureSummary || ""}`).join(" | ")}`));
    ok("pilotstartsidan saknar axe WCAG 2A/2AA-fynd", landingA11y.length === 0, landingA11y.join(", "));
    await pilotCta.click();
    const landingModal = await page.locator("#pvModal").innerText();
    ok("startsidesvägen öppnar pilotkontots inloggning", /SKOLPILOT · LOGGA IN/.test(landingModal), `${page.url()} · ${landingModal.slice(0, 100)}`);
    await close();
  }

  {
    const { page, close } = await open("pricing.html", "pilot", 390);
    ok("prissidan ersätts av en begriplig pilotåtkomstvy", await page.locator(".pilotPricingIntro").isVisible() && /endast öppen för elever med ett inbjudet skolpilotkonto/i.test(await page.locator(".pilotPricingIntro").innerText()));
    const hiddenSections = await Promise.all(["#zonPlaner", "#zonJamfor", "#zonImpact", "#manageSubSection", "#zonFragor"].map(selector => page.locator(selector).isVisible().then(visible => !visible)));
    ok("pilotprissidan döljer plan-, köp-, Impact- och FAQ-sektionerna", hiddenSections.every(Boolean));
    ok("inga plan- eller checkoutkontroller är synliga eller tabb-bara", hiddenSections.every(Boolean) && !(await page.locator("#btn-basic").isVisible()) && !(await page.locator("#btn-premium").isVisible()));
    await page.addScriptTag({ content: axeSource });
    const pricingA11y = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } })).violations.map(v => `${v.id}: ${v.nodes.length}`));
    ok("pilotprissidan saknar axe WCAG 2A/2AA-fynd", pricingA11y.length === 0, pricingA11y.join(", "));
    let checkoutRequests = 0;
    page.on("request", request => { if (request.url().includes("/api/create-checkout-session")) checkoutRequests++; });
    await page.evaluate(() => window.startCheckout("basic"));
    ok("direkt checkout-funktionsanrop gör inget i pilotläge", checkoutRequests === 0);
    ok("prissidans delningsmetadata är pilotanpassad", await page.title() === "ExGen skolpilot" && (await page.locator('meta[property="og:description"]').getAttribute("content")).includes("inbjudet testkonto"));
    await page.locator(".pilotPricingIntro a").click();
    const pricingModal = await page.locator("#pvModal").innerText();
    ok("prissidans inloggningsväg öppnar pilotkontots inloggning", /SKOLPILOT · LOGGA IN/.test(pricingModal), `${page.url()} · ${pricingModal.slice(0, 100)}`);
    await close();
  }

  {
    const { page, close } = await open("index.html", "production");
    ok("publik startsida behåller registrering och prisväg", await page.getByRole("link", { name: "Skapa ditt första prov" }).isVisible() && await page.locator("#pricingStrip").isVisible() && await page.locator(".xg-footer a[href='pricing.html']").isVisible());
    await close();
  }

  {
    const { page, close } = await open("pricing.html", "production");
    ok("publik prissida behåller verifierade priser och checkoutkontroller", await page.locator("#plan-basic .planAmt").innerText() === "29" && await page.locator("#plan-premium .planAmt").innerText() === "79" && await page.locator("#btn-basic").isVisible() && await page.locator("#btn-premium").isVisible());
    await close();
  }

  {
    const { page, close } = await open("app.html", "pilot", 390, { signedIn: true, role: "premium" });
    await page.waitForFunction(() => !!window.ExGenEngine);
    let ocrRequests = 0;
    page.on("request", request => { if (request.url().includes("/api/ocr")) ocrRequests++; });
    const guarded = await page.evaluate(async () => {
      const file = new File(["synthetic"], "test.png", { type: "image/png" });
      return {
        materialOcr: await window.ExGenEngine.ocr(file),
        answerPhoto: await window.ExGenEngine.readSolution(file, "synthetic question"),
        legacyOcrHidden: getComputedStyle(document.querySelector(".uploadBox")).display === "none",
        examPhotoHidden: !document.querySelector(".xf-photo-btn"),
      };
    });
    ok("pilotläget döljer material-OCR och fotoinlämning", guarded.legacyOcrHidden && guarded.examPhotoHidden);
    ok("pilotens OCR-API är fail-closed i båda gränssnitten", !guarded.materialOcr.ok && !guarded.answerPhoto.ok && ocrRequests === 0);
    await close();
  }

  {
    const { page, close } = await open("konto.html", "pilot", 390, { signedIn: true, role: "gratis" });
    await page.waitForFunction(() => typeof window.startCheckout === "function");
    let checkoutRequests = 0;
    page.on("request", request => { if (request.url().includes("/api/create-checkout-session")) checkoutRequests++; });
    await page.evaluate(() => window.startCheckout("basic"));
    ok("pilotkontot döljer köp och direkt checkout-anrop skickar ingen begäran", !(await page.locator("#upgradeCard").isVisible()) && checkoutRequests === 0);
    await close();
  }

  {
    const payload = Buffer.from(JSON.stringify({ email: "synthetic@example.test", sub: "synthetic-user" })).toString("base64url");
    const oauthToken = `eyJhbGciOiJub25lIn0.${payload}.synthetic-signature`;
    for (const environment of ["pilot", "production"]) {
      let signupRequests = 0;
      const { page, close } = await openPage(browser,
        `${srv.url}/app.html#access_token=${encodeURIComponent(oauthToken)}&expires_in=3600&token_type=bearer`, {
          height: 900, reducedMotion: "reduce", settle: 350,
          state: { signedIn: false, role: null },
          mocks: {
            role: "premium",
            runtime: runtime(environment),
            extra: [["**/api/signup", async route => {
              signupRequests++;
              await route.fulfill({ json: { ok: true, isNew: false } });
            }]],
          },
        });
      await page.waitForTimeout(100);
      const hasStoredSession = await page.evaluate(() => !!localStorage.getItem(window.ExGenRuntime.authStorageKey));
      ok(`${environment}: OAuth-retur ${environment === "pilot" ? "stoppas före signup-anrop" : "behåller signup-kopplingen"}`,
        environment === "pilot"
          ? signupRequests === 0 && !hasStoredSession
          : signupRequests === 1 && hasStoredSession);
      await close();
    }
  }
} catch (error) {
  crash = error;
} finally {
  await browser.close();
  await srv.close();
  process.exitCode = R.finish(crash);
}
