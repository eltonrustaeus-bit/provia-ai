// Turns raw journey observations into realistic, in-character feedback via
// OpenAI (gpt-4o-mini — same model the app uses). Output is strict JSON so
// the report writer can aggregate across personas.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

function buildStepDigest(observation) {
  const lines = [];
  for (const s of observation.steps) {
    lines.push(`### Steg: ${s.name}  (${s.ok ? "genomfört" : "MISSLYCKADES"}, ${Math.round(s.durationMs / 100) / 10}s)`);
    if (s.note) lines.push(`Interaktion/utfall: ${s.note}`);
    lines.push(`Vad användaren såg (utdrag):\n${(s.visibleText || "(tom sida)").slice(0, 1500)}`);
    lines.push("");
  }
  const errs = observation.consoleErrors.slice(0, 15).map((e) => `- [${e.step}] ${e.text}`);
  const httpe = observation.httpErrors.slice(0, 15).map((e) => `- [${e.step}] ${e.status} ${e.url}`);
  const reqf = observation.failedRequests.slice(0, 10).map((e) => `- [${e.step}] ${e.reason} ${e.url}`);
  return { steps: lines.join("\n"), errs, httpe, reqf };
}

const SYSTEM = `Du är en testanvändare som just provat en svensk pluggapp (Provia — AI-drivna prov för matte + körkortsteori för gymnasie-/högstadieelever).
Du agerar STRIKT i din tilldelade personas röst, ålder och tålamodsnivå. Var ärlig och kritisk — smickra inte appen.
Du får en logg över exakt vad du såg och gjorde, plus tekniska fel som inträffade i bakgrunden (console-fel, HTTP-fel). Tekniska fel som blockerade dig SKA sänka ditt omdöme.
Svara ENDAST med giltig JSON enligt schemat. Skriv på svenska, i personans ton (tonåring = tonårston).`;

function buildUserPrompt(persona, digest) {
  return `PERSONA:
Namn: ${persona.name}, ${persona.age} år
Roll: ${persona.role}
Mål: ${persona.goal}
Enhet: ${persona.device}
Tålamod: ${persona.patience}
Betalningsvilja: ${persona.willingnessToPay}
Personlighet: ${persona.personality}

VAD SOM HÄNDE UNDER TESTET:
${digest.steps}

TEKNISKA FEL I BAKGRUNDEN (användaren ser inte dessa direkt men de kan ha brutit flödet):
Console-fel:
${digest.errs.length ? digest.errs.join("\n") : "- inga"}
HTTP-fel:
${digest.httpe.length ? digest.httpe.join("\n") : "- inga"}
Nätverksfel:
${digest.reqf.length ? digest.reqf.join("\n") : "- inga"}

Svara med JSON:
{
  "firstImpression": "1-2 meningar, i din röst",
  "frictionPoints": ["konkreta ställen du fastnade/irriterades"],
  "bugsNoticed": ["saker som verkade trasiga ur ditt perspektiv"],
  "confusedMoments": ["vad som var otydligt"],
  "favoriteThing": "det bästa",
  "biggestBlocker": "det värsta som hindrade dig",
  "wouldPay": true/false,
  "wouldPayReason": "varför/varför inte, koppla till din betalningsvilja",
  "verbatimQuotes": ["2-4 citat exakt som du skulle sagt dem"],
  "rating": 1-5
}`;
}

export async function generateFeedback(persona, observation, apiKey) {
  const digest = buildStepDigest(observation);
  const body = {
    model: MODEL,
    temperature: 0.9,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: buildUserPrompt(persona, digest) },
    ],
  };
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { firstImpression: "(kunde inte tolka svar)", raw: content };
  }
  // Hard technical signal, independent of the LLM's read:
  parsed._tech = {
    consoleErrors: observation.consoleErrors.length,
    httpErrors: observation.httpErrors.length,
    failedRequests: observation.failedRequests.length,
    signupOk: observation.steps.find((s) => s.name === "signup")?.ok ?? null,
  };
  return parsed;
}
