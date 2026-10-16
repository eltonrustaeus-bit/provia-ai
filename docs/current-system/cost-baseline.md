# Baslinje för AI-användning och kostnader

Senast kontrollerad: 2026-10-15. Detta är en statisk granskning av repots källkod. Den verifierar inte live-schema i Supabase, leverantörsfakturor, Vercel-förbrukning, Stripe-avräkning eller faktiska skol-/pilotkostnader.

## Vad som finns i repot

- `api/_ai-usage.cjs` hämtar leverantörsrapporterade indata-, cachelagrade indata-, utdata- eller embedding-token samt utvalda uppgifter om tid och modell. Själva usage-eventet innehåller inte studiematerial eller elevsvar.
- Hjälparen skickar best-effort-batcher till `public.ai_usage_events` med serverhemlighet. Ett misslyckat skrivförsök loggas men stoppar inte elevens begäran. Saknad eller osammanhängande usage utelämnas; den bokförs inte som noll kostnad.
- Det finns anrop från provgenerering och rättning, P.E.R, OCR, lärarrapporter/klassinsikter och embedding. Täckningen beror på kodväg; denna granskning mätte inte hur stor andel av leverantörsanropen som ger ett giltigt event.
- `supabase/migrations/20260720_knowledge_engine_schema.sql` definierar usage-tabellen och kolumnen `estimated_cost`. Att en migrationsfil finns i Git bevisar inte att tabellen är installerad i staging eller produktion.
- En provpipeline kan ge flera event för generering, granskning, lösare, reparation och andra steg. Eventen kan dela `request_id`. Antalet event är inte antalet prov; att summera eller deduplicera enbart på `request_id` ger inte en tillförlitlig provräkning eller kostnadsbok. Eventkontraktet saknar ett separat ID per leverantörsanrop och verifierad idempotens.

## Vad som inte är verifierat eller beräknat

- `config/model-pricing.json` har `verified: false`, saknar kontrolldatum och har inga ifyllda priser. Eventen innehåller därför uppmätt användning, inte en aktuell kostnad i kronor eller dollar. Saknade priser ska förbli okända, inte räknas som noll.
- Koden fastställer inte en avstämd kostnad per levererat prov, abonnent, elevmånad eller abonnemangsplan. Den fastställer inte heller täckningsbidrag eller finansiering för ExGen Impact.
- Loggningen är best-effort och kan vara ofullständig. Här finns ingen avstämning mellan usage-event och leverantörens faktureringsunderlag, och inget bevis på att migrationen är installerad i någon live-miljö.
- Eventen mäter inte Stripe-avgifter, återbetalningar, chargebacks, Supabase-resurser, Vercel-funktioner, supportarbete eller kostnader för att leverera till en skola. Dessa behöver kontrolleras separat mot respektive leverantörs underlag.
- Premiumplanens gränser och appregler visar inte faktisk användning eller högsta driftkostnad för en användare med hög konsumtion.

## Prissättning och Impact

`config/model-pricing.json` listar för närvarande `gpt-4o-mini`, `gpt-4o` och `text-embedding-3-small`, men alla priser är tomma. Modellval i drift kan dessutom styras av miljökonfiguration; standardvärden i källkod visar inte vilken modell som faktiskt kördes i en driftsatt miljö.

Presentera inte historiska värden som `0,024 kr per prov`, marginalscenarier eller Basic/Premium-elevmånader som aktuell uppmätt ekonomi innan källdata, beräkningssätt, tidsperiod och fakturaunderlag har återskapats och granskats. Räkna inte kostnad genom att räkna usage-rader eller genom att behålla endast en rad per delat `request_id`.

Innan kostnadsdata används för prissättning eller Impact behövs:

1. Bekräftat schema och lagringstid i en godkänd icke-produktionsmiljö. Den lokala migrationen räcker inte som bevis på installation.
2. Syntetiska genomgående anrop som visar vilka lyckade, misslyckade och återförsökta leverantörsanrop som ger usage-event. Saknad usage ska fortsatt anges som okänd.
3. Stabilt ID för varje leverantörsanrop, separat från provets/begärans gruppering, så omförsök och flera pipeline-steg kan stämmas av utan dubbelräkning.
4. Daterad prislista från primärkälla och testad kostnadsberäkning för varje modell, inklusive cachelagrad indata där relevant.
5. Avstämning mot leverantörens faktureringsunderlag innan kostnad per prov, marginal per plan eller finansierade elevmånader publiceras.

Tills dess ska telemetrin beskrivas som uppmätt tokenanvändning där ett event faktiskt registrerats, inte som fullständig fakturering, kostnad per prov, lönsamhet eller bevisad Impact-finansiering.
