# legal-verifier-blind

Uppdragets §25.1 — verifieraren löser frågan själv innan den ser generatorns facit.

Input: fråga, alternativ, relevanta källor, kursnivå, koncept. **Får inte** ta emot generatorns facit/förklaring/source IDs i denna prompt.

```js
export default {
  version: "v1",
  systemPrompt: "...",
  buildUserPrompt(ctx) { ... },     // ctx: { question, options, sourceChunks, level, concept }
  outputSchema: blindSolutionSchema,
};
```

**Bekräftat i Fas 1** (`docs/provia-knowledge-engine/10-open-questions.md` #6): `api/hp.js`s `verifyVerbal()`/`verifyFixedAlt()` skickar redan bara `{stem, options}` till modellen — aldrig `correct_index`. Kopiera det mönstret rakt av när denna prompt skrivs i Fas 5. `hp.js` rörs inte.

Skrivs i Fas 5.
