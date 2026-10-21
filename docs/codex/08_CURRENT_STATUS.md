# 08 Current Status

## Latest pilot checkpoint — 2026-10-21

This is the current checkpoint. Older entries below are chronological snapshots; where they conflict with this section, this section is newer.

- [x] Current feature Preview `dpl_EeUdRtWVXviNd6JsZYzfCzMb4pX1` is `READY` from SHA `2fffb5fdf0181838b2e27a097177bb9fec3f5fa2` on `codex/exgen-generation-quality-2026-10-20`; its stable alias is `provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app`. Commits `6e77bdd`, `786bf73`, and `2fffb5f` are pushed; `main` and Production are untouched.
- [x] Vercel CLI fallback confirmed branch-scoped Preview metadata for the pilot runtime/config variables on that exact branch. Values remained encrypted; metadata presence does not independently prove which server-side Supabase URL an executing function used.
- [x] The startup-race cleanup is included in the current Preview: it removes a redundant early quota/Auth lookup, leaving the existing final quota refresh after `window.ExGenEngine` registration. The delayed-Auth test and the full exam-flow regression pass locally.
- [x] Current focused checks passed: frontend/pilot boundary 11/11, generation/P.E.R./issuance/quota API tests 62/62, delayed-Auth browser test, complete exam-flow regression 184/184, and sitemap lastmod test. The complete offline suite passed sequentially with `--test-timeout=60000` (exit 0). An earlier run hit the default timeout in `app-auth-gate.test.mjs`; that test passed alone (22.4 s) and in the longer-timeout full run. This is local/mock evidence only.
- [!] Authenticated read-only Preview inspection confirms the pilot runtime `appOrigin` is `https://provia-ai-git-codex-exgen-schoo-1725d7-eltons-projects-4adfb1a3.vercel.app`. Vercel alias lookup maps that callback host to old READY deployment `dpl_7jos5URBMRAY8pyREffo4V1RMRch`, SHA `303b3c6`; the current stable feature Preview alias maps to `dpl_SgpVo9TTiaGTkTPYBAuqWXteePsU`, SHA `2fffb5f`. This is a confirmed callback/deployment mismatch; it may cause recovery to serve stale code, but does not by itself establish the cause of the earlier session mismatch. No alias or Supabase redirect setting was changed.
- [x] Free, model-less quality preflights passed: subject-routing fixtures plus nine counterexamples, and all 25 structural P.E.R. gold-set checks. The paid model-comparison runner was not run; these checks do not establish live model quality.
- [!] After deploying current SHA `2fffb5f` to the stable feature Preview, the synthetic staging session was recognized and the app opened normally. A synthetic 3-question Matematik 2b exam was stopped with `Provkvoten är slut`; the UI maps this from `/api/generate-exam` HTTP 429 `Quota exceeded`, returned before `streamGeneration`, so no OpenAI generation ran. A separate synthetic P.E.R. request was stopped with `P.E.R-kvoten är slut`, so no answer was generated. The exact remaining counts/caps were not independently read. No role, quota, account, database, Production or `main` change was made.
- [x] Added a local browser regression for signed-in account-page → Mockprov navigation; it passes with the synthetic Auth/profile mocks. This proves the ordinary same-origin flow in the local harness only, not the Preview failure.
- [x] The authenticated current feature Preview visibly offers generic focus chips `övningsmaterial` and `testunderlag`. A local follow-up filters these labels and the split English label “Study guide” from learner focus choices and server-side model instructions, while preserving `guide` when it also occurs in subject content. Focus-term/API tests and a focused local browser smoke passed; the broad browser regression hung on this run and was stopped. The follow-up is not pushed/deployed.
- [x] A second local UI follow-up now uses `meta.partial` to tell the learner how many requested questions passed review, and keeps that notice visible in the exam guide; the old UI showed only a generic success toast, which the P.E.R.-led surface suppresses. A focused browser test verified “2 av 3” with exactly two rendered questions. Not pushed/deployed.
- [!] Pilot still needs a current-Preview live generation with all requested questions and acceptable content, P.E.R. outside/inside active exam, grading and verified persistence/recovery, plus hosted two-JWT RLS/IDOR and school privacy/operational approval. Prior saved staging results belong to an older Preview only, not this SHA.

**PILOT NOT READY.** Current feature Preview is `READY` at `2fffb5f`, and the staging session was recognized in this browser run. Local focus-term and partial-delivery UI improvements are not deployed. The runtime recovery callback points at an older deployment; get explicit approval before moving only the approved Vercel aliases to a matching READY Preview. Next, after exact approval, push the reviewed local commit chain; then wait for ordinary staging exam and P.E.R. quotas to replenish or obtain separate approval for a specific bounded quota change before retrying model-backed checks. Keep Production and `main` untouched.

## Local P.E.R. quota failure-settlement — 2026-10-21

> Historical snapshot: the later `5fccaff` commit is an ancestor of the current READY Preview at `1c06b91`; the local-only/deployment statements in this snapshot are superseded by the latest checkpoint above.

- [x] Replaced the API's direct `consume_per_chat_quota` increment with a request-ID-bound reservation flow for P.E.R. routes. Successful model responses commit the reservation; provider/stream failures refund it. Explain-cache hits are checked before quota reservation.
- [x] Added a local forward migration with a service-role-only reservation ledger, profile-row locking, period-aware counters, idempotent commit/refund, two-minute stale-reservation cleanup, RLS, and restricted grants.
- [x] Added PGlite execution coverage for the actual migration: application, quota cap, repeated reservation/refund, commit protection, period reset, stale cleanup, and table/function privileges passed. The first full serial run found one stale static assertion in `tips-prompt-security.test.mjs`; it now requires refund plus the unchanged generic error. The focused eight-file API/P.E.R./quota suite passed **71/71** after correction. The full suite was not rerun afterward.
- [x] `node --check api/explain.js` and `git diff --check` passed.
- [!] The migration has not been applied to staging and the code has not been pushed or deployed. PGlite is local PostgreSQL evidence, not hosted Supabase drift/RLS verification. The existing `04e542a` Preview still uses the previous quota behavior.
- [!] Live generation remains blocked because the exact `04e542a` Preview shows the invited-account sign-in gate. The already approved one-time Premium staging test remains unused; no role, quota, provider, staging database, or Production action occurred.

**PILOT NOT READY.** Review this migration against the hosted schema/migration history, obtain separate staging-DDL approval, deploy the code only to the existing Preview branch, then authenticate and run the approved single synthetic generation on the exact new READY Preview. Keep `main` and Production untouched.

## Latest bounded staging attempt — 2026-10-21

