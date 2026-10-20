# 08 Current Status

## Generation reliability follow-up — 2026-10-20

- [x] The endpoint now delivers a shortened exam only when at least 60% of the requested questions (minimum 2) have passed every existing quality gate. Mixed exams must retain both MC and short-answer types. Rejected or unchecked questions are never included; smaller sets still fail closed and release the reserved quota.
- [x] The student sees the safe `received/requested` count when too few questions pass; a delivered shortened exam uses the existing visible question-count note. Privacy-safe partial-delivery telemetry records counts and quality outcomes without source material or question text.
- [x] Added an isolated `OPENAI_MODEL_EXAM` override so candidate models can be compared for exam generation without changing P.E.R. or other model-backed features. Current default remains unchanged until a measured model evaluation.
- [x] Offline checks: full sequential API suite 174/174; exam-flow Playwright regression 177/177; question-count UI checks 7 assertions. No paid model evaluation or live staging generation was run in this follow-up.
- [x] The changes were pushed to `codex/exgen-generation-quality-2026-10-20` as commit `51a9e3c6d9cd6665d6b699f125c85aad09508aa5`. Vercel Preview `dpl_3QQzvrKwMQeA3V9zjCLVMZJKxff6` is READY at `https://provia-dmfpfaob8-eltons-projects-4adfb1a3.vercel.app/app.html`; its stable branch alias is `https://provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [x] Authenticated Vercel fetch of the new Preview's `app.html` returned HTTP 200. The Preview is deployed, but its live model-backed generation flow has not yet been exercised.
- [!] Do not merge the current generation-idempotency code to `main` until its database migration is reviewed/applied to Production under separate approval. The idempotency ledger migration is currently verified only in staging.

**PILOT NOT READY.** Next: sign in once using the stable branch alias, run a bounded synthetic generation there, and diagnose the resulting request immediately in retained runtime logs. Keep Production schema and account data unchanged until their explicit release gates are met.

## Prior pilot checkpoint — 2026-10-20 19:19 UTC

- [x] Commit `73029ffffd7959f9b672a15b85989cf34c2c4d70` was pushed to `codex/exgen-generation-quality-2026-10-20`. Vercel Preview `dpl_CM5vdB7ZiXcJzoJYu6Fvsivai8u8` is READY from that exact SHA at `https://provia-qhzyjiw2a-eltons-projects-4adfb1a3.vercel.app/app.html`; only the branch Preview alias is attached. No `main`, Production, or stable alias change.
- [x] Authenticated Vercel fetch returned `app.html` and `js/exgen-runtime.js` with HTTP 200; runtime metadata says `environment: pilot` and project ref `yhcinqejsocpmmetazpz`. Raw unauthenticated HTTP receives Vercel's 302 protection redirect; this is not an app-level auth failure.
- [x] After read-only schema verification confirmed the required quota RPCs and app tables, the approved idempotency migration was applied only to staging `yhcinqejsocpmmetazpz`. Supabase recorded version `20261020190719`; the local migration and rollback filenames now use that actual version, with SQL content unchanged. Read-only verification confirms the ledger table exists, RLS is enabled with no client policies, and the three RPCs exist. No Production schema/data was changed.
- [x] Staging ACL readback confirms `anon` and `authenticated` have no SELECT/INSERT on the request ledger and cannot execute the claim RPC; `service_role` has the required table privileges and RPC execution.
- [x] Local P.E.R streaming now requires a terminal provider signal; explicit truncation and clean EOF without a terminal event are returned as interrupted and are not saved or marked `done`. Focused streaming tests pass 10/10; the full sequential API suite passes 174/174; P.E.R. error-announcement and help-ladder checks pass 12/12 and 28/28.
- [x] Browser exam-flow regression passed 177/177 on rerun. The immediately preceding run had one transient mocked-Supabase `Failed to fetch` page error; it did not reproduce on the full rerun.
- [x] At this checkpoint, the P.E.R stream fix and migration-filename reconciliation were local only; they were later pushed with commits `54ec2c5` and `51a9e3c` to the feature branch.
- [!] Authentication and synthetic live testing had not occurred on the Preview origin at this checkpoint. No generation, grading, P.E.R. or provider request had been made after the migration.
- [!] Independent review found that cache replay expiry is seven days but physical payload deletion is only opportunistic on a later claim; there is no scheduled cleanup. Other residuals: ordinary study-mode levels 0–1 rely on model/self-review behavior, and DB idempotency tests stub the quota RPCs rather than proving full quota semantics/concurrency. Address/document retention before actual learner content is used.

