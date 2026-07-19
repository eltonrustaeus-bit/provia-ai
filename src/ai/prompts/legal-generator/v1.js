// legal-generator v1 — genererar provfrågor i batcher från retrieved chunks (uppdragets §23).
// Trots namnet (kvar från Fas 5, då bara juridik/Privatjuridik fanns) är denna modul
// ÄMNESGENERELL sedan generaliseringen: subjectLabel skickas in av anropande kod
// (src/generation/legal-generation.mjs, byggd från concepts.subject/course i databasen) — inget
// härdkodat "juridik"/"Privatjuridik" kvar i själva prompten. Filnamnet/mappnamnet döps om i en
// separat, ren cleanup-commit senare (risk/nytta motiverar inte det just nu).
// Tillåtna källor: ENDAST ctx.sourceChunks (text hämtad via retrieveChunks(), se
// src/retrieval/legal-retrieval.mjs). Abstain-regel: modellen får INTE hitta på fakta som inte
// finns i sourceChunks — om källorna inte räcker för att fylla n frågor ska den hellre returnera
// färre (schema tillåter inte det här — se batchSchema minItems=maxItems=n — så vid otillräckliga
// källor ska anropande kod (api/knowledge.js) minska n eller hämta fler chunks INNAN anrop, inte
// låta modellen fylla på med påhitt).
// Säkerhetsregel: modellen returnerar bara sina egna fält (question/options/correct_answer/
// explanation/difficulty) — concept_ids/source_chunk_ids/curriculum_refs sätts av anropande kod
// (redan kända från retrieval-steget), samma mönster som hp.js:s generateOrd/generateXyz.

function batchSchema(n, questionType) {
  const base = {
    type: "object",
    additionalProperties: false,
    required: ["question", "correct_answer", "explanation", "difficulty"],
    properties: {
      question: { type: "string", minLength: 10, maxLength: 1000 },
      correct_answer: { type: "array", minItems: 1, items: { type: "string" } },
      explanation: { type: "string", minLength: 10, maxLength: 2000 },
      difficulty: { type: "string", enum: ["E", "C", "A"] },
    },
  };
  if (questionType === "multiple_choice") {
    base.required.push("options");
    base.properties.options = {
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
    name: "legal_generator_batch",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["items"],
      properties: {
        items: { type: "array", minItems: n, maxItems: n, items: base },
      },
    },
  };
}

function systemPrompt(questionType, difficulty, subjectLabel = "kursen") {
  return [
    `Du skapar provfrågor för ${subjectLabel}.`,
    "Du får ENDAST använda fakta som uttryckligen finns i de bifogade källutdragen (kursmaterial/ämnesplan).",
    "Hitta ALDRIG på fakta, definitioner, formler, årtal eller regler som inte står i källutdragen.",
    "Om källutdragen inte räcker för att ställa en meningsfull fråga: skriv en enklare fråga som ändå är helt källgrundad, sänk aldrig kraven på källgrundning.",
    questionType === "multiple_choice"
      ? "Varje fråga har 3-5 svarsalternativ (options), exakt ETT eller FLERA är korrekta (correct_answer anger option-id:n)."
      : "Varje fråga är en kort fritextfråga (short_answer) — correct_answer är en array med ETT fritext-facit.",
    `Svårighetsgrad: sikta på ${difficulty} (E=grundläggande faktafråga, C=tillämpning på ett scenario, A=nyansfråga/gränsdragning/jämförelse).`,
    "explanation ska citera eller tydligt referera vilket källutdrag svaret grundar sig på.",
    "Svenska. Original formulering — kopiera inte källtexten rakt av som frågetext, men citat i explanation är tillåtet.",
  ].join(" ");
}

function buildUserPrompt({ concept, sourceChunks, questionType, count }) {
  const sources = sourceChunks
    .map((c, i) => `[KÄLLA ${i + 1}] (${c.section_ref ?? "okänd paragraf"}): ${c.content}`)
    .join("\n\n");
  return [
    `Koncept: ${concept}`,
    `Skapa ${count} ${questionType === "multiple_choice" ? "flervalsfrågor" : "fritextfrågor"}.`,
    "",
    "Källutdrag (använd ENDAST dessa fakta):",
    sources,
  ].join("\n");
}

export default {
  version: "v1",
  systemPrompt,
  buildUserPrompt,
  outputSchema: batchSchema,
};
