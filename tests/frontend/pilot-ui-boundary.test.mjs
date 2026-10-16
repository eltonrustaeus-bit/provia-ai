import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ROOT } from "./_harness.mjs";

test("student pilot runtime hides commercial and improvement navigation", async () => {
  const shell = await readFile(`${ROOT}/js/exgen-shell.js`, "utf8");
  assert.match(shell, /environment === "pilot"/);
  assert.match(shell, /item\.href === "app\.html"/);
  assert.match(shell, /PILOT_MODE \? "app\.html" : "index\.html"/);
  assert.match(shell, /item\.label !== "Hantera prenumeration"/);
});

test("student pilot runtime does not expose OCR or solution-photo controls", async () => {
  const flow = await readFile(`${ROOT}/js/exam-flow.js`, "utf8");
  const app = await readFile(`${ROOT}/app.html`, "utf8");
  assert.match(flow, /environment === "pilot"\)\) \{/);
  assert.match(flow, /buildSolutionPhoto\(ta, q, id\)/);
  assert.match(app, /data-exgen-environment="pilot"\] \.uploadBox/);
  assert.match(app, /environment === "pilot" \|\| currentRole === "gratis"/);
  assert.match(app, /environment === "pilot"\)return;/);
});

test("student pilot account UI hides held-out actions and states deletion limitation", async () => {
  const account = await readFile(`${ROOT}/konto.html`, "utf8");
  assert.match(account, /data-exgen-environment="pilot"\] #teacherCard/);
  assert.match(account, /data-exgen-environment="pilot"\] #manageCard/);
  assert.match(account, /data-exgen-environment="pilot"\] #deleteAccountBtn/);
  assert.match(account, /id="pilotDeletionNotice"/);
  assert.match(account, /pilotDeletionNotice[\s\S]*mailto:elton\.rustaeus@gmail\.com\?subject=ExGen%20datafr%C3%A5ga/);
  assert.match(account, /Ingen tidsfrist eller fullständig dataradering utlovas här/);
  assert.match(account, /if\(!pilotMode\)loadMyClasses\(\)/);
});

test("the requested pilot feedback has a user-initiated route and warns against sending student data", async () => {
  const app = await readFile(`${ROOT}/app.html`, "utf8");
  assert.match(app, /id="betaFeedbackLink" href="mailto:elton\.rustaeus@gmail\.com\?subject=ExGen%20feedback"/);
  assert.match(app, /id="betaPrivacyHint"[^>]*>Skicka inte personuppgifter eller provsvar\./);
  assert.match(app, /Do not include personal data or exam answers\./);
});

test("P.E.R memory clearing discloses that profile facts are a separate store", async () => {
  const account = await readFile(`${ROOT}/konto.html`, "utf8");
  assert.match(account, /Rensar P\.E\.R:s sparade chatthistorik och långtidsminne/);
  assert.match(account, /Separata profiluppgifter kan finnas kvar och fortsätta anpassa svaren/);
  assert.match(account, /granska eller ta bort dem under Vad P\.E\.R\. vet om mig/);
  assert.match(account, /Separata profiluppgifter hanteras under Vad P\.E\.R\. vet om mig/);
});

test("student pilot authentication is login-only for pre-provisioned test accounts", async () => {
  const shared = await readFile(`${ROOT}/shared.js`, "utf8");
  assert.match(shared, /#pvToReg,#pvVR,#pvVW \.pv-dv,#pvVL \.pv-tg:not\(\[style\]\)/);
  assert.match(shared, /environment === 'pilot' && view === 'register'\) view = 'login'/);
  assert.match(shared, /SKOLPILOT · INBJUDNA TESTKONTON/);
});

test("pilot P.E.R requires an invited login and suppresses unvalidated readiness scoring", async () => {
  const shared = await readFile(`${ROOT}/shared.js`, "utf8");
  const unauthenticatedGuard = shared.indexOf("isLandingMode && EXGEN_RUNTIME.environment === 'pilot'");
  const landingQuota = shared.indexOf("// Landing quota gate");

  assert.ok(unauthenticatedGuard >= 0 && unauthenticatedGuard < landingQuota,
    "pilot visitors reach login guidance before local quota or anonymous API use");
  assert.match(shared, /if \(EXGEN_RUNTIME\.environment === 'pilot'\) return;\s+var hist/,
    "readiness-score nudge is absent from the pilot");
  assert.match(shared, /Logga in med skolpilotkonto/,
    "the pilot call to action does not invite public registration");
  assert.match(shared, /Din inloggning har gått ut\. Logga in igen med ditt skolpilotkonto/,
    "expired pilot sessions do not fall back to anonymous P.E.R");
});

test("student pilot bypasses the public maintenance gate without changing Production", async () => {
  const gate = await readFile(`${ROOT}/js/site-gate.js`, "utf8");
  assert.match(gate, /runtime\.environment === "pilot" \|\|[\s\S]*?runtime\.environment === "unconfigured" && localPreviewHost/);
  assert.match(gate, /\["localhost", "127\.0\.0\.1", "::1", "\[::1\]"\]/);
  assert.match(gate, /maintenance_gate/);
  assert.match(gate, /if \(!res\.ok\) \{ settle\(deny\)/);
});

test("production navigation and upload controls remain available", async () => {
  const shell = await readFile(`${ROOT}/js/exgen-shell.js`, "utf8");
  const flow = await readFile(`${ROOT}/js/exam-flow.js`, "utf8");
  assert.match(shell, /: NAV;/);
  assert.match(flow, /environment === "pilot"\)\) \{[\s\S]*?Fota en sida i stället/);
});
