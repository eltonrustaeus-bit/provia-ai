# Kvotsystem och Stripe/Roller — ProviaAI/ProvKlarUF

Verifierat direkt mot koden 2026-07-18. Källor: `api/_provia-rules.js`, `api/generate-exam.js`, `api/explain.js`, `api/check-role.js`, `api/hp.js`, `api/ocr.js`, `api/stripe-webhook.js`, `api/create-checkout-session.js`, `api/admin.js`, `supabase/migrations/*.sql`.

---

## 1. Var kvoter definieras

Central källa: **`api/_provia-rules.js`** — `PLAN_RULES` (rad 6-67), fryst objekt (`Object.freeze`) per roll: `gratis, basic, premium, admin, user, teacher`.

| Roll | mockExam | drivingTest (teoriprov) | kkPractice (kursfrågor) | perChat (EX1.0) | hpGen | hpSim |
|---|---|---|---|---|---|---|
| gratis | 2/vecka | **0** (kräver Basic) | 10/dag | 5/vecka | 0/dag | 0/mån |
| basic | 30/mån | 30/mån | obegränsat | 5/dag | 60/dag | 4/mån |
| premium | obegränsat | obegränsat | obegränsat | obegränsat | obegränsat | obegränsat |
| admin/user | obegränsat överallt | | | | | |
| teacher | obegränsat överallt (B2B) | | | | | |

`normalizeRole()` faller alltid tillbaka till `"gratis"` om rollsträngen inte finns i `PLAN_RULES` — säker default (fail-closed mot okänd roll, inte fail-open till premium).

---

## 2. Enforcement per funktion — server-side vs. client-only

Detta är den viktigaste tabellen i dokumentet. **Sammanfattning: fem av sex kvoter är atomärt server-side enforced. En (kkPractice för gratis-rollen) är rent client-side och trivialt kringgåbar.**

### 2a. mockExam — SERVER-SIDE, atomärt ✓
- Endpoint: `api/generate-exam.js` rad 226-273 (`consumeMockExamQuota`).
- RPC: `consume_mock_exam_quota` (`supabase/migrations/20260603_add_mock_exam_quota.sql`), `security definer`, kör `SELECT ... FOR UPDATE` på användarens `profiles`-rad innan den läser räknaren, vilket **radlåser** och gör check-and-increment atomärt.
- Behörighet: `revoke execute ... from public/anon/authenticated`, `grant ... to service_role` — funktionen kan **inte** anropas direkt av en inloggad klient via Supabase REST/PostgREST, bara av backend med service-role-nyckeln. En klient som försöker anropa `/rest/v1/rpc/consume_mock_exam_quota` direkt med sin egen JWT nekas av Postgres-behörigheterna.
- Bypass-bedömning: **ingen uppenbar bypass**. Enda vägen till en gratis extra generering vore att hitta ett race i själva endpointen innan RPC:n anropas — men RPC:n är den enda platsen som faktiskt skriver kvoten, och den är låst.

### 2b. perChat (P.E.R/EX1.0-chatten) — SERVER-SIDE, atomärt ✓
- Endpoint: `api/explain.js` rad 228-242 (`consume_per_chat_quota` via `supabase.rpc(...)`).
- Kommentar i koden själv (rad 232): "Atomic check-and-increment — prevents quota bypass via concurrent requests" — samma radlåsningsmönster som mockExam (funktionen är inte i repo:t som separat migration-fil men följer samma design, anropas via Supabase JS-klienten med service-role-nyckel initierad i filen, rad 14-17).
- **Undantag**: `landingMode` (oautentiserad) och `tipsMode` (felbanks-tips) och "explain mode" (facitförklaring, rad 420-443) går **förbi** denna kvot helt. `explain mode` kräver auth men har ingen kvotkoll alls — se avsnitt 3 nedan.

