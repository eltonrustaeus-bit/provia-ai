# legal-generator

Genererar juridikfrågor i batcher (3–5, uppdragets §23) från retrieved chunks.

Varje versionerad fil (`v1.js`, ...) exporterar:

```js
export default {
  version: "v1",
  systemPrompt: "...",              // tillåtna källor, output-schema, abstain-regel, säkerhetsregler
  buildUserPrompt(ctx) { ... },     // ctx: { concept, sourceChunks, difficulty, questionType }
  outputSchema: examQuestionBatchSchema, // se schemas/exam-question.schema.json
};
```

Skrivs i Fas 5. Denna fil är kontraktsdokumentation, inte implementation.