**PILOT NOT READY.** Next: authenticate in the exact Preview above, run only the approved bounded synthetic flow, and keep `main`, Production, and staging-account/data cleanup untouched.

## Generation idempotency implementation — 2026-10-20

- [x] The generation endpoint now binds each authenticated request to a UUID idempotency key and a server-computed hash of the normalized settings and study material. A different payload cannot reuse the same key.
- [x] A server-only request ledger provides fenced attempts, a bounded lease, exact successful-response replay, and atomic quota commit + exam issuance + cached response. The client reuses the key for the same account and exact payload without storing the study material in `sessionStorage`.
- [x] The full API Node suite passed 171/171. Targeted frontend checks passed for durable request-key storage/privacy, auth gate, and pilot session recovery. PGlite checks covered replay, payload binding, retries, stale-attempt fencing, quota commit/refund, and service-only access; the lost-response API test confirmed exact replay without a second AI or quota call. `git diff --check` passed.
- [!] The broader `tests/frontend/exam-flow.regression.mjs` still terminates with Playwright `Target page, context or browser has been closed`; this is not counted as a pass.
- [!] At the time this checkpoint was written, the changes and migration had not yet been pushed, deployed, or applied. This historical checkpoint is superseded by the current pilot checkpoint above. The newly deployed implementation still needs authenticated synthetic generate/retry/grade/P.E.R. verification. Two-account live RLS/IDOR and school operational approval also remain open.

**PILOT NOT READY.** No production or `main` change was made. Keep the staging account/data intact.

## Local generation-quality follow-up — 2026-10-20

- [x] The client-side source-word picker now excludes the generic discourse word `alltså`; the API independently filters it even when a client submits it directly. Focus-term tests pass.
- [x] Swedish generation and independent review prompts now explicitly check idiomatic grammar, technical-term inflection, definite forms and prepositions. They include the observed bad form `linjären` as a negative example and `linjens ekvation` as the natural alternative. The API prompt/pipeline and verifier contract tests pass.
- [x] Local checks passed: `tests/api/exam-focus-terms.test.mjs`, `tests/api/exam-pipeline-offline.test.mjs`, `tests/api/verifier-output-contract.test.mjs`, and `git diff --check`.
- [!] `tests/frontend/exam-flow.regression.mjs` did not complete on two attempts; both ended with Playwright reporting that its page/context/browser had been closed during later navigation. No browser-suite pass is claimed.
- [!] These edits are local to the feature worktree and have not been pushed or deployed. No additional live AI request was made; the user-authenticated Preview does not yet contain these local edits.
- [!] At this checkpoint, generation replay was still open. It is addressed by the later local implementation documented above, but awaits a reviewed and separately approved staging migration and Preview verification.

**PILOT NOT READY.** The observed Swedish wording and generic focus-term issues have local fixes and regression coverage, but updated Preview verification, generation idempotency, security isolation, telemetry/security review and school operational approval remain outstanding.

## Latest authenticated staging verification — 2026-10-20 18:39 UTC

- [x] The user confirmed login to Preview `dpl_4mKdmQiWLmbXwMeh9cgrLKwm9tqS` (`4b6b75c`, `https://provia-1z24mdnqu-eltons-projects-4adfb1a3.vercel.app`). The browser showed the authenticated ExGen app; account history and server-backed exam results were visible.
- [x] First generation click was rejected before model work because the staging test account was `gratis` with `mock_quota_count=3` for `2026-W43` (3/3 weekly quota). With the previously approved temporary staging test entitlement, its role was changed to `premium`, then restored to `gratis` after verification. The stored quota count and period remain 3 and `2026-W43`. No production account or setting changed.
- [x] A 348-character synthetic Mathematics 2b source at A-level requesting 3 mixed questions reached generation but failed the verifier's unique-question threshold. No exam was issued. The UI's retry message was generic, but the failure detail correctly explained that enough unique questions could not be verified.
- [x] A richer 632-character synthetic Mathematics 2b source, C-level and 2 short answers, generated successfully. It produced one slope question and one y-intercept question. Both synthetic answers were submitted; grading returned 4/4, with rubric evidence and full-credit answers shown after verified grading. Account history increased from 2 to 3 scored exams, confirming persistence.
- [x] During the active exam, P.E.R gave a concept-level prompt and then a process-check hint without disclosing the answer. “Ge mig svaret” was disabled with the explanation that answers open only after submission. After verified grading, the result page showed complete explanations/answers.
- [!] Live generation quality has a small but concrete issue: the accepted question said “Vad är lutningen för linjären …” (awkward Swedish). The topic extractor also offered the generic word “alltså” as a priority term. Improve prompt/term filtering and add regressions before broader pilot testing.
- [!] The test account is restored to `gratis` and remains at its weekly 3/3 quota. No test account or result data was deleted. No `main`, Production, stable alias, or database schema/migration change occurred.