### 2c. drivingTest / kkPractice (körkortsteorin) — DELAT: teoriprov server-side, kursfrågor CLIENT-ONLY för gratis ⚠️
- **teoriprov (Basic/Premium)**: `api/check-role.js` action `bump_kk` (rad 184-217) → RPC `consume_kk_test_quota`, samma atomära radlåsningsmönster ("Atomic check-and-increment", kommentar rad 204). `cfg.cap===0` (gratis-rollen) returnerar direkt 429 "Teoriprov kräver Basic eller Premium" — server-side gate, kan inte kringgås.
- **kursfrågor (gratis-rollens 10/dag)**: `korkortet.html` rad 1483-1484:
  ```js
  function bumpPracticeQ() { const n = readPracticeQ() + 1; localStorage.setItem(practiceDayKey(), String(n)); return PRACTICE_LIMIT - n; }
  function isPracticeExhausted() { return role === 'gratis' && readPracticeQ() >= PRACTICE_LIMIT; }
  ```
  Detta är **ren `localStorage`**-räkning, ingen serveranrop alls i denna kodväg. **Trivialt kringgåbart**: rensa `localStorage`, använd inkognitofönster, eller anropa relevanta klient-funktioner/DOM direkt i devtools.
  - **Faktisk risk är dock låg**, av två skäl: (1) körkortsfrågorna själva ligger redan helt client-side i det statiska `final_questions.json` (608 KB, alla 352 frågor inkl. facit och förklaringar levereras till klienten oavsett roll) — det finns alltså ingen hemlig data att skydda bakom kvoten, bara UX-friktion; (2) det görs inget AI-anrop för att visa en kursfråga (förklaringar kan hämtas via `/api/explain` "explain mode", som i sig saknar kvot — se 3 nedan — men är billigt). Kvoten är med andra ord en **konverteringsmekanism, inte en kostnads- eller dataskyddskontroll**, och just därför är avsaknaden av server-enforcement mindre allvarlig än den skulle vara för t.ex. mockExam — men det är fortfarande en skillnad mot vad "kvotsystem" antyder, och bör dokumenteras explicit så att ingen antar att gratis-kursfrågor är skyddade.

### 2d. hpGen / hpSim (högskoleprovet, `api/hp.js`) — SERVER-SIDE, atomärt ✓
- RPC:er `consume_hp_gen_quota` och `consume_hp_sim_quota` (`supabase/migrations/20260630_hp_schema.sql` rad 133-233), uttryckligen kommenterade som "clone of consume_mock_exam_quota" — samma radlåsningsmönster, samma `revoke ... grant to service_role`-behörighetsmodell.
- Anropas från `api/hp.js` rad 647 och 900 via en gemensam `consumeQuota()`-hjälpfunktion.

### 2e. OCR — binär rollgate, ingen räknad kvot
- `api/ocr.js` rad 44-59: server-side rolluppslag mot `profiles`, kräver `basic|premium|admin|user`. Ingen "X anrop/dag"-räkning — se avsnitt 6 i feature-flow-map.md.

---

## 3. Explicit gap: `/api/explain` "explain mode" saknar kvot helt

`api/explain.js` rad 420-443 (facitförklaring för en körkortsfråga): kräver auth (`requireAuth` på rad 187 körs innan denna gren nås) men har **ingen** `getFeatureLimit`/RPC-anrop. En inloggad gratisanvändare kan alltså anropa denna endpoint obegränsat många gånger per dag/vecka, till skillnad från `perChat`-huvudchatten som är strikt kvoterad. Kostnadsrisken är låg per anrop (max 60 ord output, `gpt-4o-mini`), men det är en inkonsekvens mot resten av kvotdesignen och en teknisk möjlighet till volymmissbruk (t.ex. ett skript som slår igenom alla 352 frågor och hämtar AI-förklaringar för var och en, upprepat).

---

## 4. Reset-logik (periodnycklar)

`currentPeriodKey(period, now)` (`api/_provia-rules.js` rad 106-114, dupliceras identiskt i `api/explain.js` rad 19-25):
- `day` → `YYYY-MM-DD` (UTC).
- `month` → `YYYY-MM` (UTC).
- annars (vecka) → `YYYY-Www` (ISO-liknande veckoberäkning, UTC-baserad).

RPC-mönstret (`consume_mock_exam_quota` m.fl.) jämför lagrad `*_quota_period` mot den beräknade nyckeln för "nu": om de skiljer sig nollställs räknaren innan ökning (`if v_period is distinct from p_period_key then v_count := 0;`). Det finns alltså **ingen schemalagd reset-job** — resetet sker lat, vid nästa konsumtionsförsök efter periodgränsen, vilket är korrekt och vanligt mönster men betyder att en användare som aldrig återvänder efter periodslutet aldrig "triggar" en reset (harmlöst, eftersom nästa faktiska försök ändå nollställer korrekt).

