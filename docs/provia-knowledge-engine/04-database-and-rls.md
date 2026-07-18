# 04 — Database and RLS (syntes + live-verifiering)

Fullständigt statiskt underlag: `docs/current-system/database-map.md`, `docs/security/rls-audit.md`, `docs/security/service-role-audit.md`. **Detta dokument tillägger live-verifiering mot databasen** som genomfördes under Fas 0 (utöver read-only-mandatet, motiverat av att den statiska analysen inte kunde avgöra RLS-status för 11 tabeller och detta var den enskilt viktigaste öppna frågan för GO/NO-GO-beslutet).

## Live-verifierat resultat (ersätter den statiska analysens "okänt")

```sql
select c.relname, c.relrowsecurity, count(p.polname) as policy_count
from pg_class c left join pg_policy p on p.polrelid=c.oid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' group by 1,2;
```

**Resultat: samtliga 28 publika tabeller har `relrowsecurity = true`.** De 11 tabeller den statiska kartläggningen inte kunde verifiera (`profiles`, `user_exams`, `user_profiles`, `driving_questions`, `driving_progress`, `driving_results`, `mock_results`, `per_long_memory`, `per_sessions`, `question_reports`, `user_plans`, `user_roles`, `attempts`, `daily_usage`, `last_result`, `materials`, `mistakes`) har mellan 1–4 policyer vardera — inte noll, inte avstängt.

**Enda faktiska avvikelsen som live-verifieringen avslöjade:** `profiles_update_own` (se `02-security-findings.md` §2) — inte en frånvaro av RLS, utan en för generös policy. Nu åtgärdad.

**4 tabeller har RLS PÅ men noll policyer** (`anon_rate_limit`, `hp_normering`, `hp_ord_lexicon`, `hp_questions`) — detta är **avsiktligt deny-by-default** (bekräftat i migrationskommentarer), inte ett fel. Endast service_role kan nå dem, vilket matchar hur de faktiskt används i koden.

## Reviderad riskbild

Den statiska analysens "KRITISKT FYND" om `admin.html` (§rls-audit.md) nedgraderas till MEDIUM efter live-policykontroll — se `02-security-findings.md` §3 för detaljer (RLS på `driving_questions` blockerar faktiskt det befarade skrivscenariot; `question_reports` har en korrekt server-verifierad admin-policy).

## Tabellinventering (oförändrad från statisk analys, nu med bekräftad RLS)

| Kategori | Antal | RLS |
|---|---|---|
| Fullständigt spårade i migrations (`classes`, `class_members`, `hp_*`) | 10 | PÅ, verifierat korrekt (utom historisk `hp_questions`-läcka, redan fixad 2026-07-01) |
| Ej spårade i migrations, nu live-bekräftade | 18 | PÅ, policyer verifierade (1 lucka fixad under denna genomgång) |

Full kolumninventering (rekonstruerad från kodanvändning för de ospårade tabellerna) i `docs/current-system/database-map.md` §3–4.

## RPC-funktioner

7 kvot-/mastery-RPC:er identifierade, samtliga `security definer` med `revoke ... grant to service_role` — korrekt mönster, inte anropbara direkt av klient. Ett race-fönster (Codex-fynd, `apply_hp_mastery` saknar lås vid första försök på en nod) — se `02-security-findings.md` §4.

## Storage

En bucket (`question-images`), publik av design, endast service_role-skriven.

## Realtime / cron / Edge Functions

Inget av detta används idag — relevant för `10-open-questions.md` fråga #1 (hosting för nya funktioner), eftersom Supabase Edge Functions är en helt oanvänd men tillgänglig yta.

## Rekommendation för nya knowledge-engine-tabeller

1. Kör `hp_*`-mönstret exakt (bevisat säkert, har genomgått en verklig incident-och-fix-cykel).
2. Skriv RLS-policyn samtidigt som schemat, inte efteråt — både `hp_questions`-incidenten och den nu fixade `profiles`-luckan uppstod av att en policy skrevs för generöst/för sent relativt UI-koden.
3. Spåra alla nya tabeller i `supabase/migrations/` från start (till skillnad från de 18 tabellerna som inte är det) — det var just avsaknaden av spårning som gjorde `profiles`-luckan svår att upptäcka statiskt.
