# legal-verifier-compare

Uppdragets §25.2 — jämför generatorns facit/förklaring/source IDs mot resultatet från `legal-verifier-blind`.

```js
export default {
  version: "v1",
  systemPrompt: "...",
  buildUserPrompt(ctx) { ... },     // ctx: { question, generatorAnswer, generatorExplanation, sourceIds, blindResult }
  outputSchema: verificationResultSchema, // se schemas/question-verification.schema.json
};
```

Output matchar `question_verifications`-tabellens fält (§25.3): `factual_support`, `citation_support`, `ambiguity_score`, `course_alignment`, `difficulty_alignment`, `unsupported_claims`, `contradictions`, `failure_codes`, `repairable`, `recommended_action`.

Skrivs i Fas 5.
