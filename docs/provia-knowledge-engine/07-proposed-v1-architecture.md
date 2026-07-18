# 07 — Proposed V1 Architecture (till repot anpassad)

Detta dokument justerar uppdragets §12–§34-arkitektur mot vad som faktiskt är sant om denna kodbas (se `01`–`06`). Det är ett förslag för Fas 1-godkännande, inte kod.

## 1. Det viktigaste arkitekturbeslutet: hosting för ny serverlogik

**Vercel-projektet är sannolikt redan vid sitt Hobby-plans 12-funktionstak** (starkt indicium: exakt 12 routade `api/*.js`-filer + en kodkommentar i `hp.js` som uttryckligen förklarar varför HP konsoliderades till en fil). Det betyder att knowledge engine-arbetet **inte kan** lägga till fristående nya `api/*.js`-filer per pipeline-steg (generate/verify/retrieve etc.) utan att antingen:

- **(A) Konsolidera i en ny multiplexad router**, exakt `hp.js`-mönstret: en fil `api/knowledge.js` med intern `body.op`-dispatch (`retrieve`/`generate`/`verify`/`blueprint`/...). Minst risk, inga nya beroenden, matchar befintlig arkitektur rakt av.
- **(B) Flytta ny serverlogik till Supabase Edge Functions** (helt oanvänd yta idag, `supabase/functions/` finns inte). Kräver Deno-kunskap i teamet, en ny deploy-pipeline, men frigör Vercel-funktionsbudgeten helt.
- **(C) Uppgradera Vercel-kontot till Pro** (löser taket direkt, kostar pengar, enklast).

**Rekommendation: (A) för Fas 1–5, ompröva (B)/(C) om pipelinen växer bortom vad en enda router rimligen kan hantera.** Detta är en öppen fråga för ditt beslut — se `10-open-questions.md` #1.

## 2. Pilotområde

Följ uppdragets §9 rakt av: **Juridik/Privatjuridik**, med **Avtalsrätt och konsumenträtt** som första delområde, krympt vid behov till anbud/accept, fullmakt, underårigas rättshandlingsförmåga, konsumentköp/reklamation. Inget i kodbasen motsäger detta val — det är ett helt nytt ämnesområde, ingen befintlig `driving_*`/`hp_*`-data att bygga vidare på eller riskera att kollidera med.

## 3. Databasmodell — anpassad till repots mönster

Uppdragets §14-tabeller (`knowledge_sources`, `knowledge_documents`, `knowledge_chunks`, `concepts`, `chunk_concepts`, `exam_blueprints`, `exam_questions`, `question_verifications`, `generation_jobs`, `student_error_events`, `student_mastery`, `ai_usage_events`, `feature_flags`) behålls som utgångspunkt, med dessa justeringar:

- **RLS-mönster:** kopiera `hp_mastery`/`hp_attempts` exakt — `user_id uuid not null references auth.users(id) on delete cascade` + `create policy X_owner on public.X for all using(user_id=auth.uid()) with check(user_id=auth.uid())`. Detta är det enda mönstret i repot med bevisad historik (en verklig läcka, upptäckt, fixad).
- **Referensdata utan `user_id`** (`knowledge_sources`, `knowledge_chunks`, `concepts`, `exam_questions`, `question_verifications`): följ `hp_normering`/`hp_ord_lexicon`-mönstret — RLS PÅ, **ingen policy**, service_role-only. Ingen klient ska någonsin läsa dessa direkt; all åtkomst går via `api/knowledge.js`.
- **`ai_usage_events`:** bygg denna FÖRST, oavsett resten av tidsplanen (se `05-cost-baseline.md`) — den ger värde för hela plattformen, inte bara juridik-piloten, och kräver ingen AI-pipeline för att vara användbar.
- **`generation_jobs`:** eftersom Vercel-funktioner är request/response (ingen `waitUntil`/bakgrundskörning existerar idag i repot, bekräftat i `vercel-runtime-map.md` §9), måste jobbstegen antingen (a) köras synkront inom en enda `maxDuration:60`-request per steg (som `hp.js` redan gör för sina 40s-genereringar), eller (b) polling-baserat med klienten som triggar nästa steg. **Ingen kölösning finns idag** — bygg inte en ny betald jobbtjänst utan att först testa om (a) räcker för pilotens volym, i linje med uppdragets §13.2.

## 4. Modellrouting

Återanvänd befintlig `_per-core.js:callAI()`-funktion och dess `/v1/responses` + JSON Schema strict mode-mönster rakt av — det är redan precis vad uppdragets §23/§26 efterfrågar. Lägg **inte** till en ny AI-abstraktion (uppdragets §40 varnar uttryckligen mot detta); `callAI()` är redan det minimala stabila interfacet.

- **Billig modell:** `gpt-4o-mini` (redan default via `OPENAI_MODEL`).
- **Stark modell:** `gpt-4o` för juridisk verifiering — samma mönster som HP:s kvantitativa routing (`OPENAI_MATH_MODEL`), men en ny egen env-variabel (t.ex. `OPENAI_LEGAL_VERIFY_MODEL`) för att undvika att upprepa `OPENAI_MODEL_MATH`/`OPENAI_MATH_MODEL`-namngivningsbuggen som redan finns i kodbasen (se `01-current-architecture.md`).

## 5. Verifieringsmotor — återanvänd HP:s mönster

`api/hp.js`s generator+verifierare-par (oberoende lösning → jämförelse → fail-open/kasta vid avvikelse) är den mest direkta befintliga implementationen av uppdragets §25. Studera `generateOrd()`/`verifyVerbal()` i `hp.js` som startpunkt för `generateLegalQuestion()`/`verifyLegalQuestion()` innan ni designar från grunden. Viktig skillnad mot HP: uppdraget kräver **blind lösning innan** verifieraren ser generatorns facit (§25.1) — HP:s nuvarande verifierare-prompter bör kontrolleras i Fas 1 för om de redan gör detta eller om de får facit direkt (inte verifierat i denna Fas 0-genomgång, flaggas som öppen fråga).

## 6. Prompt-injection-skydd

Bygg juridikläget på `_per-context.js`s saneringsmönster (`BLOCKED_CONTEXT_REGEX`), **inte** på `_per-memory.js`s mönster (som Codex identifierade som osanerat, se `02-security-findings.md` §4). Detta är den konkreta, redan-i-repot-existerande skillnaden mellan "rätt" och "fel" på denna punkt.

## 7. Feature flags

Repot har ingen `feature_flags`-tabell eller motsvarande mekanism idag — `HP_PUBLIC`-mönstret (en enkel env-variabel + hårdkodad `OWNER_ID`-jämförelse) är den enda befintliga "feature flag" i kodbasen. Bygg uppdragets §14.12-tabell från grunden; det finns inget att återanvända, men mönstret (server-side kontrollerad, aldrig klient-litad) är redan etablerat via `HP_PUBLIC`.

## 8. Vad som INTE ska byggas (bekräftat inget existerande att kollidera med)

Matematikmotor, full Curriculum Graph, IRT/BKT, semantisk cache, reranker-infrastruktur — inget av detta finns i repot idag i någon form, så uppdragets §8-avgränsningar kräver ingen extra försiktighet utöver att inte börja bygga dem.
