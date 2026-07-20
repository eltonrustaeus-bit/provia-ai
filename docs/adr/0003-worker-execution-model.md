# ADR 0003 — Jobbsteg körs synkront inom Vercel-requests, ingen kö-tjänst i V1

Status: Beslutad (2026-07-18)

## Kontext

Uppdragets §13 vill ha en jobbmodell (queued → planning → retrieving → generating → validating → verifying → repairing → assembling → completed) med retry och progress. Verifierat i `docs/current-system/vercel-runtime-map.md` §9: repot har **inget** `waitUntil`/bakgrundskörningsmönster, inga köer, inga Edge Functions. Alla `api/*.js`-funktioner är request/response, `maxDuration` upp till 60s. `api/hp.js` visar det enda befintliga mönstret för en tung, tidskrävande AI-operation i denna stack: en synkron 40–45s-request per genereringssteg, med kvot-RPC:er som skyddar mot upprepade anrop.

Uppdragets §13.2 kräver att en ny betald jobbtjänst bara läggs till om befintlig stack bevisligen inte räcker — inte i förväg.

## Beslut

**V1 kör varje pipeline-steg synkront inom en enskild `api/knowledge.js`-request**, precis som `hp.js` redan gör för sina genereringsanrop. `generation_jobs`-tabellen (se `schemas/generation-job.schema.json`) används för att **spåra** status/progress mellan steg, inte för att driva asynkron exekvering:

- Klienten anropar `api/knowledge.js` med `op: "blueprint"` → svar med `job_id` + blueprint.
- Klienten anropar samma endpoint igen med `op: "generate", job_id` för nästa batch (3–5 frågor, §23) → uppdaterar jobbets progress-fält, returnerar batchen.
- Vid fel/timeout kan klienten anropa igen med samma `job_id` — steget är idempotent (unik constraint på `(job_id, batch_index)` i `exam_questions`, inte en ny AI-generering av redan lagrade frågor).

Detta är alltså ett **klientstyrt polling/steg-för-steg-mönster**, inte en serverdriven bakgrundskö.

## Konsekvenser

- Ingen ny infrastruktur, inga nya driftskostnader, matchar exakt vad `hp.js` redan bevisat fungerar i produktion.
- Begränsning: en klient som stänger fliken mitt i ett flerstegsflöde lämnar jobbet i ett mellanläge (`partially_completed`) tills den återvänder eller jobbet städas — acceptabelt för V1:s pilotvolym, men ska mätas (§35 Gate E/F) innan bredare utrullning.
- Om pilotens frågevolym per prov (§9: 50–75 gold-set-frågor, betydligt mindre per enskilt elevprov) visar sig kräva fler/längre AI-anrop än vad ett 60s-fönster tillåter i praktiken, omprövas ADR 0001s alternativ (B)/(C) — inte innan.
- `idempotency_key` (uppdragets §13.1-fält) sätts av klienten per steg-anrop för att skydda mot dubbla submits, samma mönster som `stemHash()`-dedupliceringen i `hp.js` redan använder för att undvika dubbletter.
