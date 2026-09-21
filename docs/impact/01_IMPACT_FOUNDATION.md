# ExGen Impact - första grund

Uppdaterad: 2026-09-21.

Detta är en produkt- och datagrund, inte implementation. Inga Stripe-webhooks, planregler eller publika siffror ska kopplas till Impact innan verklig kostnad per skolelev och pilotmodell är validerad.

## Princip

P.E.R gör studiestödet personligt. ExGen Impact ska göra det tillgängligt.

Impact ska byggas som ett mätbart system, inte som marknadsföring först. Det betyder att ExGen ska kunna skilja på:

- finansierade elevmånader
- aktiverade elevmånader
- faktiskt använda elevmånader
- skolor/klasser som fått tillgång
- faktisk kostnad per skolelev
- hur mycket en betalande användare bidrar till skolåtkomst

## Preliminära antaganden

Får användas i affärsplan, pitch och intern modellering, men inte som hårdkodad produktlogik:

- Basic kan motsvara 2 finansierade elevmånader.
- Premium kan motsvara 10 finansierade elevmånader.

En elevmånad betyder: en elev får finansierad tillgång till ExGen genom skolprogrammet under en månad.

## Första säkra implementation senare

1. Intern feature flag: `impact_enabled`.
2. Intern tabell för bidrag, utan publik visning.
3. Webhook loggar möjlig contribution efter att rolluppdatering lyckats, men får aldrig blockera betalning.
4. Adminvy visar preliminära beräkningar som "ej publik".
5. Först efter verifierad pilot: användarvy "Din impact".

## Datamodell senare

Förslag, ej implementerat:

- `impact_contributions`
- `impact_campaigns`
- `impact_allocations`
- `impact_usage`

Minimikrav före migration:

- bestäm om impact mäts i kronor, kapacitet eller elevmånader
- bestäm hur refunds/cancellations påverkar contribution
- bestäm hur skolåtkomst aktiveras och när den räknas som använd
- bestäm anonymisering för elever i skolprogram

## Vad som inte får göras nu

- Visa "du har finansierat X elever" utan datastöd.
- Koppla Basic/Premium till elevmånader i runtime innan kostnaden är validerad.
- Påstå att en namngiven skola deltar utan verifierad kontakt/avtal.
- Låta Impact-logik påverka betalningskritiska Stripe-flöden.

