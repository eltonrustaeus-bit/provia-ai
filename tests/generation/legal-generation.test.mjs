// Testar den DETERMINISTISKA beslutslogiken i src/generation/legal-generation.mjs
// (deterministicDecision) — den säkerhetskritiska delen av §25.4 som INTE får lita blint på
// modellens egna recommended_action-förslag. Rena funktionsanrop, inget nätverk/DB krävs.
//   node tests/generation/legal-generation.test.mjs

import assert from "node:assert/strict";
import { deterministicDecision } from "../../src/generation/legal-generation.mjs";

let failures = 0;
const ok = (name) => console.log(`  PASS  ${name}`);
const fail = (name, err) => {
  failures++;
  console.error(`  FAIL  ${name}\n        ${err?.message || err}`);
};
function check(name, fn) {
  try {
    fn();
    ok(name);
  } catch (e) {
    fail(name, e);
  }
}

const goodCompare = {
  factual_support: 0.9,
  citation_support: 0.9,
  ambiguity_score: 0.1,
  contradictions: [],
  unsupported_claims: [],
  repairable: true,
};

check("publish när allt är bra och facit matchar", () => {
  const action = deterministicDecision({ canAnswerFromSources: true, generatorAnswerMatches: true, compareResult: goodCompare });
  assert.equal(action, "publish");
});

check("manual_review när blind verifierare inte kan svara alls (insufficient evidence)", () => {
  const action = deterministicDecision({ canAnswerFromSources: false, generatorAnswerMatches: true, compareResult: goodCompare });
  assert.equal(action, "manual_review");
});

check("repair när facit INTE matchar men reparerbart", () => {
  const action = deterministicDecision({ canAnswerFromSources: true, generatorAnswerMatches: false, compareResult: { ...goodCompare, repairable: true } });
  assert.equal(action, "repair");
});

check("reject när facit INTE matchar och EJ reparerbart", () => {
  const action = deterministicDecision({ canAnswerFromSources: true, generatorAnswerMatches: false, compareResult: { ...goodCompare, repairable: false } });
  assert.equal(action, "reject");
});

check("repair när factual_support är lågt (< 0.7) men reparerbart", () => {
  const action = deterministicDecision({
    canAnswerFromSources: true,
    generatorAnswerMatches: true,
    compareResult: { ...goodCompare, factual_support: 0.5, repairable: true },
  });
  assert.equal(action, "repair");
});

check("reject när citation_support är lågt (< 0.7) och EJ reparerbart", () => {
  const action = deterministicDecision({
    canAnswerFromSources: true,
    generatorAnswerMatches: true,
    compareResult: { ...goodCompare, citation_support: 0.3, repairable: false },
  });
  assert.equal(action, "reject");
});

check("manual_review när ambiguity_score är högt (> 0.5), oavsett repairable", () => {
  const action = deterministicDecision({
    canAnswerFromSources: true,
    generatorAnswerMatches: true,
    compareResult: { ...goodCompare, ambiguity_score: 0.8, repairable: true },
  });
  assert.equal(action, "manual_review");
});

check("repair när det finns unsupported_claims men reparerbart", () => {
  const action = deterministicDecision({
    canAnswerFromSources: true,
    generatorAnswerMatches: true,
    compareResult: { ...goodCompare, unsupported_claims: ["påstående utan källa"], repairable: true },
  });
  assert.equal(action, "repair");
});

check("manual_review när det finns contradictions och EJ reparerbart", () => {
  const action = deterministicDecision({
    canAnswerFromSources: true,
    generatorAnswerMatches: true,
    compareResult: { ...goodCompare, contradictions: ["motsäger källan"], repairable: false },
  });
  assert.equal(action, "manual_review");
});

check("modellens EGEN recommended_action-nyckel (om den fanns i compareResult) påverkar INTE beslutet", () => {
  // compareResult ska inte ens ha recommended_action i denna funktions kontrakt — bekräftar att
  // deterministicDecision() inte läser något sådant fält, bara de kvalitativa poängen/flaggorna.
  const withFakeField = { ...goodCompare, recommended_action: "reject" };
  const action = deterministicDecision({ canAnswerFromSources: true, generatorAnswerMatches: true, compareResult: withFakeField });
  assert.equal(action, "publish", "ett eventuellt recommended_action-fält i compareResult ska ignoreras helt");
});

console.log(`\n${failures === 0 ? "Alla" : failures + " av"} kontroller klara.`);
if (failures > 0) process.exit(1);
