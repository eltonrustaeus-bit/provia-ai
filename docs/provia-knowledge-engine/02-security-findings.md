# 02 — Security Findings

Syntes av `docs/security/secrets-audit.md`, `rls-audit.md`, `service-role-audit.md`, `docs/codex_review.md`, plus live-verifiering mot databasen genomförd under denna Fas 0-genomgång (utöver uppdragets read-only-mandat, motiverat av att fynden var akuta och användaren gav explicit godkännande för de två fixarna nedan).

## 1. CRITICAL — service_role-nyckel läckt i git (delvis åtgärdad, kräver din handling)

- **Fynd:** Hårdkodad Supabase `service_role`-JWT i `scripts/fix_broken_image_urls.mjs:11`, committad sedan 2026-06-09 (`91fdb62`), kvar på `HEAD`. **Repot är publikt på GitHub** (verifierat: `gh repo view` → `"isPrivate":false`).
- **Åtgärdat under Fas 0:** Koden skriven om till att läsa `process.env.SUPABASE_SERVICE_ROLE_KEY` (samma mönster som `scripts/hp-seed-lexicon.mjs`).
- **KVARSTÅR — kräver din manuella handling:**
  1. Rotera `service_role`-nyckeln i Supabase Dashboard → `https://supabase.com/dashboard/project/mnmotdluigzeehdjbhbu/settings/api-keys` (projektet har redan migrerat till det nya nyckelsystemet — en `sb_publishable_...`-nyckel existerar vid sidan av legacy anon-nyckeln — så **secret/service_role-nyckeln kan roteras separat utan att slå ut den publika anon-nyckeln** som ligger i 10 klientfiler).
  2. Uppdatera `SUPABASE_SERVICE_ROLE_KEY` i Vercel env vars (alla miljöer) + lokala `.env.local`.
  3. Därefter, som separat godkänd åtgärd: rensa nyckeln ur git-historiken (`git filter-repo`, destruktivt, kräver force-push-koordinering) — inte gjort, inte en del av denna audit.

## 2. CRITICAL — privilege escalation via `profiles`-RLS (åtgärdat och verifierat)

- **Fynd (upptäckt genom live-verifiering, inte av den ursprungliga statiska kartläggningen):** `profiles_update_own`-policyn tillät `auth.uid()=id` att uppdatera **vilken kolumn som helst** på sin egen rad — inklusive `role`, `approved`, `stripe_customer_id`, samtliga `*_quota_count`. En inloggad gratisanvändare kunde, direkt i webbläsarkonsolen med den publika anon-nyckeln, köra `supabase.from('profiles').update({role:'admin', mock_quota_count:0, ...}).eq('id', egetId)` och få full admin-roll + obegränsad kvot.
- **Verifiering:** Bekräftat via direkt SQL mot `pg_policies` — ingen triggerbaserad skyddsmekanism fanns, och grep bekräftade att samtliga legitima `.update()`-anrop på `profiles` redan sker server-side via service_role (`check-role.js`, `stripe-webhook.js`, `create-checkout-session.js`), så policyn skyddade ingen faktisk klientfunktion.
- **Åtgärdat och verifierat:** Migration `20260718_fix_profiles_update_escalation.sql` körd live — policyn borttagen. Efterkontroll bekräftar bara `profiles_select_own`/`profiles_insert_own` kvarstår. Rollback finns (`_ROLLBACK.sql`), inte förväntad att behövas.

## 3. HIGH — `admin.html`: klientkod kringgår `api/admin.js`s skydd (ej åtgärdat, dokumenterat)

`admin.html`s `loadReports()`/`resolveReports()` (rad 498–569) pratar direkt med Supabase via anon-nyckeln (`driving_questions.update`, `question_reports.update`) istället för att gå via den service-role-gated `/api/admin`-endpointen som `saveRole()` i samma fil korrekt använder. Sidans `init()`-gate döljer bara UI:t, stoppar inte en direkt funktionsanrop i devtools-konsolen.

