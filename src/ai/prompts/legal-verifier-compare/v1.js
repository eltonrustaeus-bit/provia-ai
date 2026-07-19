// legal-verifier-compare v1 — uppdragets §25.2/§25.3: jämför generatorns facit/förklaring mot
// resultatet från legal-verifier-blind. Modellen SER här generatorns facit (skillnaden mot
// legal-verifier-blind är just poängen med detta steg) och bedömer kvalitativa dimensioner som
// kod inte kan avgöra deterministiskt. För `multiple_choice` beräknas den faktiska matchningen
// ÄNDÅ deterministiskt i src/generation/legal-generation.mjs (jämför independent_answer mot
// generatorns facit i kod, samma princip som hp.js:s `res[i].index === q.correct_index`) — men
// för `short_answer` är exakt strängmatchning meningslös (två sakligt likvärdiga fritextsvar är
// nästan aldrig identiska strängar), så `semantic_equivalent_to_generator` här är den signal
// legal-generation.mjs använder istället för den frågetypen (Fas 8.2-kalibrering). Samma för
// `recommended_action`: modellens förslag är en signal, den FAKTISKA
// PASS/REPAIR/REJECT/MANUAL_REVIEW-logiken (§25.4) är deterministisk kod, se
// schemas/question-verification.schema.json:s beskrivning av fältet.

function schema() {
  return {
    type: "json_schema",
    name: "legal_verifier_compare",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "factual_support",
        "citation_support",
        "ambiguity_score",
        "course_alignment",
        "difficulty_alignment",
        "unsupported_claims",
        "contradictions",
        "failure_codes",
        "repairable",
        "recommended_action",
        "semantic_equivalent_to_generator",
      ],
      properties: {
        semantic_equivalent_to_generator: {
          type: "boolean",
          description:
            "Är den oberoende blinda lösningen sakligt likvärdig med generatorns facit, ÄVEN OM ordalydelsen skiljer sig? Avgörande för short_answer-frågor, där exakt strängmatchning inte fångar detta.",
        },
        factual_support: { type: "number", minimum: 0, maximum: 1 },
        citation_support: { type: "number", minimum: 0, maximum: 1 },
        ambiguity_score: { type: "number", minimum: 0, maximum: 1 },
        course_alignment: { type: "number", minimum: 0, maximum: 1 },
        difficulty_alignment: { type: "number", minimum: 0, maximum: 1 },
        unsupported_claims: { type: "array", items: { type: "string" } },
        contradictions: { type: "array", items: { type: "string" } },
        failure_codes: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "WRONG_ANSWER",
              "MULTIPLE_DEFENSIBLE_ANSWERS",
              "FABRICATED_SOURCE",
              "OUTDATED_RULE",
              "MISSING_CONDITION",
              "WRONG_DIFFICULTY",
              "INSUFFICIENT_EVIDENCE",
              "AMBIGUOUS_PHRASING",
            ],
          },
        },
        repairable: { type: "boolean" },
        recommended_action: { type: "string", enum: ["publish", "repair", "reject", "manual_review"] },
      },
    },
  };
}

function systemPrompt() {
  return [
    "Du granskar en juridisk provfrågas facit mot källutdragen och mot en oberoende blind lösning.",
    "semantic_equivalent_to_generator: sätt true om den oberoende blinda lösningen uttrycker SAMMA juridiska sakinnehåll som generatorns facit, även om formuleringen skiljer sig (t.ex. två olika fritextsvar som båda korrekt beskriver samma regel). Sätt false om de säger olika saker i sak, inte bara olika ordval. Detta är särskilt viktigt för fritextsvar (short_answer), där ordagrann matchning aldrig kan avgöra detta.",
    "factual_support (0-1): hur väl stöds generatorns facit av källutdragen (1=fullt stött, 0=inget stöd/motsagt).",
    "citation_support (0-1): hur väl pekar explanation på rätt källutdrag/paragraf.",
    "ambiguity_score (0-1): hur tvetydig frågan är (1=mycket tvetydig/flera försvarbara svar).",
    "course_alignment (0-1): hur väl frågan matchar det angivna konceptet/kursen.",
    "difficulty_alignment (0-1): hur väl den faktiska svårighetsgraden matchar den avsedda.",
    "unsupported_claims: konkreta påståenden i frågan/förklaringen som INTE finns i källutdragen.",
    "contradictions: konkreta motsägelser mellan generatorns facit och källutdragen ELLER mot den blinda lösningen.",
    "failure_codes: välj bara från den givna listan, hitta inte på egna koder.",
    "repairable=true bara om felet är en formulerings-/precisionsbrist som kan fixas utan att byta koncept/källa.",
    "recommended_action är ditt förslag — den slutgiltiga logiken avgörs av annan kod, var ändå ärlig och konservativ (hellre manual_review än publish vid minsta osäkerhet).",
  ].join(" ");
}

function buildUserPrompt({ question, generatorAnswer, generatorExplanation, sourceChunks, blindResult, level, concept }) {
  const sources = sourceChunks
    .map((c, i) => `[KÄLLA ${i + 1}] (${c.section_ref ?? "okänd paragraf"}): ${c.content}`)
    .join("\n\n");
  return [
    `Koncept: ${concept}. Kursnivå: ${level}.`,
    `Fråga: ${question}`,
    `Generatorns facit: ${JSON.stringify(generatorAnswer)}`,
    `Generatorns förklaring: ${generatorExplanation}`,
    `Oberoende blind lösning: ${JSON.stringify(blindResult.independent_answer)} (can_answer_from_sources=${blindResult.can_answer_from_sources}, clean=${blindResult.clean})`,
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