**PILOT NOT READY.** Live generation, grading, persistence, and answer-gated P.E.R. are now verified on staging. Remaining gates include improving generation language/keyword quality, two-account RLS/IDOR runtime checks, usage telemetry diagnosis, secrets/security review, and school operational approval. Historical status notes below describe prior checkpoints and may be superseded by this section.

## Local verification follow-up — 2026-10-20

- [x] Grading now classifies provider transport, response-body, HTTP, and output-contract failures with an opaque request ID and content-free server diagnostic; response-body interruptions release the grading claim and can be retried. A regression proves no question, answer, or study context enters the diagnostic. The all-single-word `Kesäkten` case is also covered through the independent reviewer + blind solver + bounded repair path. The complete sequential API suite passes 170/170. These remain local/mocked changes, not live provider verification.
- [x] Added an integrated mixed-exam regression where both the MC question and short answer fail independent review in the same pass. The repair prompt must request candidates for both missing types, and the returned exam must retain the requested one-MC/one-short distribution.
- [x] Generic multiple-choice options are now compared after Unicode compatibility normalization, whitespace/case normalization, and removal of terminal sentence punctuation. Math-profile options retain their existing syntax-sensitive comparison and numeric-equivalence check. A regression covers `Stockholm` versus full-width lowercase `stockholm.`.
- [x] Assessment checks and the full sequential API suite passed: 170/170. Focused API and frontend P.E.R. session-recovery tests passed 8/8. These offline/mocked tests do not verify live model output or Preview behavior. The earlier full offline suite was started but its final exit status was not captured; it is not claimed green.
- [x] Serious P.E.R. corrections now update the saved assistant history when the corrected-history write succeeds; the streaming client also replaces its local history from that event. The answer still streams before optional self-review, so this improves future-turn context but does not hide an initial answer before a correction.
- [!] Commits `ae2cd1d` and `781dd10` were pushed to the approved feature branch. Vercel Preview `dpl_GfQx4ukSwAwakZyTy6TCvqES57vT` is READY from exact SHA `781dd10` at `https://provia-oj6r2zfao-eltons-projects-4adfb1a3.vercel.app`. Local commit `e3b427f` and the current P.E.R. history changes are not in that deployment. No alias movement, `main` merge, Production operation, or staging-data change was made.
- [!] Password changes must be entered and submitted by the user. The Supabase staging users page and the latest Preview login are the next manual handoff; after the user signs in, run only the previously approved bounded synthetic staging checks.

**PILOT NOT READY.** Authenticated Preview verification, telemetry diagnosis, two-account RLS/IDOR runtime checks, and school operational approval remain outstanding.

## Latest staging verification and local follow-up — 2026-10-20

