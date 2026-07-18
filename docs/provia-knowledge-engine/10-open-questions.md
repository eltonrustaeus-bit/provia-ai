# 10 — Open Questions

Frågor som inte kunde avgöras från repot — **besvarade av produktägaren 2026-07-18.**

## 1. Hosting för ny serverlogik — BESLUTAT

**Konsolidera i en ny `api/knowledge.js`-router** (hp.js-mönstret, `body.op`-dispatch). Ingen ny betald infrastruktur, inget Edge Functions-arbete i V1.

## 2. Rättighetsstatus för juridiskt källmaterial — BESLUTAT

**Börja med fri lagtext + Skolverkets ämnesplaner** — inga rättighetsfrågor, täcker grunden för piloten. Inga läromedel/kommersiellt material identifierat än; om sådant tillkommer senare ska det gå igenom uppdragets §17-process (`license_status` dokumenterad innan produktionsanvändning) separat.

## 3. Codex HIGH-fyndet (`_per-memory.js`) — BESLUTAT

**Fixas nu**, som fristående uppgift, oberoende av Fas 1. Se genomförande i huvudkonversationen/commit-historik.

## 4. Icke-blockerande buggar — BESLUTAT

**Samlas som egen liten uppföljnings-PR**, separat från knowledge-engine-arbetet:
- Stripe webhook `event.id`-idempotens
- Webhook `200`-svar vid interna DB-fel (ingen Stripe-retry)
- `OPENAI_MODEL_MATH`/`OPENAI_MATH_MODEL`-namninkonsekvens
- `admin.html`s `loadReports`/`resolveReports` → flytta bakom `api/admin.js`
- `apply_hp_mastery`-racet

## 5. Git-historik-rensning — KLART

Genomfört 2026-07-18: `git filter-repo --path scripts/fix_broken_image_urls.mjs --invert-paths`, force-pushat till `origin/main`. Commit `91fdb62` och den läckande filen finns inte längre i historiken. Nyckeln var redan roterad och verifierad live innan rensningen kördes.

## 6. HP-verifierarens "blind lösning"-mönster — BESLUTAT

**Kontrolleras i Fas 1** innan juridik-verifieraren designas. `hp.js` läses, rörs inte.

## 7. GDPR-kontoradering — kvarstår öppen (utanför scope)

Ingen kontoraderingsfunktion existerar idag. Nya knowledge-engine-tabeller byggs med `on delete cascade` från start (redan i `07`-planen) oavsett. Om en generell kontoraderingsfunktion ska byggas är fortsatt en separat, obeslutad fråga — inte adresserad i denna omgång.

---

**Samtliga blockerande frågor för Fas 1 är nu lösta.** Kvarvarande arbete: (a) implementera Codex-fixen (#3), (b) bygga uppföljnings-PR:n för de fem buggarna (#4), (c) starta Fas 1 av knowledge engine-uppdraget med besluten ovan som grund.
