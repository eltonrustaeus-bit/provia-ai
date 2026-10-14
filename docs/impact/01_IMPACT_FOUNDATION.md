# ExGen Impact - första grund

Uppdaterad: 2026-10-15.

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

En elevmånad betyder: en elev får finansierad tillgång till ExGen genom skolprogrammet under en månad. Det är ett tillgångsmått, inte ett bevis på användning eller lärande.

## Föreslagen ekonomisk grind

Inga belopp eller elevmånader får tillskrivas ett abonnemang innan följande storheter har uppmätts och godkänts:

- `R`: faktiskt disponibel abonnemangsintäkt efter återbetalningar, betalningsavgifter och övriga avdrag i en godkänd kalkyl.
- `C`: uppmätt rörlig kostnad för AI, drift och support för den betalande tjänsten under samma period.
- `B`: beslutad reserv för gemensamma kostnader och fortsatt drift.
- `M`: konservativ, uppmätt full kostnad för en elevs skolåtkomst under en månad, inklusive rimlig användning och support.

Ett möjligt bidrag måste uppfylla `0 <= bidrag <= max(0, R - C - B)`. En preliminär beräkning är inte en avsättning. En finansierad elevmånad får bokas först när pengar faktiskt har reserverats för Impact och minst `M` återstår per bokad månad. Basic=2 och Premium=10 är bara affärsplanshypoteser tills både marginalen och `M` stöder dem. Modellen får inte kräva sponsring, tävlingspriser eller ett högre pris än det som visas för att gå ihop.

Före beslut ska kalkylen provas med låg, normal och hög AI-användning, återbetalningar och utebliven försäljning. Om marginalen är för liten blir bidraget noll; modellen får inte skapa en skuld till framtida elever eller dölja ett underskott i kärntjänsten.

## Föreslagen mätkedja

1. **Möjligt bidrag:** beräknas från en verifierad betalningsperiod och kostnadsmodell. Det är ännu inte finansierad tillgång.
2. **Reserverad finansiering:** beloppet avskiljs i intern redovisning och varje händelse binds idempotent till sin betalnings-/återbetalningsreferens. Samma köp får inte räknas två gånger.
3. **Finansierad elevmånad:** reserverat belopp täcker en månads konservativa kostnad. Summan får inte överstiga den reserverade finansieringen dividerad med `M`.
4. **Aktiverad elevmånad:** skolan har godkänt upplägget och en elev har fått faktisk åtkomst under den avgränsade perioden. En reservation utan åtkomst är inte aktiverad.
5. **Använd elevmånad:** eleven har utfört en i förväg definierad meningsfull studieaktivitet under perioden. Den exakta händelsen och dataminimeringen måste godkännas innan mätning byggs.

Rapportering ska visa finansierat, aktiverat och använt separat, tillsammans med outnyttjad finansiering och återförda belopp. Förbättrade studieresultat kräver en separat, etiskt godkänd uppföljning; aktivitet eller antal elevmånader räcker inte som effektbevis. Ingen publik räknare eller individuell "din Impact"-siffra får visas innan kedjan kan revideras mot verkliga händelser.

## Första säkra implementation senare

1. Fastställ kostnadsmodell, bokföringsansvarig, skolans dataupplägg och godkänd definition av användning.
2. Intern feature flag: `impact_enabled`, av tills granskningsbara reserveringar är möjliga.
3. Intern tabell för bidrag och återföringar, utan publik visning. Betalningsreferenser måste vara unika och återbetalningar reversera tidigare belopp.
4. Betalningshändelser får skapa en preliminär bidragskandidat först efter att ordinarie rolluppdatering lyckats; Impact får aldrig blockera betalning.
5. Adminvy skiljer preliminär kalkyl, reserverade pengar, finansierad kapacitet, aktivering och användning. Ingen elevidentifiering behövs i ekonomisammanställningen.
6. Först efter verifierad pilot och oberoende avstämning: överväg publik sammanställning eller användarvy "Din Impact".

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
- bestäm hur kostnader, reserveringar och återbetalningar stäms av utan dubbelräkning
- besluta hur outnyttjade elevmånader återförs eller flyttas utan att rapporteras som användning

## Vad som inte får göras nu

- Visa "du har finansierat X elever" utan datastöd.
- Koppla Basic/Premium till elevmånader i runtime innan kostnaden är validerad.
- Påstå att en namngiven skola deltar utan verifierad kontakt/avtal.
- Låta Impact-logik påverka betalningskritiska Stripe-flöden.