- [x] After explicit approval, applied both grading-state migrations only to Supabase staging `yhcinqejsocpmmetazpz`; hosted ledger records `20261020170419` and `20261020170431`. Schema/RPC ACL checks and isolated PostgreSQL migration tests passed.
- [x] Authenticated Preview deployment `dpl_7jos5URBMRAY8pyREffo4V1RMRch` ran a synthetic Mathematics 2b exam end-to-end: three questions generated, active-exam P.E.R withheld answer-bearing help, submission graded 6/6, and the verified result plus account-history row were saved. Post-grade P.E.R. produced a verified-evidence explanation. Its answer included an unsolicited follow-up practice question, which may be refined.
- [!] The student selected mixed questions, but the live exam delivered three MC questions. Current prompt text requests a mix; prior server validation did not enforce the final distribution. Local code now targets one MC plus one short answer for 2 questions, and one MC plus two short answers for 3, with type-specific bounded repair in both structural and verifier-driven repair paths. Integrated 2- and 3-question regressions cover both repair paths and confirm fail-closed behavior when the model ignores the missing-type instruction; not yet deployed or live-verified.
- [!] Preview emitted `ai_usage_event_write_failed` for a four-event batch. Read-only staging metadata confirms the event table columns and constraints are compatible with the repository payload shape; an aggregate over the exact test window found no corresponding batch rows. The actual HTTP/database/network cause remains unknown because the old logger discarded status and error class. Local telemetry now logs only bounded HTTP status, database code, timeout/network category and safe class; no response body, secret or study text is logged. This diagnostic change needs a Preview run before cause can be confirmed.
- [x] The remaining grading claim metadata stays attached to the issuance after a verified save, preserving the answer fingerprint for recovery; the claim RPC checks the verified result before treating that row as pending. The observed row is therefore not by itself evidence of an unfinished grade.
- [x] The complete API test directory passed sequentially in this follow-up: 169/169 tests, including the two new ordinary-study P.E.R. handler tests. The migration regression set also passed 3/3. These are local/mocked tests, not provider-quality evidence.
- [x] Commit `edb02e4` was pushed to the approved feature branch and Vercel Preview `dpl_E565jdnYDqi1sMd8fDEdWz6CUFEK` reached `READY` from that exact SHA. Its deployment URL is `https://provia-3ctbcd5ra-eltons-projects-4adfb1a3.vercel.app`.
- [!] The new Preview opens at the staging login gate. No authenticated generation/P.E.R. request was made in this follow-up. The branch now points to `edb02e4`; local HEAD is `c0949a9` with the new P.E.R. test changes, so those later local changes are not in the Preview.
- [!] The full sequential suite previously had one `pilot-session-recovery` navigation timeout; the same test passed alone (1/1). The full suite is not claimed green.
- [ ] No `main`, Production, Preview alias or staging data was changed in this follow-up.
- [ ] Two-account RLS/IDOR runtime checks and school operational approvals (student-data scope, retention, teacher access, support and incident handling) remain open. Preserve the synthetic staging account and its data absent separate approval.

**PILOT NOT READY.** Live generation, answer-gated P.E.R., grading and result persistence now have staging evidence. Mixed-type fulfillment and usage telemetry remain unverified live; security isolation and school approvals are also open.

## Historical pre-migration staging schema/security snapshot — 2026-10-20 17:00 UTC

- [x] Current feature branch is `codex/exgen-generation-quality-2026-10-20`, HEAD `303b3c6dbd5d5f087a235f8a6dc6ced4e82f3a68`. Vercel Preview `dpl_7jos5URBMRAY8pyREffo4V1RMRch` is `READY` from that exact SHA; the approved stable Preview alias resolves to this deployment. No push, alias change, `main` merge, Production deploy, or database write was made during this audit.
- [x] Read-only metadata queries against staging `yhcinqejsocpmmetazpz` found RLS enabled on every `public` table. Reviewed student-owned policies use `auth.uid()` ownership checks; `user_exams` also has restrictive owner policies, so its permissive `true` policies do not by themselves permit cross-user reads/inserts. This is catalog evidence only, not a two-user authenticated IDOR test.
- [x] The public view found, `concept_collective_stats`, grants no `SELECT` to `anon` or `authenticated`. Supabase Security Advisor reports 40 public `SECURITY DEFINER` functions and flags four as executable by client roles (`handle_new_user`, `rls_auto_enable`, `student_error_events_consistency`, `sync_report_count`). Catalog inspection shows these return `trigger`/`event_trigger`; three are bound to triggers and `rls_auto_enable` is an event-trigger function. Direct RPC invocation was not tested. `sync_report_count` is `SECURITY DEFINER`, has no fixed `search_path`, and references `question_reports`/`driving_questions` without schema qualification; prepare and review a hardening migration before broader pilot access. The advisor also flags mutable `search_path` for invoker `match_knowledge_chunks` and disabled leaked-password protection; no database/Auth setting was changed.
- [x] Security Advisor lists 29 public tables with RLS enabled and no policies. Many are intended server-only tables; the exposed-table/RLS metadata query found no RLS-disabled public table. Per-table client access was not runtime-tested.
- [!] Metadata shows broad `TRUNCATE` table grants to `anon` and `authenticated` on multiple `public` tables, alongside RLS. RLS does not govern `TRUNCATE`; direct exploitability through the Supabase Data API was not tested. Review/revoke unnecessary client grants before widening pilot access; no grants were changed.
- [!] The deployed API and staging grading schema are incompatible. Current API code sends `p_claim_id` to `claim_exam_grading`, `release_exam_grading`, and `persist_graded_exam_result`; staging exposes only the old 3-argument claim/release and 10-argument persist signatures. Staging also lacks `exam_issuances.grading_claim_id`. Read-only migration-ledger check did not find versions `20261019130000` or `20261020091748`.
- [x] A privacy-minimized aggregate found 2 issuance rows with active grading claims; both are older than the 2-minute stale threshold and there are no claims newer than that threshold. No row identifiers or student content were read. The fencing migration will backfill claim IDs for these two stale rows; do not apply it during a live grading run.
- [x] Local isolated PostgreSQL/PGlite regression tests passed for the fencing and verified-abandonment migrations: `grading-claim-fencing-postgres`, `grading-claim-fencing-migration`, `verified-exam-abandonment-migration`, and `grading-attempt-contract` (4/4 files). These do not prove hosted staging behavior.
- [ ] Applying `20261019130000_fence_stale_exam_grading_claims.sql` then `20261020091748_fix_unverified_exam_abandonment_state.sql` to staging remains a separate schema change requiring explicit approval. The first adds a column, backfills any active grading claims and replaces/overloads grading RPCs; the second replaces abandonment RPC logic. Both have rollback files that intentionally refuse unsafe rollback.
- [ ] Authenticated live generation, grading/save, P.E.R. (normal and exam mode), and two-user RLS/IDOR verification remain incomplete. Preserve the synthetic staging account/data. Production and `main` remain untouched.