- [x] Re-read the active pilot objective and verified the exact Vercel deployment `dpl_4wYECkQiFV83ch1xHnfkJG6k2AXR`: `READY`, branch `codex/exgen-generation-quality-2026-10-20`, SHA `04e542aa1fb1452fd4433d2d4c730bf1f82a67a2`. Its deployment-specific URL is `https://provia-igzpkctdv-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [x] The deployment opens at the invited-school-account sign-in gate. No authenticated session was present; the approved synthetic three-question request was therefore not submitted.
- [x] A read-only staging profile check before and after confirmed one matching synthetic profile still has role `gratis` and quota count `5`. No role, quota, account, database, or production data was changed; no OpenAI request or model cost occurred.
- [x] The user has approved exactly one synthetic three-question generation using temporary staging Premium, with immediate restoration to Gratis. This approval remains unused and narrowly scoped to the verified deployment/test.
- [x] Offline source-reference, exam-pipeline, verifier-contract, assessment, and solver tests passed (5 test files; exit 0). This does not substitute for provider-backed generation evidence.
- [x] Additional P.E.R. offline checks passed: review/completion-proof/error/stream tests (4 test files), quota-contract test, and the pedagogy/help-ladder suite. The quota-contract test proves ordering/fail-closed behavior, not refund after provider failure; that staging risk remains open.

**PILOT NOT READY.** Next: the user signs into the exact deployment-specific Preview linked above and reports when ExGen is visible. Then perform the one approved synthetic generation, restore Gratis immediately, and verify the resulting question count and quality without issuing a second model request.

## Current pilot checkpoint — 2026-10-21

- [x] The approved eight-commit range through `04e542a` is pushed to `codex/exgen-generation-quality-2026-10-20`. Git readback confirmed remote and local HEAD at `04e542aa1fb1452fd4433d2d4c730bf1f82a67a2`; the worktree was clean.
- [x] Vercel deployment `dpl_4wYECkQiFV83ch1xHnfkJG6k2AXR` is `READY` for that exact SHA and branch. Preview: `https://provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app/app.html`. No `main` merge or Production action was performed.
- [x] The exact-HEAD offline evidence recorded below includes exam-flow **184/184**, P.E.R./exam-context **66/66**, and the selected P.E.R./assessment/exam matrix **112/112**. These are offline regressions, not provider-backed quality evidence.
- [x] Fresh full sequential run on `04e542a`: all **178 discovered test files** completed with exit code 0 using `node --test --test-concurrency=1 --test-reporter=dot $(rg --files tests -g '*.test.mjs' -g '*.test.js')`.
- [!] Staging exam and P.E.R. requests were previously rejected at exhausted quota before model generation. No successful live model response has been verified on this code; do not present the Preview as live-quality validated.
- [!] P.E.R. quota review: read-only SQL inspection of staging confirmed `consume_per_chat_quota` locks the profile row and increments `profiles.per_quota_count`; it accepts no request/idempotency key. `api/explain.js` consumes this before provider work, and provider-error branches return without a refund call. Thus a provider failure can consume a learner's P.E.R. quota. The forward migration defining this RPC is absent from the checked-in migration set (only its rollback is present). Do not add a blind counter decrement; a fix needs a reviewed idempotent reservation/refund contract, migration source, and separate approval before staging DDL.
- [!] Pilot acceptance remains open for model-backed generation, grading/persistence and P.E.R. verification, plus the previously identified two-account RLS/IDOR and school operational/privacy approvals. No quota/account, database, `main`, Production, or staging-data changes were made in this increment.

**PILOT NOT READY.** A later, separate approval now permits temporary Premium for exactly one synthetic staging generation, followed by immediate restoration to Gratis; it remains unused because the exact Preview requires sign-in. No quota change is authorized. See the latest bounded-attempt checkpoint above.

## Result recovery after reload — 2026-10-21

> The deployment/push statements in this checkpoint were accurate before the approved push recorded above; treat them as historical, not current release status.

- [x] A successful exam grade now retains the user-bound signed exam snapshot, answers, and P.E.R-used flags as a short-lived local recovery draft. If the server confirms the issuance is completed after reload, the student can explicitly restore the result through the existing exact-answer, idempotent server replay; the UI still requires a verified result/proof before showing the result or P.E.R answer-review actions.
- [x] Starting a new topic still clears the recovery draft. Failed or unverifiable recovery keeps the saved answers and offers retry; it does not show local/unverified answer keys.
- [x] Added a browser regression for grade -> reload -> one recovery replay -> restored submitted answers and P.E.R review actions. The latest `EXAM_FLOW_ONLY_RESULT_RECOVERY=1 node tests/frontend/exam-flow.regression.mjs` run passed **120 checks, 0 failures**; an earlier repeat was flaky at 119/1 and should be watched. `node tests/frontend/per-exam-context.test.mjs` passed **66/66**. The broader selected P.E.R, exam-pipeline, assessment, completion-proof, grade-to-review, and P.E.R review-handler matrix passed **112/112 Node tests**. `node --check` on changed JavaScript and `git diff --check` passed.
- [x] The complete `node tests/frontend/exam-flow.regression.mjs` browser regression passed **184 checks, 0 failures** on the latest run. One earlier focused-only repetition was flaky at 119/1; its subsequent rerun passed 120/120, so retain this as a watch item rather than treating the flake as resolved.
- [!] The authenticated READY branch Preview still reports exhausted exam quota; the synthetic P.E.R check also returned “P.E.R-kvoten är slut.” Both handlers reject at their quota gates before model generation (`api/generate-exam.js` before `pickModel`, `api/explain.js` before the chat model call). No successful provider-backed response was observed. No account, role, quota, Supabase, `main`, or Production change was made.
- [!] The explicitly approved range of eight commits through `b46bd55` is pushed and its Vercel Preview is READY at `https://provia-3eyj9tgac-eltons-projects-4adfb1a3.vercel.app`. Later local generation-quality commits and the current result-recovery changes are not in that Preview. No further push/deploy was authorized.

**PILOT NOT READY.** Next: once ordinary staging quotas are available, run the bounded synthetic generation and P.E.R checks, then verify grading persistence on the READY Preview. Review the later local generation-quality and result-recovery changes; obtain explicit approval for the exact additional commit range before pushing/deploying. Do not widen quota or clean staging data without separate approval.

## Shortened exam notice clarity — 2026-10-21

- [x] A delivered exam with fewer questions than requested already had an inline, mobile-layout-tested notice. Its wording now explicitly says that the included questions passed quality review, in Swedish and English; singular/plural English grammar is covered by the browser test.
- [x] `node tests/frontend/exam-result-language-and-note.test.mjs` passed, `node tests/frontend/exam-question-count-minimum.test.mjs` passed (7 assertions), and `git diff --check` passed.
- [x] The first standalone `node tests/frontend/exam-flow.regression.mjs` run reported 177 checks passing and one browser-side `TypeError: Failed to fetch` from external Supabase auth initialization in the English-first-load fixture. A scoped listener now records only failed `/auth/v1/` requests to the synthetic `.invalid` test host, making this failure diagnosable without logging credentials or response bodies.
- [x] A rerun of `node tests/frontend/exam-flow.regression.mjs` after that instrumentation passed **178/178**. The full sequential `node --test --test-concurrency=1 --test-reporter=dot $(rg --files tests -g '*.test.mjs' -g '*.test.js')` run also exited 0 across 178 test files.
- [!] A later repeat of the standalone browser test was manually interrupted after it remained in the simulated browser flow for over two minutes; it is not counted as a pass and did not complete. The earlier 178/178 run remains the last completed result.
- [!] Current local code changes are not on the READY deployment. Vercel's accessible READY deployment remains exactly `63533b6`. The authenticated branch-alias tab is now confirmed in the app, but shows “Provkvoten är slut” for the staging account; no live model request was made and no account/role/quota was changed.

**PILOT NOT READY.** The wording improvement and browser flow are covered offline. The approved synthetic live test is blocked by the visible exhausted staging quota. Next: wait for normal quota reset or obtain separate approval for one bounded staging entitlement change; do not change role/quota, production, `main`, or database settings in the meantime.

## Objective corrupted option guard — 2026-10-21

- [x] The deterministic assessment gate now blocks multiple-choice options containing Unicode replacement characters or C0/C1 control characters, reported as `corrupted_option_text`. It allows ordinary spaces, tabs, line breaks and carriage returns; it does not try to decide whether unfamiliar vocabulary is a real word.
- [x] Regression cases cover a damaged non-math science distractor, C0 and C1 controls, ordinary whitespace, and valid technical terms absent from the source. This preserves model review for semantic/plausibility questions rather than adding a brittle dictionary heuristic.
- [x] `node --check api/_assessment.js`, `node tests/assessment/subject-overlays.test.mjs`, `node tests/api/exam-pipeline-offline.test.mjs`, `node tests/api/solver-contract.test.mjs`, `node tests/api/verifier-output-contract.test.mjs`, `node tests/frontend/exam-flow.regression.mjs` (178/178), `git diff --check`, and the full sequential 178-file test run passed.
- [!] This is deterministic protection against corrupted text only. It does not prove that verifier and solver will identify semantic nonsense when both models incorrectly approve it; no model-backed live generation was run.

**PILOT NOT READY.** Continue with a safely bounded semantic regression fixture and live staging verification only after the exact Preview session is demonstrably authenticated. No `main`, Production, staging role/quota, or database changes.

## Provider error safety and grading deadline reserve — 2026-10-21

- [x] Exam-generation failures no longer return an upstream OpenAI response body or raw provider details to the browser. The client receives a localized retry-safe message, request ID and stage; server telemetry records only a bounded category and upstream HTTP status.
- [x] Grading now computes its provider timeout from the 60-second route budget and reserves 30 seconds for validation, result persistence, recovery bookkeeping and cleanup. It refuses to start model work when fewer than four provider seconds remain. The optional learner-loop feature-flag lookup is bounded to one second and remains fail-closed.
- [x] Regression coverage includes a synthetic provider body sentinel, safe failure telemetry, and provider-budget boundary cases. The three focused grading/generation tests passed. Syntax checks and `git diff --check` passed; the complete sequential suite passed **324/324 test files**.
- [!] These changes are local and have not been pushed or deployed. The accessible Preview tab currently shows the sign-in gate, despite the user's report of being logged in, so no live generation or grading attempt was made. No new provider call, role/quota change, Supabase mutation, `main` merge or Production action was made.