**Bedömning efter live-RLS-kontroll:** `driving_questions` har bara en SELECT-policy (`"Anyone can read questions"`) — **ingen UPDATE-policy existerar**, vilket betyder RLS by default **blockerar** `resolveReports()`s skrivförsök mot `driving_questions` för icke-service-role-roller. Det praktiska exploateringsscenariot i `docs/security/rls-audit.md` är alltså **inte körbart som beskrivet**. `question_reports` har däremot en `admins_all`-policy som korrekt server-verifierar `profiles.role='admin'` via `auth.uid()` — inte klient-spoofbar. **Slutsats: den ursprungliga HIGH-klassningen nedgraderas till MEDIUM** (kodmönstret är fortfarande fel/inkonsekvent och bör fixas, men är inte idag exploaterbart på det sätt som befarades) — kvarstår som rekommenderad städning inför ny admin-yta för knowledge-engine-tabeller: bygg *alla* skrivvägar via en service-role-gated `api/`-endpoint från start.

## 4. Codex-fynd (oberoende granskning, `docs/codex_review.md`)

| Allvarlighet | Fynd | Status |
|---|---|---|
| HIGH | `api/_per-memory.js:292` — chatthistorik osanerad mot prompt-injection i minnesprofil-prompten (till skillnad från `pageContext`, som saneras) | **Fixat 2026-07-18** — `PRIVATE_OR_SECRET_REGEX` utökad med `_per-context.js`s injection-fraser |
| MEDIUM | `apply_hp_mastery`-RPC saknar radlås vid första försök på en nod → förlorad uppdatering-race | Öppen, lågt allvar (självpåverkande, ingen cross-user-läcka) |
| MEDIUM | `check-role.js:485` — AI-genererat klassrapportinnehåll osanerat i lärarrapport-prompt | Öppen, indirekt injection-väg |
| LOW | Råa felmeddelanden (`String(e)`) läcker till klient i flera endpoints | Öppen, generell härdning |

Ingen av dessa är CRITICAL eller blockerar Fas 0-godkännande.

## 5. Övriga verifierade positiva fynd (inte problem, men värda att känna till)

- Identitetshantering är **konsekvent korrekt** i hela `api/`-lagret: `user.id` härleds alltid från server-verifierad JWT, aldrig från klient-skickat body-fält. Noll träffar vid explicit sökning efter `body.userId`/`body.user_id`/`body.uid`-mönster.
- `hp_*`-tabellerna är det bevisat säkra RLS-mönstret i denna kodbas — inklusive en verklig, dokumenterad incident-och-fix-cykel (en tidigare läckande `hp_questions`-policy som exponerade facit, upptäckt och fixad i `20260701_hp_fixes.sql`).
- `.gitignore` är korrekt konfigurerad, ingen `.env`-fil har någonsin committats.
- Alla externa hemligheter (`OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`) läses uteslutande via `process.env`, ingen klientexponering.

## 6. GDPR — kontoradering

Ingen kontoraderingsendpoint existerar (`grep` efter `deleteUser`/`delete-account`/`GDPR` gav noll träffar). `api/delete-exams.js` rensar bara `user_exams`, inte kontot. Cascade-delete bekräftat korrekt för `hp_*`/`classes`-tabellerna, okänt för resten (kräver live-FK-inspektion om detta blir relevant — inte gjort i denna genomgång eftersom det inte var akut).

## Rekommendation inför knowledge-engine-tabeller

Följ `hp_*`-mönstret exakt (`user_id references auth.users(id) on delete cascade` + `for all using(user_id=auth.uid()) with check(user_id=auth.uid())`). Bygg all admin-/lärarfunktionalitet för de nya tabellerna via en service-role-gated `api/`-endpoint från start — skriv aldrig en RLS-policy som förlitar sig på att UI:t döljer en knapp.
