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

Verifieraren ska bara få frågan, alternativen och källorna — aldrig generatorns facit, förklaring eller käll-ID:n. Jämförelsen mot facit sker först efter den blinda lösningen.

Skrivs i Fas 5.
