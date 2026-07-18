# 10 — Open Questions

Frågor som inte kan avgöras från repot eller från denna analys — kräver ditt beslut innan Fas 1 påbörjas.

## 1. Hosting för ny serverlogik (blockerande för arkitekturdesign)

Vercel-projektet är sannolikt vid sitt Hobby-plans 12-funktionstak (se `07-proposed-v1-architecture.md` §1). Tre alternativ: (A) konsolidera i en ny `api/knowledge.js`-router (hp.js-mönstret), (B) Supabase Edge Functions (oanvänd yta idag), (C) uppgradera Vercel-plan. **Vilket väljer du?** Detta styr hela Fas 1-designen.

## 2. Rättighetsstatus för juridiskt källmaterial

Inget källmaterial för juridik-piloten har identifierats i repot (rimligt — det är en ny funktion). Uppdragets §17 kräver dokumenterad `license_status` per källa innan något får användas i produktion. **Vilka källor är redan licensierade/tillgängliga** (t.ex. fri lagtext, Skolverkets material) kontra vad som måste upphandlas/godkännas separat?

## 3. Codex HIGH-fyndet (`_per-memory.js` prompt-injection-lucka) — åtgärda nu eller i Fas 1?

Inte blockerande för Fas 0-godkännande (se `02-security-findings.md` §4), men **bör den fixas som en fristående, snabb säkerhetsuppgift nu**, eller vänta till Fas 1/7 när P.E.R:s juridikläge byggs och samma saneringsmönster ändå införs? Rekommendation: fixa nu (litet, avgränsat, samma mönster som redan finns i `_per-context.js` att kopiera) — men det är din prioritering.

## 4. Ska befintliga, redan identifierade men icke-blockerande buggar fixas som en del av detta uppdrag?

Utanför knowledge-engine-scopet men upptäckta under Fas 0:
- Stripe webhook saknar `event.id`-idempotens (dubbla mail vid redelivery) — `feature-flow-map.md`/`quota-and-billing-map.md`.
- Webhook returnerar `200` vid interna DB-fel → betalande kund kan bli utan rolluppgradering utan att Stripe försöker igen.
- `OPENAI_MODEL_MATH`/`OPENAI_MATH_MODEL`-namninkonsekvensen i `generate-exam.js`/`hp.js`.
- `admin.html`s `loadReports`/`resolveReports` bör flyttas bakom `api/admin.js` (nedgraderat till MEDIUM efter live-RLS-kontroll, men fortfarande fel mönster).
- `apply_hp_mastery`-racet (Codex-fynd, lågt allvar).

Ingen av dessa hindrar knowledge-engine-arbetet. **Vill du att de samlas som en separat, liten uppföljnings-PR**, eller lämnas orörda tills vidare?

## 5. Git-historik-rensning av den läckta nyckeln

Väntar på att du bekräftar rotation är klar (se `02-security-findings.md` §1). Därefter: vill du att historiken rensas (`git filter-repo`, destruktivt, kräver force-push-koordinering med alla som har lokala klonar), eller är rotation tillräckligt (gammal nyckel blir ogiltig men strängen finns kvar synlig i historiken för alla med repo-läsåtkomst)?

## 6. Verifierarens "blind lösning"-krav mot HP:s befintliga mönster

Uppdragets §25.1 kräver att verifieraren löser frågan själv **innan** den ser generatorns facit. Om `hp.js`s befintliga verifierare-prompter redan får facit direkt (inte kontrollerat i denna Fas 0-genomgång — skulle kräva att läsa hela prompt-inventory.md:s HP-sektion rad för rad, inte gjort här), behöver antingen HP:s mönster justeras innan det återanvänds för juridik, eller så byggs juridik-verifieraren striktare från start utan att HP ändras (eftersom HP är en icke-förhandlingsbar avgränsning, §8 gäller ändå bara att inte RÖRA hp.js — att inte KOPIERA ett svagare mönster därifrån är ett separat designval). **Bör detta kontrolleras explicit i Fas 1 innan verifieringsmotorn designas?**

## 7. GDPR-kontoradering

Ingen sådan funktion existerar idag (se `02-security-findings.md` §6). Om knowledge-engine-tabellerna innehåller elevdata (t.ex. interaktion med kunskapsgrafen), byggs de med `on delete cascade` från start (redan planerat i `07`). Men den bredare frågan — **ska en generell kontoraderingsfunktion byggas som en del av eller parallellt med detta projekt** — är utanför scope men värd att flagga, eftersom knowledge-engine-datan annars ärver samma lucka som redan finns för `profiles`/`user_exams`.