**PILOT NOT READY.** Next: confirm the authenticated session in the exact staging Preview, then request/confirm approval to push these new code changes and create a Preview before any bounded synthetic live request. Keep production and `main` untouched.

## Non-blocking review hint for all-word distractors — 2026-10-21

- [x] Swedish multiple-choice exams now add `mixed_source_support_single_word_options_review` when every option is a standalone word and only some options match terms in the supplied source. The signal is passed to both first-pass and repair verification.
- [x] When none of the standalone-word options has a direct source-term match, the verifier now receives `all_single_word_options_unmatched_source_review`. Both signals are review-only; neither treats source absence alone as proof that a valid synonym or technical term is wrong.
- [x] Regression confirms the all-unmatched signal survives verifier hint filtering and that the gate retains the question for review. Subject-overlay, verifier-contract and offline generation-pipeline tests passed; changed JavaScript syntax checks and the complete sequential `tests/**/*.test.mjs` suite passed after this change.
- [x] The verifier is explicitly told to inspect each option, not reject on the signal or source absence alone, and retain valid names/technical terms. The rule does not drop questions, alter solver checks, delivery thresholds, or quota behavior.
- [x] Regression tests cover mixed, uniformly supported, and uniformly unsupported all-word options. The pipeline tests confirm the hint reaches the verifier and that a valid mixed-support technical-options question can still be delivered. Subject overlays and offline exam pipeline passed, and the complete sequential test suite passed.
- [x] When no first-pass question survives review, the bounded repair requests up to six candidates. Its prompt receives only allowlisted numeric counts from reviewer and blind-solver failure categories, with category-specific static guidance; rejected stems, answer keys, and free-form reviewer/solver text are never passed. A fixture-driven 0/3 biology integration regression confirms the repair path can return three unique candidates when stubs provide approvals after solver-only first-pass rejection. This tests application flow, not real-model recovery or question quality.
- [x] Source-term matching no longer treats a truncated prefix such as `Kloropla` as the same term as `Kloroplasterna`; bounded Swedish inflection matching includes the `-or`/`-a` pair (`cellkärnor`/`cellkärna`) and has regression coverage.
- [x] Independent review found and reproduced the missing `-or`/`-a` inflection case; the new regression failed before the fix and passes after it. Subject-overlay plus generation-pipeline tests passed, changed JavaScript syntax checks passed, and the complete sequential `tests/**/*.test.mjs` suite exited 0 after the correction.
- [x] P.E.R now persists the current pilot question while a response is in flight, so a reload restores it for an explicit retry without resending automatically. If the account changes before token lookup completes, only the old account's pending question is cleared. The browser regression covers reload recovery, completion cleanup, and account isolation.
- [x] Verification after these changes: focused P.E.R browser test passed; subject-overlay and offline generation-pipeline tests passed; all changed JavaScript files passed `node --check`; complete sequential `tests/**/*.test.mjs` suite exited 0.
- [x] Fresh verification at local HEAD `8c0a256`: `node --test --test-concurrency=1 --test-reporter=dot $(rg --files tests -g '*.test.mjs')` exited 0. An independent read-only review of the current generation/verifier/P.E.R. diff found no actionable issue; its four focused regression files passed.
- [x] Current browser verification at `8c0a256`: `node tests/frontend/exam-flow.regression.mjs` passed **178/178** with 0 failures. Separate grading recovery/provider timeout, completion-proof, grade-to-P.E.R integration, post-exam review, and active-exam P.E.R. context regressions passed **67/67** at `ee86fe3`. These are offline/browser regressions with stubbed APIs, not live provider or staging evidence; this successful rerun supersedes the older Playwright-browser-closed attempts below.
- [x] `node scripts/a11y-audit.mjs` passed on the current local tree: zero axe violations on the audited pages/cookie banner, zero console errors, and no horizontal overflow on the 390px privacy-page check.
- [!] This is a review-quality signal, not a deterministic nonsense detector. A fresh browser check found the signed-in branch alias at the exhausted Gratis quota; the separate `provia-98q3pstsi-...` Preview tab showed the auth gate. Vercel identifies that deployment as READY at `63533b6`, while local HEAD `8c0a256` is not deployed. No model-backed yield was measured in this turn. No account/role/quota, Supabase, Preview, `main`, or Production change was made.
- [!] These bounded repair, source-matching and P.E.R recovery changes are local and have not been deployed. Their effect on real model yield, latency and token usage is unverified.

**PILOT NOT READY.** Next: after normal quota reset or separately approved temporary test access, compare generated/reviewed question yield with this signal enabled. Continue the remaining live generation, grading/P.E.R., two-account RLS/IDOR, and school-operation checks.

## Matteprov: poängmatris i linje med frågan — 2026-10-21

- [x] Granskning av liveutfallet och den verkliga produktionsprompten hittade en motsägelse: kortsvarsinstruktionen säger att matrisen bara får bedöma uttryckligen efterfrågat arbete, medan matteprompten generellt krävde att varje uppgift delar poäng mellan metod och slutsvar. Det kunde skapa poängmatriser med metodkrav som frågetexten inte ställde.
- [x] Svensk och engelsk matteprompt kräver nu metodpoäng endast när frågan uttryckligen ber eleven visa eller förklara metoden. Frågor som bara begär slutsvar poängsätter bara slutsvaret. Modellsvar får fortfarande innehålla en full lösning, men utökar inte elevens poängkrav.
- [x] Regression täcker båda språken och kontrollerar att uppgiftskrav, matris och fullständigt modellsvar inte motsäger varandra. `node tests/api/exam-pipeline-offline.test.mjs`, hela sekventiella API-sviten, `node --check api/generate-exam.js` och `git diff --check` passerade.
- [x] Commit `63533b6` är pushad till `codex/exgen-generation-quality-2026-10-20` och deployment `dpl_435wsREUvHjTk2vBDfGfoG99wdmq` är `READY` från exakt commit och branch. Den stabila Preview-aliasen pekar på samma deployment; `main` och Production ändrades inte.
- [x] Offlinekontrollerna för exam-pipeline, verifierarens beslut, ämnesöverlägg och kostnadsfri ämnesroutning passerade. Hela testsviten passerade seriellt med `--test-concurrency=1` och exitkod 0. En tidigare standardkörning rapporterade 323/324 när `class-join-a11y` timeade ut; samma test passerade isolerat och i den seriella fullkörningen.
- [!] Ett nytt godkänt syntetiskt försök på den READY Previewn stoppades av Gratis-kvoten före modellval/OpenAI-anrop. Det gav ingen livekvalitetsmätning. Ingen kvot-/rolländring eller Supabase-ändring gjordes.

**PILOT NOT READY.** Nästa steg för att mäta scoringändringen är att invänta ordinarie stagingkvotreset eller få separat uttryckligt godkännande för ett nytt, avgränsat stagingtest. Därefter återstår liveverifiering av generering, rättning/sparning och P.E.R., tvåkontos-RLS/IDOR samt skolans operativa godkännanden. Ändra inte roll eller kvot utan separat godkännande.

## Approved live generation attempt stopped at quota — 2026-10-21

- [x] The user authenticated in the exact READY staging Preview. One approved attempt used only synthetic Matematik 2b notes, the existing `gratis` role/quota, level A and three short-answer questions.
- [x] The UI returned **“Provkvoten är slut”** before any exam was delivered. No second request was made and no account role/quota was changed.
- [x] Source inspection confirms the handler returns HTTP 429 from the quota check (`api/generate-exam.js`) before `pickModel()` and `streamGeneration()`. This attempt did not call OpenAI; it provides no evidence about current live question quality.
- [!] Whether the rejected attempt changed any quota counter was not independently queried. No quota or account mutation was made by the operator.

**PILOT NOT READY.** The approved live generation was blocked before the model call by the exhausted weekly quota. Next: wait for the normal quota reset or obtain separate approval for one explicitly bounded staging entitlement change, then repeat a synthetic generation. Do not alter role/quota without that approval.

