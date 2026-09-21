# 06 Payments and Plans

## Auktoritativ planlogik

Källa: `api/_provia-rules.js`.

| Plan/role | Pris | Mockprov | P.E.R | Övrigt |
|---|---:|---:|---:|---|
| `gratis` | 0 kr | 3/vecka | 5/vecka | OCR nej. Körkortsteori är modulavstängd i skolpositionering. |
| `basic` | 29 kr/månad | 30/månad | 5/dag | OCR, historik, mer träning. |
| `premium` | 79 kr/månad | Obegränsat | Obegränsat | Felbank, AI-coach, lärarrapport enligt produkttext. |
| `admin` | internal | Obegränsat | Obegränsat | Intern roll. |
| `teacher` | B2B | Obegränsat | Obegränsat | Lärarpanel, sätts av admin. |
| `user` | historisk alias till Premium | 79 kr/månad | Obegränsat | Bör undvikas i ny produkttext. |

Viktigt: servern är sanningen för kvoter. UI-texter ska säga 3 gratis prov/vecka.

## Checkout

Källa: `api/create-checkout-session.js`.

- Kräver autentisering via `_auth.js`.
- Klient skickar `plan` (`basic` eller `premium`) och eventuellt betalningssätt.
- Stripe key: `STRIPE_SECRET_KEY`.
- Price IDs:
  - `STRIPE_BASIC_PRICE_ID`
  - `STRIPE_PREMIUM_PRICE_ID`
- Swish-läge finns hårdkodat:
  - Basic: 2900 öre
  - Premium: 7900 öre
- Skapar eller återanvänder Stripe customer och sparar `profiles.stripe_customer_id`.
- Metadata sätter Supabase user id och plan. Webhook litar på metadata som skapats server-side.

## Billing Portal och Cancellation

Källa: `api/check-role.js`.

- Billing portal skapas med Stripe API och `profiles.stripe_customer_id`.
- Avslut/nedgradering kan ske genom subscription-cancel-flöde och webhook.
- Swish-expiry hanteras lazy i `check-role` genom att roll sätts till `gratis` när perioden gått ut och ingen subscription finns.

## Webhook

Källa: `api/stripe-webhook.js`.

- Verifierar `stripe-signature` manuellt med HMAC-SHA256 och `STRIPE_WEBHOOK_SECRET`.
- Idempotens med `stripe_webhook_events`.
- Hanterar:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `customer.subscription.deleted`
- Uppdaterar `profiles.role`, `stripe_customer_id`, `stripe_subscription_id`, `swish_expires_at`.
- Email via Resend försöker skickas men blockerar inte webhook.

## Entitlements

Källa: `api/_provia-rules.js`, `api/check-role.js`, `api/generate-exam.js`, `api/explain.js`.

- `/api/check-role` action `entitlements` returnerar serverns snapshot.
- Mockprovkvot konsumeras server-side med `consume_mock_exam_quota`.
- P.E.R-kvot konsumeras server-side med `consume_per_chat_quota`.
- OCR kontrollerar roll server-side.
- Teacher-roll är inte en prissättningsplan utan adminstyrd behörighet.

## Kända avvikelser

- Stripe Dashboard products/prices verifierades inte live.
- Swish-belopp är hårdkodade i checkout-filen och måste hållas synkade med prisstrategin.
- Synka alltid Swish-belopp, Stripe Price IDs och synlig pristext vid prisändring.

## ExGen Impact

Ingen verifierad payment-kod kopplar köp till ExGen Impact, elevmånader eller impact pool idag.

Preliminär affärsmodell från produktkontext:

- Basic kan komma att motsvara 2 finansierade elevmånader.
- Premium kan komma att motsvara 10 finansierade elevmånader.

Detta ska inte hårdkodas innan faktisk kostnad per skolelev och datamodell validerats.
