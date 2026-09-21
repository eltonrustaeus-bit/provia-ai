# 08 Current Status

## Implementerat och verifierat i kod

- Statiskt HTML/JS-frontend med ExGen-skal, landing, app, pricing, konto och lärarsida.
- Mockprov från eget material via `api/generate-exam.js`.
- Server-side mockprovskvot via `consume_mock_exam_quota`.
- Strikt JSON-schema för genererade prov.
- Deterministisk strukturell gate.
- Generator -> granskare -> lösare-kedja för kvalitetskontroll.
- Rättning via `api/grade.js` med deterministisk MC och AI för fritext.
- Mastery-uppdatering via `apply_mock_mastery` och `user_profiles.mastery`.
- P.E.R-chat via `api/explain.js`.
- Serverstyrd hjälptrappa/anti-facit via `api/_per-help.js`.
- P.E.R-långtidsminne och elevkontext via `_per-memory`, `_learner-context`, `_mastery-view`.
- Onboarding/elevprofil via `js/per-onboarding.js` och `/api/check-role`.
- Teacher dashboard backend actions via `/api/check-role`.
- Stripe checkout, portal och webhook.
- Knowledge engine/RAG som feature-flaggad pilotinfrastruktur.
- Admin passkeys/step-up/recovery.

## Implementerat men ej verifierat live i denna genomgång

- Faktisk Supabase live-RLS och policies.
- Faktiska Vercel env values och deploymentstatus.
- Stripe Dashboard products/prices.
- Fullt auth/signup UX från ny användare till första prov.
- Teacher dashboard med riktiga två-konto-scenarion.
- Checkout end-to-end med Stripe test/live.
- P.E.R memory update över flera riktiga sessioner.

## Delvis implementerat

- Knowledge/RAG/elevloop: byggt, men feature-flaggat och inte generellt exponerat.
- School/pilotstöd: klass/lärardashboard finns, men saknar skolpilot-operationalisering.
- Felbank/minne: data finns, men flera tabeller och källor samexisterar (`user_exams`, `mock_results`, `student_*`).
- AI usage/cost tracking: tabell finns, men äldre dokument säger kostnadsfält inte är fullt tillförlitliga.
- HP/körkort: tekniskt kvar men inte kärnpositionering; `MODULES.korkort=false`.

## Planerat / vision

- ExGen Impact: ingen verifierad implementation.
- Public impact page, impact campaigns, impact pool, elevmånader: planerat/produktkontext.
- Egen tränad språkmodell som runtime-provider: ej verifierad i repo.
- Anthropic/Claude/Gemini provider-routing: ej implementerad.
- Alléskolan: plan/ambition, inte samarbete.

## Mock/demo/gammalt

- `index.html` demo är lokal/förskriven och inte riktig modellrättning.
- `instagram/*`, `live-demo.html` är marketing/demo.
- `korkortet.html` och HP-delar är tekniska moduler men bör inte blandas in i skolproduktens huvudberättelse utan beslut.
- Äldre docs/CLAUDE/AGENTS har ProviaAI/ProvKlarUF-termer och vissa gamla påståenden.

## Tekniska problem - prioriterade

### Critical

1. Secrets-audit nämner historiskt läckt Supabase service role i script. Verifiera rotation innan produktion/skolpilot.
2. RLS/live-databas är inte verifierad i denna onboarding. Kör live RLS-audit innan riktiga elever.
3. Betalningsflöde måste testas mot Stripe testmode: webhook-idempotens finns, men Dashboard-konfiguration är okänd.
4. Teacher dashboard behöver IDOR-/klassåtkomsttest med flera riktiga konton.

### High

5. UI/server-plantext måste fortsätta hållas synkad med `api/_provia-rules.js`.
6. P.E.R/generator kvalitetskedjan fail-open: verifier/solver kan hoppas över vid tidsbrist/fel.
7. Duplicerade auth helpers ökar risken att framtida fixar bara görs i `_auth.js`.
8. Knowledge engine är komplext och feature-flaggat; nya agenter kan lätt tro att RAG är allmänt live.
9. Alléskolan-text måste hållas strikt som plan, inte samarbete.
10. `mock_results` är best-effort och kodkommentar säger att `user_exams` är mer tillförlitlig.

### Medium

11. Blandning av CommonJS/ESM är driftkänslig.
12. Många routes samlas i `check-role.js`, vilket gör filen svår att granska.
13. Plan/pricing-text är spridd i flera filer.
14. HP/körkort kvar i kodbasen kan störa ExGens skolfokus.
15. Testsviter saknar tydligt top-level npm-script.

### Low

16. Namngivning ProviaAI/ProvKlarUF/ExGen bör standardiseras.
17. Gamla demo/rapportfiler i root gör repo svårare att navigera.
18. Vissa docs verkar historiska och behöver "stale" märkning.

## Rekommenderat nästa bygge

1. Gör en säkerhets- och pilotsäkringsfas innan nya featurebyggen.
2. Samla planfakta ännu hårdare så pris/kvot bara behöver ändras på ett ställe.
3. Kör RLS/live verifiering.
4. Kör kontrollerad testbaslinje utan betalda AI-anrop.
5. Bygg en skolpilot-checklista: 1-5 klasser, lärarroll, elevjoin, samtycke/GDPR, export/reporting, support.
6. Därefter: förbättra kärnflödet mockprov -> rättning -> felbank -> P.E.R-rekommendation, eftersom det är ExGens huvudloop.
