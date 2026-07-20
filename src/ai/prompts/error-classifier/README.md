# error-classifier

Klassificerar elevfel mot en fast enum (uppdragets §29) — modellen får **inte** hitta på egna felkoder.

Enum-källa: `schemas/error-codes.json` (juridik-anpassad variant av mönstret som redan finns i `api/grade.js`s `error_tags`-enum för mockprov — se `docs/provia-knowledge-engine/03-ai-and-prompt-inventory.md` "Återanvändbart för V1").

```js
export default {
  version: "v1",
  systemPrompt: "...",              // listar exakt de tillåtna felkoderna, inget annat
  buildUserPrompt(ctx) { ... },     // ctx: { question, studentAnswer, correctAnswer, concept }
  outputSchema: errorClassificationSchema,
};
```

Skrivs i Fas 9.
