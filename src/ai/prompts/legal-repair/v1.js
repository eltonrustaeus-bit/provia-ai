// legal-repair v1 — uppdragets §25.4: MAX ETT repair-försök per fråga (räknas/spärras i
// api/knowledge.js, inte här). Får korrigera formulering/alternativ/facit/förklaring utifrån
// verifieringsresultatet. Får INTE byta koncept/topic/källa — sourceChunks som skickas in är
// exakt samma chunks som redan användes, inget nytt retrievalsteg. Efter repair körs HELA
// legal-verifier-blind + legal-verifier-compare igen (samma spärr som en nygenererad fråga).

function schema(questionType) {
  const props = {
    question: { type: "string", minLength: 10, maxLength: 1000 },
    correct_answer: { type: "array", minItems: 1, items: { type: "string" } },
    explanation: { type: "string", minLength: 10, maxLength: 2000 },
    difficulty: { type: "string", enum: ["E", "C", "A"] },
  };
  const required = ["question", "correct_answer", "explanation", "difficulty"];
  if (questionType === "multiple_choice") {
    required.push("options");
    props.options = {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text"],
        properties: {
          id: { type: "string", enum: ["A", "B", "C", "D", "E"] },
          text: { type: "string", minLength: 1, maxLength: 400 },
        },
      },
    };
  }
  return {
    type: "json_schema",
    name: "legal_repair_item",
    strict: true,
    schema: { type: "object", additionalProperties: false, required, properties: props },
  };
}

function systemPrompt(subjectLabel = "kursen") {
  return [
    `Du korrigerar EN provfråga (${subjectLabel}) utifrån en verifieringsrapport som pekar på konkreta brister.`,
    "Du får ENDAST ändra formulering, svarsalternativ, facit och förklaring — koncept, ämnesområde och källutdrag ligger fast.",
    "Åtgärda EXAKT de brister som verifieringsrapporten pekar på (unsupported_claims, contradictions, ambiguity, wrong_answer) — hitta inte på nya fakta utöver källutdragen.",
    "Om bristen inte går att fixa utan att byta källa/koncept: gör frågan smalare/enklare så den blir helt källgrundad, ändra aldrig vad källutdragen faktiskt säger.",
  ].join(" ");
}

function buildUserPrompt({ question, verificationResult, sourceChunks }) {
  const sources = sourceChunks
    .map((c, i) => `[KÄLLA ${i + 1}] (${c.section_ref ?? "okänd paragraf"}): ${c.content}`)
    .join("\n\n");
  return [
    `Ursprunglig fråga: ${JSON.stringify(question)}`,
    `Verifieringsrapport: ${JSON.stringify({
      factual_support: verificationResult.factual_support,
      citation_support: verificationResult.citation_support,
      ambiguity_score: verificationResult.ambiguity_score,
      unsupported_claims: verificationResult.unsupported_claims,
      contradictions: verificationResult.contradictions,
      failure_codes: verificationResult.failure_codes,
    })}`,
    "",
    "Källutdrag (oförändrade, får inte bytas):",
    sources,
  ].join("\n");
}

export default {
  version: "v1",
  systemPrompt,
  buildUserPrompt,
  outputSchema: schema,
};