Alla periodnycklar är **UTC-baserade**, inte svensk tid (Europe/Stockholm) — vid dag-gränser runt midnatt svensk tid (som UTC+1/+2) kan detta ge en kvot som återställs 1-2 timmar tidigare/senare än användaren förväntar sig lokalt. Litet UX-gap, ingen säkerhetsrisk.

---

## 5. Race condition-bedömning

De atomära RPC:erna (`consume_mock_exam_quota`, `consume_per_chat_quota`, `consume_kk_test_quota`, `consume_hp_gen_quota`, `consume_hp_sim_quota`) skyddar sig alla genom **`SELECT ... FOR UPDATE`** inuti en `plpgsql`-funktion — Postgres radlås gör att två samtidiga requests för samma `user_id` serialiseras: den andra transaktionen blockerar tills den första committat, läser då det uppdaterade värdet och utvärderas korrekt mot gränsen. **Detta är rätt implementerat och skyddar mot det klassiska "check-then-increment"-racet** som frågan efterfrågade.

Den enda platsen med en teoretisk check-then-act utan lås är **kkPractice/gratis** (`localStorage`), men eftersom hela mekanismen körs client-side och utan serverautentisering av räknaren är "race condition" inte ens rätt hotmodell där — hela kontrollen kan bytas ut av användaren, inte bara racas.

---

## 6. Fallback-beteende vid överskriden kvot

- **mockExam**: `429 { error:"Quota exceeded", count, limit, period }` — inget prov genereras, inget AI-anrop görs (kvot koll sker innan OpenAI-anropet).
- **perChat**: `429 { error:"Quota exceeded", count, limit }`.
- **drivingTest (teoriprov)**: `429` om `cap===0` (gratis) med tydligt meddelande "Teoriprov kräver Basic eller Premium"; annars `429 { error:"Quota exceeded" }` vid faktisk gräns.
- **kkPractice/gratis**: klientfunktionen `isPracticeExhausted()` triggar en UI-modal ("Uppgradera till Basic") och blockerar UI-flödet lokalt — men blockerar **inte** någon serverresurs eftersom ingen serverresurs konsumeras för denna funktion i första läget.
- **hpGen**: **mjuk fallback, inte hård 429** — `api/hp.js` rad 645-654: om kvoten är slut serveras ändå cachade/redan existerande frågor (`source:'cache_only'`, `quota_exhausted:true` i metadata) istället för fel. Bra UX-val (eleven får ändå något att träna på), men avviker från mönstret i övriga endpoints.
- **hpSim**: hård fallback, `200 { ok:false, error:'quota_exhausted', message:'Provpass-simulering kräver Basic eller Premium.' }` (notera: `200`, inte `429` — avsiktligt så frontend kan hantera det utan att träffa generisk felhantering för icke-2xx).
- **OCR**: `403 { error:"OCR requires Basic or Premium" }` för fel roll.

---

## 7. Stripe och roller

### 7a. Checkout — `api/create-checkout-session.js`
1. Kräver auth (`requireAuth` från `_auth.js`).
2. Skapar/återanvänder en Stripe Customer, kopplad via `profiles.stripe_customer_id`. Om den lagrade kund-id:t inte längre finns hos Stripe (`checkRes.ok===false`) nollställs den lokalt och en ny kund skapas — självläkande mot inkonsistens.
3. Två betalningsvägar:
   - **Prenumeration** (kort, `mode:"subscription"`), pris styrt av `STRIPE_BASIC_PRICE_ID`/`STRIPE_PREMIUM_PRICE_ID`.
   - **Swish** (`mode:"payment"`, engångsbetalning, `payment_method_types:["swish"]`), fast belopp (`SWISH_AMOUNTS: {basic:2900, premium:7900}` öre) hårdkodat i filen — **inte** synkat med `STRIPE_BASIC_PRICE_ID` osv., så om priset ändras i Stripe Dashboard måste denna konstant uppdateras manuellt separat.
4. `metadata.supabase_user_id` + `metadata.plan` sätts på både session och (för prenumerationer) `subscription_data.metadata` — detta är navet som knyter Stripe-events tillbaka till Supabase-användaren i webhooken.

