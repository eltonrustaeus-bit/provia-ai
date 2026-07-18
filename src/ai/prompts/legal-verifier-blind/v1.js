// legal-verifier-blind v1 — uppdragets §25.1: verifieraren löser frågan SJÄLV innan den ser
// generatorns facit. Får ALDRIG ta emot correct_answer/explanation/source_chunk_ids i denna
// prompt — bara {question, options, sourceChunks, level, concept}, exakt samma princip som
// api/hp.js:s verifyVerbal() (bekräftad korrekt i Fas 1, se 10-open-questions.md #6). Jämförelsen
// mot generatorns facit sker i JS-kod i api/knowledge.js, INTE här och INTE av modellen.

function schema() {
  return {
    type: "json_schema",
    name: "legal_verifier_blind",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["independent_answer", "can_answer_from_sources", "clean"],
      properties: {
        independent_answer: {
          description: "Verifierarens egen lösning — option-id:n för multiple_choice, fritextsvar för short_answer.",
          type: "array",
          items: { type: "string" },
        },
        can_answer_from_sources: {
          description: "false om källutdragen inte räcker för att avgöra svaret alls (§25.1 abstain).",
          type: "boolean",
        },
        clean: {
          description: "false vid stavfel/oklar formulering, flera försvarbara svar, eller otydligt format.",
          type: "boolean",
        },
      },
    },
  };
}

function systemPrompt(level, concept) {
  return [
    "Du är en sträng, oberoende granskare av juridiska provfrågor (Privatjuridik, svensk gymnasieskola).",
    `Koncept: ${concept}. Kursnivå: ${level}.`,
    "Lös frågan SJÄLV utifrån ENDAST de bifogade källutdragen — du får inte facit, bara frågan/alternativen och källorna.",
    "Om källutdragen inte räcker för att avgöra ett svar med rimlig säkerhet: sätt can_answer_from_sources=false och independent_answer=[].",
    "Sätt clean=false om frågan har stavfel/grammatikfel, flera försvarbara svarsalternativ, eller är otydligt formulerad. Var petig.",
  ].join(" ");
}

function buildUserPrompt({ question, options, sourceChunks, level, concept }) {
  const sources = sourceChunks
    .map((c, i) => `[KÄLLA ${i + 1}] (${c.section_ref ?? "okänd paragraf"}): ${c.content}`)
    .join("\n\n");
  const payload = { question, options: options ?? null };
  return [
    JSON.stringify(payload),
    "",
    "Källutdrag:",
    sources,
  ].join("\n");
}

export default {
  version: "v1",
  systemPrompt,
  buildUserPrompt,
  outputSchema: schema,
};
