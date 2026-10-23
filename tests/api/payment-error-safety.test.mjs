import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const checkout = await readFile(new URL("../../api/create-checkout-session.js", import.meta.url), "utf8");
const roleApi = await readFile(new URL("../../api/check-role.js", import.meta.url), "utf8");
const generator = await readFile(new URL("../../api/generate-exam.js", import.meta.url), "utf8");

assert.doesNotMatch(checkout, /details:\s*cust\b/, "Stripe customer error payloads are not returned to users");
assert.match(checkout, /customer_creation_failed[\s\S]*?Betalningen kunde inte startas/, "customer creation failure has a stable, generic client response");
assert.doesNotMatch(checkout, /JSON\.stringify\(session\)/, "raw Stripe checkout errors are not copied into server logs");

const portalStart = roleApi.indexOf('if (action === "portal")');
const portalEnd = roleApi.indexOf("// Cancel Stripe subscription", portalStart);
const portalRoute = roleApi.slice(portalStart, portalEnd);
assert.doesNotMatch(portalRoute, /details:\s*portalSession\b/);
assert.match(portalRoute, /portal_unavailable[\s\S]*?Kunde inte öppna betalningsportalen/);

const cancelStart = roleApi.indexOf('if (action === "cancel_sub")');
const cancelEnd = roleApi.indexOf('if (action === "delete_exams")', cancelStart);
const cancelRoute = roleApi.slice(cancelStart, cancelEnd);
assert.doesNotMatch(cancelRoute, /details:\s*result\b/);
assert.match(cancelRoute, /cancellation_failed[\s\S]*?Prenumerationen kunde inte avslutas/);

const quotaStart = generator.indexOf("  let quota;\n  let focusInstruction = \"\";");
const quotaEnd = generator.indexOf("if (!quota.ok)", quotaStart);
const quotaRoute = generator.slice(quotaStart, quotaEnd);
assert.match(quotaRoute, /catch\s*\{[\s\S]*?await examGenerationOperations\.failGeneration\([\s\S]*?return json\(res, 503/,
  "an ambiguous reservation error is reconciled through its fenced generation operation before returning a generic response");
assert.doesNotMatch(quotaRoute, /details:|String\(e\)|e\.details/);

console.log("payment error safety: provider payloads are not exposed to clients");