### 7b. Webhook — `api/stripe-webhook.js`
- **Signaturverifiering**: `verifyStripeSignature()` (rad 15-28) implementerar HMAC-SHA256 mot `STRIPE_WEBHOOK_SECRET` manuellt (utan Stripe SDK) med `crypto.timingSafeEqual` — korrekt, timing-safe jämförelse. Om signaturen saknas/felaktig → `400` direkt, inget event processas.

- **Hanterade event-typer och roll-uppdatering**:
  | Event | Effekt på `profiles` |
  |---|---|
  | `checkout.session.completed` (subscription) | `upsert({role, stripe_customer_id, stripe_subscription_id})` |
  | `checkout.session.completed` (payment/Swish) | `upsert({role, stripe_customer_id, swish_expires_at: now+30d})` |
  | `customer.subscription.updated` | `update({role})` om `status==='active'` och metadata har plan |
  | `invoice.payment_succeeded` (bara `subscription_cycle`) | ingen roll-ändring, bara bekräftelsemail |
  | `invoice.payment_failed` | ingen roll-ändring (nedgradering sker inte automatiskt vid ett enstaka misslyckat betalningsförsök — Stripes egna retry-schema + ev. `customer.subscription.deleted` senare hanterar det) |
  | `customer.subscription.deleted` | `update({role:"gratis", stripe_subscription_id:null})` |

- **Swish-expiry hanteras lat, inte av webhooken**: Swish ger ingen prenumeration i Stripe (`mode:"payment"`), så det finns inget `customer.subscription.deleted`-event att luta sig mot. Nedgraderingen sker istället i `api/check-role.js` (rad 601-610): vid **varje** anrop till `/api/check-role` (som händer på i princip varje sidladdning) kontrolleras `swish_expires_at < now()`, och om sant nedgraderas rollen till `gratis` inline, innan svaret skickas. Fungerar i praktiken (användare laddar sidor kontinuerligt) men är strikt sett inte en garanterad, tidsstyrd nedgradering — en användare som aldrig anropar `/api/check-role` efter utgången (osannolikt men teoretiskt möjligt om de bara sitter kvar på en redan laddad sida) behåller förhöjd roll tills nästa anrop.

- **⚠️ IDEMPOTENCY-GAP — ingen deduplicering av `event.id`**: handlern läser `event.type` och processar om typen matchar, men **kontrollerar aldrig om `event.id` redan hanterats**. Stripe garanterar "at-least-once"-leverans och skickar **om** samma event vid timeout, nätverksfel, eller om webhooken svarar med icke-2xx (t.ex. om Supabase-anropet i handlern tar för lång tid och Vercel-funktionen timar ut efter att Stripe redan fått ett svar, eller om Stripe inte fick svaret i tid och gör en retry). Konsekvenser vid dubbelleverans:
  - `checkout.session.completed`: `upsert` på `profiles` är i sig idempotent för roll/kund-id (samma värden skrivs igen, ingen skada) — **men** `sendEmail()`-anropen (bekräftelsemail till kund + adminmail) körs **på nytt för varje leverans**, ovillkorat. En kund kan alltså få flera identiska "Betalning bekräftad"-mail för en och samma betalning, och admin får dubbla notismail.
  - `invoice.payment_succeeded`/`invoice.payment_failed`: samma sak — enbart mailutskick, men dubblerade mail är en trovärdighetsrisk (ser ut som dubbelfakturering för kunden även om inget dubbeldebiterats).
  - `customer.subscription.deleted`: `update({role:"gratis"})` är idempotent, men "Prenumeration avslutad"-mailet skickas igen vid varje redelivery.
  - **Ingen ekonomisk dubbelskada** (inga dubbla Stripe-debiteringar orsakas av detta — det är Stripe/kortnätverket som äger den delen), men **UX/förtroendeskada** genom dubbla mail är reell och lätt att fixa: en `stripe_webhook_events`-tabell med `event.id` som unik nyckel, kontrollerad/insatt innan sidoeffekter körs, skulle stänga gapet. Ingen sådan tabell eller motsvarande dedupliceringslogik hittades i migrations-katalogen eller i handlern.