**PILOT NOT READY.** The staging grading contract is definitively behind the Preview API; obtain approval for the exact staging migrations, apply and verify them, then perform the bounded synthetic live flow once the user is authenticated.

## ExGen school pilot — verified status 2026-10-20 16:55 UTC

- Auth-fix application commit `15a95880d49a9f54430e47ef2b508317c5c00c7f` and status-doc commit `691cd290a4b8fc50ec4347d33abe5cfca8764f73` are pushed to feature branch `codex/exgen-generation-quality-2026-10-20`.
- Vercel deployment `dpl_7adHe5wkw7rf5VEpDa5HV97PMLaD` is `READY` from exact docs commit `691cd29`; its app code includes `15a9588`. The stable Preview alias `provia-ai-git-codex-exgen-schoo-1725d7-eltons-projects-4adfb1a3.vercel.app` resolves to this deployment. No `main` merge, Production deployment or database change was made.
- The preceding live generation attempt on deployment `dpl_83i2yFcRadJDSN3DVecMyVF8irz4` logged `exam_auth_rejected`, stage `auth_user_lookup`, `TimeoutError`, after the old 5-second timeout. The new code performs one bounded retry (8 seconds per request), distinguishes invalid user token (401) from Auth service unavailability (503), and shows an appropriate retry message in the UI. This is not yet live-verified.
- Offline verification passed: 196 Node tests across 95 API, assessment and P.E.R. test files; focused auth/pipeline/Supabase-key tests passed 10/10; 10 browser/UI/eval files completed, with Node reporting 13/13 subtests and specific P.E.R. exam-context 66/66, ladder 28/28 and error-announcement 12/12; `git diff --check` passed. These are code/mock tests, not live provider evidence.
- Vercel metadata shows encrypted staging-scoped variables on the feature branch, including pilot URL, server secret, OpenAI key, exam signing secret and pilot flag. Values were not read or exposed.
- The new Preview tab currently shows the sign-in gate. In the exact 2026-10-20 16:37-16:40 UTC staging Auth log window, 13 successful `GET /user` requests had `referer=http://localhost:3000`; no request from the Preview was present in the returned aggregate. This does not establish why the Vercel request timed out. The underlying cause is unknown, and no live generation, grading, persistence or P.E.R. test was possible after the latest deployment.
- The latest Preview emitted a Node.js `DEP0169` `url.parse()` deprecation warning while serving an unauthenticated `/api/abandon-exam` request. The route returns 401 when unauthenticated by design; the observed stderr warning is from a dependency and is not evidence of an application exception.

**PILOT NOT READY.** Next: authenticate in the stable staging Preview, then run the bounded synthetic generation -> grade/save -> P.E.R. checks. Preserve staging account/data; do not touch Production or `main`.

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
