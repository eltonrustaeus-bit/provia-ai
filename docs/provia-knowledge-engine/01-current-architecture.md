# 01 — Current Architecture (verifierad)

Kondenserad syntes. Fullständigt underlag: `docs/current-system/repository-map.md`, `database-map.md`, `vercel-runtime-map.md`, `feature-flow-map.md`, `quota-and-billing-map.md`.

## Stack
Ren HTML/CSS/vanilla JS i repo-roten (11 sidor, ingen SPA-router) + 12 Vercel serverless-funktioner (`api/*.js`, Node.js 24.x, ingen Edge-runtime) + Supabase (Postgres 17.6, `mnmotdluigzeehdjbhbu`). Inget build-steg, ingen CI (`.github/workflows` saknas), inget testramverk (`npm test` finns inte). `@supabase/supabase-js` är enda produktionsberoendet.

## Frontend
Varje `.html`-fil är fristående, `shared.js` är den delade runtimen (auth-modal, Supabase-klient med hårdkodad publik anon-nyckel — avsett). `korkortet.html` (236 KB) är en dokumenterad legacy-monolit; `provia-hp.html` (Provia HP) är medvetet tunn och modulär (`js/hp-*.js`) som arkitektonisk reaktion på den kritiken.

## Backend (`api/`)
12 routade endpoints, **exakt vid Vercel Hobby-planens funktionstak** (bekräftat via kodkommentar i `api/hp.js`). Blandad modulsyntax (ESM för de flesta, CommonJS för `grade.js`/`ocr.js`) trots `package.json` saknar `"type":"module"` — fungerar via Vercels per-fil-transpilering, men är inkonsekvent stil. Två separata `requireAuth`-implementationer existerar (delad `_auth.js` + dupliceringar i CJS-filerna).

## Databas
28 tabeller i `public`-schemat. Endast 10 har spårad migration i repot (mest `hp_*` + `classes`/`class_members`); resterande 11 kärntabeller (`profiles`, `user_exams`, `driving_*`, `mock_results`, `per_*`, `question_reports`) skapades utanför migrationsflödet. **Live-verifierat under denna genomgång:** samtliga 28 tabeller har RLS aktiverat; policyerna är korrekta förutom en nu åtgärdad lucka på `profiles` (se `02-security-findings.md`). Se full tabellinventering i `04-database-and-rls.md`.

## Funktionsflöden
- **Provgenerering** (`generate-exam.js`): inklistrad text (max 3000 tecken) → ett AI-anrop med strikt JSON-schema (bara mc/short, ingen essä) → reviewer-pass → klienten sparar till `user_exams`.
- **P.E.R / "EX1.0"** (`explain.js` + `_per-core.js`/`_per-context.js`/`_per-memory.js`): sex lägen, kontext sanerad mot prompt-injection (utom en lucka, se Codex-fyndet i `02-security-findings.md`), kort- och långtidsminne i egna tabeller.
- **Rättning** (`grade.js`): MC deterministiskt (ingen AI), övrigt ett batchat AI-anrop med befintlig strukturerad feltaxonomi (`error_tags`-enum, 12 kategorier) — direkt återanvändbar för en framtida felbank/mastery-modell.
- **Förbättringsmodul**: ingen egen backend, ren klientaggregering av `user_exams`. Kör-teori-fel och provfel är idag två frikopplade system.
- **OCR** (`ocr.js`): OpenAI multimodal, ingen fillagring, Basic+/server-gated.
- **Kvoter**: 5 av 6 atomärt server-side (`SELECT...FOR UPDATE`-RPC:er, korrekt låsta). Ett undantag (gratis körkorts-kursfrågor, lågriskt eftersom frågebanken redan är klientexponerad).
- **Stripe**: signaturverifiering korrekt, men webhook saknar idempotency-nyckel på `event.id` (dubbla mail vid at-least-once-redelivery) och returnerar `200` vid interna DB-fel (ingen Stripe-retry vid misslyckad rolluppgradering).

## Vercel-runtime
Node.js 24.x, ingen edge-runtime, 7 funktioner på `maxDuration:60`, ingen region/cron-konfiguration, ingen extern loggningstjänst (bara `console.*` i 3/12 filer), ingen retry/backoff någonstans.

## AI-lager
Uteslutande OpenAI. `gpt-4o-mini` default, `gpt-4o` selektivt för kvantitativt innehåll (dokumenterad kod-kommentar: mini "reliably mislabels correct_index" på kvantitativa uppgifter). 17 distinkta produktions-anropsställen, alla server-side, ingen kostnadsloggning. Full detalj i `03-ai-and-prompt-inventory.md`.

## Avvikelser mot befintlig dokumentation
11 konkreta avvikelser identifierade mellan CLAUDE.md/AGENTS.md/.claude/ARCHITECTURE_MAP.md och verkligheten (mest döda filreferenser efter Hobby-plan-konsolideringen, samt en verklig kodbugg: `OPENAI_MODEL_MATH` vs `OPENAI_MATH_MODEL`). Full lista: `docs/current-system/repository-map.md` §11.