- **Ingen retry/backoff-hantering av egna Supabase-fel**: om `supabase.from("profiles").upsert(...)` misslyckas loggas felet (`console.error`) men handlern returnerar ändå `200 {received:true}` till Stripe i de flesta grenar (utom vid ogiltig signatur) — det finns inget explicit "returnera 500 så att Stripe retry:ar" för databasfel. I praktiken betyder det: om Supabase är nere exakt när ett `checkout.session.completed`-event kommer in, får kunden betalningsbekräftelse-mail (om email-steget lyckas) men rollen uppgraderas **aldrig**, och eftersom Stripe fick `200` görs ingen ny leveransförsök. Detta är den allvarligaste enskilda risken i webhook-flödet: en betalande kund som inte får sin roll uppgraderad, utan automatisk självläkning.

### 7c. Cancellation — två vägar
1. **Via Stripe Customer Portal**: `api/check-role.js` action `"portal"` (rad 220-244) öppnar en Stripe-hanterad portal-session. Alla ändringar därifrån (uppgradering/nedgradering/avslut) kommer tillbaka som webhook-events (`customer.subscription.updated`/`deleted`).
2. **Direkt i appen**: `api/check-role.js` action `"cancel_sub"` (rad 247-272) anropar Stripes DELETE `/v1/subscriptions/{id}` **direkt** och sätter `role:"gratis"` **synkront i samma request** — detta sker **innan** (eller helt oberoende av) webhook-eventet `customer.subscription.deleted` som Stripe ändå kommer skicka strax efter. Roll-nedgraderingen sker alltså två gånger för samma avslut (en gång direkt i `cancel_sub`, en gång när webhooken senare tar emot `customer.subscription.deleted`) — harmlöst eftersom båda sätter samma slutvärde, men ytterligare en plats där samma tillståndsövergång inte är strikt en gång.

### 7d. Rollverifiering i övrigt
- `api/check-role.js` huvudsvar (rad 588-613): läser `profiles.role` rakt av och returnerar den till klienten — klienten litar aldrig på en egen lokal roll-cache för säkerhetsbeslut (enligt kommentar i `CLAUDE.md`: "never trust client-side role" — bekräftat i koden: varje kvot-känslig serverendpoint gör sin egen `profiles`-uppslagning, ingen förlitar sig på en roll som skickas med i request-body).
- `api/admin.js` `set-role`/`approve` (rad 129-161): kräver `requireAdmin()` som slår upp anropande användares egen roll i `profiles` och kräver exakt `"admin"` — kan inte förfalskas via request-body eftersom `targetId`/`role` i body bara är *vad som ska sättas*, inte vem som anropar.

---

## 8. Sammanfattning — avvikelser värda uppmärksamhet

1. **kkPractice (gratis, 10 kursfrågor/dag) är enbart `localStorage`, ingen serverkontroll.** Låg praktisk risk (frågebanken är redan fullt klientexponerad, ingen AI-kostnad per fråga), men stämmer inte med hur övriga fem kvoter är byggda och bör inte förväxlas med dem.
2. **`/api/explain` "explain mode" har ingen kvot alls**, trots att övriga EX1.0-vägar (huvudchatten) är strikt kvoterade. Litet men reellt inkonsekvens-/kostnadsgap.
3. **Stripe-webhooken saknar idempotency-nyckel på `event.id`.** Risk: dubbla bekräftelse-/notismail vid Stripes at-least-once-redelivery. Ingen dubbel fakturering, men ett trovärdighetsproblem och en lätt fixbar lucka.
4. **Databasfel i webhooken (t.ex. Supabase nere) svarar ändå `200` till Stripe** i de flesta grenar → ingen automatisk retry från Stripe, vilket kan lämna en betalande kund permanent utan uppgraderad roll om felet inträffar vid fel tillfälle, utan någon inbyggd upptäckts- eller självläkningsmekanism.
5. **Swish-nedgradering är lat** (kontrolleras vid nästa `/api/check-role`-anrop, inte av ett schemalagt jobb) — fungerar i praktiken men är inte en garanterad tidsstyrd process.
6. **`cancel_sub` sätter roll till gratis synkront OCH webhooken gör det igen** vid `customer.subscription.deleted` — harmlöst dubbelarbete, inte en bugg, men värt att känna till vid framtida refaktorering av cancellation-flödet.
7. Övriga fem kvoter (mockExam, perChat, drivingTest, hpGen, hpSim) är **korrekt atomärt server-side implementerade** med `SELECT ... FOR UPDATE`-radlåsning och RPC-behörigheter som blockerar direkta klientanrop — inget race-fönster hittades där.