## Staging security advisor snapshot — 2026-10-21

- [x] The read-only Supabase Security Advisor returned 30 `RLS enabled, no policy` informational findings, two mutable-search-path warnings (`match_knowledge_chunks`, `sync_report_count`), one `pg_trgm`-in-public warning, four client-executable `SECURITY DEFINER` findings, and leaked-password protection disabled. No database/Auth setting was changed.
- [!] RLS-enabled tables without policies are not evidence of public row access; they commonly represent server-only tables. Advisor function warnings also need source/ACL review, especially trigger-returning functions. No exploitability conclusion or two-user runtime IDOR result is established by this snapshot.
- [ ] Before widening a school pilot, review and remediate applicable function/extension warnings, decide whether leaked-password protection should be enabled for staging, and complete authenticated two-account RLS/IDOR tests. Any Auth or database setting/migration change needs separate approval.

**PILOT NOT READY.** Security Advisor findings are documented as review items, not silently modified. Runtime access isolation and school-level data-handling approval remain unverified.

## Full offline regression and Preview recheck — 2026-10-21

> Historical checkpoint; superseded by the current pilot checkpoint at the top of this file.

- [x] The complete repository test run passed **324/324** (`node --test 'tests/**/*.test.mjs' 'tests/**/*.test.js'`); duration was 91.6 s. No failures, cancellations, skips, or todos.
- [x] Read-only GitHub/Vercel verification confirms feature branch `codex/exgen-generation-quality-2026-10-20` remains at `adc5e0b41f3849789c683864036337e22ab6a2ac`; deployment `dpl_AVPF16aWsaWkgeHQwFiMzZxs5dVv` is `READY` from that exact branch and SHA.
- [x] Reopened the exact Preview in the browser. It still displays the invited-pilot login gate, so this is not an authenticated runtime test.
- [!] The user approved exactly one synthetic 3-question generation using the existing staging role/quota. No model-backed request has been made in this check because the Preview session is logged out. No credentials were requested or used; no quota, role, staging data, `main`, Production, or deployment settings were changed.
- [!] The current local branch includes two status-only commits (`526e46c`, `1c72e42`) beyond the deployed remote SHA; they do not change app code. This status update is local and has not been pushed.

**PILOT NOT READY.** Offline tests and the Preview build are verified, but generator quality and the full generation -> grading -> persistence -> P.E.R. live flow remain unverified on this deployment. Next: the user signs in directly to the exact Preview URL and confirms “inloggad”; then run only the already-approved synthetic 3-question test at the current staging role/quota. Stop if auth or quota blocks before a model call.

## Staging target and Preview secret-scope recheck — 2026-10-21

- [x] Supabase read-only project metadata identifies `yhcinqejsocpmmetazpz` as `exgen-pilot-staging`, region `eu-west-1`, status `ACTIVE_HEALTHY`. The migration ledger includes the grading-fencing, verified-abandonment, and mock-generation-idempotency migrations. No SQL or data was changed.
- [x] The Vercel MCP returned 403 for environment metadata; the documented CLI read-only fallback succeeded against the explicitly verified `provia-ai` project and exact feature branch. It confirmed `EXGEN_PILOT_APP_ORIGIN`, `EXGEN_PILOT_PUBLISHABLE_KEY`, `EXGEN_PILOT_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`, `EXAM_SIGNING_SECRET`, `EXGEN_PILOT_MODE`, and `SUPABASE_URL` are encrypted and Preview-scoped to `codex/exgen-generation-quality-2026-10-20`. No values were decrypted or read.
- [!] These configuration checks do not prove that the browser has a valid Supabase session or that an AI request succeeds. The exact deployment remains at the login gate.

**PILOT NOT READY.** The staging target and Preview secret scope are verified, but authenticated runtime behavior remains unverified. Next: user sign-in to the exact Preview, then the already-approved single synthetic generation request; make no role/quota changes.

## Grading recovery regression audit — 2026-10-21

- [x] Focused grading/API recovery and frontend timeout suite passed **15/15**. Coverage includes injected upstream HTTP 502, retry recovery, concurrent claim fencing, lost HTTP response replay, conflicting answers, result persistence, and no result/mastery writes when provider transport times out.
- [x] The handler releases a retry-safe grading claim after an upstream failure; the same submission/answer fingerprint can then be retried, while completed requests replay the saved result and do not grade or persist twice.
- [!] This verifies offline handler behavior only. The cause of the historical live 502 is still unknown because no matching live runtime event has been freshly retrieved for that request.

**PILOT NOT READY.** Grading recovery has focused offline evidence, but the new streamed-repair Preview has not had a generation request. Continue with the separately approved one-request staging check when its approval arrives; keep the test account role/quota unchanged.

## Streamed repair Preview — 2026-10-21

