# legal-repair

Uppdragets §25.4 — maximalt ett repair-försök per fråga. Får korrigera formulering/alternativ/facit/förklaring. Får **inte** byta koncept/topic/källa utan nytt retrievalsteg.

```js
export default {
  version: "v1",
  systemPrompt: "...",
  buildUserPrompt(ctx) { ... },     // ctx: { question, verificationResult, sourceChunks }
  outputSchema: examQuestionSchema, // samma schema som legal-generator, en fråga
};
```

Efter repair körs hela `legal-verifier-blind` + `legal-verifier-compare` igen (§25.4). Skrivs i Fas 5.