- [x] After explicit approval, pushed exactly `807a4d9`, `2adfe18`, `b974478`, and `adc5e0b` to `codex/exgen-generation-quality-2026-10-20`. Remote branch readback confirmed exact tip `adc5e0b41f3849789c683864036337e22ab6a2ac`.
- [x] Vercel deployment `dpl_AVPF16aWsaWkgeHQwFiMzZxs5dVv` reached `READY` from that exact SHA and branch in the existing `provia-ai` project. Preview URL: `https://provia-dcf0wih06-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [!] This approval covered only the branch push and Preview build. No model-backed request, staging database change, role/quota change, `main` merge, or Production action was made. Runtime authentication and Supabase target have not been newly verified for this deployment.

**PILOT NOT READY.** The streamed-repair code has a READY Preview but no live generation evidence. Next: obtain fresh, bounded approval for one synthetic generation request; do not change the staging account role/quota unless separately approved. If authentication or the existing staging quota blocks before a provider call, stop and report that exact blocker.

## P.E.R regression audit — 2026-10-21

- [x] Ran `node --test tests/per/*.test.mjs`: **25/25** passed, covering P.E.R guidance, evidence selection, answer-leak protection, and usage-event privacy.
- [x] Ran `node --test tests/frontend/per-*.test.mjs tests/frontend/pilot-session-recovery.test.mjs`: **15/15** passed on the clean rerun, including active-exam answer gating, preserving an unsent question through reauthentication, accessible error announcements, widget suppression, and focus/layout behavior.
- [!] One earlier parallel frontend run reported a failure in `per-felbank-collision.test.mjs`; that test passed in isolation and the full focused suite passed on rerun. Treat as a transient timing flake, not proof that the behavior is failure-free in live browsers.
- [!] These are offline regressions only; they do not constitute authenticated staging verification or school-pilot acceptance.

**PILOT NOT READY.** P.E.R's offline regression suite is green. The latest live exam-generation attempt still failed closed at 0/3, and the local streamed-repair fix has not been deployed or live-verified. The two local commits remain unpushed; obtain fresh approval before Preview deployment or another provider-backed staging request.

## Bounded streamed quality repair — 2026-10-21

- [x] The verifier-driven quality-repair request now uses the existing bounded Responses stream reader, matching the initial generation path. A timeout can retain complete question objects emitted before a partial JSON tail; those candidates still pass normalization, source checks, independent verifier, and the existing fail-closed delivery gate.
- [x] Added offline coverage for an actual abort-signal timeout preserving streamed bytes, JSON salvage of complete candidates before an incomplete tail, and a full synthetic repair where salvaged candidates must pass independent review. When all first-round items fail, two salvaged and verified replacements may use the existing explicit 2-of-3 partial-exam floor; rejected first-round questions remain excluded. Telemetry marks a salvaged/truncated repair response as incomplete. No extra repair attempt or quality-threshold relaxation was added.
- [x] Verification: `node tests/api/exam-pipeline-offline.test.mjs` passed; full API suite **176/176**; `node --check api/generate-exam.js` and `git diff --check` passed.
- [!] This is offline evidence only. The latest live run on commit `7f2a067` timed out before repair candidates were returned; it does not prove partial candidate text reached the server, nor does this change prove that a live repair will produce or pass review.

**PILOT NOT READY.** Next: continue offline analysis of the reviewer rejection pattern and inspect model-call timing/stream behavior under controlled fixtures. A new staging model call and Preview deployment require fresh explicit approval; do not weaken the quality gate.

## Verifier repair feedback — 2026-10-21

- [x] Pushed only approved commit `7f2a067df4585f9a8820bec9fc36feac802356eb` to `codex/exgen-generation-quality-2026-10-20`. Preview `dpl_rpqu8moGNyjqm4ZgXGidqaDyA5Cr` is `READY` from that exact SHA and branch. Required Preview variables remain encrypted and scoped to the branch; no values were read.
- [x] Ran exactly one approved synthetic A-level Mathematics 2b generation attempt with three short-answer questions and worked quadratic examples; no learner data was used. The API failed closed at **0/3 approved** and issued no exam. Sanitized telemetry: verifier checked 3 and rejected all 3 (`low_factual_accuracy`, `low_source_alignment`, `low_scoring_quality`); the bounded repair attempt timed out before producing candidates (`repairTransportError=timeout`, `repairCandidateCount=0`). Total elapsed time was 33.0 s; generation time was 15.4 s. No study-material, question, or answer text appeared in the diagnostic event.
- [x] The test account was changed only from `gratis` to `premium` for this approved request and immediately restored to `gratis`. Readback confirmed `mock_quota_count=3` and `mock_quota_period=2026-W43`. No other profile, quota, staging data, schema, `main`, or Production was changed.
- [x] The new verifier-category repair mapping is now live on the exact tested deployment, but this run shows it is not sufficient: all initial candidates failed and the repair model call timed out. The quality gate remained intact.
- [x] Offline API suite at code commit `7f2a067`: **176/176** passed; focused source-reference suite **6/6**; exam-pipeline regression, `node --check api/generate-exam.js`, and `git diff --check` passed before push.
- [!] Further model-backed attempts are not approved. The next useful step is offline diagnosis of repair timeout budgeting, provider latency, and why the reviewer rejects every candidate. Use synthetic fixtures and sanitized logs; do not weaken acceptance thresholds based on this single run.

**PILOT NOT READY.** The app still cannot reliably produce the requested three-question exam. Do not make another provider call, change quota/role, weaken quality controls, touch `main`/Production, or alter staging data without fresh bounded approval.

## Local source-reference recovery and scoring diagnostics — 2026-10-21

- [x] Added a conservative source-excerpt fallback for non-graph questions when the model's supplied citation is absent or paraphrased. It derives only a literal excerpt from the student's submitted material after multiple meaningful terms overlap with question/answer context; weak or unrelated matches return no citation. The independent reviewer, solver and existing quality gate still decide whether a question is accepted.
- [x] Added bounded verifier failure categories so scoring, answer alignment, source support, clarity, language and difficulty issues can guide repair without storing free-form reviewer notes or generated/student content in telemetry.
- [x] Added Swedish and English repair guidance for short-answer scoring alignment: method points must be explicitly requested, rubric parts must sum to the stated points, and the solution must be checked again.
- [x] Added a deterministic elapsed-budget regression for the two-repair path: when structural repair leaves less than the protected generation/review/finalization window, quality repair is not started and no unreviewed/rejected question is issued.
- [x] Fixed two browser-suite fixtures: the quota test now waits on the visible quota status row, and the graph-flow mock now implements the server's idempotency claim/completion/failure RPC contract. Both previously failing tests pass in isolation and in the full run.
- [x] Offline verification: focused source/pipeline/verifier tests **8/8**; pilot candidate builder **10/10**; complete API/P.E.R. suite **201/201**; all discovered repository tests **324/324**. `node --check` for all changed JavaScript files and `git diff --check` passed.
- [!] These are local/offline improvements only. They do not overturn the live **0/3** generation outcome or prove that the requested number of questions will be generated. The user approved one more synthetic staging run with temporary Premium, but the open signed-in Preview is an older deployment and does not contain these local changes. No new provider call, push, deployment, role/quota change, database change, `main` merge or Production operation was made in this update.

**PILOT NOT READY.** Next: get explicit approval to publish the exact reviewed local commit to the existing feature branch and create a staging-only Preview. Then use the already approved one-shot synthetic test on that exact READY deployment, temporarily set only the staging test account to Premium, and restore it immediately after the attempt. Keep `main`, Production and unrelated staging data unchanged.

## Approved second synthetic generation test — 2026-10-20 21:38 UTC

- [x] Ran exactly one additional synthetic staging request on READY deployment `dpl_FQy7czAN2fnnX2swogy1af6R4Zoo` (branch `codex/exgen-generation-quality-2026-10-20`, SHA `679e6350cb7603668e4b37d844c48da665e8e3a5`). Vercel's env-list API returned 403; the explicit CLI fallback verified the needed pilot variables remain encrypted and Preview-scoped to this branch. No values were read.
- [x] Replaced the short source with a clearer synthetic Mathematics 2b source containing two fully worked quadratic examples and explicit rules. The authenticated UI remained set to A-level, three short-answer questions. No real learner material was used.
- [x] The request reached generation and failed closed: **0/3** approved, no exam issued; elapsed time 36.2 s and initial generation 12.7 s. Content-free telemetry shows all 3 initial candidates were structurally rejected for `source_reference_missing`. Structural repair returned 4 candidates, all passed structural checks; the reviewer checked 3 and rejected all 3 with `required_changes` / `low_scoring_quality`.
- [x] No quality repair followed: telemetry says `qualityRepairAttempted=false` and `qualityRepairGenerationTimeoutMs=null` with about 20.8 s left. The configured repair gate requires 32 s (8 s generation + 10 s review + 14 s finalization), so it correctly withheld a second repair rather than risk an unreviewed result. This is a bounded-budget tradeoff, not evidence of a provider outage.
- [x] The synthetic account was verified Gratis before the run, changed temporarily to Premium only for this approved attempt, and immediately restored to Gratis. Post-run profile read showed `mock_quota_count=3`, period `2026-W43`, role `gratis`; Premium's code path bypasses the quota RPC. Production and `main` were untouched.
- [!] The richer material did not fix candidate quality. The evidence points to two generation-pipeline weaknesses: exact source excerpts are not consistently emitted/retained, and the initial math candidates failed the independent scoring-quality review. Runtime logs deliberately contain no generated question or source text, so the precise reviewer objections are unknown. Do not weaken the review gate or conclude a stronger model is the fix from this run alone.

**PILOT NOT READY.** Next: improve and test the generator's exact source-reference behavior and short-answer rubric/scoring alignment using synthetic fixtures; add a regression for the structural-repair path leaving insufficient time for a quality repair. Then seek a separate bounded approval before another model-backed staging request.

## Local verifier diagnosis and targeted scoring repair — 2026-10-20

- [x] The verifier now maps free-form `required_changes` to a fixed allowlist of diagnostic categories. Raw reviewer notes remain out of logs and repair telemetry; the quality gate is unchanged.
- [x] When a rejection is categorized as a question/rubric scoring mismatch, the bounded repair prompt now requires method points to be explicitly requested, rubric parts to sum to the question's points, and the answer to be independently re-solved. This is a targeted repair instruction, not a claim that the model will necessarily comply.
- [x] Added offline regression coverage for safe categorization, multi-category findings, verifier output, and targeted math scoring repair. A false-positive clarity classification was caught and narrowed during testing.
- [x] Focused pipeline/verifier tests passed **2/2**. Full API and P.E.R. suites passed **199/199**. `node --check` on both changed API files and `git diff --check` passed.
- [!] The live **0/3** outcome is not repaired or overturned by this local change. Exact source-reference generation remains unaddressed; this improvement has not been deployed or live-tested, and the previously approved staging request is consumed. No provider call, push, deployment, role/quota change, database change, `main` merge or Production operation was made here.

**PILOT NOT READY.** Next: add synthetic fixtures that reproduce missing source references and verify the generator/structural-repair contract, then exercise the repair-budget edge case offline. Request separate approval before any further model-backed staging request or push/deploy.

## Approved staging generation after temporary entitlement — 2026-10-20 21:33 UTC

- [x] The user approved exactly one synthetic 3-question Mathematics 2b attempt using temporary Premium on the existing staging account. Before changing the role, a read-only query found exactly one matching profile and confirmed it was `gratis`; the role was changed only in staging project `yhcinqejsocpmmetazpz`.
- [x] Rechecked the READY Preview `dpl_FQy7czAN2fnnX2swogy1af6R4Zoo` and its alias. Vercel environment-variable metadata confirmed the pilot URL, publishable key, Supabase server key, OpenAI key, signing secret and pilot flag are Preview-scoped to `codex/exgen-generation-quality-2026-10-20`; encrypted values were not read.
- [x] The request reached `POST /api/generate-exam` at 2026-10-20 21:32:55 UTC. The UI failed closed with **1/3** questions passing and no exam issued.
- [x] Sanitized runtime telemetry explains the rejection path: initial generation took 12.3 s; the reviewer checked 3 questions, approved 1 and rejected 2 with `low_factual_accuracy` / `required_changes`. One bounded quality repair returned 3 candidates; one was structurally dropped for `source_reference_missing`, and both reviewed candidates were rejected with `required_changes`. Final verified question count: 1. Total elapsed time: 36.3 s. No question text or study material was logged or retrieved.
- [x] The staging profile was immediately restored from `premium` to `gratis`; a fresh query confirmed exactly one matching profile and role `gratis`. No quota counter/period, other account, production, `main`, or student data was changed.
- [!] The run exposes a real reliability issue: for this synthetic material and request, one bounded repair still failed to reach the requested count. The failure categories do not expose enough content to determine whether the issue was source grounding, question formulation, or reviewer calibration. Do not weaken the quality gate without inspecting safe synthetic question evidence and adding targeted tests.
- [x] Fresh offline verification at code commit `679e635`: API suite **174/174**; exam-flow browser regression **178/178**; P.E.R. completion-proof/review **55/55**; P.E.R. browser context **66/66**; P.E.R. help ladder **28/28**; pedagogy test passed; `git diff --check` passed.

**PILOT NOT READY.** The one newly approved live attempt is consumed. Next: investigate why the initial and repair candidates were rejected using only sanitized synthetic evidence, implement a targeted correction with regression coverage, then seek a separate bounded approval before another provider-backed staging test. Keep the account Gratis and do not touch `main` or Production.

## Previous staging attempt stopped at quota — 2026-10-20 21:26 UTC

- [x] The user approved exactly one synthetic 3-question Mathematics 2b short-answer attempt on the READY Preview `dpl_FQy7czAN2fnnX2swogy1af6R4Zoo`, using the existing synthetic quadratic-function source. Deployment SHA and branch were rechecked first; encrypted pilot variables are scoped to the exact feature branch. No variable values were read.
- [x] The authenticated Preview returned the learner-facing state **“Provkvoten är slut”** and said the test version's weekly allowance was used. No role or quota setting was changed and no additional attempt was made.
- [x] Source inspection confirms `generate-exam.js` handles `!quota.ok` with HTTP 429 and returns before `pickModel()` and `streamGeneration()`. Therefore this attempt did not reach a model call. The Vercel runtime-log query returned no records in its requested five-minute window, so no runtime event corroboration was available.
- [!] At that time, the prompt and repair-telemetry changes remained unverified against live model output; the last allowed live generation still yielded **0/3** before this commit. The later 21:32 attempt is documented above.
- [x] The fresh API suite (174/174), frontend exam-flow regression (178/178), P.E.R pedagogy, active-exam gate (55/55), P.E.R browser context (66/66), and help ladder (28/28) remain green at code commit `679e635`; status-only commits do not alter deployed app code.

**PILOT NOT READY.** This quota-denial checkpoint is historical; the single separately approved Premium-assisted attempt is documented above. Do not change staging role/quota or make another model call without fresh bounded approval.

## Preview and offline verification — 2026-10-20 21:22 UTC

- [x] Commit `679e6350cb7603668e4b37d844c48da665e8e3a5` is pushed to `codex/exgen-generation-quality-2026-10-20`. Vercel Preview `dpl_FQy7czAN2fnnX2swogy1af6R4Zoo` is `READY` for that exact SHA and branch at `https://provia-jgnflaa89-eltons-projects-4adfb1a3.vercel.app/app.html`; its branch alias is `provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app`.
- [x] Fresh local verification at the same HEAD: full sequential API suite **174/174**; frontend exam-flow browser regression **178/178**; `git diff --check` passed. The first browser run was manually interrupted and is not counted; the completed rerun passed.
- [x] An attempted independent agent review could not start because the agent thread limit was reached. No independent agent review is claimed.
- [!] The latest live 3-question Mathematics 2b request on the prior deployment failed closed at **0/3** after ambiguous reviewer feedback and a repair transport timeout. Commit `679e635` clarifies bounded math tasks and records repair budget/timeout telemetry, but its effect on live question yield and latency has not been measured.
- [!] No new provider-backed request was run on this Preview. The previously approved single live test was consumed; another staging model call requires fresh, bounded approval. No quota/role change, staging cleanup, `main` merge, Production deployment, or production-data change was made in this increment.

**PILOT NOT READY.** Next: obtain separate approval for one synthetic staging generation on the exact READY Preview, without changing role/quota; stop before the provider if staging denies it. Capture only sanitized telemetry and compare candidate yield, repair duration and final questions with the previous 0/3 run. Keep `main`, Production and staging data unchanged.

## Latest live generation check — 2026-10-20 21:13 UTC

- [x] The user approved exactly one synthetic staging exam with temporary Premium access. The signed-in feature Preview `dpl_CYcK7LWidAyog31TXN7zkCJmq7xN` (branch `codex/exgen-generation-quality-2026-10-20`, SHA `a70092b8bbede3a9467d4f7c70d07bc7bd9814a6`) was verified before the request; no login was needed.
- [x] Generated a 3-question short-answer Mathematics 2b exam from synthetic quadratic-function notes. The request reached the live model pipeline but failed closed: **0/3** questions passed review, so no exam was issued.
- [x] Privacy-minimized Vercel telemetry shows all three initial items were rejected for reviewer rejection, required changes, and high ambiguity. The bounded repair request timed out before returning HTTP headers (`repairTransportError=timeout`); the first generation took 16.9 s and the full request reached 33.0 s. This confirms both weak first-pass question clarity and an unhelpful repair outcome, but the exact repair timeout allowance was not logged.
- [x] The staging test profile was restored immediately to `gratis`; `mock_quota_count=3` and `mock_quota_period=2026-W43` remain unchanged. No production, `main`, or student data was touched.
- [x] Local follow-up now makes A-level math short answers explicitly bounded multi-step tasks with one checkable answer target. Repair telemetry now records only the remaining milliseconds and provider timeout allowance, without question or study-material content.
- [x] Focused offline tests for the exam pipeline and regeneration budget pass **2/2**; `git diff --check` passes.
- [!] The prompt and telemetry changes are local only and have not been pushed, deployed, or live-tested. A second provider-backed request needs separate authorization; no further live generation was sent.

**PILOT NOT READY.** Next: finish the offline suite, review the local diff, then get a bounded approval before deploying and performing one more staging-only generation check. Keep the staging profile free and Production/`main` unchanged.

## Single-pass repair after partial generation — 2026-10-20

- [x] One explicitly approved synthetic staging request on Preview commit `b401b6b` requested three short-answer Mathematics 2b questions. It failed closed with **1/3** approved; no incomplete exam was delivered.
- [x] Content-free runtime diagnostics showed one initial structural drop (`source_reference_missing`) and two verifier rejections (`low_scoring_quality`). A structural repair returned two candidates, but the later quality repair did not run.
- [x] Root cause: the partial batch triggered a structural repair before first review, spending generation time before the verifier-driven repair could run inside the 60-second function budget.
- [x] The pipeline now reserves pre-review structural repair for the zero-valid-candidate case. A partial batch is reviewed first; the existing single verifier-driven repair can then fill structural gaps and replace rejected questions.
- [x] The staging profile was temporarily Premium for the one approved request and immediately restored to `gratis`; its recorded count/period was not modified. No second model request was made.
- [x] Focused generation-pipeline and budget tests passed; full sequential API suite passed **174/174**; P.E.R. pedagogy regression and exam answer-gate tests also passed.
- [x] Commit `1778d97` is pushed to the feature branch; Preview `dpl_37J7CEM4Pd9sRzNJJw56QTXzMLhB` is `READY` from that exact SHA, and the stable branch alias points to it. The existing signed-in session restored after the page's brief auth-state check.
- [!] The new repair flow has **not** been live-tested. The single approved request was consumed on the preceding deployment; no retry was sent.

**PILOT NOT READY.** Next: request separate approval for another bounded staging generation to verify the single-repair fix. Preserve the staging account at `gratis`, and keep `main` and Production unchanged.

## P.E.R. help-level consistency — 2026-10-20

- [x] P.E.R.'s pedagogy prompt now follows the selected help level: guided practice at levels 0-1, requested step-by-step work at level 2, and a full explanation with answer at level 3. The generic instruction no longer overrides levels 2-3.
- [x] Added regression coverage for levels 0, 2 and 3, exact task values, and the guided-practice answer boundary.
- [x] `node tests/per/per-pedagogy.test.mjs` passed; `node --test tests/api/per-exam-review-handler.test.mjs tests/api/grade-to-explain-completion-proof.integration.test.mjs` passed **55/55**; full sequential API suite passed **174/174**.
- [!] User confirmed the Preview session is already signed in; no further login is needed. The P.E.R. prompt change is still local and has not been deployed or live-tested.

**PILOT NOT READY.** Next: commit the reviewed local change, update the branch Preview, and verify normal study help at levels 0-3 without changing the active-exam answer gate. Live generation still needs a permitted staging test entitlement.

## Bounded quality-repair follow-up — 2026-10-20

- [x] Quality repair now requests one extra candidate beyond the missing slots instead of `2 * missing slots + 2`, reducing repair output while retaining a spare for independent review. Mixed repairs reserve one extra candidate for each missing question type so the requested balance cannot be lost.
- [x] Both first-pass generation and repair prompts now require bounded short-answer tasks, complete mathematical givens, and scoring criteria limited to the work the question asks for (Swedish and English).
- [x] Offline exam-pipeline regression, independent-verifier contract and regeneration-budget tests passed; full sequential API suite passed **174/174**; `git diff --check` passed.
- [x] Commit `86aacb4153b49f7ba458912078c47ddec8db04a8` is on `codex/exgen-generation-quality-2026-10-20`; Vercel Preview `dpl_2qR8ZTm4YdPEKgnDvqgnQhCtDCSt` is READY and carries the branch Preview alias.
- [x] The signed-in Preview restored its session after the initial reload. One synthetic run was attempted, but staging returned the test account's weekly quota-exhausted state before model generation; no live model result was produced.
- [x] The first-pass refinement is included in commit `e33b0010e89a9a9a535a2efaf26d6bc009e80c74`; Preview `dpl_79yFTWprTFK1kcqbSMZZfLWXtUH5` is READY from that exact SHA.
- [!] Neither change has established its effect on real model-backed question yield or repair latency.
- [!] No model default was changed. `OPENAI_MODEL_EXAM` remains the controlled exam-only comparison path; stronger-model quality, latency and cost have not been measured against the default.

**PILOT NOT READY.** Next: with separate authorization, temporarily enable one bounded synthetic test for the staging account (or wait for its quota reset); compare candidate count, repair duration, and verified question yield to the last 0/3 run. Do not change model defaults until a controlled candidate-model comparison is measured.

## Live generation and repair diagnostics — 2026-10-20

- [x] The authenticated stable feature Preview session was already active after its brief restoration delay; no password was used or requested.
- [x] The quota-denial UI fix is live on deployment `dpl_D5f6AT7BHNJ2HVk7yyYNU3EF22HR` from commit `7feb6ac9cff9c0907cd936165d4fb08df96ca30f`. One synthetic 429 request verified the exhausted-quota message and that no question skeleton remains. The fix also has a frontend integration regression.
- [!] A separate synthetic 3-question Mathematics 2b generation reached the model pipeline but failed closed with **0/3** questions delivered. Safe telemetry showed two candidates rejected for missing source references and the remaining reviewed candidate rejected for option quality. Repair was attempted but its structural-repair response diagnostics were absent, so timeout/network/HTTP/parse cause is not yet known. No generated content was delivered.
- [!] Two more synthetic 3-question runs failed closed with **0/3**. One had three verifier rejections for `high_ambiguity`; another had three rejections across `high_ambiguity` and `low_scoring_quality`. No generated content was delivered.
- [x] The bounded, content-free diagnostics and shared tolerant Responses JSON parser were pushed in commits `5ec3e64` and `577923f`. Preview deployment `dpl_2G18qf3qpHWUC3jfAFhoZmgM31GX` is `READY` from exact SHA `577923f89a52b6b78b09b5617b57ff291f291636`.
- [x] One final bounded synthetic request on that deployment exposed the exact repair failure: `repairTransportError: timeout`, with no HTTP response. The repeated run confirms that the existing repair window is too short for this workload after generation and review. No generated content was delivered.
- [x] The shared tolerant Responses JSON parser now handles structural repair; both repair paths record bounded HTTP status, response/parse status, output count, normalization category and coarse transport-error class. The raw provider error/body and study material are not logged.
- [x] `node tests/api/exam-pipeline-offline.test.mjs` passed; `node --test tests/api/*.test.mjs` passed **174/174**; `git diff --check` passed.
- [!] `node tests/frontend/exam-flow.regression.mjs` did not complete in this run: it remained in a Playwright wait and was interrupted, producing a browser-closed error. No pass is claimed. Prior UI behavior was independently verified on Preview.
- [x] Staging test account role was restored from temporary `premium` to `gratis` after the approved bounded tests. No production account or quota was changed.
- [ ] The diagnostic change makes failures actionable but does **not** improve the observed question pass rate by itself. Next: fix the repair-time budget/streaming path and tighten prompts against ambiguous short-answer tasks, then compare the default model with a stronger exam-only candidate on the existing controlled eval before changing provider settings.

**PILOT NOT READY.** The latest live generation failed quality checks; grading/P.E.R. and broader security and school-operation gates remain separate. No `main`, Production or production database action was made.

## Quota messaging follow-up — 2026-10-20

- [x] The exam wizard now treats an API quota response as a distinct learner state: it says the quota is exhausted and shows the existing reset/limit message instead of presenting a generic generation failure or suggesting fewer questions.
- [x] Browser coverage drives the real wizard-to-`runGenerate()` bridge with a synthetic HTTP 429 and verifies the dedicated heading, reset guidance, and absence of the misleading retry hint.
- [x] Focused generation/verifier/solver checks passed. The complete `tests/frontend/exam-flow.regression.mjs` passed **178/178** on the final rerun; an earlier run had one transient Supabase mock fetch failure. `EXAM_FLOW_LANGUAGE_ONLY=1` also passed 58/58; syntax and diff checks passed.
- [x] Commit `4fc2122` was pushed only to `codex/exgen-generation-quality-2026-10-20`; Vercel Preview `dpl_ApBoVAqpGLqFhVnzGyHuZ5xqqvw7` is READY from that exact SHA at `https://provia-q6w46eyau-eltons-projects-4adfb1a3.vercel.app/app.html`. The existing stable branch Preview alias points to this deployment; `main` and Production were not changed.
- [!] After reloading the stable alias, the app showed the sign-in gate. The prior browser session is no longer active, so no model-backed generation/P.E.R./grading check was run against this deployment. Earlier authenticated live checks were stopped by exhausted staging quotas. No quota/role or staging data was changed in this increment.

**PILOT NOT READY.** Next: reauthenticate once on the stable feature Preview, verify its staging runtime, then run the bounded synthetic generation/P.E.R./grading checks if the approved staging test entitlement allows them. Preserve all staging data and keep `main`/Production unchanged.

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

## Liveuppdatering — kvotreservation och trefrågeprov — 2026-10-21

- [x] Commit `5fccaff6bfedfbbb4831f8a293e40d71fa44f8a3` är pushad till `codex/exgen-generation-quality-2026-10-20`. Vercel Preview `dpl_DjHaHgpC1Fu5e3W2rBJVeD2bPQ73` är `READY` från exakt denna SHA; projektets publika runtime visar pilotläge och stagingref `yhcinqejsocpmmetazpz`. Ingen merge till `main` eller Production-deploy har gjorts.
- [x] Efter uttryckligt godkännande tillämpades endast `per_chat_quota_reservations` i Supabase-staging. Migreringen registrerades som `20261021122219`. Read-only kontroll bekräftar RLS på reservationstabellen, ingen tabell-SELECT för `anon`/`authenticated`, samt att reserve/commit/refund/reap-RPC:erna endast kan köras av `service_role`.
- [x] Staginginloggning lyckades i den nya Previewn. Ett godkänt syntetiskt Matematik 2b-prov med 3 kortsvarsfrågor genererades på nivå A. Alla tre visades i UI: kostnadsstruktur med fasta/rörliga kostnader, totalkostnad vid 15 biljetter, samt kostnadsfunktionens lutning och tolkning. Detta bekräftar endast att ett prov med begärt antal frågor kunde genereras i just detta försök; det bevisar inte allmän kvalitet eller stabilitet.
- [x] Testkontots roll ändrades tillfälligt från Gratis till Premium för det godkända genereringsförsöket och återställdes direkt till Gratis. Ingen kvot ändrades. Det genererade syntetiska provet ligger kvar i staging; det har inte rättats eller raderats.
- [x] Den kompletta seriala Node-sviten avslutades, men rapporterade två timeoutfel i webbläsartesterna `tests/frontend/solution-photo.test.mjs` och `tests/frontend/stale-session.test.mjs`. Båda passerade när de kördes isolerat. Därför räknas fullsviten inte som helt grön. Den fokuserade kvot/P.E.R.-sviten hade passerat 71/71 före denna stagingkörning.
- [ ] Live-rättning och verifierad resultatsparning är ännu inte testade. Live-P.E.R. utanför och under ett aktivt prov är ännu inte testat. Stagingkonto och provdata ska bevaras tills separat godkänd städning.
- [ ] Stagingadvisories innehåller även befintliga säkerhets-/prestandafynd. Den nya reservationstabellen syns i RLS-no-policy-linten; direkt tabellåtkomst är samtidigt borttagen för `anon`/`authenticated` och RLS är aktiv. Övriga project-wide fynd har inte ändrats eller åtgärdats i denna ändring.

**PILOT NOT READY.** En aktuell Preview och stagingmigration är verifierade och ett syntetiskt 3-frågeprov genererades. Rättning/sparning, P.E.R.-beteende, RLS/IDOR med två konton och skolans operativa godkännanden återstår.

## Uppföljning av liveprov, rättning och P.E.R. — 2026-10-21

- [x] I samma staging-Preview och med syntetiskt Matematik 2b-material färdigställdes provet med exakt 3 frågor. Vercel-loggen visar `finalQuestionCount: 3`, 3 av 3 granskade frågor godkända och en reparations-timeout; hela provet levererades ändå efter 35,7 sekunder. Det verifierar ett lyckat försök, inte stabil svarstid eller allmän kvalitet.
- [x] Det syntetiska provet lämnades in och gav ett synligt rättat resultat: 5/7 poäng, inklusive full poäng på kostnadsresonemang och beräkning samt delpoäng på lutningsförklaringen. Resultatsidan visade frågespecifik återkoppling och nästa träningsområde.
- [ ] P.E.R. under aktivt prov gav endast en säker statusvägledning: den kunde inte verifiera provstatus och gav varken facit eller vanlig modellsvarshjälp. Källgranskningen bekräftade ett kontraktsfel: API:t utfärdade `v1.<antal-frågor>.<signatur>`, medan klienten bara extraherade ID ur `v2.<submissionId>.<signatur>`. Därför hoppades exakt-issuance-kontrollen över och klienten använde den bredare statusvägen. Stagingens `exam_issuance_state(uuid,text)` finns och har `SECURITY INVOKER` plus tom `search_path`. Vercels Hobby-retention gav ingen P.E.R.-requestlogg, så kontraktsfelet är bekräftat i koden men dess andel i varje observerat livefel är inte fullt bevisad.
- [x] Riktade offlineprov `tests/api/per-exam-review-handler.test.mjs` och `tests/frontend/per-exam-context.test.mjs` passerade tillsammans: 52/52. Den tidigare fulla sviten är fortsatt inte grön som helhet eftersom två timeoutande frontend-filer endast passerade isolerat.
- [x] Gratisrollen lämnades oförändrad under rättning och P.E.R.-kontrollerna. Ingen kvotändring, radering, produktionsåtgärd eller elevdata användes.

### Lokala P.E.R.-status- och kontextfixar — ej Preview-verifierade

- [x] Nya provmanifest är nu `v2.<submissionId>.<signatur>`; signaturen binder det synliga ID:t till användare, kurs, material och frågemängd. Verifieraren accepterar även äldre v1-manifest så redan utfärdade prov kan rättas och avbrytas.
- [x] `stepSubject()` rensar dessutom resultat-/frågekontext före vanlig studiehjälp. Browser-regressionen använder serverns `submissionId()` och kontrollerar att exakt ID skickas till `/api/explain`.
- [x] Riktad verifiering: completion/issuance/grade-review/recovery API 23/23; exam-pipeline offline passerade; P.E.R.-kontext 68/68; verifierare/solver-kontrakt 3/3; syntax och `git diff --check` passerade.
- [x] Cachead idempotent provåterspelning får nu ett nytt v2-manifest utan att frågor, grade-task eller metadata ändras. Ogiltig replay-payload failar stängt i stället för att returnera gammalt manifest.
- [x] Giltiga äldre v1-utkast kan nu statuskontrolleras efter omladdning: klienten skickar hela signerade provkontexten, servern verifierar den, härleder kontoägt ID och gör enbart en statusläsning. Browser-testet verifierar att återupptaget äldre prov för vidare exakt ID till P.E.R.
- [x] Uppdaterad riktad verifiering efter återhämtningsfixen: issuance/completion API 19/19 och P.E.R.-browser 69/69; offline generation pipeline passerade, syntaxkontroll och `git diff --check` passerade.
- [x] Bredare offline-regression på samma kod: samtliga API-tester 180/180; exam browser 9/9 filer (huvudflöde 184/184, inklusive viewport); P.E.R. browser 16/16 filer; grade browser 2/2; pilot-session recovery 1/1. Inga provideranrop i dessa tester.
- [x] Fixarna är deployade till feature-Preview `https://provia-m7ws1q3sa-eltons-projects-4adfb1a3.vercel.app/app.html`, deployment `dpl_8QyRVKihvp5oFmXk8cW1rDYE1HLe`, exakt SHA `c82914e` på `codex/exgen-generation-quality-2026-10-20` (`target=null`).
- [ ] Inget nytt live P.E.R.-anrop har körts efter deployen; livebekräftelse av fixen återstår och kräver separat godkännande. Aktiva och oavslutade prov ska fortsatt verifieras fail-closed.

**PILOT NOT READY.** En generering med tre frågor samt rättning/resultatvisning verifierades live. P.E.R:s live-statusgrind hindrar fortfarande normal hjälp i appens provflöde; dessutom återstår fullsvitsstabilitet, RLS/IDOR-tvåkonto, och skolans operativa godkännanden.

## Exekverad RLS-regression — 2026-10-21

- [x] `tests/api/user-exams-rls-postgres.test.mjs` kör den riktiga `lock_user_exams_to_owner`-migreringen i isolerad PostgreSQL via PGlite med två användar-ID:n och rollen `authenticated`.
- [x] Testet bekräftar att konto A endast läser egna provrader, kan infoga en egen rad, inte kan infoga med konto B:s ägar-ID och saknar direkt UPDATE/DELETE. Slutlig tabellkontroll bekräftar att det nekade försöket inte sparades.
- [x] Samma ändringars närliggande regressionskontroller passerade: RLS/pilot-scope/route-boundary 13/13; resultatpersistens/completion-proof plus PostgreSQL grading fencing 5/5.
- [x] Read-only katalogkontroll i aktuellt Supabase staging bekräftade `user_exams` med RLS aktiv, ägarbegränsade SELECT/INSERT-policyer och ingen authenticated UPDATE/DELETE-grant. `mock_results`, `exam_issuances` och `per_chat_quota_reservations` har RLS aktiv och saknar browser-rollernas tabellgrants. Migreringshistoriken innehåller de väntade ägar-/exam-skyddsmigreringarna.
- [ ] Varken PGlite-testet eller katalogkontrollen bevisar två separata autentiserade JWT-sessioners faktiska radåtkomst via staging Data API. Inga stagingrader eller konton lästes eller ändrades.

**PILOT NOT READY.** En central ägarpolicy har nu ett exekverat tvåkontotest lokalt. Hosted staging-RLS/IDOR och skolans operativa godkännanden är fortfarande öppna.
