# 08 Current Status

## Local reliability fixes — awaiting Preview acceptance — 2026-10-31

- Mixed 12-question jobs now alternate the requested question type on tied
  no-progress claims, instead of selecting MC indefinitely. The original
  MC-first choice remains on the first attempt; per-type targets, the bounded
  batch size, independent review and solver gates are unchanged.
- Ordinary P.E.R answers that require review are buffered until the review
  succeeds. A malformed review or a serious finding without a usable
  correction returns a safe retry message; no unreviewed answer delta or
  history is exposed. Answers that do not require review still stream, and
  active-exam guidance keeps its separate restricted flow.
- Verified results retain bounded custom course labels such as “Biologi
  lokal” and “Kemi: syror och baser”. Instruction-like names, including
  accented Swedish phrases, are rejected; the coaching prompt now describes
  the same boundary.
- Focused offline verification: exam pipeline plus generation pipeline
  **35/35**; targeted P.E.R streaming safety **8/8**; custom-course handler
  **1/1**; `tests/per/per-review.test.mjs` reports “Allt grönt”. Syntax checks
  and `git diff --check` passed. The independent reviewer found no remaining
  blocker in these scoped changes.
- These are local/mocked results, not new model-quality evidence. The previous
  live 12-question 0/12 failure remains unresolved until a fresh, bounded
  staging run demonstrates relevant questions. Commit `e4af81f` is pushed on
  the existing feature branch; Vercel Preview `dpl_9RUAsSj6S5WiVAVUJNz1T5b4hzEh`
  is READY on that exact commit and the existing stable branch alias now points
  to it. The already-open Preview session is authenticated, but its account
  has a saved result and the app correctly disables creation of another exam.
  That result was preserved, so no new paid test was run. The approved +$0.50
  staging budget cap was briefly applied, then restored because the test could
  not proceed; spend/reserved counters did not change (cap 3.379071, spent
  3.064882, reserved 0.263628, available 0.050561 USD). No schema, account,
  role, `main` or Production change was made for this checkpoint.

## Final acceptance stopped; bounded MC repair follow-up — 2026-10-31

- The exact `9762b53` Preview was READY on the same authenticated feature
  alias. One subsequent synthetic 12-question biology job
  `1d1658e6-d92a-460f-9bcc-492cae674378` terminated at **0/12**,
  `STAGE_RETRY_LIMIT`, after three claims. UI explicitly says no exam was
  delivered. Hosted metadata confirms zero active exams, scrubbed private job
  payload and zero retained questions. No replacement test was started.
- Sanitized first-batch diagnostics: 3 MC candidates reviewed, 1 reviewer
  approval, all 3 rejected by the blind solver for implausible options; zero
  structural drops. Optional repair did not recover enough unique candidates.
  The two later repairs expanded to 5 MC candidates under the same roughly
  44-second route remainder and ended `independent_check_unavailable` after
  about 41 and 39 seconds. This proves unavailable independent checks, not
  specifically a timeout; old diagnostics cannot distinguish the cause.
- Code now limits MC repair batches to the normal maximum of 3, including
  mixed jobs; short-answer widening remains. Final type targets, approval
  gates, deadlines, retry limits, ownership, issuance and quota logic remain.
  Solver failures now retain elapsed time and fixed, content-free failure
  categories. Both initial and repair checks log the namespaced correlation
  ID and safe timing/category fields, without provider text or learner data.
- Offline focused pipeline/HTTP/budget/solver group **43/43**. The HTTP/PGlite
  case follows a persisted no-progress repair through the real generator and
  two mocked independent roles: 3 candidates, 1 rejected by each role,
  1 accepted; it then resumes to exactly 12 with one issuance/quota commit and
  safe replay. These provider responses are mocked, not new live acceptance.
  Updated allocation matrix also passes **33/33** at a 44-second deadline.
  Independent review found and resolved two diagnostic gaps: logs now use the
  validated parent-job correlation key, and JSON null is invalid_contract.
  Real mocked-handler coverage exercises both initial/repair failure events,
  exact safe log fields and no issuance; final bounded review has no findings.
- Full frontend regression finished **246 passed, 0 failed** on `9762b53`;
  this is local browser-harness evidence. No frontend code changed afterward.
  Production migration metadata was read again: canonical `20261020170419`
  exists and temporary `20261028095505` does not; no repeat write was needed.
- Fresh staging budget: spent **3.064882**, reserved **0.263628**, available
  **0.050561 USD**, unchanged hard cap **3.379071**. No new paid test was
  started for this patch; another full acceptance attempt is not assumed to
  fit. The initial semantic option defects remain unproven fixed. PR #125
  stays draft and main/Production release stays held pending content acceptance.

## Finished staging journey and energy-role follow-up — 2026-10-31

- Resumed the same authenticated Preview tab and already-filled exam from
  job `153b42a2-712d-4745-ae5d-11f5ee2ce3b7`. No parallel or replacement
  generation was started. On exact READY `b78c048`, its submission saved
  **16/18 (89%)**, verified 2026-10-30 23:13:25 UTC. The deliberate ATP/DNA
  misconception scored 0/2; all other answers were retained and graded.
- P.E.R's active q4 guidance separated contents/function and then asked the
  learner to check the function statement, with facit disabled. Postgrade it
  explained the actual 0/2, supplied DNA/protein information and explicitly
  identified the feedback's unsupported cell-division detail without inventing
  a score correction. Course coaching used the verified 85/87/94/88/89 history
  and Biologi 1 mistakes. Homepage help answered directly with a working app
  link and no internal self-review note. These are staging observations.
- The signed saved result confirms q2/q9 both keyed Glukos and q5/q11 share
  the complete energy-transfer exemplar. New bounded natural-science MC
  variation policy parses energy-input identification tasks, checks same
  process/carrier/atomic key and an explicit positive source relation, and
  keeps different outputs, conditions, reasoning and calculations separate.
  Process, bearer and carrier vary; this is not an ATP-specific key rule.
- A separate circular-location clarity veto recognizes a positive unqualified
  process frame such as q5. Negative or unparsed qualified contexts abstain;
  the review counterexamples and a valid-citation disavowal fixture are covered.
- Shared pair checks reject energy repeats before issuance/finalization.
  Generator-side drops carry existing capped duplicateCount, and circular
  drops carry existing question_clarity feedback into the next checkpoint.
  There is no new persisted category, schema, model, account or quota change.
- A small assistant-history display fix removes internal GOTO/CLARIFY markers
  from restored visible text. User text and stored history are unchanged;
  restoration does not execute actions or resend clarification requests.
- Offline quality/HTTP/pipeline/verifier/solver/coverage/gold group **90/90**;
  focused history browser **1/1**; active keyboard/focus/lifecycle browser
  **1/1**. Bounded source/variation review cleared the negative-scope correction;
  final repair-wiring and history microreviews also cleared the scoped fixes. This follow-up has
  not yet been published or live-accepted. PR #125 remains draft; main is held.
- Fresh production metadata confirms the canonical grading fence UUID/log,
  verified-mistake column and lease/result RPC prerequisites. Those helpers,
  dependency manifests and Vercel configuration have no diff from main.
  Last staging counter after the completed journey: spent 2.996068, reserved
  0.263628, available **0.119375 USD**, cap unchanged at 3.379071.

## Replay cleanup and two-part P.E.R teaching — 2026-10-30

- `f78271e` is READY on the existing feature alias. The next synthetic job
  `153b42a2-712d-4745-ae5d-11f5ee2ce3b7` delivered **12/12 in 83.17 seconds**,
  charging 0.024540 USD to the conservative app counter. Source/candidates
  were scrubbed after terminal success. Prior runs took 128 and 165 seconds;
  this is a run-specific comparison, not an established average.
- Manual review found another clear energy-input MC repetition (q2/q9) and
  circular wording in q5. Independent content review agrees. The new function
  policy is intentionally narrower than these cases; main remains held.
  All answers are filled; this same exam will be finished, not replaced.
- P.E.R kept facit hidden at q4, but its generic verb hint was insufficient for
  the two-part contents/function task. A fixed scaffold now explicitly separates
  those parts and guides the learner to connect two statements. It neither
  echoes nor evaluates the draft's facts. Comparison, causal and calculation
  precedence is preserved; unsigned questions cannot select the scaffold.
- Full-branch read-only audit found no new auth, quota, issuance or dependency
  blocker, but reproduced an inherited grade replay/practice cleanup race.
  These success and rejection terminals now await confirmed release of the
  exact held fence; two bounded attempts accept released/missing. Unknown
  cleanup returns no result/proof. Memoized finally cleanup remains.
- Offline: grading/recovery/scaffold group **12/12**; four selected real P.E.R
  handler cases **4/4**; hosted pipeline migration/lease/quota/ACL regression
  **29/29** in PGlite. Delayed release, unknown release and retry/missing tests
  cover both replay and practice, including acquired/released fence equality.
  Independent bounded review cleared the fixes after precedence corrections.
- PR #125 is a draft for the feature branch. Main/Production is unchanged.
  Fresh staging balance before final grading is **0.125339 USD**, reserved
  0.263628, spent 2.990104, cap 3.379071. No budget/schema/model/account change.

## Source-subject and presented-task checks — 2026-10-30

- Reviewed grading checkpoint `933c54f` is pushed and READY as
  `dpl_5NYfbALyNnqmuhacTeaSSC3SAYFB` on the existing feature alias. The same
  failed submission was deliberately retried once after that concrete fix:
  **14/16 (88%)**, saved and verified at 2026-10-29 23:13:58 UTC. The intended
  wrong ribosome response received 0/2. No additional exam was created.
- The saved result confirmed another false glucose-to-ATP claim in a separate
  MC model explanation, despite its correct terminology key. Both that field
  and the keyed option now enter the bounded source-subject veto.
- This Swedish natural-science veto recognizes explicit positive quantity /
  bearer / relation frames and parsed function, process or quantity tasks.
  It rejects the observed q1/q8 cases and the internal verbatim head-loss
  substring. Negation, unknown embedding, unparsed task contexts and competing
  positive source clauses abstain. Physics counterexamples accompany biology.
  It is not a universal factual validator; independent review/solver remain.
- Generation and review prompts separately require source-faithful keyed
  options and model answers. Fixed transient repair feedback requests a newly
  supported task; no key is silently changed and no new category is persisted.
- A separate presented-work policy rejects short-answer function repeats only
  with the same parsed entity/context, exact complete answer and a shared full
  sentence verified in actual material. Existing raw rubric-equivalence dedup
  is unchanged. Extra asked tasks, changed context, missing anchors and math
  remain separate. Differing metadata labels do not justify identical work.
- All seven pair checks enforce the shared policy, including initial gates,
  repair merges, pipeline accumulation and finalization. Both generator-pruned
  and pipeline-pruned repeats feed the existing capped duplicateCount field.
  An actual pipeline.advance regression covers both routes and continued repair.
- Read-only reviewers cleared the bounded source/policy and integration fixes
  after their counterexamples were addressed. Offline quality/HTTP/solver/
  verifier/coverage/gold group **85/85** passes; source eligibility recheck
  **3/3** passes after the final scoped change. Hosted acceptance is pending.
- Permanent recovery compared all 51 surviving tracked old files with pushed
  `6604ab4`: no differences. No old files were deleted. Staging counter after
  saved grading: spent 2.965564, reserved 0.263628, available **0.149879 USD**
  under unchanged cap 3.379071. Main/Production remains held for content
  acceptance and the full branch release review; no schema/model/secret/
  account/quota change.

## Grading score-contract recovery — 2026-10-30

- The exact `6604ab4` staging journey delivered 12/12 in 165 seconds. It
  still contained a false glucose-to-ATP option and repeated ribosome function
  tasks. These remain release blockers; no main/Production release is cleared.
- One submission retained every answer but returned to the exam without a
  saved result. Hosted logs identify `contract_score_range` in batch 1/2,
  with all four rows present. This does not distinguish a mismatched maximum
  from an out-of-range award. The model calls were measured; no automatic
  second submission or new exam was made. The claim was safely released.
- The grading request now constrains every schema slot to its signed question
  ID and maximum, with awarded points between zero and that maximum. Fractional
  partial credit and final rejection checks remain. This is prevention, not
  clamping invalid output or relaxing the scoring contract.
- A grading error remains in the question sheet across time and navigation;
  accepted retries and newly generated exams clear it. It is not persisted
  through a reload. The old transient nudge no longer hides this failure.
- Offline: eight focused grading/terminal-state files pass **8/8**; a browser
  regression passes **1/1**, preserving answers and proving no timed automatic
  retry after 12 seconds or question navigation. Read-only review independently
  exercised signed schema bounds. Hosted acceptance of this fix is pending.
- The temporary checkout lost its Git metadata/base files. A permanent clone
  was recovered at the exact pushed `6604ab4`; current goal code was already
  committed and pushed. Old survivors were not deleted. Cause is unverified.
- Fresh staging budget remains cap 3.379071, spent 2.963025, reserved 0.263628,
  available **0.152418 USD**. The same unfinished exam/session is retained.

## Split-requirement ambiguity veto — 2026-10-29

- Reviewed checkpoint `46623365f4d88900ce892f6e2e4b447ec033f843` was pushed
  and READY as `dpl_6p1mssmEAnTWBQBJC1XZzdFWPuWd`, on the same feature alias.
  Branch staging URL, pilot mode and unchanged budget cap were verified.
  Production still has canonical migration `20261020170419`, no temporary
  `20261028095505` ledger entry, UUID grading claim and verified-mistake column.
- One subsequent synthetic Biologi 1 C/mixed journey delivered **12/12 in 128s**
  (job `8c3d9c9c-e333-46c4-a7ea-5b91eaaf3231`). Live telemetry recognized
  12 sections and the first three approved questions referenced three sections.
  Generation charged **0.041299 USD** to the conservative app counter, versus
  0.106373 in the previous run. These two runs do not establish general averages.
- Every question was answered; saved grading was **15/16 (94%)**. Manual review
  found a release blocker: "Vad krävs för aktiv transport över cellmembranet?"
  offered ATP energy and transport proteins separately although its source
  supported both. Choosing transport proteins received 0/1. P.E.R's postgrade
  explanation identified the ambiguity and preserved the recorded score.
  Main remains held; technical success is not content acceptance.
- P.E.R homepage help, signed active guidance, postgrade explanation and the
  immediate history/cache-check/new-coach transition completed on that exact
  Preview. No lingering busy error; afterward active exams and leases were zero.
  Both completed synthetic results were retained; no parallel exam was started.
- New local guard vetoes this bounded natural-science MC failure pattern:
  a complete broad requirement stem, explicit same process, a simple positive
  source coordination, two separate whole-phrase choices and no full combination.
  Conditions, negation, alternative mechanisms, unknown scope and qualified
  choices abstain. The transport-boundary exception recognizes membrane nouns
  only. "Can ... with help from" is treated as source-supported ambiguity, not
  a claim of universal necessity. Reviewer, solver and signing gates remain.
- Initial/repair/final structural gates enforce the veto, including already
  model-verified candidates. Fixed transient repair feedback requests a precise
  replacement and renewed uniqueness checking, never a prescribed key. No
  persisted checkpoint category/schema change was introduced.
- Coaching v6 labels an older under-70 result as a historical signal, explicitly
  distinct from latest/current proficiency. Paired older-45/latest-94 evidence
  is covered; earlier cached advice is invalidated by the revision.
- Offline quality/pipeline/HTTP/coverage/gold group **67/67** and focused coach
  checks **3/3** pass. Reused reviewers cleared both bounded follow-ups. Neither
  new guard nor v6 coaching has yet had a live acceptance run. Available staging
  counter **0.212609 USD**, reserved 0.263628, spent 2.902834, cap 3.379071;
  no cap/account/quota/model/schema change. Next: publish this reviewed feature
  checkpoint, then one complete acceptance journey under the remaining guard.

## Completed comparison journey and targeted follow-up — 2026-10-29

- Exact Preview `c1e5b6163e649e0e5d9cd7f1f14c45d87c73a04b`
  (`dpl_546Ru4N21vYLurxnGKGSVrXaq6MX`) completed one synthetic Biologi 1
  journey on the same stable origin/account/tab. Job
  `ce32777c-b8fc-4996-a38f-2a2769273b83` delivered **12/12 in 295 seconds**;
  terminal payload and accepted candidates were scrubbed. It used 42 provider
  stages versus 29 in the prior approximately 308-second run. This is not proof
  of a speed or efficiency improvement. The budget counter charged 0.106373 USD
  for generation; it is a conservative app counter, not an invoice.
- All twelve questions were answered and the result was saved/verified at
  **13/15 (87%)**. The deliberately incorrect ribosome/DNA answer received 0/2.
  P.E.R used the selected seventh question and choice, provided two fixed
  pedagogical steps without confirming correctness, then explained the actual
  saved second-question mistake, score and next-time strategy after grading.
  The improvement coach used course-linked saved focus; no extra exam was made.
- Manual inspection still found repeated ribosome/chlorophyll targets and
  "Vilket av följande gaser". The private scoring rubrics are encrypted and are
  not reconstructed from the public stems. New bounded regression scopes are
  explicitly synthetic; do not claim every live overlap is now a proven duplicate.
- A local source-coverage fix recognizes **12 numbered prose blocks instead of
  zero** in that exact synthetic source. Excerpts remain literal. Existing heading
  handling, ambiguous-list abstention, citation uniqueness, advisory coverage
  and mistake-training priority remain. A stale mock in the coverage test now
  supplies the source evidence required by the existing focus matcher.
- Bounded deduplication now understands role/function wording and generic cell
  inflections. A one-word object choice only inherits a scope when stem plus
  option reconstruct the entire explicit scored fact; purpose/condition clauses,
  unknown extra requirements and shared-answer distractors remain distinct.
  A Swedish-only closed noun-gender check rejects obvious MC agreement defects
  before review/signing; compound continuations and unknown vocabulary abstain.
- The first coach request exposed a real response/lease race: postgrade JSON
  could finish before fenced release, and the next call returned busy until TTL.
  Read-only review reproduced it with a delayed release. The local completion
  path now awaits the exact lease release before JSON/end, retries an unknown
  outcome twice using the same fence, and retains final cleanup. SSE completion
  follows correction, persistence and release; its final history cannot replace
  a correction with the earlier answer. Release-failure paths do not report success.
  The streamed primary turn is only committed after deadline/review checks;
  a late retry cannot reappear as a finished answer through a later history GET.
- Final-done ordering also required a client correction: a safe unavailable
  notice now updates the answer even before commitment. The browser fixture
  reproduces `delta → safe notice → done` and checks visible and cached text.
  Streaming work has a request deadline; optional review is bounded by remaining
  time reserved for persistence/release. Late primary output returns a retry
  error rather than starting another long review or falsely reporting success.
  This does not guarantee completion through arbitrary database/network stalls.
- Offline follow-up: quality/pipeline/HTTP/coverage/gold **64/64**; handler checks
  after the lease fix **84/84**; latest P.E.R stream/deadline checks **20/20**;
  browser session/safe-notice recovery **1/1**. Read-only reviewers cleared the
  parser and bounded assessment corrections; the response-completion follow-up
  review is pending. This follow-up is not yet live-verified or cleared for main.
- Fresh staging counter after the completed generation, grading, explanation
  and coaching: spent **2.855738 USD**, reserved **0.263628 USD**, available
  **0.259705 USD** under the unchanged **3.379071 USD** cap. Old reservations
  were left untouched; no additional live exam has started.
- Main/Production still needs the goal's release gates: final independent
  completion review, relevant regression results, exact READY Preview and a
  fresh critical student journey within the unchanged remaining budget. No
  new model, schema, secret, account or quota change was made.

## Active-attempt pedagogy and course-linked coaching — 2026-10-29

- Continuation starts from clean `13cd067`; XelioV context and role cards were
  reloaded. The full goal still requires a final staged student journey before
  main/Production release. Two existing read-only reviewers were reused.
- Assessment checkpoint `06987ac` restores bounded cross-format matching when
  MC rubric parts are absent. A single explicit source fact must support the
  same task; selected-option/model-answer terms, top-level rubric and option
  distinctions preserve additional skills. Production-shaped rubric fixtures
  and paraphrased mRNA/DNA/tRNA counterexamples cover the review findings.
  Unknown paraphrases remain conservative false negatives; historical scrubbed
  rubrics are not reconstructed or claimed fixed by these synthetic fixtures.
- Active P.E.R now reads structural features of the bounded learner attempt:
  missing calculation steps, one-sided comparisons, causal links, slope ratios,
  selected-MC reasoning and canonical graph draft states. Fixed prompts perform
  no arithmetic/correctness assessment, reflect no draft text, and require a
  signed current active question. Task-specific MC guidance and unknown-graph
  fallback are preserved. Counterexamples cover signed scalars, unit notation,
  truncated excerpts and null graph slots.
- Coaching retains course-linked mistake labels/error categories from the
  authenticated verified-result rows. Labels are bounded untrusted grading
  summaries, not scientific facts or instructions. Legitimate system-related
  concepts survive filtering; equal-score focus changes invalidate the v5 cache.
  The UI says "fokus från sparad rättning", including an 80% result with a
  specific mistake. Postgrade guidance requires a transferable strategy and
  prohibits inventing a changed score.
- Offline: quality/pipeline/HTTP/gold group **54/54**; scoped P.E.R API **30/30**;
  helper/provenance/identity group **5/5**; page-target browser checks **95/95**.
  Independent final rechecks cleared the bounded assessment and P.E.R findings.
  Legacy `tipsMode` still uses client-supplied exercise data; do not describe
  that separate route as verified personal-mistake evidence.
- The previously approved production fencing migration and its ledger version
  were verified on 2026-10-28; source version is `20261020170419`. No further
  production-database, schema, account, quota or model change is included;
  code release remains conditional on the goal's stated release gates.
- Fresh staging read: no active exams/jobs; available **0.370188 USD**. Prior
  12-question usage was 128926 input / 18328 output tokens across 29 stages,
  about **0.060672 USD** under the app's conservative counter (not an invoice).
  Thus the prior blanket "insufficient" budget assessment was too categorical.
  This was the preflight for the completed comparison journey recorded above;
  it did not authorize a cap increase.

## Scored-fact diversity checkpoint — 2026-10-28

- Source-answer audit checkpoint `45631477bdc969d38ab8cdbbbbabbe1f8b71fdd0`
  is pushed and READY as `dpl_DpW6ihCA2z2RYrmWRveZx8fU3yjF` on the same
  feature alias. It has not yet received a new paid/live exam.
- Assessment now compares explicit scored factual requirements before a
  bounded source-anchored input/effect task match. Equal requirements and
  complete shared source sentences can establish the same assessed fact
  across short/MC wording; literal answer equality alone no longer suffices.
  Raw additional requirements, input/output conflicts and unknown extra task
  demands veto the factual shortcuts. Mathematical/logical precedence remains.
- Independent review supplied counterexamples for unclassified extra skills,
  high/low and mixed conditions, extra entities, appended demands, decimals and
  wrapped source lines. They have regression controls. Source segmentation
  preserves decimals and sentence-internal wrapping. No global similarity
  threshold was reduced; missing/generic scoring scope cannot enable the new match.
- Offline assessment/pipeline/HTTP/gold/mistake-training group passed 54/54.
  Independent final recheck found no actionable issue in the last input-suffix
  fix; its gate test retained the additional task and still removed the clean
  duplicate. Syntax/diff checks passed.
- Rubrics in the older issued public response were stripped and private job
  payloads scrubbed. The new scoring fixtures are explicitly synthetic; this
  checkpoint does not prove that every historical duplicate would be removed.
  Unknown factual grammars/paraphrased scoring requirements remain conservative
  false negatives for this added path. No new live exam or hosted data mutation.

## Independent source-answer audit — 2026-10-28

- New goal authorizes reviewed feature checkpoints and a main/Production release
  only after relevant tests, independent review and critical staging journeys pass.
  Database/schema, secrets, model settings, accounts and quota changes remain excluded.
- The blind MC solver now emits a bounded source check before option votes:
  premise validity, independent answer, factual/derived/unanswerable basis,
  literal evidence and per-option answer matches. Both the answer audit and
  existing option votes must identify the same sole answer and trusted key.
  Unsupported premises, absent answers and malformed/invented evidence fail closed.
  Existing confidence, plausibility, reviewer and issuance gates are retained.
- Initial and repair approval both pass source material; the offline model-eval
  harness passes its fixture material too. No extra provider call, model change,
  failure-code category or database contract was introduced. Evidence strings
  remain request-local and are not added to telemetry or browser responses.
- The exact observed respiration stem/key is frozen in a synthetic regression.
  A mocked independent answer of ATP with no matching option excludes the bad
  question despite an agreeing reviewer/old option vote; normal bounded repair
  fills the slot with a separately reviewed candidate. Valid input/output tasks,
  synonym matching, energy conversion and derived calculations have controls.
- Offline source/solver/handler/pipeline/HTTP/verifier/gold tests passed 43/43;
  syntax and diff checks passed. Independent read-only review found no runtime
  approval bypass; its P2 instruction conflict was corrected by explicitly
  limiting absent-option rejection to MC questions in both verifier languages.
- Important limit: these tests prove enforcement when the model supplies the
  correct independent audit, not that a live model will do so. Consistently wrong
  semantic judgments can still agree. The known semantic defect is not yet
  proven fixed live. No new exam, paid call, main/Production or hosted data/config
  mutation was made for this implementation.

## Targeted duplicate and active-hint follow-up — 2026-10-28

- Type-schema checkpoint `1492347c456289cee180a5d9cc99ea1d735021e7` is pushed;
  `dpl_CuV53pLmDVSs7Ew8RneEjeGpnm79` is READY on the same stable Preview
  alias. No new exam was created after the completed 12-question test.
- One post-grade P.E.R explanation of the defective question 7 correctly
  distinguished its stored glucose key from the source: glucose is used in
  respiration and energy becomes available as ATP; ATP is missing from the
  options. P.E.R explicitly attributed the problem to the question rather
  than the learner. This is a successful critical post-grade explanation,
  not a fix for the earlier reviewer/solver semantic miss.
- Read-only metadata confirms q2/q8 share concept `Ribosomer`, identical
  objective and the same source sentence. q4/q12 likewise share their
  photosynthesis-input objective, and q5/q10 share their temperature-effects
  objective. Independent local probes reproduced all three duplicate misses.
  They also found a false positive: high- versus low-temperature conditions
  could be collapsed by broad word overlap. Lowering global thresholds is
  therefore not an acceptable fix.
- Local assessment patch narrowly recognizes equivalent Swedish function
  tasks: `Vad gör X ...?` and `Vad är X:s främsta funktion ...?`. It requires
  the same entity/context, concept, exact objective, explicit source anchor
  and substantial answer overlap. This resolves the observed ribosome pair
  across MC/short formats without globally reducing token thresholds. A
  separate condition guard preserves high/low temperature differences.
  Photosynthesis and enzyme duplicate misses remain unresolved.
- Local P.E.R patch replaces generic advice for verified MC transport-type
  identification with a fixed three-level clue-comparison ladder: what moves,
  what boundary is crossed and what direction the question states. It names
  no transport type, gives no answer and confirms no student choice. An
  independent finding that the first draft captured short calculations was
  fixed by restricting dispatch to MC identification stems; signed short and
  MC membrane calculations retain their calculation guidance.
- Offline evidence: factual-duplicate tests 3/3; final seven-file assessment/
  generation/HTTP/gold/mistake-training regression 48/48; focused active-exam P.E.R
  regression 20/20. Syntax/diff checks passed. The first full P.E.R suite was
  stopped after a focused new-test run found an overbroad test regex (`option
  c` also matched `option conflicts`); the regex was corrected and the 20
  relevant active-state tests passed. No full 77-test pass is claimed here.
- Budget guard after the critical P.E.R explanation: spent 2.745255 USD,
  reserved 0.263628, available 0.370188. The completed exam had 9 generator,
  4 repair, 11 reviewer and 5 blind-solver provider stages, all 4o-mini; these
  29 stages belong to one exam. No account, quota or configuration was changed.
- Independent review found that the first temperature guard bypassed existing
  quadratic dedupe when temperature was incidental context. The guard was
  moved after quadratic/logical safeguards and the existing mathematical
  positive match; the exact counterexample now has a bidirectional regression.
  Final recheck confirmed that P2 resolved with no additional findings in the
  reviewed precedence fix. The corrected hint dispatch had no further findings.
  The existing reviewer was reused; the other historical agent remained at
  model capacity, so no additional agents were created.
- The reviewed assessment/hint follow-up is ready for the approved feature
  checkpoint; its hosted hint behavior has not been retested in an active exam.
  Goal remains incomplete: issued semantic
  correctness, remaining duplicate targets, general active-hint usefulness,
  six-question and mistake-training live journeys still need evidence.

## Complete delivery exposed remaining semantic defects — 2026-10-28

- Reviewed checkpoint `55d638e196d62db0d2d9b7063056eced9e5a57d4` is pushed;
  deployment `dpl_H9PaAALHL9ExAZqE7qFVnAfNxmTr` is READY on the same stable
  feature alias. Staging URL, pilot mode and budget cap were rechecked before
  one new controlled request with the exact prior source/settings.
- That request succeeded: database state `succeeded/terminal`, 12 requested,
  12 delivered, `partial=false`. UI and stored response agree. Delivery was
  about 308 seconds after the recorded UI start. No `invalid_part_mapping`
  diagnostic was observed on this deployment; semantic source rejections,
  missing quotes, distractor errors and empty short-answer rubrics still
  occurred during candidate generation. One successful count is not a
  reliability or semantic-quality claim.
- Manual inspection found a real issued defect: question 7 asks which
  energy-storing substance is generated from cell respiration, but offers
  glucose, oxygen and carbon dioxide. After grading, the displayed key says
  glucose and repeats that false relationship; its own source excerpt says
  energy in glucose becomes available as ATP. Reviewer and blind-solver
  agreement did not prevent this role/relationship error. This blocks a
  pilot-ready quality claim and needs a concrete semantic regression.
- Repeated targets also passed: ribosome function appears as short answer
  (question 2) and MC (8); photosynthesis inputs/process recur in 4/9/12;
  high-temperature enzyme effects recur in 5/10. Questions 4 and 12 have
  especially close stems, while existing lexical/answer-target dedupe missed
  them. The exact metadata still needs inspection before choosing a fix.
- One active-exam P.E.R request returned an answer-free but generic study
  hint. It did not name the answer or option, but did not provide the desired
  task-specific pedagogical guidance. Do not record that as a full pedagogy
  pass. Desktop screenshot showed the widget, while native AX output omitted
  it; the existing desktop `aria-owns` behavior needs investigation before
  claiming accessibility is verified.
- The same synthetic exam was completed and graded once: 11/13 points,
  including the deliberately wrong ribosome answer and the deliberately
  unanswered defective MC. The user confirmed the app's unanswered-question
  submission dialog after browser automation could not operate it. Result
  feedback correctly identified the ribosome mistake. Readback confirmed
  zero active exams and zero queued/running pipeline jobs. No further exam
  was started.
- Budget guard after generation and grading: spent 2.744343 USD, reserved
  0.263628, available 0.371100 under the unchanged lower cap. These are guard
  accounting amounts, not invoice totals.
- Local type-schema follow-up addresses an observed batch where all five
  short-answer candidates lacked a usable scoring rubric. Initial and repair
  schemas now use the selected type; short-answer parts must contain 1–20
  nonblank descriptions with positive point values. Mixed items use isolated
  MC/short branches, preserving the MC empty-rubric allowance. Default and
  graph schema calls remain unchanged. Structural and semantic runtime gates
  are unchanged.
- Offline controls: focused handler/schema file passed; the four-file
  pipeline/HTTP/graph/gold regression passed 35/35. Ajv covers requested 3/6/12,
  wrong type, empty/blank/nonpositive parts and the mixed-type exception;
  handler fixtures assert both initial and repair calls emit the contract.
  Syntax/diff checks passed. Independent review found no code/call-path defect;
  its documentation question about `exclusiveMinimum` is resolved by the
  [official supported-schema guide](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses),
  which explicitly lists it for numbers. Hosted acceptance of this generation
  schema has not been tested yet.
- The type-schema follow-up is ready for an approved feature checkpoint.
  Remaining work is substantive: semantic correctness, duplicate-target
  control, useful active-exam P.E.R, and current six-question/mistake-training
  live evidence. Continue offline from the identified counterexamples before
  spending on another exam. Main/Production and database configuration remain
  untouched.

## Source-review cardinality and immediate repair follow-up — 2026-10-28

- The user approved reviewed checkpoints on the existing feature Preview for
  the remainder of this goal, using the same tab/session and one synthetic
  exam at a time within the remaining budget. Main/Production, migrations,
  secrets, accounts and quota settings remain excluded.
- Source-index checkpoint `c4846538fc5268f0690688ebf2ad230fcadad508` is pushed;
  deployment `dpl_9TQXfRUtGyAdcj1X3zohtahpNDza` is READY on the existing stable
  branch alias. Read-only checks confirmed the exact branch, staging URL,
  pilot mode and lower budget cap. The same browser session restored itself
  after reload; no new tab, account or login was needed.
- One comparison used the exact prior synthetic Biologi 1 material, level C,
  12 mixed questions and no focus chips. It terminated with 6/12 approved,
  `STAGE_RETRY_LIMIT`, about 301 seconds after the recorded UI start. No exam
  was issued; the visible message correctly stated 6/12. Readback confirmed
  zero active exams and zero queued/running pipeline jobs. The previous run
  had 3/12; two stochastic runs do not establish a reliable yield improvement.
- New content-free diagnostics recorded 12 `invalid_part_mapping` findings
  and 7 `unsupported_verdict` findings across 10 reviewer events. These are
  candidate-stage counts, not distinct exams or independent truth judgments.
  No invalid-index finding was recorded. This establishes repeated reviewer
  array-shape failures, while semantic source rejections also remain.
- Local fix: the emitted reviewer schema now binds option verdict counts,
  rubric-part verdict/evidence counts and accepted-answer verdict/evidence
  counts to the actual submitted question. Equal shapes share an ID-bound
  branch; heterogeneous shapes use nested `anyOf`, supported by the official
  Structured Outputs guide linked below. Negative verdicts remain valid
  schema output and are still rejected by the unchanged runtime gates.
  Oversized rubrics exceeding the existing 20-part contract stop before the
  paid reviewer call. General schema-inspection calls retain their old shape.
- Independent source inspection also confirmed that deterministic source
  failures were absent from immediate repair prompts. A separate transient
  count argument now carries only `source_answer_not_extractable` and
  `source_reference_missing`, capped at 20, into both zero-survivor and
  post-review repairs. No candidate text or IDs are copied into that feedback.
  Persisted feedback and the database contract are unchanged; cross-request
  structural-feedback loss remains outside this patch.
- Offline: the seven-file generation/HTTP/verifier/source/gold/decision
  regression passed 43/43. New controls compile the emitted schema with Ajv,
  reject wrong per-ID array sizes and unknown IDs, permit reordered results
  and negative semantic verdicts, and verify runtime rejection when a provider
  ignores the schema. Real-handler mocked-provider fixtures verify both
  immediate repair paths, unchanged source, one repair and continued exclusion
  of non-extractive candidates. These are offline controls, not live yield.
- Guard accounting after the comparison: spent 2.577031 USD, reserved
  0.263628, available 0.538412 under cap 3.379071. The comparison consumed
  0.147952 in guard accounting; this is not an OpenAI invoice measurement.
- Independent final review found no actionable defect in either code change.
  The reviewer counted at most 20 schema branches and 741 declared properties
  with A-level and training fields; these stay below the fetched provider's
  5,000-property limit, with `anyOf` nested under results and the object root
  unchanged. Runtime duplicate/missing-ID checks remain essential. Hosted
  acceptance of the complete new schema still needs the controlled live run.
  Syntax and diff checks passed.
- These follow-up code changes are ready for the next approved feature
  checkpoint. No additional paid retry has run.
  Goal remains incomplete until current-version delivery, active-exam P.E.R,
  six-question and mistake-training journeys have sufficient live evidence.

## Current Preview live evidence and source-index follow-up — 2026-10-28

- Deployed Preview is `be5eff97331b9bff1d91ac23cfa4673a0096f837`, deployment
  `dpl_DPUMsZUhWcGTrMDwdUc1zpfeSsbK`, through the same stable branch alias.
  It points to the verified staging project with pilot mode and the matching
  lower budget cap. The existing browser session refreshed successfully; no
  new tab, login, account, role or quota adjustment was needed.
- Live homepage P.E.R passed two synthetic cases: choose Mockprov before
  mistake training for a new learner, and explain how photosynthesis and cell
  respiration are connected. Responses were direct and showed no self-review
  note. Verified telemetry: two `gpt-6-luna` provider calls, 2934–4034 ms.
- The improvement coach reused its saved recommendation without a new model
  call. Visible latest score 100% and +17 percentage-point trend matched a
  read-only aggregate of the five latest server-verified results (83 -> 100).
  The recommendation distinguished historical weak results from recent success.
- The previous synthetic three-question result was recovered as 6/6 through
  server replay. P.E.R then correctly explained the selected 2/2 answer against
  its actual rubric. No new model grading call was recorded. That result stays
  on the account; only its local recovery copy was released via New topic to
  prepare the next single synthetic exam.
- One new Biologi 1, level C, mixed 12-question request used 12 numbered,
  synthetic source paragraphs. It ended `failed/terminal` with
  `STAGE_RETRY_LIMIT`, 3/12 approved, after 270.4 seconds of job time. No exam
  was issued; the UI correctly displayed 3/12 and a final failure. Readback:
  zero active exams and zero queued/running private pipeline jobs. There was
  no new attempt after this terminal outcome.
- Sanitized batch diagnostics show source-support rejections, occasional
  non-extractive science answers, weak options and scoring/alignment findings.
  Solver disagreement was not observed. Recorded exam-provider events: 6
  generate, 3 repair, 10 reviewer, 2 blind solver, all `gpt-4o-mini-2024-07-18`.
  These are stages of one request, not 21 separate exams. Source-support counts
  combine malformed evidence and genuine unsupported claims; they do not prove
  which subtype caused this run's rejections.
- Budget guard before these controls: spent 2.277246 USD. After three P.E.R
  calls and the one terminal exam request: spent 2.429079, reserved 0.263628,
  available 0.686364 under cap 3.379071. These are guard accounting amounts,
  not a claim about an OpenAI invoice.
- Independent source review found a prompt/schema gap: evidence indices were
  not explicitly zero-based and local to each question's quote array, while
  runtime requires it. Quote length was bounded at runtime but not described
  by the emitted quote schema. The local follow-up clarifies both languages
  and adds a string pattern limiting quote size, a constraint supported by the
  [official Structured Outputs schema guide](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
  It also explicitly forbids duplicate quotes and explains index reuse. All
  runtime and semantic approval gates remain unchanged.
- The local follow-up also logs `exam_verifier_source_contract` with evaluated
  count and fixed failure-count keys: invalid quote shape, quote absent from
  source, duplicate quote, unsupported reviewer verdict, invalid support shape,
  invalid index, and invalid part mapping. It emits no source/candidate text, notes, identities
  or evidence indices, and a logging failure cannot change approval. Categories
  may overlap and are not semantic truth judgments independent of the reviewer.
- Local contract checks cover a paragraph-12 quote: own-array index 0 passes,
  indices 1/12 fail, 500 characters pass, and 501 fail. Existing unsupported-
  claim rejections remain. The focused four-file regression passed 39/39;
  syntax and diff checks passed. Independent final follow-up found no remaining
  findings in the reviewed prompt/schema/diagnostic scope.
  This fix was subsequently deployed as `c484653`; the single comparison and
  more specific findings are recorded in the section above. Its independent
  effect on live yield remains unproven.
- Goal remains incomplete: current 12-question live yield failed; 6-question
  delivery, new mistake-training generation and active-exam P.E.R still need
  current-version live evidence. Do not retry paid tests without an actionable
  reviewed change and a fresh environment/budget check.

## Saved-exam recovery checkpoint — 2026-10-28 (feature Preview scope)

- Current working checkout: `codex/exgen-focused-mistake-evidence-2026-10-25`,
  based on `0f9cb999f0672f1e86bb3a3eeb4fd8dde71d6159`. Local code/tests are
  `js/exam-flow.js`, `tests/frontend/exam-flow.regression.mjs`, and
  `tests/frontend/graph-exam-flow.test.mjs` (accept the new explicit confirmation).
  The user approved committing these four files (including this status file)
  and pushing to the existing feature branch for Preview. The deployment must
  be checked against the resulting commit; production release is not included.
- Fresh read-only Git and Vercel checks agree: remote feature branch
  `codex/exgen-generation-quality-2026-10-20` and its existing stable Preview
  are READY on `0f9cb99` (`dpl_38Ekf3nAmeSUFPdVAyKZWAMeNqmf`). `main` and
  the deployment serving `exgen.se` remain on `ad60a68`
  (`dpl_5jhXXmoq94bp3gqyPwtJvLgEycd1`). No release was performed.
- Root cause: starting a new exam could overwrite the per-user local copy
  of an existing signed exam/result. The local patch blocks ordinary and
  prefilled generation while that copy needs attention, offers continuation
  or result recovery, and requires explicit confirmation for its removal.
- Recovery now retains expired/aged local answers, restores original course
  and exam settings after confirmed replacement, keeps the result visible
  after language changes, and rejects late recovery responses after navigation.
  Deferred redraws check both saved-copy identity and current account.
- A new complete save carries a random revision; small quota-fallback progress
  is tied to that revision. This prevents an older fallback from masking a
  later complete save if cleanup fails, without relying on timestamp ordering.
  Legacy pairs retain their existing matching behavior until a versioned save.
- Reading a draft no longer deletes fallback data and invalidates the caller's
  own snapshot. Successful account-save retry updates the result's persistence
  state; language changes wait for the in-flight save and cannot recreate a
  false failure or a second save request.
- Independent review identified those two P2 issues; both were fixed and
  rechecked with no remaining findings in that follow-up. The broader review
  also confirmed the expiry, settings, ownership and result-redraw fixes.
- Offline results: core API/pipeline/source/gold/public-P.E.R 75/75,
  P.E.R review handler 76/76, P.E.R exam-context frontend 104/104,
  graph exam -> P.E.R -> mistake-focused training -> grading passed.
  The final full exam-flow regression passed 246/246 on the reviewed code.
  The goal audit also checked ordinary-chat correction display: 2/2 targeted
  API tests passed, including persistence failure without a self-review note.
  Syntax and diff checks passed. All provider/database responses were synthetic
  or mocked; API-suite runtime is not a measurement of production response time.
- Limits: localStorage snapshot comparison is not atomic across simultaneous
  tab writes; this patch detects sequential conflicts, not every interleaving.
  Legacy base/fallback records cannot prove recency when their metadata is
  ambiguous. Do not describe either limitation as solved.
- No new live AI request, database/account/quota/secret change, or user-browser
  tab was made. The previous staging check found a saved result-recovery draft;
  it remains untouched. Offline fixtures do not prove live model quality,
  timing, 6/12-question yield, or the complete four-context P.E.R journey.
- Next: execute the approved feature push and verify the exact Preview commit.
  Reuse the stable Preview tab/session; verify environment and available budget
  before one synthetic end-to-end run, and finish that same run before another.

# Production exam-pipeline migrations — 2026-10-25

- [x] Applied exactly migrations `20261024140557`, `20261024151433`,
  `20261024225011`, and `20261024225017` to Production project
  `mnmotdluigzeehdjbhbu`, in order. The Supabase migration ledger now records
  those exact repository versions and names.
- [x] Production readback confirms `assembly_grace_used` defaults to false,
  the claim function uses the bounded assembly grace, cleanup has the
  20-minute recovery window, and quota reaping checks the live parent lease.
- [x] Both question-count constraints are validated. Aggregate check:
  1 pipeline row, 0 progress/candidate count violations, and 0 active jobs.
  No application rows were modified or deleted by these migrations.
- [x] The three changed `SECURITY DEFINER` RPCs use an empty search path and
  are executable only by `service_role` among `anon`, `authenticated`, and
  `service_role`.
- [x] Focused offline pipeline/recovery and migration tests passed 37/37;
  migration-file integrity check passed (53 migrations, 50 rollbacks).
- [!] Supabase advisors still report existing unrelated RLS, mutable search
  path, extension, function-grant, leaked-password-protection, and unindexed
  foreign-key findings. They were not changed as part of this approved scope.
- [!] These checks verify Production schema and aggregate invariants only.
  No paid AI call, learner-flow test, merge to `main`, or Production Vercel
  deployment was performed in this step.

# P.E.R auth-state synchronization — 2026-10-25

- [x] Root cause: the visitor quota row was calculated once when the widget
  loaded. Same-tab sign-in and cross-tab session changes could leave stale
  guest UI visible after authentication.
- [x] P.E.R now rechecks the local session on login, logout, language change,
  and cross-tab auth storage events. Near-expiry access tokens stay signed in;
  expired sessions are hidden from guest UI only after the registered
  Supabase token provider confirms refresh.
- [x] Offline coverage: `anon-per` 21/21, `stale-session` 13/13, and
  `per-page-targets` 65/65. The refresh path is stubbed in the frontend test;
  provider refresh itself is not claimed as live-verified.
- [x] Independent review rechecked the refresh-token edge case and cross-tab
  sign-in/sign-out; no blocker remains.
- [!] A read-only staging budget check showed 0.972991 USD remaining under the
  existing lower cap. No AI request was made: the side-panel account page
  showed a profile, but `app.html` then displayed the login gate, so P.E.R
  authentication in the target route was not confirmed. A separate Chrome
  Preview tab showed an active 12-question exam; it was left untouched.
- [x] Commit `6c090c8` is pushed to
  `codex/exgen-generation-quality-2026-10-20`; Vercel Preview
  `dpl_K5pn5TmPtG7Q7acUX8TEjQYrFxXq` is READY from the exact commit.
- [x] No `main`, Production, or database write was made.

# P.E.R request-aware active-exam hints — 2026-10-25

- [x] Active-exam guidance now recognizes explicit student requests for a
  why-explanation, a starting method, a term clarification, or a self-check.
  The help text remains fixed, pedagogical and answer-free; direct requests
  for the answer still receive only the existing hint ladder.
- [x] When a signed question has specialized source/graph guidance, that
  question-specific guidance takes priority over generic intent text. English
  and Swedish self-check requests are covered.
- [x] The signed-question projection no longer trusts the client's unsigned
  `answered` flag. Self-check wording is selected from the student's explicit
  request, not from that mutable field.
- [x] Offline verification: full `per-exam-review-handler` 72/72; focused
  active-hint overlap tests 5/5; changed-file syntax checks and
  `git diff --check` pass.
- [x] Independent read-only review found no blocker in answer gating, proof
  binding, intent classification, or model/quota avoidance.
- [!] No live model call or hosted database operation was made. The reused
  Preview tab is authenticated and shows ExGen with saved exam history; no
  active exam is visible on that page. The history was left untouched.
- [x] Feature checkpoint `cfdbbaa` is pushed to
  `codex/exgen-generation-quality-2026-10-20`; Vercel deployment
  `dpl_5VtdWjfNZe8Kh3EN2ysurBeTSUNA` is READY at
  `provia-ai-git-codex-gener-b3c147-eltons-projects-4adfb1a3.vercel.app`.
- [!] End-to-end P.E.R interaction was not live-tested: the remaining staging
  AI budget could not be freshly verified, so no paid request or exam action
  was made.

# P.E.R coach cache and verified-history access — 2026-10-25

- [x] Independent review found two improvement-coach gaps: old cached advice
  could survive prompt changes, and empty local `user_exams` history blocked
  the UI even when the authenticated server could access verified results.
- [x] Server coach fingerprints now include an explicit prompt/evidence
  revision. A browser cache from the prior revision fails validation and is
  regenerated from current authenticated, verified evidence.
- [x] The improvement page keeps the coach entry available without local exam
  history. The API remains the source of truth for authenticated verified
  results and provides neutral guidance when those results are absent.
- [x] Added regression coverage for a stale prompt fingerprint, server coach
  access with empty local history, and ordinary school-subject help from the
  authenticated homepage.
- [x] Offline verification: `per-exam-review-handler` 71/71; focused API
  homepage/cache tests 2/2; `per-page-targets` 65/65; changed JavaScript syntax
  checks and `git diff --check` pass.
- [!] Review and tests are source/harness evidence only. No staging model call,
  real learner history, active exam, or hosted database was used.
- [!] Existing active exam in the signed-in browser remains untouched. No
  production, main, database, account, quota, or secret changes were made.
- [x] Independent read-only review found no blocker in cache revisioning,
  account ownership, or empty-local-history access. It confirmed cache
  validation follows the authenticated active-exam gate.
- [!] The frontend test mocks the coach response; authenticated server evidence
  is covered separately by API tests rather than one hosted end-to-end test.
- [x] Code checkpoint `4f226f103fe165efee2286ceb6a6d5af05b96985` is pushed to
  `codex/exgen-generation-quality-2026-10-20`; Vercel Preview
  `dpl_F1MZFtPs92zJD1wxZJWTcMr72KfF` is `READY` at
  `https://provia-39pnnj8rl-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [!] The Preview currently shows its login gate in the available browser
  session. A login on another unique Preview hostname is not shared, so no
  authenticated live behavior was claimed or exercised.

# P.E.R material change guard — 2026-10-25

- [x] Independent security review found that the in-flight context key covered
  page, course, level and exam question, but omitted study material that P.E.R
  can use before an exam. A response grounded in old material could therefore
  arrive after the student edited the source.
- [x] The transient context key now includes the current page-scoped study
  material. A delayed-response browser regression changes that material while
  P.E.R is pending and asserts cancellation, retry availability and suppression
  of the late answer. The exam answer/proof gates are unchanged.
- [x] Improvement-coach instructions now match the facts actually supplied by
  the server: concrete next steps map from the fixed error taxonomy, while
  unsupported concepts and model-generated free-text tags cannot be presented
  as verified weaknesses.
- [x] Offline verification: `per-exam-context` 96/96, `per-page-targets` 64/64,
  `per-manifest` 29/29, `per-context-pack`, `per-exam-review-handler` 71/71,
  `pilot-session-recovery` 1/1, `per-pilot-smoke` and `account-storage-boundary`
  exited successfully.
- [!] Browser/API tests use synthetic fixtures and mocked requests; no live
  model call or staging database write was made. The material mutation is
  simulated at the page-context source, not entered through the production UI.
- [x] Syntax and `git diff --check` pass; independent read-only review found no
  blockers in the material guard, coaching prompt, or preserved exam gates.
- [x] Feature checkpoint `6673020` is pushed to
  `codex/exgen-generation-quality-2026-10-20`; Vercel Preview is READY at
  `https://provia-f5z1p6ez0-eltons-projects-4adfb1a3.vercel.app/app.html`
  (`dpl_D2eqXnEjpqFKwX9vtKnfn7FoBnQ5`).
- [!] No live model request was sent: the available signed-in account shows
  existing study history, so synthetic-only input could not be established
  without sending personal study data. Production and database were untouched.

# P.E.R begränsad livekontroll — 2026-10-25

- [x] Den inloggade staging-Previewn för kodcheckpoint `b8e38aa` öppnades i
  samma webbläsarsession. Startsidan laddade och den inskickade allmänna
  frågetexten fick ett faktiskt svar med relevant vägledning till Mockprov.
  Inget prov skapades.
- [!] Frågetexten var syntetisk, men sidans sparade P.E.R-historik verifierades
  inte före anropet. Därför räknas detta inte som en fullt verifierad
  syntetisk prompt/livekvalitetskontroll.
- [x] Utvecklingssidan laddade i samma session och visade serverhämtad
  studiehistorik. En skrivskyddad stagingfråga visade noll aktiva, orättade
  prov och noll köade/körande genereringsjobb.
- [!] Ingen AI-fråga skickades från utvecklingssidan eftersom kontots
  studiehistorik inte kunde verifieras som syntetisk. Inget aktivt prov fanns
  att testa säkert; vi skapade därför inte ett nytt prov bara för att få ett
  live-test av provledtråden. Aktivt provläge verifieras här endast offline.
- [!] Före startsidans livefråga var stagingens lästa återstående gräns
  `$0.974381`; en efterkontroll visade `$0.972991`. Dessa värden är från den
  lästa budgettabellen, inte en garanti för framtida kostnadsutrymme.
- [!] Den inaktuella-frågeledtråden-korrigeringen förblir på feature Preview;
  `main` och Production har inte ändrats. Full liveverifiering av alla tre
  lägen är därmed inte klar.

# P.E.R avbryter inaktuella provledtrådar — 2026-10-25

- [x] Oberoende granskning hittade att ett fördröjt P.E.R-svar kunde visas
  efter att eleven bytt aktuell provfråga. Det kunde göra att en ledtråd om
  fråga N uppfattades som hjälp för fråga N+1.
- [x] P.E.R-begäran binds nu till aktuell sida, kurs/nivå och, under aktivt
  prov, verifierad providentitet och frågeidentitet. Kontextbyte avbryter
  begäran, rensar dess tillfälliga fråga och visar ett tydligt besked; manuellt
  skickande krävs för att fråga igen. Svar som redan färdigställts påverkas
  inte. Provets serverbaserade proof- och facitgrindar är oförändrade.
- [x] Ny fördröjd webbläsarregression bekräftar att frågebyte avbryter ett
  väntande svar, återaktiverar Skicka och aldrig renderar ett sent svar från
  föregående fråga.
- [x] Oberoende slutgranskning fann inga blockerare i ändringen och
  bekräftade att elevens svarstext på samma fråga inte utlöser avbrott.
- [x] Tester på patchen: `per-exam-context` **94/94**,
  `per-page-targets` **64/64**, `per-manifest` **29/29**,
  `pilot-session-recovery` **1/1**; full API-handler **71/71** på samma
  API-kod; syntax- och diffkontroller passerade.
- [x] Den fördröjda webbläsarregressionen täcker nu även sid- och
  kurskontextbyte och verifierar att ett sent svar inte visas. Bytena
  simuleras via P.E.R-kontexten; riktig routenavigering och kursväljarens
  interaktion är inte täckta av detta test.
- [x] Kodcheckpoint `b8e38aa0a16e8b8c0a33da10e90b361438d8747a` är pushad till
  `codex/exgen-generation-quality-2026-10-20`. Preview
  `dpl_BUy5g6e27yV4rEXAaUZ1utfogdUC` är `READY` från exakt SHA. Den
  inloggade branch-aliasen har ett befintligt ifyllt prov; det lämnades orört.
- [!] Ingen ny live-AI-förfrågan gjordes. Den aktuella inloggade sessionen har
  ett äldre aktivt prov och används därför inte för ny ledtrådstestning. Den
  senaste äldre testvyn visade en separat provgenerering som misslyckats 0/3;
  den är inte en liveverifiering av den här P.E.R-fixen. Stagingbudgeten
  lästes endast: `$0.974381` återstod vid senaste budgetuppdatering.
- [!] Previewns deploymentstatus och commit är verifierade, men appflödet efter
  autentisering har inte visuellt verifierats på den nya unika deploy-URL:en.
  Ingen `main`, Production, Supabase-data/schema, konto, kvot eller hemlighet
  ändrades.

**PILOT NOT READY.** Nästa säkra steg är att använda en inloggad stagingvy utan
öppet prov för syntetisk kontroll av startsida, aktiv provledtråd och
förbättringscoach. Lämna befintliga prov orörda och gör inga betalda anrop
utöver den verifierade kvarvarande staginggränsen.

# P.E.R kontext på förbättringssidan och kvalitetskontrakt — 2026-10-25

- [x] Förbättringssidan skickar en sektionsnyckel från en fast allowlist
  (`hem`, `felbank`, `prov`, `coach`, `rapport`). Servern mappar bara kända
  nycklar till fasta etiketter, och bara på förbättringssidan. Ändring av
  sektion avbryter en pågående P.E.R-förfrågan.
- [x] Aktivt prov får fortsatt endast answer-free, fråga-specifika ledtrådar.
  Beräkningsstegen använder en begränsad avsiktsmatchning så biologins
  "bestäm organell" och SO:s "räkna upp" inte felaktigt får matematikstöd.
- [x] Resultatfrågan "Vad ska jag träna på nu?" går genom vanlig studiecoachning
  efter verifierat resultat. Verifierade svagheter hämtas från servern; klientens
  resultatsammanfattning och svarhistorik skickas inte vidare som bevis.
- [x] Offline-regression kopplar ihop produktionsnormalisering och strukturell
  grind, verifierarens riktiga parser med ett syntetiskt negativt svar,
  `decideApproval` och `finalizeVerifiedExam`. Kandidaten avvisas före
  slututfärdande. Detta bevisar kontraktet, inte att en riktig modell alltid
  upptäcker semantiska fel.
- [x] Verifiering på aktuell lokal diff: P.E.R API **76/76**; förbättringssidans
  browserflöde **87/87**; manifest **31/31**; data-minimering **4/4**;
  genereringspipeline **28/28**; source coverage **6/6**; HTTP-pipeline **2/2**;
  offline pipeline **1/1**; ämnesrouting och eval-first-pass passerade;
  verifierarkontrakt och offline quality-gold passerade. `per-context-pack`
  passerade.
- [x] Oberoende read-only-granskningar fann inga säkerhets-/kvotgrindar som
  försvagats. En granskning bekräftade att det nya sammansatta offlinefallet
  stänger den avgränsade verifierar-till-finaliserar-kontraktsluckan.
- [x] Det tidigare saknade testberoendet `@electric-sql/pglite@0.5.10` finns nu
  endast i arbetskopians ignorerade `node_modules`; `package.json` och
  `package-lock.json` ändrades inte. Fullt HTTP-pipelinetest passerade **2/2**,
  inklusive 3/6/12-frågeflöden, retry, 503 och tydlig partiell leverans.
- [!] Aktuell Vercel Production är READY från `main` SHA
  `ad60a68316a1dfaedb54a508e5b063bd1cc24bf4`. Senaste kontrollerade Preview
  är READY från feature SHA `590ac554871231469c9f2612ce42a1445cf4cca0`.
  De aktuella lokala ändringarna är ocommittade och finns inte i någon av dessa
  deploymentar.
- [!] Ingen staging-/produktionsdatabas, live-modell, betald AI-förfrågan,
  push, merge eller deploy utfördes. Verklig modellrelevans och full livekedja
  är därför ännu inte verifierade.

**MÅLET FORTSÄTTER.** Nästa steg: granska källförankring och felbaserad
generering mot syntetiska ämnesfall; gör sedan aktuell stagingbudget- och
Preview-kontroll före en begränsad syntetisk liveverifiering. Ingen lokal
ändring ska beskrivas som live innan exakt commit och deployment verifierats.

# P.E.R sidhistorik och startsidesminne — 2026-10-25

- [x] Live-stagingkontrollen på den godkända Previewn avslutades säkert med
  **0/3 godkända frågor**; prov utfärdades inte och inga befintliga prov
  ändrades. Telemetrin visar verifierarkasseringar för källstöd/linjering,
  faktakvalitet, tydlighet och svårighetsgrad samt strukturella avslag på
  `source_answer_not_extractable`. Reparationen kördes men gav inte tre
  godkända frågor. Detta är en provgenererings-/underlagsdiagnos, inte bevis
  för ett fel i P.E.R eller att material saknades.
- [x] P.E.R konversationsfönstret begränsas nu till de senaste åtta meddelandena
  **efter** filtrering till aktuell sida och borttagning av provbundna turer.
  Nyare samtal på andra sidor kan inte längre skjuta undan relevant kontext på
  startsidan.
- [x] Startsideshjälp sparar fortsatt sidans vanliga chathistorik, men hoppar
  över den fristående långminnesuppdateringen. Det undviker att en generell
  ExGen-fråga oavsiktligt uppdaterar elevminne. Inläsning av elevprofil och
  verifierat provunderlag förblir avstängd på startsidan.
- [x] Oberoende granskning fann inga blockerare. Den noterade en testlucka kring
  sparad sidchat; regressionstestet har kompletterats och verifierar nu både
  sparandet och att ingen bakgrundsuppdatering av långminne startar.
- [x] Fullständig `tests/api/per-exam-review-handler.test.mjs` passerade
  **70/70** efter kodändringarna. Därefter lades granskningens extra
  sidchattsparande-assertion till och det fokuserade startsidetestet passerade
  **1/1** på exakt slutdiff. P.E.R frontendsviter passerade **5/5**;
  `per-memory-epoch`, syntaxkontroller och `git diff --check` passerade.
- [!] Live P.E.R-kvalitet på startsida, aktivt prov och förbättringssida är
  fortsatt overifierad. Inga ytterligare live-AI-anrop är godkända i denna
  verifieringsrunda. Ingen kvot, roll, hemlighet, Supabase, `main` eller
  Production ändrades.

# P.E.R three-page checkpoint — 2026-10-25

- [x] Integrated code checkpoint `81319a8687e212795835846f3ea145e23de0320f`
  and status checkpoint `b71e630141a1af83c618c2c246f6ac399090a583` are pushed
  to `codex/exgen-generation-quality-2026-10-20`. Vercel deployment
  `dpl_Foma2M2hftE18gezWJt55Vsht4sa` is `READY` from exact SHA `b71e630...` at
  `https://provia-mmqi4rbt6-eltons-projects-4adfb1a3.vercel.app/`.
- [x] The current Preview session was authenticated. One approved synthetic
  Biologi 1 generation request was run. It safely failed with **0/3 approved**;
  no exam was issued, no existing exam was touched, and no P.E.R live hint or
  post-grade response could be tested because no exam was created.
- [x] Sanitized Vercel telemetry for the request shows this was not an upstream
  model/transport failure or a simple timeout: generation and repair calls
  completed. The generation batch returned 8 candidates (4 dropped because
  source answers were not extractable); all 3 verifier-checked candidates were
  rejected for source support. Two repair batches each returned 7 candidates;
  each dropped 2 structurally and the remaining verifier-checked candidate was
  rejected. Across the request, 5 verifier-checked candidates were rejected;
  recorded reasons include source alignment/support, factual/answer quality,
  clarity and difficulty mismatch. No solver check ran because candidates did
  not pass the reviewer. Telemetry also reports zero source sections tracked;
  that is a diagnostic lead, not proof that the material was absent.
- [x] Staging budget read after the request (`2026-10-25 03:35:50 UTC`): cap
  `$3.379071`, spent `$2.141062`, reserved `$0.263628`, remaining `$0.974381`.
  No budget, quota, account or role was changed. No further live AI calls are
  authorized or planned in this verification.
- [x] Offline verification on final code: full P.E.R handler suite **70/70**;
  focused homepage/ordinary-chat suite **3/3**; frontend P.E.R suite **5/5**;
  usage stream **17/17**; memory-provenance, syntax and diff checks passed.
- [!] Live P.E.R quality on homepage, active exam and improvement page remains
  unverified. The exam-generation failure is an adjacent blocker; keep quality
  gates intact and investigate source segmentation/answer extraction and
  repair targeting before another live test. `main`, Production, Supabase
  schema/data, roles, secrets and existing exams remain unchanged.

- [x] Checkpoint `21bf94d7e4af7c29ee655db7336b0588e3034c63` is pushed to
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_7WkebewvQt7F26d3JkHK7R1x2mvA` is `READY` from that exact SHA:
  `https://provia-foqlgy9zr-eltons-projects-4adfb1a3.vercel.app/`.
- [x] Homepage routing now uses the shared page canonicalizer, so both
  `startsida` and legacy `start` retain the homepage identity while dropping
  stale client course, material, targets, weak areas and mistake context.
  PER's product/support prompt accepts only whitelisted page identities.
- [x] Synthetic Playwright smoke followed one session through homepage help,
  active-exam hint for the current question, and verified-results improvement
  coach. It passed **1/1**; focused API regressions passed **4/4**;
  `per-page-targets` passed **50/50**; `per-exam-context` passed **88/88**;
  prompt/public-guide tests passed **5/5**. Syntax checks and `git diff --check`
  passed.
- [x] `app.html` and `förbättring.html` returned HTTP 200 through authenticated
  `vc curl`. Unauthenticated requests receive the Vercel protection redirect.
- [!] All application-flow responses in the browser smoke are synthetic mocks.
  No live OpenAI request was made and no fresh staging budget was checked, so
  live model quality and a signed active-exam hint remain unverified. The
  Preview is available, but this does not establish pilot readiness.
- [x] Independent review confirmed the legacy `start` alias fix and that the
  active-exam server-state and signed-question-proof gates are unchanged.
- [x] Follow-up history isolation is implemented locally: only authenticated
  server-loaded turns tagged for the current non-exam page enter P.E.R prompts.
  `prov`, `resultat`, `exam` and `exam-result` turns are treated as exam-bound;
  untagged legacy/client-forged turns and other-page history are excluded.
  Homepage help also skips learner profile, long-memory and verified exam
  evidence, while the improvement coach still uses its own verified results.
  Long-memory refresh accepts only tagged non-exam page history.
- [x] Full P.E.R handler regression passed **70/70** before the final small
  route-classification cleanup. After that cleanup, the focused homepage and
  ordinary-chat handler cases passed **3/3**, and `per-memory-epoch` passed,
  including provenance assertions. Syntax checks and `git diff --check` passed.
- [x] The follow-up changes are included in integrated checkpoint `81319a8`
  above; the earlier Preview remains recorded here only as its historical
  checkpoint. Live model response quality remains unverified pending the
  authenticated, budget-bounded staging run.

# Senaste P.E.R-verifiering — 2026-10-25

- [x] På `91e914bb360610fc4fc16f3cea2620e884db1812` passerade den fullständiga
  `tests/api/per-exam-review-handler.test.mjs`-sviten **66/66**. Den tog cirka
  323 sekunder; tidigare korta testkörningar avbröts av en tillfällig
  55-sekundersgräns och ska inte tolkas som kodfel.
- [x] `tests/api/per-usage-stream.test.mjs` passerade **17/17**. De tre
  frontend-sviterna `per-page-targets`, `per-exam-context` och `per-manifest`
  passerade också. De omfattar sidrouting, aktivt prov, kontobyte och dold
  provhistorik.
- [x] Tre oberoende, skrivskyddade granskningar fann ingen blockerande
  kontext-, säkerhets- eller kvalitetsgrind-bugg i den granskade ändringen.
  De bekräftade att hemsidans generella hjälp inte får klientpåhittade
  studieområden, att förbättringscoachen använder verifierade resultat för
  autentiserat konto och att aktivt prov fortsätter att kräva facitfria
  ledtrådar. Hjälp på hemsidan kan däremot inte utgå från studiematerial som
  användaren inte har lagt till i den kontexten.
- [x] Inloggad P.E.R.-vy bekräftades skrivskyddat på den befintliga
  branch-previewn. Den visar ett äldre syntetiskt 12/12-prov; P.E.R:s befintliga
  meddelande säger att provet inte är öppet för svar. Ingen fråga skickades,
  provet lämnades orört och en annan oskickad P.E.R.-fråga behölls.
- [x] Vercel-previewvariablernas metadata verifierades för exakt
  `codex/exgen-generation-quality-2026-10-20`: staging-URL, OpenAI-nyckel,
  Supabase servernyckel, pilotläge och budgetvariabel är branch-scope:ade och
  krypterade. Inga värden lästes.
- [x] Färsk, skrivskyddad stagingbudget: cap `$3.379071`, spenderat
  `$2.090394`, reserverat `$0.263628`, återstående `$1.025049`.
- [!] Detta är fortfarande inte bevis på live-modellens svarskvalitet. Ingen
  ny live-AI-förfrågan eller ändring av Supabase, kvot, Vercel Production eller
  `main` gjordes. Den äldre provvyn saknar bekräftad aktiv serverstatus och
  används inte som testunderlag.
- [x] Senaste statuscheckpoint `317636e` är pushad och Vercel-preview är
  `READY` från exakt SHA:
  `https://provia-jitp12zs2-eltons-projects-4adfb1a3.vercel.app/`.
- [!] **PILOT NOT READY.** Offlineflöden och rätt stagingkonfiguration är
  verifierade, men ingen serververifierad aktiv provfråga har använts för ett
  nytt live-test. Behåll det öppna provet och invänta ett säkert testläge.

## P.E.R sidkontext och vanliga kontobyten — 2026-10-25

- [x] P.E.R skiljer sididentitet från skolämne: startsidan och
  förbättringssidan skickas kvar som `pageContext.page`, men används inte längre
  som ämne när kurs/ämne saknas. Det förebygger att modellen får `startsida`
  eller `förbättring` som studieämne.
- [x] Vanliga P.E.R-anrop knyts nu till det konto som startade dem även utanför
  pilotmiljön. En auth-ändring mellan flikar avbryter begäran; sen kontroll av
  ägarskap stoppar även ett redan fördröjt svar från att visas eller sparas i
  den delade P.E.R-historiken.
- [x] Ett Playwright-test öppnar två verkliga flikar i samma origin. Det byter
  auth-session från A till B medan A:s P.E.R-svar hålls tillbaka och bekräftar
  storage-händelse, avbruten begäran samt att A:s svar varken visas eller
  cachelagras.
- [x] Tvåflikstestet bekräftar även att ett svar som anländer efter ett
  kontobyte nekas av den sena ägarskapskontrollen även när inget storage-event
  levereras till samma flik.
- [x] `tests/frontend/per-page-targets.test.mjs` passerade **41/41**;
  `per-manifest` **28/28**; `per-exam-context` **87/87**; `per-context-pack`
  och `per-landing` passerade. `node --check` och `git diff --check` passerade.
- [!] En enda P.E.R-förfrågan gjordes i den redan öppna staging-Previewn med
  syntetiskt material, enligt användarens godkännande. Servern svarade
  ”Provet är inte öppet för svar ...” i stället för en ämnesspecifik ledtråd.
  Det befintliga 12/12-provet lämnades öppet och oskickat; dess verifierade
  serverstatus avlästes inte, och inget nytt försök gjordes. Därför är live-
  beteendet för ett serververifierat aktivt prov fortfarande obekräftat.
- [!] Den fullständiga API-testfilen för P.E.R avbröts före denna ändring och
  räknas inte som godkänd. `main`, Production, Supabase och kvoter ändrades inte.

## P.E.R allmän hjälp, provläge och kontobyte — 2026-10-25

- [x] Allmän P.E.R-chatt på app-/förbättringssidor skickar inte längre lokal
  poäng, svaghetsområden eller historik som om de vore verifierade serverdata.
  Förbättringssidans coach använder serverns autentiserade historik.
- [x] Inaktuella provfrågor som ligger kvar i klientkontext blockerar inte
  tydliga allmänna frågor när servern säger `none`, `completed`, `abandoned`,
  `expired` eller `missing`. En riktig fråga om facit eller lösning fortsätter
  att stoppas; provfält och gamla svar tas inte med till den vanliga prompten.
- [x] Kontobyte rensar kontobunden lokal data genom den befintliga
  `ExGenLocalDataBoundary`, uppdaterar ägarmarkören och ogiltigförklarar
  fördröjda coachsvar. A→B-testet bekräftar att B:s historik/svar finns kvar,
  medan A:s sena svar varken visas eller cachas.
- [x] Nya, provverb-anpassade ledtrådar som byggde på overifierad frågetext
  togs bort. Befintliga korta, facitfria ledtrådar behålls. Granskaren noterade
  att äldre fasta graf-/lutningsledtrådar ännu kan väljas av klientmetadata;
  de avslöjar inte facit men kan ibland bli irrelevanta.
- [x] Lokal verifiering: full `tests/api/per-exam-review-handler.test.mjs`
  passerade före senaste utökningen; efter utökningen passerade fokuserade
  API-tester **2/2** för fem inaktiva statusar, treordsöverlapp och fortsatt
  facitspärr. `tests/frontend/per-page-targets.test.mjs` passerade **29/29**.
  Även `per-manifest` **28/28**, `per-exam-context` **87/87**,
  `per-landing` och `per-context-pack` passerade. Syntax- och diffkontroller
  passerade.
- [!] Endast offline/mock-verifiering gjordes i detta checkpoint. Ingen staging-
  Preview, live-modellförfrågan, `main` eller Production ändrades. Dessa tester
  bevisar inte kvaliteten på svar från en live modell.
- [x] API-checkpoint `e6a673906e17b26ccf1ba88987eb7c5cbef4f847` är pushad till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_DQcx79XMu9rUhUmkwK4sDUaPdhM9` är `READY` från exakt denna SHA:
  `https://provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app`.
- [x] Frontend-/kontoisoleringscheckpoint `d9dd0d59b7361fd09ed78a77ad09e225c7905fea`
  är pushad separat. Preview `dpl_5qX493oiqfLF4M4bW3F4DgKonz9b` är `READY`
  från exakt denna SHA; Vercels befintliga branch-alias är
  `https://provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app`.
- [!] Offline-/mock-testerna och Preview-builden är verifierade. Inloggad
  staging/live-modellbeteende testades inte; färsk kostnads- och
  stagingåtkomstkontroll saknades. `main`, Production och Supabase ändrades
  inte.

## Senaste livebevis och nästa kvalitetsfix — 2026-10-25

Den här posten är nyaste kontrollen och ersätter äldre påståenden nedan om att
ingen ny modellförfrågan/liveverifiering har gjorts. Äldre poster behålls som
historiska checkpoints.

- [x] Återanvände den befintliga inloggade Preview-fliken och slutförde ett enda
  syntetiskt Biologi 1-prov: 12 frågor genererades, alla 12 besvarades och
  rättades. Inga extra flikar, parallella prov eller ytterligare genereringar
  startades. Resultatet blev 11/12 (92 %).
- [x] Livefrågornas sparade, syntetiska metadata visar två konkreta
  redundansfall: Q2/Q10 delar koncept `Ribosomer`, lärandemål och fullpoängssvar
  men hade olika ämnesetiketter; Q5/Q8 hade samma fotosyntesbegrepp och nästan
  identisk frågestam men olika underetiketter. Q3 kallade fotosyntes
  ”energiåtervinning”, en missvisande term.
- [!] Q8 gav 0/1 trots att svaret uttryckligen beskrev ljusenergi som omvandlad
  till kemisk energi och angav druvsocker/syre. Detta ser inkonsekvent ut, men
  korrekt/felaktigt poängutfall är inte slutligt fastställt utan den signerade
  fullständiga rubricen; gör ingen generell slutsats från en fråga.
- [x] Lokal assessment-fix fångar nu de observerade ribosom- och
  fotosyntesparafraserna. Nästan identisk frågestam kräver samma koncept och
  exakt samma icke-tomma lärandemål; samma mål och svar jämförs med exakt samma
  normaliserade ord i samma ordning. Regressioner säkerställer att olika
  lärandeverb, ”ej”, extra svarsbegrepp, omvända processroller och saknade mål
  inte kollapsas.
  Naturvetenskaplig verifierare instrueras även att granska processpremiss och
  terminologi, inklusive att fotosyntes inte är ”energiåtervinning”.
- [x] Lokal P.E.R.-fix rensar gammal provkontext även när klienten felaktigt
  anger `page=app`; regressionen täcker både `prov` och `app`. Aktivt provs
  facitfria skydd ändrades inte.
- [x] Verifiering efter senaste justeringen: assessment + subject overlay-filer
  passerade; pipeline/HTTP/verifier/salvage **32/32**; `node --check` för de
  tre ändrade API-filerna och `git diff --check` passerade. P.E.R-handler hade
  passerat **59/59** efter kontextsaneringen; P.E.R-kod har inte ändrats sedan.
- [x] Färsk stagingbudget efter en generering och en rättning: cap
  `$3.379071`, spent `$2.090394`, reserved `$0.263628`, intern marginal cirka
  `$1.025049` (rad `2026-10-24 23:35:16 UTC`). Användarens totala
  auktoriseringsgräns är nu `$5`; stagingens interna cap lämnades orörd.
- [x] Oberoende slutgranskning av den senaste dubblettregeln fann ingen
  blockerande falskpositiv. Kvarvarande dokumenterad avvägning: omformulerade
  eller omordnade facit kan undgå hård dubblettmatchning när övriga signaler
  inte räcker; detta är avsiktligt säkrare än att kasta svar med omvända roller.
- [x] Kodändringarna är committade som `a4cee07` och pushade till den
  godkända branchen `codex/exgen-generation-quality-2026-10-20`. Vercel
  deployment `dpl_ETh73S5PAcWyDVPKFRrVippFxU1b` är `READY` från exakt commit
  `a4cee07739df2ae45a28d50f463a7189ffa1b373`; befintlig stabil Preview-alias
  pekar på den. Main/Production och produktionsdatabasen är orörda.
- [!] Samma Preview-flik laddades om efter deployen och visade autentiserings-
  grinden; den tidigare staging-sessionen följde inte med. Inget nytt AI-anrop
  gjordes efter omladdningen, så budgetraden är fortsatt cap `$3.379071`, spent
  `$2.090394`, reserved `$0.263628`, remaining cirka `$1.025049`. Ett enda nytt
  syntetiskt prov kräver att en staging-session återställs i denna befintliga
  flik; inget parallellt test eller ytterligare flik ska skapas.

**PILOT NOT READY.** Nästa steg: återställa staginginloggning i den redan
öppna Preview-fliken. Kontrollera då först att det inte finns ett aktivt prov
och att intern budget fortfarande täcker ett helt syntetiskt test; generera,
besvara och rätta högst ett prov i samma flik. Produktionsgrindar är ännu inte
uppfyllda.

## Terminal rättningsstatus, kostnad och fortsatt stagingverifiering — 2026-10-25

- [x] Användaren höjde den totala godkända AI-kostnadsgränsen till `$5`.
  Stagingens egen budgetrad lämnades oförändrad: cap `$3.379071`, spenderat
  `$1.989743`, reserverat `$0.263628`, effektiv marginal cirka `$1.125700`.
  Ingen budget, kvot eller roll ändrades.
- [x] Den enda återanvända Preview-fliken visade ett redan ifyllt 12/12-prov.
  Ett avslutsförsök gick kort till rättningsläge och återgick till provvyn.
  Staging hade 20 issuance-poster, 12 med verifierat resultat, 0 aktiva
  ograderade och 0 rättningar utan resultat. Vyns sista fråga/svar matchade
  inte någon sparad resultatrad. Inga nya `ai_usage_events` registrerades.
  Vyn bedöms därför som en gammal klientvy, inte en ny liveverifiering.
- [x] Rättningsmotorn spärrar nu upprepade inlämningar efter terminala svar
  (`EXAM_NOT_ACTIVE`, redan rättat, svarskonflikt, avbruten rättning eller
  utgånget resultat). Spärren gäller även P.E.R:s direkta `grade(answers)`-väg.
  Provets lokala innehåll lämnas kvar; ny provrendering/återupptagning återställer
  spärren. Tillfälliga nätverks- och modellfel förblir återförsökbara.
- [x] Ny riktad regression `tests/frontend/terminal-grade-state.test.mjs`
  passerade; den kontrollerar att terminal standard-/P.E.R-inlämning inte gör
  ett nytt API-anrop och att ett tillfälligt providerfel kan återförsökas.
  Hela `tests/frontend/exam-flow.regression.mjs` passerade **192/192**.
  `git diff --check` passerade. Oberoende granskning fann ingen blockerare.
- [!] Ingen ny modellförfrågan, ny generering, produktionsändring eller merge
  gjordes. Aktuell flik kan inte användas som bevis för lyckad ny rättning.
  Före ett nytt liveprov ska den gamla vyns identitet/återhämtning lösas; kör
  därefter högst ett komplett syntetiskt flöde inom stagingens kvarvarande
  interna spärr, utan att skapa parallella prov.

## Enfliksregel och aktuell Preview-status — 2026-10-25

- [x] Arbetet återanvänder en befintlig Preview-session. Inga nya
  browserflikar, inloggningsrundor eller prov har skapats i den här
  uppföljningen. Ett syntetiskt liveprov ska genereras, besvaras och rättas i
  samma session; avbryt inte efter generering och skapa inte parallella prov.
- [x] Dedupe-fixen och P.E.R.-saneringen är committade i `c9e04aa`. Den lokala
  checkout-branchen är `codex/exgen-school-pilot-integration-20261024`; samma
  SHA finns på den godkända fjärrbranchen
  `origin/codex/exgen-generation-quality-2026-10-20` och i Vercel Preview
  `READY` från just den fjärrbranchen.
  Den befintliga branch-aliasen är
  `https://provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [x] Den befintliga Preview-sessionen visade autentiserad ExGen-startsida efter
  omladdning. Ingen ny inloggning behövdes i den här kontrollen.
- [x] Exakt READY-deployment och branch-scopade Preview-variabler verifierades
  igen: deployment `dpl_GRbkaEMrt361TFLTCMJjU2zbeejC` kör `c9e04aa` från
  `codex/exgen-generation-quality-2026-10-20`. Variabelnamn och scope kunde
  läsas utan att dekryptera några värden.
- [x] Supabase staging `yhcinqejsocpmmetazpz` saknade två lokala migrationer.
  Efter förhandskontroll (20 befintliga jobb, 0 aktiva, inga checkpointar över
  begärt antal) tillämpades endast stagingmigrationerna
  `release_abandoned_exam_pipeline_after_recovery_window` och
  `tighten_pipeline_integrity_bounds`. Supabase registrerade dem som
  `20261024225011` respektive `20261024225017`; motsvarande repo-filer heter
  `20261024165536_...` och `20261024212500_...`. De två integritetsvillkoren finns;
  quota-reapern skyddar en aktiv parent-lease innan pipeline-jobbet skapats.
  Postkontrollen fann fortsatt 20 jobb och 0 aktiva; budgetraden var oförändrad.
- [x] Staging-ACL-kontroll bekräftade att anon inte kan anropa status-RPC:n,
  authenticated kan anropa den endast via ägarbunden `auth.uid()`-kontroll.
  Security Advisor visar övriga projektvarningar (bland annat RLS-tabeller utan
  policies och SECURITY DEFINER-funktioner); de granskade pipelinefunktionerna
  är avsiktligt server- eller ägarbegränsade och inga nya behörigheter gavs här.
- [x] Den hostade retention-schemaläggningen verifierades skrivskyddat:
  `exgen-mock-exam-pipeline-retention` är aktiv med `*/15 * * * *` och kör den
  förväntade cleanup-funktionen mot stagingdatabasen.
- [x] Lokal riktad svit efter verifiering av kod passerade **135/135**:
  pipeline/Postgres, 3/6/12-gränser, reservation/lease, källgrundning,
  dubbletter, felträning, verifierarkontrakt och P.E.R.-lägen. En oberoende
  granskning rapporterade separat **52/52** källgrundnings-/pipeline-tester.
  HTTP-/återställnings- och kvotgränssnittssviten passerade dessutom **24/24**.
- [x] De fem nya rollbackspärrarna passerar **5/5** PGlite-tester;
  `node scripts/check-migration-files.mjs` passerar med 53 migrationer och
  50 rollbackfiler. Spärrarna vägrar osäker rollback i stället för att ta bort
  reservationer eller återöppna provpipelinefel.
- [x] Riktade offline-tester och syntaxkontroller för ändringarna passerade;
  oberoende P.E.R.- och provgenereringsgranskningar fann inga blockerare.
  Dessa verifierar kodens deterministiska regler, inte live-modellens svar.
- [!] Ingen ny modellförfrågan gjordes. Senast lästa stagingbudget visade
  spenderat `$1.989743` och reserverat `$0.263628` mot den användargodkända
  gränsen `$2`; kvarvarande godkänd marginal kan därför inte säkert täcka ett
  nytt test. Ingen budget, kvot, roll eller konto ändras för att kringgå detta.
- [!] **PILOT NOT READY.** P.E.R.- och den senaste ändringens live-modellbeteende
  är inte verifierade. Main/Production har inte ändrats. Ett framtida
  stagingtest kräver först en färsk budgetkontroll som visar tillräcklig
  marginal och ett befintligt konto utan pågående prov; kör då ett enda prov
  och slutför generering, elevsvar och rättning i samma flik. Oberoende
  säkerhetsgranskning fann ingen blockerare för ett bounded försök, men verklig
  konkurrens mellan PostgreSQL-sessioner återstår att verifiera före bredare
  pilottrafik.

## P.E.R. efter rättat prov — 2026-10-25 (checkpoint före c9e04aa-push)

- [x] Oberoende granskning fann att vanlig hjälp från en kvarhängande `prov`-
  sida efter ett rättat prov kunde få gammal klientkurs, studiematerial,
  historik och felbank. Servern verifierade att ett prov var rättat, men inte
  att dessa kvarvarande klientfält hörde till det provet.
- [x] Vanlig P.E.R.-hjälp från en stale provvy sanerar nu dessa fält även när
  senaste serverstatus är `completed`. Den nya frågan går fortfarande till
  vanlig studiehjälp; aktivt provs ledtrådsskydd och verifierad efterrättning
  använder oförändrade kodvägar.
- [x] Regressionstest kontrollerar att gamla kurs-/material-/historik-/felbank-
  markörer inte når modellgränssnittet och att vanlig hjälp fortsätter fungera.
  Oberoende granskning fann inga blockerare; riktade P.E.R.-tester passerade.
- [x] Vid detta checkpoint var ändringen ännu lokal. Den kom senare med i
  `c9e04aa`, pushades till feature-branchen och verifierades på READY Preview;
  se aktuell sammanfattning ovan. Live-modellbeteendet är fortfarande
  overifierat.

## Slutfört enfliks-test och processdubblett — 2026-10-25

- [x] Återanvände den redan inloggade stabila Preview-fliken; inga nya flikar,
  konton eller prov startades. Det enda nya syntetiska Biologi 1-provet
  slutfördes och rättades i samma session.
- [x] Previewn utfärdade och sparade alla **12/12** begärda frågor. Rättningen
  sparade resultatet **11/12 (92 %)**. De flesta svaren fick full poäng och
  resultatvyn visade täckta begrepp och nästa träningsområde.
- [!] Liveutfallet blottlade ändå redundans: två enzymfrågor, två
  fotosyntesfrågor och överlapp mellan cellandning/mitokondrier. En bred fråga
  om cellens funktioner gav 0/1 eftersom rubriken förväntade specifika roller
  för cellmembran och cytoplasma. 12/12 antal är alltså inte ensamt ett
  kvalitetsmått.
- [x] Oberoende, skrivskyddad granskning reproducerade en möjlig falskpositiv:
  om två processfrågor delar ämne och facit kan de felaktigt slås ihop.
  Processparafraser kräver nu samma in-/utdatainriktning och samma
  ämnessignatur; enda specialfallet är den snäva kloroplast/fotosyntes-
  parafrasen med samma ämnestagg och facit.
- [x] Lade till offline-regressioner som fångar två parafraser av samma
  fotosyntesprocess, behåller separata frågor om indata/utdata och bevarar
  olika processer under breda och blandade ämnestaggar. Riktade assessment-, 3/6/12
  pipeline- och offline-pipeline-tester passerade; syntax- och diffkontroller
  passerade.
- [x] Dedupe-fixen och regressionerna kom senare med i `c9e04aa` och finns på READY Preview.
  Inget andra liveprov kördes; den nya regeln är därför offline-verifierad men
  inte livebevisad.
- [!] Denna uppföljning lämnade 9/12-gränsen, andra konton och reservationer
  orörda. Skrivskyddad stagingkontroll efter rättningen: cap `$3.379071`,
  spent `$1.989743`, reserved `$0.263628`, kvar under cap `$1.125700`; raden
  var uppdaterad `2026-10-24 22:27:08 UTC`. Inga nya AI-anrop gjordes utöver
  det enda godkända provets generering och rättning.

## Svarsmålsdubbletter och enfliksregel — 2026-10-25

- [x] Behöll regeln om en återanvänd Preview-flik. Den här ändringen använde
  enbart offline-tester; inga nya flikar, prov eller modell-anrop skapades.
- [x] Reproducerade de tre observerade Biologi 1-dubblettparen i
  `tests/assessment/assessment.test.mjs`. Svarslikhet ensam får inte längre
  kasta bort frågor: paret måste även ha samma koncept, frågeintention och
  icke-uppgiftsbärande ämnessignatur. Regressionerna behåller tilläggsmål om
  temperatur, NADH, aktiveringsenergi/"inklusive" och omvända processer som
  fotosyntes/cellandning, samtidigt som de tre observerade parafraserna fångas.
  Matematiska frågor behåller sin uttrycks-/färdighetslogik.
- [x] Tidigare godkända facit skickas separat till granskaren i
  `comparison_answer_targets`, inte till frågegeneratorns prompt. ID-koppling,
  max 20 poster, 400 tecken per facit och total granskningsstorlek valideras;
  felkopplade poster stoppar före leverantörsanrop.
- [x] Oberoende granskningsprompt instruerar att upptäcka onaturligt/översatt
  språk och tautologiska frågor. Rättningsprompten betonar semantisk innebörd
  och synonymer utan att släppa explicita rubric-kriterier.
- [x] P.E.R behandlar nu en kvarlämnad `page="prov"`-etikett som inaktuell
  provkontext när servern inte har ett aktivt prov. Innan vanlig studiehjälp
  skickas rensas gammalt material, kurs, historik, fel och förtydliganden;
  en ny regression verifierar att elevens aktuella allmänna fråga ändå går
  vidare till vanlig hjälp.
- [x] Riktade offline-sviter passerade: `assessment.test.mjs`,
  `grading-output-contract.test.mjs`, `verifier-output-contract.test.mjs`,
  `exam-generation-pipeline.test.mjs` (inklusive 3/6/12) och
  `exam-pipeline-offline.test.mjs`. `node --check` för ändrade API-filer samt
  `git diff --check` passerade. Efter den senaste dedupe-regeln passerade
  `node --test tests/assessment/assessment.test.mjs`. Den kombinerade
  bedömnings-/P.E.R-sviten passerade tidigare 59/59; P.E.R-filen har inte
  ändrats sedan dess.
- [x] Oberoende granskare hittade successivt flera falska dublettfall.
  Senaste omgranskningen fann ingen kvarvarande konkret blockerare: svarslikhet
  måste också matcha uppgiftstyp, koncepttagg och exakt ämnessignatur, utan
  sammansatta eller villkorade extrauppgifter.
- [!] Inga nya staging-anrop kördes; AI-promptens beteende och rättning är inte
  liveverifierade. Ändringarna kom senare med i `c9e04aa` och en READY Preview;
  produktens livekvalitet är fortfarande oprövad.

**PILOT NOT READY.** Kodgranskningen är klar och ändringen ligger på feature-
Previewn, men AI-beteendet har inte verifierats live. Håll fast vid enfliksregeln
och använd inte fler betalda liveprov utan bekräftad återstående budget.

## En Preview-session och ett helt slutfört stagingprov — 2026-10-24 21:50 UTC

- [x] Behöll samma Preview-alias och flik genom commit `f2e52f4`, READY-
  deployment `dpl_BxAnsgsXWHC7Ekjm5GWXZUDhDyjW` och inloggning. Ingen ny flik
  eller nytt konto behövdes. En kort auth-gate vid sidstart försvann efter den
  befintliga sessionens initiering.
- [x] Testflödesregel: återanvänd den befintliga stabila branch-aliasen i samma
  flik; öppna inte deployment-specifika Preview-URL:er för samma kod. Om
  sessionen upphör, stanna och återuppta först efter en enda ny inloggning i
  samma flik. Starta inte ett nytt modellprov förrän föregående prov är helt
  rättat/sparat eller uttryckligen bevarat utan omförsök. Denna uppföljning
  inspekterade befintlig flik 20 och skapade inga flikar, prov eller AI-anrop.
- [x] Uppdaterade P.E.R:s skyddade frågedetektering för vanliga formuleringar
  som ber om bekräftelse på ett svar. Vanliga studiefrågor fungerar fortsatt;
  verifierade provgränser ändras inte.
- [x] Felbankens senaste misstag begränsas på serversidan till den aktiva kursen;
  om kurs saknas skickas ingen kursbunden felhistorik till modellen.
- [x] Lade till databaskontroller för att `progress_current` och antalet
  accepterade frågor aldrig ska överstiga elevens begärda antal. Reapern skyddar
  också en levande parent-lease innan pipelinejobbraden skapats.
- [x] Färsk, skrivskyddad staging-preflight på `yhcinqejsocpmmetazpz` fann
  0 jobb med progress över begärt antal och 0 med för många accepterade frågor.
- [x] Riktad offline-svit för pipeline, HTTP, PGlite, källtäckning, felträning,
  P.E.R och klientkontext passerade **147/147**. Separat PGlite-svit passerade
  **28/28**; syntax- och diffkontroller passerade.
- [x] Ett enda syntetiskt Biologi 1-prov med 12 begärda kortsvarsfrågor
  genererades, besvarades och rättades i samma session. Appen utfärdade 12/12;
  sparat resultat blev 10/12 (83%). Inget omförsök eller andra prov skapades.
- [!] Stagingkörningen visade ett kvalitetsfel trots 12/12: tre nära-dubblettpar
  om mitokondrier, cellmembran och enzymers funktion samt en klumpigt formulerad
  cellfråga. De flesta frågorna var källgrundade, men detta räcker inte som
  kvalitetsbevis för pilot. Rättningen gav även delpoäng/0 poäng på två svar som
  i huvudsak uttryckte det förväntade begreppet.
- [x] Stagingbudget efter testet: cap `$3.379071`, spent `$1.850432`, reserved
  `$0.263628`, available `$1.265011`; rad uppdaterad `2026-10-24 21:49 UTC`.
  Förändringen under den enda genereringen och rättningen var cirka `$0.112`.
- [!] Den nya constraint-/reaper-migrationen `20261024212500` är committad men
  inte applicerad i staging. Ingen produktionsdatabas, `main` eller Production
  ändrades.
- [x] Oberoende granskning av slutlig diff fann inga blockerare. Granskaren
  bekräftade att legacy-rad-testet stoppar vid brott mot båda gränserna utan
  partiella constraints. PGlite bevisar inte hosted PostgreSQL-racebeteende.

**PILOT NOT READY.** Nästa steg är att lägga till offline-regressioner som
avslöjar dessa semantiska dubbletter och för snäv rättningsbedömning, förbättra
urval/rättning utan att sänka kvalitetsgrindarna och låta oberoende granskare
kontrollera diffen. Gör inte ett nytt betalt liveprov förrän den ändringen är
redo och budgeten lästs om. Ingen production/main-ändring.

## Aktiva provledtrådar: jämförelse och orsak–verkan — 2026-10-25

- [x] `api/explain.js` ger verifierade, aktiva kortsvarsfrågor tydligare
  stegvisa stöd när frågan uttryckligen ber om jämförelse eller orsak–verkan.
  Frågorna ska matcha endast en struktur; blandade/otydliga formuleringar går
  vidare till den generella ledtråden.
- [x] De nya texterna ber eleven själv hitta källbelägg och bygga resonemanget.
  De innehåller varken modellfacit eller inskickade svar. De nya trapporna
  påverkas inte av klientens osignerade `answered`-flagga; aktiv provhjälp är
  fortsatt deterministisk och gör inga modell- eller kvotanrop.
- [x] Riktade tester täcker tre hjälpnivåer för båda strukturerna, säkerhet mot
  facittext, blandad struktur, osignerat svarstillstånd och generisk fallback
  när frågeproof saknas.
- [x] Full `tests/api/per-exam-review-handler.test.mjs`: **67/67**. Samlad
  P.E.R stream-/sid-/kontokontext-, manifest-, landningssida- och
  förbättringssidetestkörning passerade. JS-syntax och `git diff --check`
  passerade. Oberoende säkerhetsgranskning fann inga blockerare.
- [x] Färsk skrivskyddad stagingkontroll för testkontot fann cap `$3.379071`,
  spenderat `$2.090394`, reserverat `$0.263628` och **$1.025049 kvar**;
  inget aktivt orättat prov hittades för kontot. Inga stagingdata ändrades.
- [x] Commit `450bc449d3599ccc16b51532c0d818cd35ae08cd` är pushad enbart till
  `codex/exgen-generation-quality-2026-10-20`. Vercel deployment
  `dpl_8PacEuccFYE3uLZsVEgojg53i9ga` blev `READY` från exakt denna SHA och
  Preview-aliasen är den befintliga branch-aliasen
  `provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app`.
  Branch-scopade Previewvariabler verifierades via Vercel CLI utan att
  dekryptera värden.
- [!] Liveprovet kördes inte. I samma befintliga flik visade kontosidan
  `exgenswedenab@gmail.com` och Premium, men appens `/app.html` visade
  inloggningsgrinden när den öppnades från kontosidan och även vid återgång.
  Ingen modellförfrågan eller budgetreservation gjordes. Stagingens senaste
  lästa budget förblev `$1.025049` tillgänglig och kontot hade 0 aktiva
  orättade prov vid förkontrollen.
- [x] Den tidigare resultatvyn låg kvar som färdig, ej aktiv provpost enligt
  den skrivskyddade förkontrollen. Ingen provrad avbröts, rättades eller
  raderades. Ingen ytterligare flik eller staginginloggning skapades.

## Uppföljning utan extra liveförbrukning — 2026-10-24 21:04 UTC

- [x] Behöll en och samma befintliga Preview-flik. Inga nya flikar, provstarter,
  stagingkonton eller modellförfrågningar skapades i denna fortsättning.
- [x] Regressionstest reproducerade ett återupptaget felträningsprov där ett
  gammalt, obestyrkt fokus-anspråk kunde ta sista platsen utan att täcka rätt
  källunderlag. Pipeline täcker nu bara tidigare fokus som stöds av frågans
  källa. Regressionen och angränsande 3/6/12-tester passerar.
- [x] När fler godkända kandidater än platser finns rankas nya lärandemål före
  redan representerade mål. Detta är urval, inte en ny avvisningsregel: inga
  frågor underkänns av breddheuristiken och godkänd övning kan fylla provet när
  bättre källstödda alternativ saknas.
- [x] Oberoende granskning fann inga blockerande fynd eller försvagade grindar.
  Granskaren noterar att lärandemålsbredd rangordnas före materialsektionernas
  täckning när kandidater konkurrerar om platser.
- [x] Offline-sviten för pipeline, HTTP, Postgres-emulering, källtäckning och
  felträning passerade **77/77**. Inga OpenAI-anrop gjordes. Tidigare riktade
  P.E.R.-regressioner passerade **4/4**.
- [!] Ändringarna i denna fortsättning är lokala och ocommittade; de har inte
  byggts i en ny Preview eller liveverifierats. Det redan synliga påbörjade
  provet och dess session lämnades orörda.

**PILOT NOT READY.** Nästa säkra verifikation är en enda stagingkörning på
Previewn efter att ett befintligt konto utan aktivt prov valts och den aktuella
stagingbudgeten bekräftats. Håll samma Preview-flik; skapa inte prov i flera
flikar eller starta om en pågående körning.

## Senaste session- och kvotkontroll — 2026-10-24 20:50 UTC

- [x] Aktuell kodrevision är `6582f96ad34c7f233f738c5bf483411deca97ec0` på
  `codex/exgen-school-pilot-integration-20261024`; fjärrens godkända
  feature-branch pekar på samma commit. Matchande Vercel Preview är `READY`.
- [x] Den befintliga branch-aliasen i sidbrowsern visar den autentiserade
  ExGen-appen. UI:t erbjuder att fortsätta ett tidigare påbörjat prov. Ingen
  knapp trycktes; provet identifierades inte närmare och lämnades orört.
- [x] Ingen ny flik, provstart eller modellförfrågan gjordes. Samma Preview-flik
  behölls för fortsatt arbete.
- [x] Read-only aggregerad stagingbudget kontrollerades kl. 20:50 UTC:
  cap `$3.379071`, spenderat `$1.737989`, reserverat `$0.263628`, aktiverad;
  tillgängligt `$1.377454`. Radens senaste uppdatering är 20:22 UTC. Detta är
  appens stagingbudget, inte en OpenAI-faktura.
- [x] `node --test tests/api/exam-generation-pipeline-postgres.test.mjs`
  passerade **25/25**. Den kombinerade offlinekörningen av pipeline-, HTTP- och
  PGlite-tester avslutades med exit code 0 och innehöll 3/6/12-, retry-,
  assembly- och kvotreaperfallen.
- [x] Två oberoende skrivskyddade reviewers fann ingen blockerande race för
  redan skapade aktiva jobb och ingen blockerare i idempotens/provstatus.
  Reaper skyddar aktiva jobb; completion låser jobbet och committar kvot och
  utfärdande transaktionellt. PGlite-testerna är dock sekventiella och bevisar
  inte konkurrens mellan verkliga PostgreSQL-sessioner.
- [!] En separat, smal testlucka finns före pipeline-jobbskapandet: reaper
  kontrollerar aktiva pipelinejobb, inte en ännu ej skapad jobbrad. En paus över
  två minuter kan i teorin återbetala reservationen. I den konfigurerade vägen
  är API:ets `maxDuration` 60 s, parent-leasen 90 s och reapertröskeln 2 min;
  scenariot ligger alltså utanför normal exekvering och har inte reproducerats.
  Ingen kodändring gjordes för hypotesen.
- [!] Historisk kontroll kl. 20:50 visade `20261024140557` och
  `20261024151433`, men saknade senare migrationer. Migrationsgapet är nu
  åtgärdat på staging efter preflight; se aktuell sammanfattning ovan. Ingen
  Production-schemaändring gjordes.
- [x] Fem riktade P.E.R.- och felträningsfiler avslutades lokalt med exit code 0.
  Alla körningar var offline och gjorde inga modellförfrågningar.

**PILOT NOT READY.** Detta är en historisk checkpoint från kl. 20:50. Det
synliga påbörjade provet lämnades orört; staging-schema uppdaterades senare
enbart enligt aktuell sammanfattning ovan. `main`, Production, konton, roller
och kvoter har inte ändrats.

# Fortsatt skolpilotfix — fokusord, källbredd och felträning — 2026-10-24

- [x] Färsk Vercel-runtime-logg för den versionssynkade Previewn bekräftar att
  det syntetiska Matematik 2b-provet begärde 12 men slutade på 0/12. Kandidater
  genererades och nådde verifierare/lösare, men godkändes inte: loggade orsaker
  omfattade `source_support`, `option_quality_failed`, `difficulty_mismatch`,
  `low_source_alignment` och solver-avvikelser. UI:t lämnade inte ut något prov.
- [x] Kodgranskning fann ett separat, bekräftat källbreddsfel: när vanliga
  materialprov skickade elevens valda `focusTerms` stängde pipelinen av
  rubrikbaserad källstyrning (`sourceSectionCount=0`). Rubriker analyseras nu
  även med fokusord; fokusorden skickas vidare oförändrade. Det förklarar inte
  ensamt modellens verifieringsunderkännanden och är inte beskrivet som deras
  bevisade grundorsak.
- [x] Generell källavsnittsstyrning stängs av när jobbet har obligatoriska
  `trainingFocus`. Felträning instrueras då inte samtidigt att prioritera ett
  allmänt materialavsnitt; serverns krav på matchning av verifierade misstag
  och verifieringsstatus är oförändrade. En regression bevisar att en
  irrelevant, i övrigt verifierad kandidat avvisas och att ouppfyllda
  felmoment håller jobbet i `repair`.
- [x] Oberoende skrivskyddad granskning fann inga blockerande problem i ändringen
  eller försvagade kvalitetsgrindar. Granskaren noterade att regressionerna
  mockar verifierade kandidater och inte bevisar den riktiga modellpromptens
  kvalitet.
- [x] Offline-verifiering på slutlig kod: generering/pipeline/kvot/återhämtning
  **80/80**, P.E.R. **56/56**, felträning/källkontext/stream/frontend **44/44**.
  Syntaxkontroll och `git diff --check` passerade.
- [!] Senast verifierade stagingbudget, read-only (databasrad uppdaterad
  `2026-10-24 20:22 UTC`): hårt cap `$3.379071`, spenderat `$1.737989`,
  reserverat `$0.263628`, tillgängligt `$1.377454`.
  Detta är bokföring i staging, inte en OpenAI-faktura. Inget nytt AI-anrop
  gjordes efter budgetläsningen.
- [x] Ändringen committades som `a5732275169f12bd414aea9285e23d86fa26a4d8`
  och pushades till `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_2TSwT2GTCE6zQHEtt562AAYrMaqu` blev `READY` på exakt denna commit; dess
  branch-alias öppnades i sidbrowsern och visade den inloggade appen.
- [!] Ingen ny modellkörning gjordes efter ändringen. Den tidigare
  godkända 12-frågekörningen slutade 0/12 före fixen. Användaren har nu godkänt
  ett nytt syntetiskt test inom taket. Den tidigare 9/12-körningen bevaras och
  lämnas orörd. En redan öppen flik med en deployment-specifik Preview-URL
  återanvändes. Vercel verifierade att den stabila branch-aliasen pekar på
  `a573227`; fliken navigerades inte till den aliasen. Efter omladdning på den
  specifika URL:en visades inloggningsgrinden igen. Inga nya flikar eller prov
  skapades. Nästa Preview ska öppnas via branch-aliasen i samma flik.
  `main`, Production, produktionsdatabasen, konton, roller, kvoter och hemligheter
  har inte ändrats.

**PILOT NOT READY.** Den senaste livekörningen visar att appen säkert stoppar
ett 0/12-resultat, men inte att den kan leverera 12 kvalitetsgodkända frågor.
Efter färdig offline-granskning och slutlig Preview behövs en enda staginginloggning
på samma alias, verifiering att kontot saknar aktivt prov samt färsk kontroll av
budget och staging-schema före det enda godkända syntetiska testflödet. Det äldre
9/12-provet ska bevaras.

## Felträning knuten till källan — lokal uppföljning, 2026-10-24

- [x] Verifierad källkontext från ett rättat prov knyts nu per fokus-ID till högst
  tre serverhärledda, ordagranna källutdrag (högst 500 tecken vardera). En
  kandidats påstådda fokusmatch godtas i pipelinen endast när dess redan
  validerade `source_references` stöder samma utdrag. Obestyrkta fokus-ID:n
  sparas inte och räknas inte som täckta. Äldre köjobb utan fältet behåller
  kompatibilitet; nytt fokus med uttryckligen tom evidens failar stängt.
- [x] Tomma eller blankstegssvar avvisas som felträning även när ett gammalt
  betygsresultat saknar `unanswered: true`.
- [x] Oberoende källgranskare hittade och verifierade de två ovanstående
  riskerna. Efterföljande granskning fann inga blockerare. Riktade offlineprov
  passerade för två olika källor i samma kurs, felaktiga/överdrivna fokus-ID:n,
  äldre källfält, tom evidens samt 3/6/12-frågepipelinen.
- [x] Oberoende säkerhetsgranskning fann ingen blockerare eller försvagad
  ägar-, auth-, kvot- eller kvalitetsgrind. En icke-blockerande lucka kvarstår:
  inget separat PGlite-test laddar om ett checkpointat jobb med en obestyrkt
  lagrad fokusmatch; återkontrollen i koden och vanliga persistensprov finns.
- [x] Relevanta API-/pipeline-/verifierar-/Postgres-emuleringstester passerade;
  syntaxkontroll och diffkontroll passerade. P.E.R.-regressionerna för vanlig
  hjälp, aktivt prov och rättat resultat passerade 3/3. Inga modeller anropades.
- [x] Ändringarna är committade som `6582f96ad34c7f233f738c5bf483411deca97ec0`
  och pushade till `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_H6TXc96SnQZNqKEoQrwZeFbHkQ3b` blev `READY` på exakt den committen.
  Branch-aliasen öppnades i samma befintliga flik; ingen ny flik eller prov
  skapades.
- [!] Ingen ny stagingmodellkörning har verifierat den slutliga ändringen.
  Previewn visar inloggningsgrinden. Senast tidigare budgetläsning visade
  `$1.377454` tillgängligt under Preview-cap, men den är inte färsk och får inte
  användas som anropsgodkännande utan ny läsning.

**PILOT NOT READY.** Källbindning och tomsvarsfelet är åtgärdade, offline-
testade och deployade till en READY staging-Preview. Nästa steg är en enda
inloggning på branch-aliasen i samma flik, följt av kontroll att kontot saknar
aktivt prov och färsk budget-/schema-verifiering före det enda godkända
syntetiska flödet. Ingen Production-, `main`-, kontovals- eller kvotåtgärd har
gjorts.

## Ny stagingkörning och förbättringar för provbredd — 2026-10-24

- [x] Den inloggade staging-Previewn på commit `3006e1e5c2e4c12ccea02843c87f4cabaa5375f9` tog emot ett syntetiskt Matematik 2b-prov: nivå C, blandat, 12 begärda. Jobbet avslutades korrekt som **9/12**; UI:t visade endast de nio godkända och sade uttryckligen att tre saknades. Inga svar skickades in.
- [x] Genomgång av de nio visade frågorna fann upprepade rot-/nollställeuppgifter för samma andragradsfunktion och snävare än avsett färdighetsbredd. Detta är direkt observerat i Previewn; vi har inte korrelerad batchtelemetri för att hävda att just dubblettgrinden orsakade de tre saknade platserna.
- [x] Oberoende kodgranskning fann att `quadraticZeroSignature` inte extraherade `p(x)=…`, trots att den stödde `f(x)`/`y=`, och att dubblettklassning tappade riktningen i `> 0`/`< 0`. Slutgranskningen fann också att strikta `>`/`<`-intervall kunde slås ihop med inklusiva `>=`/`<=`; fix och regressioner lades till, och eftergranskningen fann inga blockerande eller allvarliga kvarstående fynd. Ändringarna lägger till notationstöd och täckning för parafraser, motsatta intervall, strikta/inklusiva gränser och annan färdighet på samma polynom.
- [x] Oberoende kodgranskning fann att promptens 9/2/1-mattebalans räknades per delbatch, fast den är tänkt för hela provet. Lokal ändring för vidarebefordran av hela provets begärda antal gör instruktionen konsekvent: målen gäller hela provet och godkända frågor är täckningskontext, inte bara ordalydelse att undvika.
- [x] Oberoende recovery-review fann att 9/12-statusen behölls i det aktiva provet men saknades efter rättning i sparad provpost/resultatvy. Lokala ändringar visar underskottet även efter rättning och sparar begärt antal plus `partial_delivery`; kontohistorik återställer dessa värden. Grade-requesten använder oförändrat signerade frågor och manifest.
- [x] Riktad API-/pipeline-/recovery-svit passerade **35/35**. Browserkontroller för 2/3, 4/6 och 8/12 passerade; nytt browsertest för 1/3 kontrollerade resultatskärmen, lagrad metadata och att begärt antal/delprov återställs från kontohistorik efter omladdning. `node --check` för ändrade JavaScript-filer och `git diff --check` passerade.
- [x] Ändringarna är committade som `09dc034` och pushade endast till `codex/exgen-generation-quality-2026-10-20`. Vercel-deployment `dpl_93UjDDvnPdmBimdDjccohKGFf7Xu` blev `READY` på exakt commit `09dc034fa6cad690452b4025a11bceef44da0faa`; den återanvänder den befintliga staging-Preview-aliasen. `main` och Production har inte ändrats.
- [!] Read-only kontroll av stagingbudgeten kl. `2026-10-24 19:05 UTC`: cap `$3.379071`, spenderat `$1.616745`, reserverat `$0.263628`; kvar under det hårda taket efter reservation `$1.498698`. Ingen AI-körning gjordes efter kontrollen. Den redan aktiva syntetiska 9-frågekörningen är fortfarande osvarad; den bevaras och skrivs inte över.

**PILOT NOT READY.** Förra livekörningen bekräftade korrekt delprovsmärkning men levererade inte 12/12 och visade redundans. Förbättringarna för dubblettklassning, helprovsbalans i delbatchar och delprovsstatus efter rättning är nu granskade, testade och deployade till staging-Preview. En ny liveverifiering inom budget återstår; det öppna 9/12-provet bevaras tills eleven väljer om det ska lämnas åt sidan eller avbrytas. `main`, Production, produktionsdatabasen, hemligheter, konton och kvoter är orörda.

## Skolpilotens felträning, P.E.R. och testbudget — 2026-10-24

- [x] Åtgärdade två verifierade relevansfel. En tydligt formulerad vanlig P.E.R.-
  fråga får inte längre blockeras av exakt eller semantisk överlappning med en
  gammal `page=prov`-fråga när servern bekräftar att inget prov finns. Explicit
  facit-/uppgiftsreferens och aktivt/osäkert provläge förblir spärrade.
- [x] Felträningshistorik delar nu samma operatorbevarande normalisering mellan
  källresolver och jämförelsekontext. Regressioner bevarar skillnader som `+`/
  `-`, `∈`/`∉`, `≠`/`≡`, `∣`/`∤`, och slår ihop ekvivalenta mellanslagsvarianter.
  Ägar-, kurs-, signerad rättning-, svarsfingerprint- och felkontroller är
  oförändrade.
- [x] Stagingens AI-budgetvakt kan nu använda en branch-scopead cap som bara får
  sänka det befintliga hårda taket på 5 USD. Både reservation och avräkning
  skickar samma verifierade cap; saknad eller ogiltig cap failar stängt.
- [x] En oberoende P.E.R.-granskare verifierade att aktivt/okänt provläge och
  facitintention fortfarande stoppas före modell/kvot. En oberoende
  källgranskare verifierade att felträningsproven förblir ägar- och
  rättningsbundna. En oberoende säkerhetsgranskare bekräftade att databasens
  cap måste matcha exakt; den synkas först efter att rätt Preview är `READY`.
- [x] Riktad samlad offline-svit passerade 158/158, inklusive 3/6/12-fråge-
  pipeline, retry/timeout/idempotens/kvot, P.E.R.-läge och källgrundning. Syntax-
  och diffkontroller passerade. Dessa resultat är lokala och inte livebevis.
- [x] `EXGEN_PILOT_BUDGET_CAP_USD=3.379071` lades till endast som Preview-variabel
  för `codex/exgen-generation-quality-2026-10-20`; beloppet motsvarar då
  verifierad spend 1.379071 USD + den godkända ytterligare gränsen 2 USD. Värdet
  är inte en hemlighet. Databasraden är ännu inte uppdaterad; dess cap är fortsatt
  5 USD tills ny Preview är redo, så budgeterade anrop failar stängt under
  övergången.
- [!] Senaste read-only stagingvärden: cap 5.000000 USD, spent 1.379071 USD,
  reserved 0.263628 USD; raden uppdaterades 2026-10-23 19:43 UTC. Ett nytt AI-
  anrop har inte gjorts. Syntetiskt liveprov inväntar commit/Preview och exakt
  synkning av databas-cap. Produktion, `main`, roller och kvoter är orörda.

**PILOT NOT READY.** Lokala relevansfixar är granskade och testade; branch-
Preview, budgetcapens databassynkning och därefter avgränsad liveverifiering
återstår.

## Skolpilot-uppföljning — träningskontext och övergivna jobb, 2026-10-24

- [x] Bekräftad orsak till irrelevanta prov från tidigare misstag: `app.html`
  skickade nytt provmaterial via `setInputs()` utan träningsmetadata precis före
  `generate()`. Motorn tolkade saknade fält som att träningen skulle rensas,
  trots att föregående steg hade verifierat och lagt till kursens felområden.
  Ändringen bevarar endast kontext när fälten utelämnas; uttryckligt tomma
  värden och Nytt ämne rensar fortfarande träningsläget.
- [x] Regressionstesterna täcker nu hela kedjan från rättat prov och P.E.R till
  felbaserat träningsprov, inklusive att kurs och valda fel når den riktiga
  generatorbegäran. Alla berörda offline-tester passerade 150/150.
- [x] En separat retentionmigration kortar städgränsen för privata, utgångna
  pipelinejobb från 24 timmar till 20 minuter efter jobbets deadline. Den
  behåller radlåsning, lease-fencing, exakt kvotåterbetalning och payload-rensning.
  PGlite verifierade gränsen före/efter cutoff, återbetalning och idempotent
  upprepad städning; pipeline-/Postgres-fixturen passerade 25/25.
- [x] Oberoende säkerhets-/kvotgranskning fann ingen blockerare i migrationen.
  Begränsning: PGlite testar inte faktisk samtidighet mellan PostgreSQL-sessioner;
  låssäkerheten är granskad statiskt och kan stärkas med hosted concurrencytest.
- [x] Uppföljningsändringarna är committade som `a53ff9c` och pushade endast
  till `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_FLG7ZQBUoTxcZYUAZ6JLqPJYp96U` blev `READY` på exakt denna commit;
  den skyddade appvägen svarade 200 och runtime konfigurationen pekar på
  stagingprojektet `yhcinqejsocpmmetazpz`.
- [!] Den nya retentionmigrationen är ännu inte tillämpad i staging; separat
  bekräftelse inväntas. Ingen syntetisk live-AI-körning har gjorts. Den öppna
  stagingwebbläsarsessionen har ett aktivt prov vars ägare/ursprung inte kan
  fastställas säkert, så det har inte lämnats in, avbrutits eller ändrats.
- [!] `appOrigin` för lösenordsåterställning pekar fortfarande på en äldre
  Preview-alias. Den lämnades orörd; auth-recovery i denna Preview är därför
  inte verifierad.
- [x] Det godkända tomma Vercel-projektet `provia-ai-school-pilot-clean` gav 404
  vid kontroll av exakt projekt-ID; projektet saknas redan, så inget raderades.

**PILOT NOT READY.** Lokal regressionssvit är grön; stagingmigration, ny
Preview och säker syntetisk liveverifiering återstår. Ingen produktionsdatabas,
`main`, hemlighet, användarkonto eller kvot har ändrats.

## Integrerad skolpilot-fix — lokal verifiering, 2026-10-24

- [x] Den lokala, isolerade integrationsarbetskopian sammanför nu den befintliga
  genererings-/säkerhetskedjan med verifierad felträning från rättade konto-prov.
  Träningskälla, kurs och felval binds fortsatt till serververifierat, ägarbundet
  provresultat; kvalitets- och källgrindar har inte sänkts.
- [x] Kontobyte och utloggning rensar idempotensnyckel och tillfälligt
  återhämtningsmaterial för provgenerering. Utkast för sparade prov fortsätter
  vara separerade per användare och bevaras för säker återhämtning.
- [x] Återupptagningsstatus vid avbruten generering visas i det aktiva
  provkontraktet med `role=status`; provet öppnas inte och inget falskt
  komplettresultat visas. Browser-fixturen testar nu den verkliga
  `start → advance → status`-vägen och serverns terminala `incomplete_exam`.
- [x] Riktad offline-svit passerade 104/104. Full browserregression passerade
  188/188. `node --check` och `git diff --check` passerade.
- [!] En separat kodreview upptäckte att ett tidigare föreslaget start-svarsfel
  inte matchade produktionspipelinen; den verkningslösa klientändringen togs
  bort och testfixturen korrigerades till pipeline-kontraktet. Reviewens
  uppföljning av den slutliga testfixturen är ännu inte mottagen.
- [!] Arbetet är lokalt och ocommittat i en isolerad integrationsarbetskopia;
  ingen staging-Preview eller live-AI-generering verifierades i denna kontroll.
  En stagingrad med gammalt köat jobb utan motsvarande kvotreservation behöver
  först undersökas read-only. Ingen stagingrättning, migration eller radering
  utfördes.
- [!] Produktionen är inte redo för denna integration: tidigare review fann att
  produktionsschemat saknar `assembly_grace_used`, vilket kodvägen behöver.
  Produktionsmigrationer, `main` och Production får inte ändras utan separat
  granskning och godkännande.

**PILOT NOT READY.** Lokal verifiering är grön, men hosted staging-Preview,
upprepade modellprov över flera kurser, P.E.R.-användbarhet och kvarvarande
produktions-/pilotkrav återstår. Offline-resultat är inte livebevis.

## Tokenutgång i återupptagbar provkörning — pågående, 2026-10-23

- [x] Read-only staginglogg för körningen 23 okt kl. 19:01 UTC bekräftade
  `bad_jwt` / `token is expired` på Supabase Auth `/user` (403). Tidigare
  `/user`-kontroller och en refresh-tokenförnyelse hade lyckats. Ingen token,
  fråga eller materialtext kopierades till dokumentationen.
- [x] Grundorsaken i klientkoden var att den återupptagbara provkörningen tog
  en verifierad token vid start och återanvände den genom hela den långa
  pipeline-sessionen, även om Supabase hann rotera token. Ny klientåterhämtning
  verifierar en ny token mot samma ursprungliga användar-ID och försöker samma
  idempotenta start-/advance-/statusbegäran en gång till. Ett authfel i status
  lämnas nu som authfel, inte som falsk `generation_in_progress`.
- [x] Lokala progress-/snapshottester täcker utgången token i start, advance och
  status, nekad token för annat konto, misslyckad refresh och terminala authfel.
  Oberoende granskning fann inga blockerare i fixen och dess gränstester.
- [x] Browserregressionen passerade 193/193 efter att dess syntetiska
  refresh-session fick matcha rätt testkonto. Riktad browserkontroll passerade:
  en verifierad refresh, ett idempotent återförsök och ett tydligt terminalt
  authfel. Ingen ny provgenerering, AI-kostnad, kvot-/rolländring eller
  databasändring har gjorts.
- [x] Commit `29280c31c7608a2ac134fc32c3ea092a2a11f9e0` pushades endast till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview blev `READY` som
  deployment `dpl_8KfrCVtAHMDkcZ3cwBCVYLAibuSY`; Vercel CLI visade pilotens
  env-variabler branch-scopade till samma Preview-branch. Inga värden lästes.
- [x] Ett syntetiskt Biologi 1-prov med 1 271 tecken begärde 12 kortsvarsfrågor
  på denna Preview. Inget prov utfärdades: exakt 1/12 godkändes och pipelinen
  avslutades säkert med `STAGE_RETRY_LIMIT` efter tre begränsade reparations-
  försök. Sanerad Verceltelemetri visar att många kandidater underkändes med
  `source_answer_not_extractable`; granskning underkände även källstöd,
  svarslinje och poängkvalitet. Auth/setup anropen lyckades under försöket.
- [x] Telemetrin visar att grundprompten redan krävde ordagranna meningar, men
  reparationsprompten inte uttryckligen förbjöd inledning/förklaring runt
  `model_answer`. Lokal uppföljningsändring förstärker samma extraktiva krav i
  både grund- och reparationsprompt på svenska/engelska; inga kvalitetsgrindar
  har sänkts. Oberoende read-only review fann inga blockerare och bekräftade
  att ändringen svarar mot den dominerande observerade avvisningsorsaken.
  Syntax, prompt-, budget-, pipeline-, HTTP- och Postgres/PGlite-tester passerade
- [x] Promptfixen pushades som `91e4714bd632eb5459aa4edef61cd1fdd8ec3d6d`
  endast till feature-branchen. Preview `dpl_44avLTTqEWQqVRiWRb5EBE13EPZV`
  blev READY på exakt den SHA:n, och branch-scopade stagingvariabler verifierades
  utan att läsa deras värden.
- [x] Ett andra syntetiskt Biologi 1-prov med 799 tecken begärde 12 kortsvars-
  frågor. Samma Preview levererade och utfärdade exakt 12/12 godkända frågor;
  Supabase-jobbet slutade `succeeded`, `progress_current=12`, utan felkod.
  Telemetrin visar att sista omgången verifierade två kandidater och godkände
  båda. I tidigare omgångar förekom fortfarande avslag för källstöd, tydlighet,
  svarslinje och poängsättning. Inget provsvar skickades in.
- [!] Stagingbudgeten lästes read-only kl. 19:43 UTC: tak `$5.000000`, spenderat
  `$1.379071`, reserverat `$0.263628`, kvar `$3.357301`. Jämfört med före det
  andra syntetiska försöket ökade spend med `$0.120592`, inom den godkända
  ytterligare gränsen på `$2`. Annan sparad provsession lämnades orörd.
- [!] Äldre syntetiskt prov från 23 okt kl. 16:12 UTC var redan markerat
  avbrutet vid read-only-kontroll; ingen separat resultatpost fanns för det.

**PILOT NOT READY.** Ett syntetiskt 12-frågeprov passerade live efter promptfixen,
men upprepade körningar över flera kurser, användbarhet/P.E.R. och övriga
skolpilotkrav återstår. Ingen produktion eller `main` har ändrats.

## Källstöd i 12-frågeprov — pågående feature-arbete, 2026-10-23

## Senaste stagingprov — `16d4f14`, 2026-10-23

- [x] Commit `16d4f14951d3e2bfcd19fcc0debb7fa473b1e0c6` är pushad endast till
  `codex/exgen-generation-quality-2026-10-20` och Preview `dpl_39qpVp7vWwtXn27T3yP2ZVZDpMiE`
  blev READY. Vercel visade separata, krypterade Preview-variabler på just den
  branchen; Production och `main` ändrades inte.
- [!] Ett syntetiskt Biologi 1-prov begärde 12 kortsvarsfrågor. UI och privat
  jobbmetadata nådde 8/12 godkända frågor efter upprepade generationer,
  oberoende granskning och reparation. Inget komplett prov utfärdades.
  Därefter visade UI:t att provtjänsten inte kunde verifiera inloggningen.
  Innehållsfri jobbmetadata låg kvar som `queued`, `repair`, 8/12 med
  `NO_NEW_APPROVED_QUESTIONS`; orsaken till autentiseringsfelet är inte
  fastställd. Ingen ny generering kördes efter felet.
- [x] Kostnadsgränsen höll: senaste stagingläsningen visade 1,213161 USD
  spenderat och 0,263628 USD reserverat av 5 USD, alltså 3,523211 USD kvar.
  Telemetrin innehöll genererings-, reparations- och verifieringsrader utan
  text från underlag eller frågor.
- [!] Detta är inte bevis på att 12-frågeproblemet är löst. Källnära grinden
  finns i Preview, men tjänstens auth/recovery-väg behöver återställas för att
  slutföra och verifiera återupptagning. Separat kvarstår den tidigare
  blockeraren att rubrik/poängdelar/alternativa svar inte deterministiskt
  binds till samma källfacit.

- [x] Ny lokal säkerhetsgrind för naturvetenskapliga kortsvar kräver att hela
  facitsvaret är en ordagrann, sammanhängande del av elevens material. Matchningen
  bevarar versalisering och jämförelsesymboler och kräver ord-/talgränser, så
  `CO`/`Co`, `7`/`70` eller `7`/`7,5` inte blandas ihop. En källhänvisning kan
  inte längre bära ett facit med extra påståenden.
  Matematikbehållare för härledda svar är undantagna; grafuppgifter har sin
  befintliga deterministiska väg. Initiala kandidater, reparationer och slutlig
  sammansättning använder grinden.
- [!] Den deterministiska kontrollen gäller just `model_answer`. Rubric,
  poängdelar och accepterade svar granskas fortsatt av verifierarmodellen,
  som tidigare missat obestyrkta krav. Därför är källtrohet i hela
  bedömningskontraktet fortfarande ett pilotstopp.

- [x] Feature-Preview för `b676c8f` skapade ett nytt syntetiskt Biologi 1-prov
  med 12/12 godkända frågor från tre källavsnitt. Det färdiga provet lämnades
  in med tolv tomsvar för att visa alla fullpoängssvar; ett serververifierat
  resultat på 0/24 visades. Inga riktiga elevsvar användes.
- [!] Även detta prov har blockerande kvalitetsfynd: fråga 6 och 8 prövar
  nästan samma sak om koldioxid i fotosyntesen, liksom fråga 10 och 11 om
  glukos/stärkelse. Facit till bland annat fråga 1, 3, 8 och 12 innehåller
  påståenden eller preciseringar som saknas i det syntetiska underlaget.
  Källcitatet täcker alltså inte alltid hela svaret trots den nya
  fältnivågranskningen. 12/12 är framsteg för leveransantalet, inte bevis
  för pedagogisk pilotkvalitet.
- [x] I feature-Preview efter första livefyndet: generatorn instrueras att hålla varje
  poängkrav och facitpåstående inom materialet; granskaren instrueras att
  kontrollera facit sats för sats och rapportera explicit `duplicate_of`
  för frågor med samma lärandemål och svarsmål. Servern stoppar rapporterade
  dubbletter. Offline-kontraktstester passerar, men nästa liveprov visade
  att detta inte räckte för semantisk källtrohet eller variation.
- [x] En separat telemetrijustering ger batchade AI-kostnadsrader samma
  kolumner. Rader har nu sparats i staging utan det tidigare `PGRST102`-felet
  under ett syntetiskt 12-frågeprov. Den hårda stagingbudgeten är separat
  och kvar; ett test utesluter inte alla andra telemetrifel.
- [x] Nästa Preview (`eb37536`, `dpl_8bdXicRTAGAemtcaSkQZTk6wCcyi`)
  levererade åter 12/12 från samma syntetiska underlag. Tom inlämning gav ett
  serververifierat 0/24-resultat och visade alla facit. Alla tre källavsnitt
  refererades. Stagingens `ai_usage_events` fick rader för generering,
  reparation och granskning; det tidigare bulkfelet syntes inte i denna
  körning. Budgeten efter testet var 1,172112 USD spenderat av 5 USD.
- [!] Den nya revisionen löste inte semantisk källtrohet: första frågan hade
  ett språkfel, flera frågor prövade samma samband, och facit lade till
  detaljer om DNA-helix, elektroner/väte och ett ekosystemkretslopp som inte
  fanns i det syntetiska materialet. `duplicate_of` och den strängare
  instruktionen fångade inte dessa live. Detta är ett fortsatt pilotstopp.
  Nästa åtgärd bör pröva en källnära facitkontrakt för faktabaserade
  kortsvar, med separat undantag för beräkning/graf och test av hur många
  godkända frågor som återstår. Sänk inte kvalitetsgrinden för att nå 12.

- [x] Preview på `5dc2470` skapade ett syntetiskt Biologi 1-prov med 12/12
  frågor från ett tredelat material. Sanerad pipeline-status rapporterade att
  alla tre avsnitt refererades; frågorna omfattade fotosyntes, cellandning och
  genetik. Alla tolv frågor och facit lästes i appen efter ett serververifierat
  resultat. Ett tidigare 12-frågeprov rättades också live till 22/23 poäng och
  resultatet återhämtades utan nytt modellanrop. Det äldre syntetiska prov som
  blockerade resultatvisning avbröts separat efter uttryckligt godkännande.
- [!] Kvalitetsgranskningen hittade ett nytt blockerande fynd trots 12/12:
  genetikfrågorna om dominant/recessiv nedärvning och DNA:s struktur, samt
  delar av facit och poängkraven, gick längre än det syntetiska underlaget.
  Att ett källcitat finns och granskaren ger hög `source_alignment` bevisar
  inte att hela frågan och exempelsvaret stöds. Detta prov är inte pilotbevis.
- [x] Lokalt kräver den oberoende granskaren nu strukturerade verdict för
  frågans krav, hela exempelsvaret, rubriken, varje poängdel och varje
  accepterat alternativ. Varje del måste peka på sina egna källutdrag och
  servern kontrollerar att utdragen finns i materialet. Frågan stoppas om
  en del saknar stöd, pekar på ett ogiltigt utdrag eller saknar verdict.
  Endast en fast `source_support`-kod når reparationsfeedbacken; råa citat
  förs inte vidare dit. Befintliga poäng- och kvalitetsgrindar består.
- [!] Både fältnivågranskningen och de efterföljande prompt-/dubblettkraven
  har liveprövats men är otillräckliga: modellen missar fortfarande vissa
  obestyrkta tillägg. `main` och Production lämnas orörda.

**PILOT NOT READY.** Källstödet i frågorna och facit är fortsatt en blockerare
tills den skärpta granskningen prövats live och de kvarvarande pilotgrindarna
är uppfyllda.

## Skolpilotens prov- och P.E.R.-grind — feature-Preview, 2026-10-23

- [x] Målkoden committades som `cefde2e` och pushades endast till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_Ghhv5etnRPAenHLFi6TxuBYWtK6S` blev `READY` för exakt den
  revisionen. Rättningsfixen `432024d` blev också `READY` i Preview
  `dpl_FBuiESjdpnrXt6zDT3Vh8xNeV1Tx`. `main`, produktion, konton och
  hemligheter ändrades inte.
- [x] Ett nytt syntetiskt Biologi 1-prov med 12 begärda kortsvarsfrågor gav
  12/12 i denna Preview. P.E.R. nekade facit under aktivt prov och gav en
  svarsfri ledtråd. Frågorna saknade dock helt genetik trots ett tredelat
  underlag och hade flera snarlika uppgifter. Det är ett kvalitetsfynd, inte
  pilotbevis.
- [!] Rättning av de 12 syntetiska svaren gav HTTP 502 och sparade inget
  verifierat resultat. Sanerad Vercel-logg visar att tredje fyragruppen gav
  fem rader i stället för fyra (`contract_row_count`). Svaren fanns kvar i
  klienten. En efterföljande Preview (`9ed797d`,
  `dpl_CdbhYnqh5i2EGgP1N2MhQQgRv4Eh`) återupptog samma 12 svar men
  rättningen fick åter HTTP 502: första fyragruppen gav två rader och den
  begränsade återhämtningen räckte inte inom tidsbudgeten. Ingen delrättning
  sparades. Ytterligare lokal ändring delar därför upp upp till 12 öppna svar
  i grupper om två från början. Den blev `READY` i Preview `6e20e37`
  (`dpl_CmZNBB2M4Z5noswavmLdAXHLxmQa`) men samma svar fick HTTP 502:
  fjärde tvågruppen nådde en `transport_error` vid den dåvarande
  30-sekunders modellbudgeten. En testad men säkerhetsmässigt otillräcklig
  idé om kortare lagringsreserv skickades inte. Den nu lokala lösningen ger
  varje fyragrupp ett strikt JSON-objekt med exakt fyra obligatoriska slotar,
  återställer 30 sekunders lagringsreserv och validerar fortfarande varje
  modellsvar mot sin signerade fråga. Denna fix rättade de 12 syntetiska
  svaren live, sparade 22/23 poäng serververifierat och spelade upp samma
  resultat utan ny modellkostnad. Ett äldre, oavslutat syntetiskt stagingprov
  blockerade först facit enligt provskyddet. Efter separat godkännande
  avbröts endast det äldre provet med `abandon_exam_issuance`-funktionen;
  det nya, verifierade resultatet visades sedan i appen.

- [x] En staging-Preview med tidigare kod skapade ett syntetiskt 3/3-prov.
  P.E.R. gav en svarsfri ledtråd under provet och kunde förklara efter
  verifierad rättning. Ett separat syntetiskt 12/12-prov skapades, men frågorna
  koncentrerades till fotosyntes trots material med fyra avsnitt. Rättningen
  av det provet fick `grading_response_invalid` och sparade inget verifierat
  resultat. Detta är stagingfynd, inte bevis för den nuvarande lokala diffen.
- [x] Lokalt styr den återupptagbara generatorn nya batcher mot mindre
  refererade, tydligt rubriksatta källavsnitt. När fler redan verifierade
  kandidater än platser finns prioriteras dem som tillför nya avsnitt.
  Strukturell kontroll, källstöd, oberoende granskare, lösare och
  dubblettkontroll är kvar. Avsnittsprioritering är inte en ny avslagsgrind;
  tunna avsnitt och frågor som jämför avsnitt får inte ensamma stoppa 12
  godkända frågor. Telemetrin beskriver refererade avsnitt, inte semantiskt
  garanterad täckning.
- [!] Liveprovet med 12/12 skapades innan korrigeringen av fokusvalet.
  Gränssnittet valde då automatiskt alla extraherade ord, vilket stängde av
  avsnittsstyrningen i pipelinen. En lokal ändring lämnar nu fokusorden
  avvalda från början; eleven kan fortfarande välja dem aktivt. Det stora
  gränssnittstestet passerade 193/193 kontroller, inklusive standardval och
  aktivt fokusval. API-testerna för avsnittsstyrning med uttryckligen tomt
  fokusval passerade. En ny 12-frågegenerering i Preview måste visa om
  detta förbättrar bredden.
- [x] Lokalt rättas öppna svar i grupper om högst fyra, med högst tre samtidiga
  modellförfrågningar. Varje grupp måste matcha sina signerade frågor och alla
  grupper måste passera innan ett enda resultat sparas. Tester täcker 12 och
  20 svar, saknad mittgrupp, HTTP-fel, kostnadshändelser, tidsbudget och
  frisläppt rättningsanspråk. Den äldre stagingens 12-svarsfel är ännu inte
  omtestat med denna ändring.
- [x] Riktad prov-/rättningssvit: 39/39 tester passerade. P.E.R.-svit: 55/55
  passerade. En seriell körning av samtliga 200 upptäckta lokala testfiler
  utanför `tests/live/` avslutades med exitkod 0 efter att två föråldrade
  testförväntningar uppdaterats. `git diff --check` och syntaxkontroller
  passerade. Oberoende granskare fann inga kvarstående blockerande fynd i
  den ändrade avsnittsprioriteringen och rättningsflödet.
- [!] Arbetskopian är detached och innehåller en orelaterad lokal
  `förbättring.html`-ändring som inte följer med målets commits. Ny Preview
  och livekontroll av innehållsbredd samt P.E.R. efter rättning återstår.
  Inga produktionsåtgärder ingår.

**PILOT NOT READY.** 12 frågor och rättning fungerar nu i ett stagingfall,
men avsnittsbredd, duplicering och reproducerbarhet måste verifieras innan skolpilot.

## UI-skydd för ofullständiga prov — 2026-10-23

- [x] Appen avgör nu delprov genom att jämföra faktiskt antal returnerade
  frågor med klientens begärda antal. `meta.partial` kan inte längre få ett
  kortare prov att visas som komplett om flaggan är falsk eller saknas.
- [x] Browserregression väljer 3, 6 och 12 frågor i wizardens UI, verifierar
  att valt antal skickas till API:t och provar 2/3 med motsägande metadata,
  4/6 utan metadata samt 8/12 med delprovsmetadata. Visad instruktion anger
  godkänt antal och endast returnerade frågor renderas.
- [x] Riktat browsertest passerade 1/1. Hela seriella offline-sviten över 193
  testfiler passerade efter UI-fixen. Den oberoende granskningen fann inga
  blockerare; staging/livebeteende är inte verifierat av dessa tester.
- [x] Den avgränsade ändringen är committad som `1804cf2` och pushad till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_23iEGHpAgqZ23W5qAXbJCDw16Vzj` är `READY` för exakt commit
  `1804cf2ce44544ba40d110cb46df98292cc3f9ec`; feature-aliasen är
  `provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app`.
- [!] Ingen migration, betald AI-förfrågan eller merge till `main` utfördes.
  PR #123 är fortsatt draft. Produktionsschema saknar dokumenterat pipeline-
  och P.E.R-kvotschema, därför är merge till `main` fortfarande osäker.

## Releasegrind efter Preview-push — 2026-10-23

- [x] Den semantiska jämförelsegrinden känner nu igen enkla, omkastade
  tvåledade frågor av typen "Jämför X och Y" / "Compare X and Y". Svenska och
  engelska dubblettregressioner passerar; frågor med ytterligare kontextled
  förblir separata. Oberoende read-only review fann inga fynd i denna snäva
  normalisering.
- [x] Commit `0d5394b` innehåller den granskade kod-/test-/XelioV-uppdateringen;
  `44fdcb4` för in senaste `main` (`7dc2e9a`) och bevarar P.E.R:s
  kvotreservation och begränsade allmänna studiehjälp.
- [x] Branchen pushades till
  `codex/exgen-generation-quality-2026-10-20`. Draft-PR #123 är öppen mot
  `main`; den är inte mergad. Vercel Preview `dpl_Dp9HqPP1SsS3MDQYuBDvTgYhHEy5`
  är `READY` för exakt commit `44fdcb47c173db20c4fab9afe8297647910cec1c` och
  öppnades i sidbrowserflik 76. Den visar inloggningsgrinden; ingen inloggning
  eller live-AI-begäran gjordes.
- [x] Read-only produktionskontroll med Supabase bekräftade att
  `mock_exam_generation_pipeline_jobs`,
  `claim_mock_exam_generation_pipeline_job`,
  `checkpoint_mock_exam_generation_pipeline_batch` och
  `reserve_per_chat_quota` saknas. Migrationslistan innehåller inte den nya
  pipeline-/P.E.R-kvotschemakedjan. En merge till `main` skulle därför
  auto-deploya kod med saknade database contracts och är spärrad tills exakt
  produktionsmigrationsplan granskats och separat godkänts.
- [x] Staging saknar fortfarande
  `20261022220521_add_repeated_learning_objective_checkpoint_feedback.sql`.
  Ingen Supabase-migration, produktionsdatabasändring eller Vercel Production-
  deploy gjordes. `.temp/cli-latest` är en befintlig lokal ändring och lämnades
  utanför committen.
- [x] Full seriell offline-svit avslutades med exit 0 över 193 testfiler; den
  kördes medan den sista lilla dedupliceringsfixen redigerades, så den riktade
  `tests/api/exam-pipeline-offline.test.mjs` kördes om efter fixen. P.E.R-
  handler + kvotmigration passerade 52/52 efter merge med `main`.
  `npm run xeliov:context:test` passerade 4/4; `node --check` och
  `git diff --check` passerade.

**PILOT NOT READY.** Kod/Preview är pushad för granskning, men produktionens
schema är inte versionssynkat. Draft-PR #123 ska inte mergas innan databasens
förkrav har granskats, godkänts och verifierats.

## Integrerad dubblettreparation och rollbackskydd — 2026-10-23

- [x] Semantisk dubblettkontroll fångar även svenska förklaringsparafraser
  efter böjningsnormalisering. Regressionen stoppar "Beskriv ... innebär"
  kontra "Redogör ... betyder" men behåller relaterade frågor med olika
  svarsmål, inklusive hastighet kontra energiproduktion i samma cellandning.
- [x] Oberoende kvalitetsgranskning hittade att semantiska stoppord kunde få
  "bärförmåga och hur påverkas den" att slå ut en fråga om påverkande faktorer.
  Svensk verb-/småordsnormalisering och regressioner skiljer nu dessa åt utan
  att släppa igenom rena förklaringsparafraser. Normaliseringen är avgränsad
  till den semantiska grinden; den äldre exakta signaturen och betydelsebärande
  "eller/or"-token ändras inte. Semantisk matchning kräver även samma ordnade
  sekvens av konjunktioner/disjunktioner, samma parentesgruppering och samma
  ordnade betydelsebärande token när logiska operatorer finns. Redundanta
  parenteser normaliseras bara där grupperingen är ekvivalent; operatorer utan
  operand på båda sidor stängs ute från semantisk dubblettmatchning. Motexempel
  med ändrad operatorordning, gruppering, operandplacering och trasiga uttryck
  testas.
- [x] Granskarfeedback med vanliga varianter som "samma begrepp", "same skill"
  och "overlaps with an existing question" mappas till den fasta
  reparationskategorin `repeated_learning_objective`.
- [x] En syntetisk HTTP-regression tvingar fram verifieraravslag för
  `repeated_learning_objective`, bekräftar att endast den fasta kategorin
  sparas i privat checkpoint och att nästa reparationsprompt kräver ett annat
  lärandemål. Den levererar exakt 12/12 verifierade frågor via verklig intern
  generator och autentiserad HTTP/PGlite, med en issuance och en
  kvotförbrukning; avvisad fråga utfärdas inte. Slutcheckpointens 12 `verified`
  poster måste matcha utfärdade ID:n exakt.
- [x] Framåtmigrationen lägger till kategorin i checkpointens fasta allowlist.
  Rollback återställer äldre allowlist men vägrar medan jobb är `queued` eller
  `running`; operativ ordning är att rulla tillbaka apprevisionen som skickar
  kategorin, stoppa ny generering, dränera kön och hålla trafiken stoppad tills
  SQL-rollbacken är klar. Guard är en punktkontroll, inte ett trafiklås; ingen
  hosted migration utfördes.
- [x] Den riktade fyrfiliga API-/HTTP-/PGlite-sviten passerade 25/25. Därefter
  avslutades den fulla seriella offline-sviten över 193 testfiler med exitkod 0
  på den slutliga lokala diffen (katalogen för explicita liveprov exkluderad).
  `node --check` för bedömningsmodulen och dess offline-test samt
  `git diff --check` passerade.
- [x] Oberoende säkerhets-/kvotgranskning fann inga blockerare i diffen.
  Den noterade att rollbackens aktiva-jobbkontroll inte synkroniserar trafik;
  operativt stopp och dränering måste ske före rollback. Granskaren verifierade
  inga hostade ACL/RLS-förhållanden. En separat granskning av logiknormalisering
  hittade ett ogiltigt uttryck som kunde jämföras med en giltig fråga; det är nu
  täckt av regression och uteslutet från semantisk matchning.
- [x] Read-only Vercel-kontroll: senaste READY Previewn på feature-branchen är
  deployment `dpl_2GdDg83hDTZVsLMdvf46QJEkUNJs`, commit
  `3b7dcfb12c1a989e050880b3935b8153ea80ba55`, samma som lokal HEAD före lokala
  ändringar. Previewn öppnades synligt i sidebrowserflik 75 och visar
  inloggningsgrinden. Lokala dirty ändringar ingår inte. Den tidigare
  obesvarade syntetiska provfliken lämnades orörd.
- [x] Read-only Supabase-kontroll bekräftade stagingprojektet
  `exgen-pilot-staging` som `ACTIVE_HEALTHY`; senast applicerade migration är
  `20261022172446_checkpoint_exam_repair_feedback`. Den lokala nya
  `repeated_learning_objective`-migrationen saknas i staging.
- [!] Read-only stagingkontroll 2026-10-23 bekräftar projektet
  `exgen-pilot-staging` som `ACTIVE_HEALTHY`; den nya lokala
  `repeated_learning_objective`-migrationen saknas fortfarande. Budgettabellen
  visar tak `$5.000000`, spenderat `$0.581394`, reserverat `$0.225728` och
  beräknat saldo `$4.192878`, men `updated_at` är 2026-10-22 21:50 UTC. Detta är
  en gammal intern bokföring, inte ett aktuellt tillstånd eller en
  leverantörsfaktura; ingen betald förfrågan får utgå från den.
- [x] Efter den senaste regressionsfixen passerade den riktade fyrfiliga
  API-/HTTP-/PGlite-sviten 25/25. En utökad körning av 12 relevanta testfiler,
  en kostnadsfri ämnesroutningskontroll och fyra eval-delivery-tester avslutades
  utan fel. Den bredare seriella offline-sviten passerade i samtliga 193
  testfiler.
  `node --check` för bedömningsmodulen och offline-testet samt
  `git diff --check` passerade efter dokumentuppdateringen.
- [!] Ingen push, deploy, stagingmigration, produktions-/main-ändring eller ny
  modellförfrågan gjordes.

**PILOT NOT READY.** Lokala flöden och kontrakt är testade, men den här
revisionen har inte körts mot en versionssynkad stagingmiljö eller verifierats
med verklig modellutmatning. Enstaka framgångar räcker inte för stabil
12-frågeyield.

## Lokal dubblett- och språkgrind för provfrågor — 2026-10-22 22:05 UTC

- [x] `api/_assessment.js` kompletterar exakt signatur och befintlig
  matematikintent med en försiktig semantisk jämförelse. Den kräver gemensamma
  innehållsord, samma frågeintent och Jaccard-likhet; samma begreppstagg får en
  lägre minsta ordgräns. Offline-motexempel stoppar nära parafraser om
  bärförmåga och biologisk mångfald men behåller två olika frågor om syres
  effekt på cellandningens hastighet respektive energiproduktion.
- [x] `api/_verifier.js` skickar en max-100-teckens `concept_tag` endast som
  jämförelsekontekst till tidigare godkända frågor; överskridna taggar failar
  stängt. Granskarprompten betonar upprepade lärandemål och avslag på tydliga
  grammatikfel, inklusive regressionsfrasen `den viktigt`. Godkännandetrösklar,
  verifiering, blind lösare, källstöd och utfärdandeflöde ändrades inte.
- [x] `api/generate-exam.js` tillåter en fast, integritetsbevarande
  `repeated_learning_objective`-reparationskategori. Reparationen måste byta
  lärandemål och får inte bara formulera om kandidaten.
- [x] Oberoende API-/återhämtningsgranskning hittade att SQL-checkpointens
  allowlist saknade kategorin. En framåtriktad migration lägger till enbart
  denna fasta kategori; rollbacken återställer tidigare allowlist och vägrar
  köras medan aktiva jobb fortfarande innehåller kategorin. PGlite accepterar
  och lagrar feedbacken, avvisar den efter rollback, testar rollbackskyddet och
  bekräftar att `anon`/`authenticated` fortfarande inte får köra funktionen.
- [x] Oberoende granskning identifierade en falsk-positiv risk när delad
  ordmängd dividerades med den mindre frågan. Jaccard-måttet och ett syskonfråge-
  regressionstest hanterar det fallet; granskaren bekräftade att motexemplet
  behålls och bärförmågeparafrasen fortfarande stoppas.
- [x] Fokuserad offline-svit för pipeline unit/HTTP/PGlite, recovery, budget,
  idempotens, verifierare, 3/6/12 UI/progress/delprov och pilot-readiness
  avslutades med exitkod 0 efter SQL-fixen och rollbackskyddet. PGlite-testfilen
  passerade 21/21; syntaxkontroller och `git diff --check` passerade.
- [!] Ändringarna är lokala ovanpå `3b7dcfb`; ingen push, deploy, staging-
  migration eller ny modellförfrågan gjordes. Den öppna sidebrowsern visar den
  tidigare deployade Previewn och dess obesvarade syntetiska 12-frågeprov.
  Förra stagingens budgetbokning är historisk och duger inte som nytt budget- eller
  liveverifieringsbesked.

**PILOT NOT READY.** Lokal dubblett- och språkgrind är starkare, men upprepade
stagingkörningar på exakt denna kodrevision och verifiering mot verklig
modellutmatning återstår.

## Live staging-verifiering efter recovery-release — 2026-10-22 21:50 UTC

- [x] Den branch-scopade Previewn för commit
  `3b7dcfb12c1a989e050880b3935b8153ea80ba55` körde ett enda godkänt,
  syntetiskt Biologi 1-prov på C-nivå. Begäran var 12 kortsvarsfrågor.
- [x] Previewn utfärdade provvyn med exakt 12 frågeknappar. Den öppna vyn står
  kvar på fråga 2 av 12; samtliga 12 är obesvarade. Ingen rättning, inlämning,
  avbrytning eller ytterligare generering gjordes. En visad fråga handlar om
  ekosystemets bärförmåga. Detta är inte en fullständig manuell innehållsreview
  av alla frågor.
- [x] Läsning av stagingens interna budgetbokföring kl. 21:50 UTC: tak
  `$5.000000`, spenderat `$0.581394`, reserverat `$0.225728`, återstående
  `$4.192878`. Före testet var spenderat `$0.528050`; förändringen är
  appens interna bokföring, inte en verifierad leverantörsfaktura.
- [!] Detta är en lyckad liveleverans för en syntetisk begäran, inte belägg för
  stabil yield över upprepade körningar eller en full kvalitetsgranskning av
  frågorna. Produktionssystem, `main`, staging-schema, konton och kvoter ändrades
  inte i denna verifiering.

**PILOT NOT READY.** Exakt 12/12 levererades i detta enda stagingprov. Behåll
provet öppet för användarens inspektion; upprepad yield och granskning av
frågekvalitet återstår.

## Staging release: request identity and recovery — 2026-10-22 21:44 UTC

- [x] Committed the scoped app/recovery change as `3b7dcfb12c1a989e050880b3935b8153ea80ba55` and pushed only to `codex/exgen-generation-quality-2026-10-20`.
- [x] Vercel Preview deployment `dpl_2GdDg83hDTZVsLMdvf46QJEkUNJs` is READY for that exact SHA. Its branch alias remains the open side-browser URL. Branch-only staging environment-variable metadata was verified without reading values.
- [x] Focused API/PGlite/browser identity tests passed (23 tests); the browser exam-flow regression passed 192/192 on the diagnostic rerun. Syntax checks and `git diff --check` passed before commit.
- [x] The refreshed Preview returned to the signed-in app start screen in the sidebrowser. No exam was generated during this verification.
- [!] This release hardens verified-session binding, idempotency-key durability and safe retry/cleanup; it does not change generator quality gates or prove improved 12-question yield. No Supabase migration, production/main change, or paid model call was made.
- [!] Separate XelioV playbook/learning files and unrelated local changes remain uncommitted and outside this app release. `supabase/.temp/cli-latest` remains untouched.

**PILOT NOT READY.** The deployed client recovery changes are visible in Preview, but hosted generation and repeatable 12-question acceptance remain unverified.

## Recovery hardening and final offline test pass — 2026-10-22 21:33 UTC

- [x] Malformed durable request metadata now fails closed when its valid
  fingerprint matches the pending request but its idempotency UUID or expiry
  is invalid. This check runs before legacy-session migration can rewrite the
  record. The regression asserts that no replacement key is written and the
  damaged record remains available for safe resolution.
- [x] Supabase identity is bound to one captured session token: the token is
  verified once against Auth, its verified user ID binds the request
  fingerprint, and the same token is used for graph, start, advance and status
  requests. Missing or mismatched identity stops before generation.
- [x] Mixed retry partial rules now cover 3, 6 and 12 requested questions,
  including the approved-count floor, one below it, and missing-format cases.
  The mixed deadline HTTP cases verify terminal payload/checkpoint scrubbing,
  exact response replay, one issuance/refund and unchanged quota on replay.
- [x] The real two-tab browser test now waits until both tabs have requested the
  Web Lock before asserting that creation and cleanup remain blocked behind the
  lock holder. Synthetic auth fixtures for partial delivery, graph navigation
  and quota denial now return the same verified user as their seeded session.
- [x] Final affected API/PGlite/browser-identity tests passed 23/23 after the
  last coverage additions. `node --check` for modified JS/test files and
  `git diff --check` passed. The serial repository suite exited 0 across 193
  test files before the last two test-only coverage additions; the added cases
  themselves are included in the 23/23 final affected-file run. The standalone
  Playwright exam-flow regression passed 192/192.
- [x] The independent security reviewer confirmed the malformed-key P2 is
  closed. The test/recovery reviewer found no blocker in the updated lock
  handshake and mixed retry work; their suggested boundary cases are now
  covered by the focused passing run.
- [!] No code was pushed or deployed, no Supabase migration or staging mutation
  was made, and no live model call was made. The open side-browser Preview still
  shows the pilot login gate; the local dirty changes are not in that Preview.
  The last staging budget read is historical and must be refreshed before any
  new live request.

**PILOT NOT READY.** Offline coverage is stronger, but a revision-synced,
authenticated staging run is still needed to verify current 12-question yield.

## Preview, staging readout and offline verification — 2026-10-22 21:02 UTC

- [x] Read-only Vercel listing confirms the latest READY Preview on the feature
  branch is deployment `dpl_9JzibJsjf78pTXNfcUy1wAtSqc26`, created 19:29 UTC,
  at commit `1ff86e1e7fb9309871a6949a0ffca5b718ef056b`. This matches local HEAD.
- [!] The current dirty worktree changes are not part of that deployment.
  In particular, the open browser URL that previously showed `b3c147` is older;
  a separate side-browser tab now shows the latest READY Preview. This Preview
  is behind the local unstaged request-recovery changes and cannot verify them.
- [x] Browser request identity also fails closed if shared `localStorage`
  becomes unavailable between capability detection and storage selection; it
  never falls back to tab-scoped storage in a browser. The UI explains the
  required capability, and a regression exercises the intermittent failure.
- [x] The latest focused local command covered generation pipeline unit/HTTP,
  PGlite/issuance, recovery/progress, browser-backed request identity, and
  mixed-format deadline partials: 58/58 tests passed. The full Playwright
  exam-flow regression passed 192/192, including a browser without Web Locks
  stopping before the generation API or quota reservation. No live provider
  call was made in this check.
- [x] Read-only staging inspection found no active queued/running/retryable
  generation job. In the four newest synthetic 12-question jobs, one completed
  12/12, two stopped at 2/12 with `STAGE_RETRY_LIMIT`, and one ended with
  `OPERATION_DEADLINE` before any model-usage event. These jobs predate telemetry
  commit `af37cfa`; their nullable `verification_passed` values therefore do
  not diagnose individual candidate rejection or the current Preview behavior.
- [x] The staging spend ledger reports a $5.00 cap, $0.528050 spent and
  $0.225728 reserved at its last update (2026-10-22 17:59:47 UTC). This is the
  application ledger, not a provider invoice or proof of current provider
  balance. No live AI request or staging mutation was made in this check.
- [!] The visible current Preview still shows the login gate, so there is no
  authenticated session for a revision-synced live generation check. No schema,
  account, role, quota, spend-ledger or exam-row state was changed. No active
  queued/running/retryable generation job was present in the read-only check.
  Refresh budget and job state immediately before any separately approved live
  request.
- [x] The broad serial command `node --test --test-concurrency=1
  --test-reporter=dot $(rg --files tests -g '*.test.mjs' -g '*.test.js')`
  completed with exit code 0 across 192 test files before the latest focused
  edits. After those edits, auth-snapshot/progress/idempotency tests passed
  14/14; the HTTP pipeline test file passed 2/2; and the full browser exam-flow
  regression passed 192/192. The preceding focused generation suite passed
  58/58 and supplemental issuance/quota tests passed 12/12.
- [x] Follow-up coverage now checks mixed-format deadline partial floors for
  3, 6 and 12 questions, including missing-format and one-below-floor failures.
  Request cleanup also verifies read-back after deleting the final key, with a
  regression for storage implementations that silently ignore `removeItem`.
- [x] Generation now captures one Supabase session token, verifies the user
  against that exact token, and binds both owner fingerprint and all start,
  advance, status and graph requests to the same snapshot. A verified-user
  mismatch or missing session stops before a generation request. Tests cover
  snapshot/token wiring and reuse through status recovery.
- [x] Migration of legacy session-scoped request keys now fails closed when the
  old storage cannot be read or parsed, instead of treating an unreadable
  pending key as absent and creating a second quota claim. Synthetic regressions
  verify no durable key is written in either failure case.
- [x] Independent read-only security review confirmed both P2 findings are
  closed by the local changes and their tests. The independent test/recovery
  review confirmed the new mixed 3/6/12 cases match the server's 60% partial
  floor and require both formats. No remaining blocker was found in these
  reviewed scopes; this does not verify hosted Supabase or live-model behavior.

**PILOT NOT READY.** Before claiming
repeatable live yield, run a synthetic test against a revision-synced Preview
after confirming the active exam is safely resolved and the current staging
budget remains within the approved cap.

## Keep resumable generation identity across tab closure — 2026-10-22

- [x] `js/generation-request.js` now keeps only a request fingerprint, UUID
  idempotency key and expiry in browser storage; it does not store study text
  or the account ID. With Web Locks, same-origin tabs serialize the lookup and
  creation. If Web Locks or accessible shared local storage is unavailable,
  browser generation fails closed before starting a job; tab-scoped keys cannot
  prevent another tab from charging quota twice.
- [x] Legacy same-tab request metadata is merged into existing durable records.
  The registry is bounded at five; a sixth request fails closed instead of
  evicting a key that may still identify an active server job. Malformed UUIDs
  are ignored and unreadable storage blocks generation rather than reusing stale
  in-memory state.
- [x] Creation and cleanup both use the same Web Lock when shared local storage
  is enabled. The app waits for cleanup; if durable cleanup fails after a
  successful exam, the student is warned that identical settings may replay the
  prior result. Cleanup failures are no longer silently reported as success.
- [x] If migration finds distinct keys for the same account-bound request
  fingerprint, both keys are preserved and generation fails closed with a clear
  support message instead of silently selecting one possibly active job.
- [x] `app.html` now tells a returning student that resumption requires the
  exact same material and exam settings. It only supports closing the tab when
  Web Locks plus local storage are available; otherwise it tells the student
  to keep/reload the same tab. Server replay of the same key avoids another
  quota reservation.
- [x] Offline verification: request identity and migration tests cover reload,
  concurrent key creation, locked cleanup, account-bound fingerprints, bounded
  storage, malformed/corrupt state, legacy migration collisions and the
  no-Web-Locks and intermittent-localStorage fail-closed behavior. A two-tab Playwright test exercises actual
  same-origin Web Locks, concurrent create/cleanup and reload persistence. The
  focused generation/API/PGlite/recovery suite including the browser
  request-identity test passed 58/58; browser exam-flow regression passed
  192/192; syntax and `git diff --check` passed.
- [!] The source text is intentionally not recovered from browser storage.
  After closing a supported tab, the student must paste identical material and
  use the same settings to reconnect. Browsers without Web Locks cannot start a
  generation until browser capabilities are restored. These are offline tests; no
  live provider request, staging deployment or hosted recovery was run.

**PILOT NOT READY.** Repeatable hosted 12-question yield and live resume still
need a separately approved, revision-synced staging test after the open exam is
safely completed or cleared by its owner.

## Accumulate bounded repair feedback across retries — 2026-10-22

- [x] `api/_exam-generation-pipeline.cjs` now merges the prior job feedback
  with the latest batch before checkpointing. Only existing allowlisted review
  and solver categories survive normalization; counts cap at 20 and duplicate
  count at 3, matching the private RPC constraints. Candidate acceptance,
  independent verification, solver checks, source support and deduplication
  are unchanged.
- [x] Unit coverage verifies cross-attempt category accumulation, ignored raw
  fields/categories and saturation at the SQL bounds. HTTP/PGlite recovery
  coverage seeds an earlier `answer_alignment` signal, observes a later
  `low_source_alignment` signal, and verifies the next repair prompt retains
  both. The focused nine-file suite passed 72/72; the HTTP suite passed 2/2;
  `node --check api/_exam-generation-pipeline.cjs` and `git diff --check` passed.
- [x] Independent generation and security reviewers found no blocker in the
  local diff. The security review confirms the merge stays bounded and behind
  the existing fenced private checkpoint.
- [!] This is offline evidence only. No source/material text is added to
  feedback, but no new staging model run has shown improved yield. The active
  staging exam remains untouched; no push, deploy, migration, provider call,
  production change or `main` change was made.

**PILOT NOT READY.** After the open staging exam is safely completed or cleared
by its owner, rerun a synthetic 12-question test on the exact Preview and
inspect the persisted diagnostics and accepted-count progression.

## Read-only staging yield diagnosis — 2026-10-22 19:06 UTC

- [x] Rechecked the exact READY branch Preview: deployment
  `dpl_GiBqY9VJCDwVt8sVdYf5wVQo7axb`, SHA `6e0fbe2c6eb28cda2adbd34225fa924ca7365a55`,
  created 18:58 UTC. It is the same generation code as `af37cfa` plus docs.
- [x] Read only sanitized job columns and aggregates from staging
  `yhcinqejsocpmmetazpz`. In four recent 12-question jobs, one succeeded at
  12/12 after five generation events (mean 20.1s, max 23.4s) and eleven
  comparison-review events (mean 4.3s, max 6.3s). Two failed at 2/12 with
  `STAGE_RETRY_LIMIT`: their generation means were 18.6s/22.2s and comparison
  review means 5.1s/6.7s. One failed at 0/12 with `OPERATION_DEADLINE` before
  any model event.
- [!] The older jobs have no persisted `verification_passed` outcome flags.
  Their aggregates do not expose candidate-level reject reasons, so they
  confirm underfilled/retry and preflight-deadline paths, not the exact cause
  for each rejected candidate. The new telemetry still needs a run on the
  deployed revision to test hosted persistence and explain new outcomes.
- [!] Vercel runtime-log lookup for the 17:26 UTC failure was rejected because
  the project plan retains runtime logs for one hour; no historical per-batch
  console diagnosis can be recovered from that interval. Persisted, sanitized
  outcome metrics and a fresh post-deploy run are the available route forward.
- [x] The currently open browser session corresponds to a 12-question exam
  with all answers unanswered; it was not submitted, abandoned, or modified.
  The staging budget was reread at 19:06 UTC: cap `$5.000000`, spent
  `$0.528050`, reserved `$0.225728`, remaining `$4.246222`; its ledger row's
  last update remains 17:59 UTC. Recheck immediately before another provider
  request.

**PILOT NOT READY.** Preserve the active exam. Once its owner finishes or
leaves it, run another synthetic 12-question job on the current Preview and
compare accepted counts, generation/review latency, persisted outcome flags,
and retry stage against this baseline.

## Staging quality-diagnostic package deployed — 2026-10-22

- [x] The approved generation diagnostic package is on feature branch
  `codex/exgen-generation-quality-2026-10-20`, commit
  `af37cfa40924f1c09d9b3e54300706457bbabef0`. Vercel deployment
  `dpl_GjZgfGUr6wTxssvPi1Sp1RSwoTHu` is READY as a branch Preview. No
  Production or `main` change was made.
- [x] Added nullable, batch-level `verification_passed` diagnostics to
  verifier/blind-solver usage events, including initial and repair checks.
  Completed checks record true only when all checked candidates pass, false
  when any are rejected, and null/omitted when the check is unavailable or
  has no usable candidates. No candidate acceptance or quality gate changed.
- [x] Corrected the reported failure stage when normalized repair output has
  no structurally valid candidates: it now records
  `repair_structural_validation`, not the stale `repair_normalization` stage.
  Added HTTP-path coverage proving rejected repair candidates do not reach the
  verifier or solver, plus serialization and privacy assertions.
- [x] The existing staging schema already has nullable boolean
  `ai_usage_events.verification_passed`; no migration was required or applied.
  Preview variable metadata is branch-scoped to the feature branch; values
  were not read. No account, role, quota or secret was changed.
- [x] Focused nine-file generation/API/PGlite/budget/recovery/progress tests
  passed 71/71. Browser exam-flow regression passed 191/191. Relevant
  `node --check` and `git diff --check` passed. Independent API/time and
  security/idempotency reviewers found no blocker in the reviewed scope.
- [!] No new paid/live model request was made for this commit. The existing
  browser session still contains an active 12-question exam with unanswered
  questions; it was left untouched. The prior staging ledger snapshot showed
  one successful 12/12 job among four recent jobs, which is insufficient to
  establish repeat reliability. The earlier recorded budget balance is a
  point-in-time snapshot, not a current balance or authorization.

**PILOT NOT READY.** The next live evidence requires a clean, signed-in
staging session after the existing exam is safely completed or cleared by its
owner. Then run one bounded synthetic 12-question test and inspect its
sanitized quality outcomes, progress and spend. Do not claim that the new
telemetry has been verified in hosted persistence until that test succeeds.

## Local quality-gate outcome telemetry — 2026-10-22

- [x] Added batch-level `verification_passed` usage metadata for completed
  verifier and blind-solver checks. A completed check with any rejected
  candidate records `false`; a fully accepted checked batch records `true`.
  Unavailable calls, empty checks and invalid counts remain `null`/omitted.
- [x] Confirmed the staging `ai_usage_events.verification_passed` column is
  nullable boolean, so this change needs no migration. The serializer accepts
  strict booleans only, and the helper does not alter candidate acceptance or
  quality gates.
- [x] Focused offline suite passed 58/58. The actual HTTP generator path for
  3/6/12 asserts `true` for fully approved verifier and solver batches, while
  the rejected repair fixture asserts `false`; source-privacy assertions still
  exclude question and study text. This does not prove hosted persistence.
- [x] Repair-budget assertions now pin both sides of the strict minimum:
  26,000ms declines ordinary repair while 26,001ms allows 4,001ms generation;
  internal repair similarly transitions at 16,001ms. The budget itself is
  unchanged.
- [x] The browser exam-flow regression passed 191/191 with mocked APIs. The
  separate budget/recovery suite passed 14/14 before the two exact-boundary
  assertions were added; the updated budget test then passed again.
- [!] The telemetry change is local and not deployed. Staging persistence and
  aggregate diagnosis remain to be verified after a separately approved,
  revision-synced Preview test.

## Staging package revalidated — 2026-10-22

- [x] Read-only Vercel check found the latest READY Preview on the approved
  feature branch at `9fedd1029d1f88ad9b4287b77665da53961d5163`. The Supabase
  migration ledger contains the resumable pipeline, owner-scoped claim,
  retention, scheduled cleanup, preflight-budget release and repair-feedback
  migrations. No migration needed to be applied in this pass.
- [x] The protected staging budget currently reports cap `$5.000000`, spent
  `$0.528050`, reserved `$0.225728`, remaining `$4.246222` at 17:59 UTC. This
  internal ledger is not a provider invoice and is not additional authorization.
- [x] A fresh focused offline run passed 49/49 across the pipeline unit/HTTP,
  Postgres-emulation, issuance-idempotency and progress-recovery tests.
- [x] Sanitized staging aggregates for the last 14 days show four 12-question
  jobs: one succeeded at 12/12 on the current Preview, two terminalized at 2/12
  with `STAGE_RETRY_LIMIT`, and one hit `OPERATION_DEADLINE` at 0/12 before any
  model event. For the retry-exhausted jobs, the stored usage aggregate shows
  23 model events (9 generation, 14 comparison-verifier), mean latency 11.3s
  and max 24.2s. The successful job shows 16 model events, mean latency 9.2s
  and max 23.4s. This supports quality/retry and latency/setup failure paths,
  but does not reveal individual candidate rejection reasons.
- [!] The staging browser still has an active 12-question exam with all
  questions unanswered; its branch alias resolves to the latest READY Preview
  at `9fedd10`. The matching staging job succeeded at 12/12 at 17:59:48 UTC.
  The exam was left untouched and no additional paid model call was started.
  A 6-hour runtime-log query was unavailable under the current Vercel retention,
  and narrower queries returned no runtime events, so per-batch rejection
  reasons cannot be recovered from hosted logs.
- [x] Latest independent API/time and security/idempotency review found no
  blocker in the widened repair test. Added explicit assertions for all five
  repair candidate stems and private payload markers absent from batch
  telemetry, exactly one quota increment on initial issuance, and no second
  issuance or quota charge on replay. The focused HTTP test passed 2/2.

**PILOT NOT READY.** After the active exam is completed or safely cleared by
its owner, run another bounded synthetic 12-question test to assess repeat
yield, then inspect spend and any new sanitized failure aggregates. Current
live evidence is one success in four recent staging jobs; do not describe this
as reliable repeatability.

## Staging refresh and deadline assertion — 2026-10-22

- [x] Read-only refresh confirmed the READY feature Preview at commit `9fedd10`
  uses the approved staging project and branch. The staging migration list
  includes the resumable pipeline, repair-feedback and budget-guard migrations.
- [x] The generation implementation at `9fedd10` is identical to successful
  live-run commit `a607edc`; the intervening diff contains only these status
  documents. Existing staging UI showed an already-open 12-question exam, so
  it was left untouched and no additional paid model request was started.
- [x] Current protected staging spend row: cap `$5.000000`, spent `$0.528050`,
  reserved `$0.225728`, remaining `$4.246222`. This internal ledger is not a
  provider invoice and the remaining amount is not a new allowance.
- [x] Focused nine-file generation/API/PGlite/recovery/budget/progress/runtime
  suite passed 67/67. Reused API/time and independent security reviewers found
  no implementation blocker. A test-evidence finding was fixed: the simulated
  remaining-time assertion now uses the actual `deadlineAt` passed to the
  generator rather than a hard-coded route duration. The HTTP test passed 2/2;
  syntax and diff checks passed.
- [x] Browser-backed exam-flow regression passed 191/191 with zero failures,
  including visible progress, resume, incomplete-answer states, mobile layout
  and P.E.R context. This is local UI evidence with mocked APIs.
- [x] Rechecked the 4-second streamed-repair minimum: the helper starts repair
  only when the minimum generation window plus independent-review and
  finalization reserves fit. Truncated repair output is normalized and gated;
  verifier approval and the MC blind solver remain required before acceptance.
  Budget and offline-pipeline tests passed 2/2 in this follow-up.
- [x] Postgres/PGlite ownership, lease-fencing, 3/6/12 partial floors,
  idempotent issuance/replay, quota commit/refund and private ACL tests passed
  20/20. This is local database-emulation evidence, not hosted RLS proof.
- [!] The timing test remains fake-clock arithmetic with mocked provider
  responses; it is not measured live latency or real timeout-abort evidence.
  This refresh does not add another live model run or prove repeated yield.

**PILOT NOT READY.** Keep the existing staging exam intact. After it is
completed or otherwise safely cleared by its owner, run another bounded,
synthetic 12-question test to measure repeatability under the existing cap.

## Offline HTTP coverage for widened repair boundary — 2026-10-22

- [x] Extended `tests/api/exam-generation-pipeline-http.test.mjs` to reach the
  five-candidate repair batch through authenticated HTTP start/advance and
  PGlite-backed claim/checkpoint operations. The path begins with three
  independently verified questions, preserves them across a failed first
  repair attempt, and confirms the subsequent persisted claim requests exactly
  five candidates.
- [x] The actual generator, verifier, blind solver, and issuance logic run
  against deterministic synthetic provider responses. The five-question
  verifier request is asserted between 54,000 and 60,000 serialized characters.
  One verifier-rejected question and one exact solver/key-mismatch candidate
  are both excluded; only verified candidates checkpoint. The same job then
  resumes to 12/12, issues once, and replays without new provider calls or a
  second quota charge.
- [x] Synthetic Date.now advancement covers setup, three model endpoints, and
  the checkpoint RPC, leaving at least 12 seconds by arithmetic. This is a
  fake-clock budget test, not measured wall-clock latency or a timeout/abort
  experiment.
- [x] Focused eight-file pipeline/API/PGlite/recovery/budget/progress suite
  passed 63/63. The HTTP test passed 2/2; `node --check` and `git diff --check`
  passed. API/timeout and security/idempotency reviewers found no blocker after
  the follow-up assertions.
- [!] Provider/reviewer/solver outputs remain mocks and database behavior is
  local PGlite. No staging, live-model, concurrency, Vercel, production, push,
  migration, or paid verification was performed. Earlier staging evidence is
  one successful 12/12 run, not general yield reliability.

**PILOT NOT READY.** Next evidence step remains a separately approved,
budget-checked staging run on a revision-synced Preview; this local test does
not establish real model latency, quality or yield.

## Repair feedback, batch identities and visible progress prepared locally — 2026-10-22

- [x] Confirmed a source-level cause of lost approved questions: model IDs are
  local to a generation batch, but pipeline accumulation previously treated
  their reuse as an exam-wide duplicate. Reviewed candidates now receive IDs
  scoped to the server job/lease before checkpointing. Content-based duplicate
  checks remain unchanged; telemetry distinguishes content duplicates from
  within-batch ID collisions. This does not prove which duplicate category
  caused the older hosted run, whose private candidates were already scrubbed.
- [x] Also fixed raw ID collisions between first-round and inline repair
  candidates: rename only after independent verifier/solver acceptance and
  preserve the matching verifier-map entry used for final validation metadata.
  Rejected candidates remain excluded.
- [x] Underfilled reviewed batches now enter the existing repair stage for a
  fresh request budget. A new service-only checkpoint wrapper atomically writes
  bounded, allowlisted review/solver counts into the private job payload;
  zero-progress retries retain the existing attempt limit. Existing terminal
  and retention scrubbing clears the feedback with the rest of the payload.
  No rejected candidate text, source excerpts or answer keys are added to it.
- [x] Added an engine progress callback to the visible exam flow, a polite
  status beside the generation button and accurate multi-minute waiting copy.
  The result-screen regenerate path reuses the same status component.
- [x] Focused eight-file offline suite passed 62/62. Actual generator HTTP tests
  use mocked provider/reviewer/solver responses, deliberately reuse q1/q2/q3
  across 3/6/12 runs and within inline repair, assert cross-request feedback
  prompts, reject old question stems, preserve verified checkpoints and exercise
  issuance/replay/quota invariants. SQL/PGlite tests also reject invalid feedback,
  wrong/expired leases, wrong stages and client-role reads/execution; preserve
  bounded retries and terminal cleanup. These are sequential local checks.
- [x] Reused API and independent safety reviewers found no remaining blocker
  in the local implementation; both reran the HTTP test. Server JS syntax,
  all four inline app scripts and diff whitespace checks passed.
- [x] Browser regression passed 191 checks with zero failures. Reviewed desktop
  and 390px mobile progress screenshots; the count is inside the viewport beside
  the generation button and is announced politely. The language fixture now
  reuses its already-open start screen rather than aborting a pending mocked
  Auth request with an unnecessary reload; Auth errors are still checked.
- [!] Migration `20261022170148_checkpoint_exam_repair_feedback.sql` and the
  new code remain local. Apply the migration before the matching feature
  Preview; old code does not require the new function. No new hosted write,
  push/deploy, paid test, account/role/quota change, main or production change
  was made during this follow-up. A corrected live 12-question run is still
  required. Read-only refresh confirms the enabled USD 5 cap and remaining
  USD 4.530004; the latest hosted migration is still the preflight-release
  migration, so the new repair-feedback function is not installed.

Commands executed for this follow-up:

```sh
node --test --test-reporter=spec tests/api/exam-generation-pipeline.test.mjs tests/api/exam-generation-pipeline-http.test.mjs tests/api/exam-generation-pipeline-postgres.test.mjs tests/frontend/exam-generation-progress.test.mjs tests/api/exam-pipeline-offline.test.mjs tests/api/exam-generation-recovery.test.mjs tests/api/exam-regeneration-budget.test.mjs tests/api/ai-budget.test.mjs
node tests/frontend/exam-flow.regression.mjs
node --check api/generate-exam.js
node --check api/_exam-generation-pipeline.cjs
node --check api/_exam-generation-operations.cjs
node --check js/exam-flow.js
git diff --check
```

Additionally parsed the four inline app scripts with `vm.Script`. The exact
14-file release scope is in `17_GENERATION_STAGING_CHECKLIST.md`.

## Approved staging package executed; live 12-question acceptance failed — 2026-10-22

This section supersedes earlier pending-approval/deployment snapshots below.

- [x] User approved the staging package. Committed generation changes as
  `f06ad7df27162f4f29dac3c0710db342f679ad59` and pushed the existing feature
  branch only. Vercel deployment `dpl_5iw7aHseSpgXNaYXLkZqQ5bm9i1V` is READY
  at that SHA. Its automatic branch alias retained a usable staging session;
  no credentials or alias configuration were changed.
- [x] Applied the four checklist migrations in order to staging
  `yhcinqejsocpmmetazpz` only. Hosted checks deny anon/authenticated execution
  of all four new RPCs and grant service_role execution. Pipeline and schedule
  ownership tables have RLS enabled and deny client SELECT; retention cron is
  active every 15 minutes. The ownership migration does not itself enable RLS,
  so its observed hosted RLS state is not proof of portable migration behavior.
- [x] Verified Preview branch-scoped variable metadata without reading values,
  and fetched deployed public runtime configuration: staging project present,
  production project absent. Post-commit sitemap test passed. Independent
  release reviewer reran 22 local pipeline/HTTP/PGlite tests successfully.
- [!] One synthetic Mathematics 2b/C/short-answer/12-question UI test ran as
  job `080ceb86-2647-46da-8399-2c9dd3d4ee2b`, 16:54:51–16:57:04 UTC.
  Four batches requested three candidates each; reviewer approved 2/1/1/1
  and rejected 1/2/2/2. Each later approved candidate hit the duplicate guard.
  Progress remained 2/12; terminal code was `STAGE_RETRY_LIMIT`. No exam was
  issued, ledger is retryable with no response, private checkpoints were
  scrubbed on terminal failure. UI correctly reported 2/12 and no issued exam.
  This is a failed full-count acceptance test, not pilot readiness.
- [!] Batch latencies were 29.605/30.441/32.329/33.093 seconds. Inline repair
  did not start in the first three batches; the last attempted repair failed
  normalization. Review failures included answer_alignment and required_changes.
  Source review confirms the repair time gate needs more than 16 seconds
  remaining within the roughly 45-second worker budget. No rejected-candidate
  feedback is persisted for the next batch; the repair stage is not entered.
  Duplicate telemetry combines ID collisions and semantic matches, so this
  evidence does not distinguish their contributions.
- [!] Visible exam-flow UI kept the static under-a-minute promise; progress
  updates currently target the hidden legacy status element. Bridge progress
  into the visible flow and implement reviewed cross-request repair next.
- [x] Budget before/after: spent USD 0.208611 -> 0.244268, reserved unchanged
  at 0.225728, remaining USD 4.530004 of total cap 5. Delta USD 0.035657 is
  application budget accounting, not a verified provider invoice. No further
  live attempt, account/role/quota/secrets change, main merge or production write.
- [!] Successful live issuance/replay, hosted concurrent claims and full-count
  acceptance remain unverified. Do not restart paid attempts on unchanged code.

## Failed AI-cost settlement preserves the cap — 2026-10-22

- [x] Added a PGlite integration test connecting the actual budgeted-fetch and
  settlement helpers to the existing SQL migration. A provider transport error
  followed by unavailable settlement leaves the reservation held at the cap;
  the next request is rejected before another provider call. Later conservative
  settlement, repeated twice, leaves spent at USD 5 and reserved at zero.
- [x] Budget unit/stream and migration tests passed 9/9. Independent read-only
  review found no blocker; syntax and diff checks passed. Renamed the existing
  sequential cap test to avoid implying concurrency evidence.
- [!] This proves sequential local SQL/client behavior with synthetic provider
  and RPC routing. It does not establish hosted behavior, concurrency, or an
  automatic recovery mechanism for historical held reservations. The already
  requested staging-package approval remains pending; no external writes made.

## Repair-stream timeout and conservative staging spend settlement — 2026-10-22

- [x] Added a real-generator HTTP/PGlite scenario in which independent review
  rejects one candidate and the subsequent repair stream aborts. Both approved
  initial candidates survive; the same operation resumes to 12 verified
  questions, issues once, charges exactly one exam quota unit, and replays
  without new provider calls or quota use.
- [x] Fixed handled provider failures leaving AI spend indefinitely reserved.
  Generation stream finalization settles measured usage when available and
  explicitly uses the full reservation estimate when usage is unknown. Fetch
  exceptions settle conservatively before rethrowing. Non-stream structural
  repair also settles in a finally block after response reading/parsing.
  The cap is unchanged;
  estimated settlement must not be reported as an exact provider invoice.
- [x] Eight-file generation/budget/recovery/progress suite passed 59/59. The
  repair-abort case uses actual generator logic and mocked provider streams;
  budget tests enable the staging guard with synthetic requests and check abort,
  fetch failure, HTTP failure, missing usage and measured usage.
- [x] Reused independent reviewers checked the repair-abort assertions and
  settlement changes. Follow-up assertions establish all 12 checkpointed
  questions are verified and the entire operation uses one exam quota unit.
  Final safety review found no blocker in the handled settlement paths.
- [!] Process termination or a failed settlement RPC can still leave a safe
  held reservation. Historical held amounts were not changed. No automatic
  release of unknown provider costs is permitted by this fix.
- [!] Read-only refresh confirms remote branch and latest READY Preview remain
  at `a66a7f1`; local HEAD is `dd0b4f1` plus this diff. Hosted migrations still
  stop at `20261022092012`. No current-code live yield is established.

See `17_GENERATION_STAGING_CHECKLIST.md` for the scoped release and remaining
live evidence. No push, deploy, migration, or production action was performed.

## Correlate batch quality events with the pipeline job — 2026-10-22

- [x] Successful and failed batch events now use the same strictly allowlisted
  `exam-pipeline:<job UUID>` correlation key as pipeline setup and model-usage
  events. Per-batch idempotency keys remain internal and are not confused with
  the parent job. The event still excludes user ID, source material and question
  text.
- [x] Added sanitizer and end-to-end assertions for the shared correlation ID.
  The focused seven-file generation/API/PGlite/recovery/budget/UI suite passed
  52 tests; independent generation reviewer found no local blocker in the
  reviewed changes.
- [!] This enables future diagnosis only when the exact code reaches a synced
  Preview and telemetry is captured. Current offline tests do not explain the
  historical hosted zero-progress job or prove model yield.

## Back off polling while a worker lease is active — 2026-10-22

- [x] The browser now uses bounded exponential backoff (1.2, 2.4, 4.8, 9.6,
  then 15 seconds) while an operation reports `working`, instead of repeatedly
  calling the advance endpoint every 1.2 seconds during another worker's lease.
  Newly approved progress or a transport failure resets the wait to 1.2 seconds.
- [x] Added a UI regression proving the same operation resumes and returns its
  complete exam after the lease clears. The focused seven-file pipeline/API/
  PGlite/recovery/budget/UI suite passed 52 tests; the XelioV context-loader
  suite passed 3/3; test syntax and `git diff --check` passed.
- [!] This reduces polling pressure but does not make the job server-driven:
  progress can still pause if the browser closes. Tests remain offline and do
  not establish hosted lease behavior or live model yield.

## Correlate generation setup failures — 2026-10-22

- [x] The advance handler now emits one allowlisted setup event before every
  claim-result branch, including RPC-unavailable responses. It records a
  pipeline correlation UUID, outcome, and numeric auth/claim/remaining-time
  measurements without database error text, user identity, or study content.
- [x] HTTP/PGlite regression covers both failure boundaries. A pre-execution
  RPC rejection returns 503 without state mutation. A committed claim whose
  response is lost returns 503 with a running lease; immediate replay reports
  `working` without a second stage attempt or quota effect, and the job issues
  exactly once after lease expiry and recovery. Setup timing uses the earlier
  of route and job deadlines.
- [x] The focused seven-file generation/recovery/budget/UI suite passed 49
  tests; the XelioV context-loader suite passed 3/3. Both reused reviewers
  confirmed the retry lifecycle and found no new local blocker.
- [!] Offline-only diagnostic coverage. It can distinguish a future claim/RPC
  failure from time spent after claim, but cannot retrospectively identify the
  cause of the old zero-progress staging job because its deployed code had no
  correlated setup event.

## Task-specific agent context loader — 2026-10-22

- [x] Added `npm run xeliov:context -- --task "<task>"` to print a bounded
  packet with relevant reusable reviewer roles and matching reviewed lessons.
  It is deterministic, local, stdout-only, and does not invoke agents or write
  into XelioV. `AGENTS.md` now asks substantive sessions to use it; full ledger
  reads remain appropriate for broad audits.
- [x] Added CLI regression tests for role/lesson selection and missing-task
  usage. The independent read-only workflow review confirmed the existing
  role-card/curated-ledger model and cautioned that snapshots can be stale and
  captured agent claims require source verification.
- [x] Applied the loader to the active generation task and changed it to surface
  only `VERIFIED` ledger entries. A fixture confirms `PROPOSED` and `REJECTED`
  lessons stay out of the reviewed-learning section; focused loader tests pass
  3/3. The ExGen role packet and task-specific verified lessons were emitted
  locally for this session.
- [!] The packet is a lexical navigation aid, not automatic memory learning.
  Status, source, Git state, live services, and each proposed ledger lesson must
  still be checked; historical agent instances and private reasoning are not
  preserved.

## Make the project brain safer and usable in every coding session — 2026-10-22

- [x] Codex and Claude project instructions now point to the same task-context
  loader and closeout rules. The role cards, curated ledger, and task-ranked
  packet are usable in this checkout; this is role reuse, not persistence of
  historical agent instances.
- [x] The loader no longer echoes the task argument, prints only allowlisted
  status/evidence/finding/limitation fields for reviewed lessons, and redacts
  common key, bearer, private-key, and email patterns. Added
  `npm run xeliov:context:test`; the privacy/selection suite passed 4/4.
- [x] Independent workflow and privacy reviews confirmed current usability and
  identified the task echo/full-entry output risk; tests cover the mitigation.
- [!] Redaction catches common patterns, not arbitrary sensitive content. Keep
  task arguments and ledger entries free of secrets/private learner data; stale
  lessons must still be checked against current source.

**Next:** continue offline reliability work using the selected generation,
quality, and recovery roles. Live staging/Preview steps remain subject to the
existing explicit approval and version/schema synchronization gates.

## Real generator through resumable HTTP issuance — 2026-10-22

- [x] Added a synthetic Responses API fixture to the HTTP/PGlite harness and
  exercised real `start → advance → issuance` flows for 3, 6 and 12 MC questions
  through `generateVerifiedBatch`, structural checks, independent verifier,
  blind solver, checkpoints and the existing quota/issuance path.
- [x] Each requested count must complete exactly, checkpoint only
  `validation_status=verified` questions, consume one reservation and issue
  once. Replay returns the exact result without new generation, finalization,
  usage events, quota consumption or issuance. Correlated generation/review
  telemetry excludes question and source text; successful completion clears
  private payload/checkpoint data.
- [x] A read-only test/recovery reviewer independently identified the prior gap:
  3/6/12 start/advance coverage used pre-verified generator stubs, while actual
  internal generator coverage only exercised provider abort. The new fixture
  closes that integration gap without calling a provider.
- [x] The real-generator HTTP fixture now includes a verifier rejection and a
  bounded repair batch for the 12-question request. The rejected candidate is
  not issued; all final 12 pass the structural gate, independent verifier and
  blind solver. This extends mocked/offline coverage, not live-model evidence.
- [x] An independent security/idempotency/quota review found no weakened quality
  gates. It also noted that sequential replay tests do not prove concurrent
  claim contention or hosted RLS/ACL isolation. The focused seven-file offline
  suite passed 49/49 in the latest rerun.
- [!] Offline integration only. Mocked model outputs are predetermined and do
  not establish real-model semantic quality, 12-question yield, hosted behavior,
  or provider latency. The PGlite/fetch harness also does not establish hosted
  Supabase RLS/ACL behavior or two-connection contention. Existing
  staging/Preview synchronization and approvals remain prerequisites for live
  verification.

## Repair recovery and response-budget review — 2026-10-22

- [x] Extended the actual-generator HTTP fixture with a verifier-rejected
  low-source-alignment question. The real bounded repair runs, the rejected
  question is absent from issuance, and all 12 replacement/retained questions
  reaching the final checkpoint are verified by the structural gate, verifier,
  and blind solver.
- [x] Fixed a response-state mismatch after retry exhaustion: when the database
  moves an eligible partial job to `assemble`, the API now reports
  `state=assembling`, `stage=assemble`, and exact approved/requested counts
  instead of incorrectly saying `retrying`. The HTTP test checks the
  intermediate response before the final partial issuance.
- [x] Clarified and tested the internal verifier's 18-second timeout cap. The
  3-second response/usage margin is deducted separately from remaining time;
  it is not part of the verifier cap. Existing generation and finalization
  margins are unchanged.
- [x] The API/timeout reviewer rechecked the follow-up corrections; the
  security/idempotency reviewer found no blocker in the updated response/budget
  paths. Focused tests and syntax checks passed; see this session's handoff for
  exact commands.
- [x] The standalone Playwright exam-flow regression now waits for the active
  wizard panel's entrance animation before its next click; it passed 186/186.
  Reduced-motion emulation was not retained because it masks animation-related
  assertions. No live provider, staging, deployment, migration, or production
  action was performed.

## Fresh read-only Preview and staging verification — 2026-10-22

- [x] Re-read the current branch and external state. Local HEAD is `dd0b4f1`
  with an existing dirty worktree; the latest READY branch Preview remains
  `a66a7f1` (`dpl_CGLkFkw6u6XRYkq5YUgH3fgczVd5`).
- [x] Staging project `yhcinqejsocpmmetazpz` is `ACTIVE_HEALTHY`. Hosted
  migrations end at `20261022092012`; local migrations `20261022140100` through
  `20261022140400` are not applied there.
- [x] Read-only budget aggregate: cap **$5.000000**, spent **$0.208611**,
  reserved **$0.225728**, remaining **$4.565661**. This is a snapshot, not
  authorization for a provider request.
- [x] In the last seven days, one 12-question pipeline job failed with
  `OPERATION_DEADLINE`, 0/12 progress, parent request `retryable`, and quota
  enforcement false. No `exam-pipeline:` usage events exist for the period.
- [!] Same-owner/time-window usage had 11 `generate` events (mean 22.619 s,
  p95 25.712 s) and 16 `verify_compare` events (mean 5.447 s, p95 8.997 s).
  The deployed `a66a7f1` predates the new job correlation; these nearby events
  cannot be assigned to the failed job and contain no verified/rejected counts.
  Exact zero-progress cause remains unresolved; do not infer model under-yield.
- [!] Vercel runtime-log lookup for that historical window returned a retention
  error: the project's Hobby plan only retains one hour. This is not evidence
  that no logs existed; capture the correlated events immediately after the next
  authorized Preview test.
- [!] No push, deploy, migration or paid call was performed. The hosted project
  cannot validate current local code until exact revision/schema sync is approved.

## Reusable agent workflow applied to end-to-end generation — 2026-10-22

- [x] Loaded the project role cards and ledger, then reused three read-only
  reviewers for API/timeout, tests/recovery, and security/idempotency/quota.
  One writer kept sole ownership of the test file.
- [x] Test/recovery review found that 3/6/12 worker completion and 12-question
  start replay were covered separately, but real HTTP `start -> advance ->
  issue` was not covered for every requested count. Added that integration path
  for 3, 6 and 12, checking exact final count, one quota consumption and one
  issuance per run.
- [x] Focused seven-file pipeline/API/PGlite/recovery/budget/progress suite
  passed 49/49 after the addition. The HTTP/PGlite file passes 2/2; the browser
  exam-flow regression passes 186/186; syntax check and `git diff --check` pass.
- [x] Independent security review found no actionable local issue in
  ownership, claim fencing, retry, quota or migration order. API/timeout review
  confirmed setup beyond the six-second preflight allowance safely releases
  the worker without consuming a generation attempt.
- [!] Offline evidence only. Hosted setup latency, migration/ACL/cron behavior,
  and real-model 12-question yield remain unverified. Keep the quality window
  and gates unchanged; investigate setup latency from sanitized hosted metrics.

## Persistent agent knowledge loop and current verification — 2026-10-22

- [x] Made the reusable knowledge loop actionable in `AGENTS.md`: substantive
  sessions load current status, role cards and the curated ledger; reviewers are
  read-only by default; material status is recorded at closeout; only reusable,
  independently checked findings enter the ledger. Replaced the unsafe default
  `git add -A`/commit-before-feature instruction with exact-file staging and
  explicit commit authorization.
- [x] Reused the security/idempotency reviewer role on local HEAD `dd0b4f1` plus
  the dirty diff. It reported no actionable local blocker. Its offline review
  covered owner-scoped claims, lease fencing, preflight release, retention,
  quota settlement and telemetry correlation; hosted ACLs, cron and deployment
  behavior remain unverified.
- [x] The complete serial offline test-file run exited 0:
  `node --test --test-concurrency=1 --test-reporter=dot $(rg --files tests -g '*.test.mjs' -g '*.test.js' | rg -v '^tests/live/')`.
  The focused generation/API/Postgres-emulation/recovery/budget/progress suite
  also exited 0; `git diff --check` and syntax checks passed.
- [!] No push, deployment, hosted migration, quota change or paid provider call
  occurred. The current local worktree is ahead of the READY Preview and the
  new owner-scoped migration is not in staging; no live 12-question improvement
  is claimed.

## Backoff and retry-exhaustion boundaries — 2026-10-22

- [x] Applied the reusable ExGen role cards in this work session: API/timeout, tests/recovery, and security/idempotency/quota reviewers worked read-only on the same local branch. One writer integrated fixes; follow-up reviews checked the resulting narrow diffs.
- [x] Added bounded exponential client backoff for repeated `GENERATION_BUDGET_INSUFFICIENT` responses: 1.2s, 2.4s, 4.8s, 9.6s, capped at 15s. The same operation resumes after the miss clears. Frontend progress suite passes 8/8.
- [x] Added HTTP/PGlite retry-exhaustion salvage boundaries for 3/6/12 questions: 2/3, 4/6 and 8/12 can be finalized as explicitly partial; one below each floor returns a safe 502, refunds once and issues nothing. Replay asserts response, generation/finalization count, quota reservation/profile count and issuance count.
- [x] Added whole-row and parent-request before/after assertions that expired lease or persistent deadline rejects preflight release without mutating the job/request; reservation and profile quota count remain unchanged.
- [x] Final focused generation pipeline/API/database/recovery/budget/progress/partial-delivery suite exited 0; the same suite previously reported **49/49**. `git diff --check` passed after the changes.
- [!] Offline/synthetic only. A local mocked SSE stream now proves the actual internal generator's abort signal reaches the provider-fetch boundary; the pipeline preserves its prior checkpoint and resumes. The stream contains no usable SSE content, and recovery uses a stub generator, so partial stream salvage and live model yield remain unverified. The current READY Preview remains behind the dirty local worktree and staging migration `20261022140100` remains absent; no provider/staging request was made.

**Next:** use the separately approved Preview/staging path only after exact branch/deployment/schema and current spend cap are reverified. Do not claim live 12-question yield improvement yet.

## Fresh branch and staging readback — 2026-10-22

- [x] Local branch is `codex/exgen-generation-quality-2026-10-20`, HEAD `dd0b4f1`; `origin/codex/exgen-generation-quality-2026-10-20` is an ancestor at `a66a7f1`, so local HEAD is two commits ahead (`c2b39f5`, `dd0b4f1`). The dirty working tree has additional local edits. Preserve them; do not force-push or assume the current Preview contains these changes.
- [x] Vercel read-only lookup found the latest branch deployment READY at commit `a66a7f1`, URL `https://provia-854p66c3v-eltons-projects-4adfb1a3.vercel.app/app.html`. It is two commits and the dirty local edits behind the current local HEAD/worktree.
- [x] Supabase read-only verification identifies `yhcinqejsocpmmetazpz` (`exgen-pilot-staging`) as `ACTIVE_HEALTHY`. Hosted migrations currently end at `20261022092012`; local owner-scoped claim migration `20261022140100` is absent.
- [x] The read-only staging spend row is enabled with cap **$5.000000**, spent **$0.208611**, reserved **$0.225728**, remaining **$4.565661**. No provider call or schema change occurred in this readback.
- [x] Sanitized last-seven-day model telemetry: `gpt-4o-mini-2024-07-18` initial generation 46 calls, average 14.024 s / p95 24.292 s / max 26.026 s; repair 25 calls, average 13.754 s / p95 20.382 s / max 22.896 s; comparison verification p95 6.393 s; blind solver p95 2.662 s. These aggregates are from the hosted period, not correlated to local HEAD.
- [x] One hosted 12-question pipeline job ended `OPERATION_DEADLINE` at **0 approved questions**, after 1,558 seconds; its parent request was `retryable` and `quota_enforced=false`. This confirms a real no-progress deadline failure, but current safe aggregates do not establish whether model under-yield, quality rejection, or orchestration caused that individual job.
- [!] Live verification remains blocked for the current local revision: the owner-scoped migration is absent, the existing READY Preview is two commits behind the local base plus dirty changes, and the current push/deploy/migration approval request has not been answered.

## Reusable reviewer workflow applied to exam generation — 2026-10-22

- [x] Loaded the project role cards and learning ledger, then used the existing security/idempotency/quota and test/recovery reviewers plus the exam-quality reviewer on the current local HEAD `dd0b4f1` and dirty diff. Security review found no concrete local blocker but left hosted ACL and true concurrent-connection contention unverified. Test/recovery review passed its focused suite and requested an integrated all-rejected HTTP regression. Exam-quality review found the terminal retry status bug fixed below, optional verifier/solver model separation, and a 3/6/12 gap in the all-rejected HTTP matrix. No agent edited code; one writer integrated and verified the changes.
- [x] Added an integrated all-rejected HTTP/PGlite matrix for requested counts 3, 6 and 12. The terminal retry now returns `502 incomplete_exam` on the same final request after job terminalization/refund, with the actual requested/approved counts and no issued exam. Intermediate retries remain resumable.
- [x] Propagated the same terminal response for repeated batch/transport failures, not only HTTP-200 batches whose candidates fail review. Added 3/6/12 coverage for terminal response, payload cleanup, exact quota refund, no issuance and stable terminal replay. The updated HTTP/PGlite file passes **2/2**.
- [x] Follow-up test/recovery review identified residual gaps: replay after terminal all-rejected failure, exact `profiles.mock_quota_count` restoration, and the browser's 0/N failure state. Added coverage including exact terminal-response replay equality, no second generation/refund, and a disabled grade action. The HTTP/PGlite test passes **2/2**; `node tests/frontend/exam-flow.regression.mjs` passes **186/186**. One preceding browser run had a transient Supabase auth `ERR_ABORTED`; the immediate rerun passed all 186 checks.
- [x] The focused pipeline, database-emulation, recovery, budget, progress and partial-delivery command passed **44/44** before those additional assertions; the changed HTTP/PGlite file was rerun afterward and passed **2/2**. A separate 17-file quality/assessment/UI run passed **36/36** before these test-only additions. This remains offline evidence; no model provider or staging request has run against local HEAD.
- [x] The focused resumable-pipeline HTTP/PGlite/API suite passed **35/35**, including 3/6/12-question completion, partial eligibility/counts, retry/replay, quota/issuance gates, setup deadline and owner-scoped lease tests.
- [x] A second targeted run of 12 verifier, solver, grounding, assessment, delivery and frontend-progress test files exited successfully. Node's test runner reported **26/26** formal subtests; the repository's assertion-script tests also printed their success markers. The partial-delivery browser test verified correct 2/3, 4/6 and 8/12 labels and rendering only approved questions.
- [x] Fresh full serial run across **190** test files completed. All passed except the unrelated `tests/frontend/sitemap-lastmod.test.mjs`. The failure was reproduced alone: `sitemap.xml` says `app.html` was last modified on 2026-10-21, while the current Git date is 2026-10-22. `app-auth-gate` passed in this full run; the earlier full-run failure was not reproduced. The sitemap was left unchanged as out of scope.
- [x] `node --check` passed on the four changed generation modules; `git diff --check` passed.
- [!] This is offline evidence using mocked/model-independent fixtures. No live OpenAI generation was performed. The hosted staging schema still lacks the local owner-scoped claim migration, so this revision is not ready for provider-backed staging verification until the migration and exact Preview are separately authorized and present.
- [!] The reviewers identified that model separation is configuration-dependent: verifier and solver can fall back to the generator model if their dedicated environment settings are absent. Runtime configuration was not inspected in this review; do not claim independent model weights until the exact Preview configuration is verified.
- [x] The follow-up test/recovery reviewer verified the replay, exact quota baseline, and zero-count UI assertions in source. A final precision pass also verified exact response equality and disabled grading. Reviewer did not rerun tests; local commands above are the direct test evidence, not hosted behavior.

**Next:** the outstanding approval for commit/push, exact Preview, staging migration and one bounded synthetic 12-question run is still required. Do not infer improved live-model yield from these offline results.

## Retry-limit propagation follow-up — 2026-10-22

- [x] Used the existing role cards and ledger as the working agent system; the playbook/ledger are loaded by `AGENTS.md` for each substantive ExGen task. Creating a separate Spaces spreadsheet was attempted, but the service rejected it with `invalid_page_schema`; no workbook was created, and the repository Markdown remains the source of truth.
- [x] A second exam-quality review found two paths that could flatten terminal `retry_limit` to an ordinary retry: final assembly validation and the defensive invalid-stage branch. Both now preserve `retry_limit`, allowing the advance handler to return its existing `502 incomplete_exam` contract.
- [x] Added HTTP/PGlite coverage for repeated finalization failure through terminalization, quota refund, payload/question cleanup, safe replay, and no duplicate generation; added a unit test for invalid-stage terminal propagation. The invalid stage cannot be seeded through the schema because its CHECK constraint rejects it, so that defensive branch is unit-tested only.
- [x] Added no-repeat generation/finalization and unchanged quota/reservation assertions to successful full, partial, and eligible-partial replays. Focused five-file pipeline/HTTP/PGlite/recovery/budget suite passed **35/35** after the final assertions. The independent test reviewer confirmed the quota assertions match the migration semantics.
- [x] Independent exam-quality reviewer confirmed all four `retryPipelineStep` callers preserve terminal status and found no remaining blocker in the reviewed return paths. No reviewer edited files.
- [!] `node tests/frontend/exam-flow.regression.mjs` did not complete: after more than 90 seconds it was stopped while Chromium remained active, with no assertions emitted. This is not a passing result; earlier 186/186 evidence remains from the prior run only.
- [!] All current evidence is offline with PGlite/stubs. No model provider or hosted staging request was made.

**Next:** isolate and rerun the browser regression if its timeout proves generation-related; then seek/confirm the separate approval for the exact Preview, staging migration, and one synthetic 12-question model run before making a live-yield claim.

## Owner-scoped resumable generation and reusable agent workflow — 2026-10-22

- [x] The reusable agent system is now usable in this project: `AGENTS.md` loads `08_CURRENT_STATUS.md`, role cards in `15_AGENT_PLAYBOOK.md`, and the curated learning ledger at each substantive task. Earlier work applied API/timeout, test/recovery, and independent security roles with one writer. Historical agents are not persistent workers, and this is not an archive of every historical invocation. This turn could not obtain new reviewer capacity, so the latest fixture diagnosis and validation are local, not agent-reviewed.
- [x] Replaced the advance route's separate owner GET and pipeline/parent lease round trips with a new owner-scoped, service-role-only claim RPC in `20261022140100_owner_scoped_pipeline_claim.sql`. It locks by both job and authenticated user, claims and renews the exact parent lease in one transaction, and fails closed on identity mismatch without mutating another attempt. Its rollback removes only the two new functions.
- [x] The request deadline remains anchored to handler entry and clamped to the persisted job deadline. Content-free setup timing now measures auth + the combined claim RPC. No identities, source text or credentials enter these events. Question structure, independent review, solver, repair, quota and issuance gates were not weakened.
- [x] HTTP/PGlite tests cover owner isolation, parent renewal, mismatch terminalization and payload cleanup, mismatch quota isolation, setup delays at 39s/38s, and resumable full 3/6/12 flows with retry/replay/issuance. The focused six-file suite passed **35/35** after the final mismatch change. Syntax checks and `git diff --check` passed.
- [x] A focused browser run passed **8/8** checks for partial delivery and resumable progress. The UI renders only approved questions and labels the correct 2/3, 4/6, and 8/12 counts.
- [x] Updated ten browser-test fixtures to intercept the real `?pipeline=start` route for ordinary exams; kept graph-only generation on its direct route. All ten targeted frontend files now pass (**10/10**), including auth/account-switch, graph flow and keyboard isolation, math rendering, P.E.R. context/ladder/mobile, quota copy, and solution-photo OCR UI. This repairs stale tests, not production behavior.
- [!] The latest complete offline suite is still **not green**: `sitemap-lastmod` fails because `app.html`'s Git date is `2026-10-22` while the sitemap entry is `2026-10-21`; this unrelated failure was left unchanged. The previous `app-auth-gate` full-run failure did not recur in the fresh 190-file run. The sitemap failure remains outside the exam-generation scope.
- [!] Read-only staging verification on 2026-10-22: `exgen-pilot-staging` (`yhcinqejsocpmmetazpz`) is `ACTIVE_HEALTHY`; its 5 USD pilot budget had 0.208611 spent and 0.225728 reserved, leaving **4.565661 USD at the time of that read**. The resumable-pipeline migration is present, but local `20261022140100_owner_scoped_pipeline_claim` is not listed in hosted migrations. No provider request was made. Current local code cannot be live-verified until the exact migrations and Preview are separately approved and available.
- [!] Evidence is local offline/PGlite with synthetic questions and mocked generation. PGlite uses one serialized client, so it does not prove true two-connection claim contention. No live provider yield or hosted ACL/migration state was verified. The new migration is local only; no Supabase migration, OpenAI request, push, deploy, merge, account/quota change, `main`, or Production action occurred. Existing dirty `supabase/.temp/cli-latest` was preserved.

**PILOT NOT READY.** Next: capture the full-suite `app-auth-gate` failure detail and decide whether it is a real timing race; the sitemap date mismatch is unrelated. Then verify the new migration and exact Preview in authorized staging before a bounded synthetic 12-question live test. A passing local 12-question fixture is not live-model improvement evidence.

## P.E.R all-app chat and bounded zero-pass repair — 2026-10-22

- [x] Fresh staging latency aggregates (last 7 days, previous code) show p95: initial generation 15.6 s; repair 20.4 s; comparison verifier 4.6 s; blind solver 2.7 s; grading 5.1 s. The verifier and solver run concurrently for the retry review. This supports an offline-tested local adjustment reducing only the optional retry-review timeout from 10 s to 8 s, potentially returning 2 s to repair generation; the 14 s post-review reserve, 8 s minimum generation window, and all acceptance gates are unchanged. It is not yet pushed or live-verified.
- [x] Focused budget/pipeline/static/verifier checks passed, then the full serial API suite passed 181/181 tests with `--test-timeout=60000`. One existing all-app P.E.R exam-review test took about 56 s; it passed. `node --check api/generate-exam.js` and `git diff --check` passed.
- [x] P.E.R general study chat is restored while server-side exam gating remains: generic study questions are allowed with a restricted help level; current exam questions, answer-bearing routes, and unverified full solutions remain gated. Commit `0a3b6f2` is deployed as READY Preview `dpl_78nq9m4h5xaRUz6SpnZCAUWjxn9q` on the existing feature branch. Focused P.E.R tests passed 52/52.
- [x] A 0/3 quality-repair request now asks for three candidates plus one spare instead of up to six. Mixed repairs retain one spare for each missing question type; no verifier, solver, source, delivery, or grading threshold was relaxed. Commit `f48119e` is pushed; exact Preview `dpl_C2Ls8YbNiamdaCmm4Jdiax1NKTfh` is READY. `/app.html` returns HTTP 200 and the client runtime identifies `exgen-pilot-staging`.
- [x] Generator pipeline, repair-budget, verifier, solver and assessment-focused tests passed 13/13. Full serial offline suite passed with exit 0 across 183 discovered test files after both changes. `node --check api/generate-exam.js` and `git diff --check` passed.
- [!] No model-backed request was made. On 2026-10-22, the current Chrome tab on the stable feature alias showed the authenticated ExGen app; this confirms that this browser session works, not that fresh sessions work. The staging project is `ACTIVE_HEALTHY`; a read-only check of the synthetic test account showed Gratis, exam quota count `3`, and P.E.R. quota count `5` in `2026-W43`, so live requests remain blocked before model execution. No role, quota, account, database, Production or `main` change was made. The 0/3 repair change is not live-quality proof.
- [!] Read-only, content-free staging aggregates for the preceding seven days show 15 `mock_exam_generation_requests` rows: 14 `retryable`, 1 `succeeded`. Five issued exams had saved graded results and one was abandoned. On 2026-10-20, `ai_usage_events` recorded 24 initial generation calls, 17 repair calls (mean 14.7 s, max 22.9 s), 21 blind-solver calls and 35 comparison-verifier calls, all on `gpt-4o-mini-2024-07-18`. These historical aggregate rows do not map individual outcomes to the current `f48119e` code and do not identify the root cause.
- [!] Vercel runtime-log search for `generate-exam` returned no rows for the latest 30 minutes; a 60-minute query was rejected because the Hobby retention window was exceeded. This is not evidence that older failure events do not exist.
- [x] Re-ran the focused exam-pipeline, verifier-contract, subject-overlay and solver suites on this checkpoint; all 4 test files passed, including the `Kesäkten` distractor rejection and 0/3 repair-budget regression.
- [x] The free subject-routing preflight passed all 15 fixture/counterexample cases; the delivery fail-closed checks passed all 4 tests. No provider API call was made.

**PILOT NOT READY.** Next: wait for the staging period to reset or obtain separate approval for a bounded quota change before a synthetic model-backed test. Then verify accepted count/content, grading, persistence and P.E.R both outside and during an active exam. Keep `main` and Production untouched.

## Latest pilot checkpoint — 2026-10-21

This is the current checkpoint. Older entries below are chronological snapshots; where they conflict with this section, this section is newer.

Read-only staging quota snapshot, 2026-10-21: profile role `gratis`, exam quota count `3`, and P.E.R. quota count `5`, both in `2026-W43`. This confirms the exhausted quota has not reset. No role, quota, or account data was changed; no email or profile ID is recorded.

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
- [x] Fresh serial offline suite on app-code commit `f82a67e`, before this docs-only checkpoint: all 182 discovered `tests/**/*.test.mjs` files completed with exit code 0 using `node --test --test-concurrency=1 --test-reporter=dot $(rg --files tests -g '*.test.mjs')`. This excludes standalone regression scripts, live provider calls, and hosted database checks.
- [x] Local P.E.R. voice-state fix localizes the input placeholder while speech recognition starts/ends. Browser tests passed: 6 voice-localization assertions, 12 error-announcement assertions, and 17 mobile/axe assertions. Fresh full serial suite passed all 183 discovered `tests/**/*.test.mjs` files on this local code with `--test-timeout=60000`. This remains offline/mock evidence; the change is unpushed.
- [!] Pilot still needs a current-Preview live generation with all requested questions and acceptable content, P.E.R. outside/inside active exam, grading and verified persistence/recovery, plus hosted two-JWT RLS/IDOR and school privacy/operational approval. Prior saved staging results belong to an older Preview only, not this SHA.

**PILOT NOT READY.** Current feature Preview is `READY` at `2fffb5f`, and the staging session was recognized in this browser run. The latest local serial offline suite passed all 183 test files after focus-term filtering, partial-delivery disclosure, and P.E.R. voice-language localization; these newest changes are not deployed. The runtime recovery callback points at an older deployment; get explicit approval before moving only the approved Vercel aliases to a matching READY Preview. New live model-backed checks remain blocked by exhausted staging exam and P.E.R. quotas. Keep Production and `main` untouched.

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

## Offlineuppföljning av återupptagbar provgenerering — 2026-10-22

- [x] Den HTTP/PGlite-baserade regressionskontrollen täcker nu deadline med 8/12 godkända frågor: API:t utfärdar tydligt 8/12 som delprov, använder den godkända kvoten exakt en gång och återspelning varken genererar eller utfärdar igen.
- [x] Samma gränstest täcker 7/12 under delprovsgränsen: API:t returnerar `incomplete_exam` med faktiskt antal, rensar terminalt innehåll, återbetalar reservationen exakt en gång och utfärdar inget prov.
- [x] Pipeline-enhetstestet har en övre gräns på tio steg, så fel i progressionen misslyckas tydligt i stället för att hänga.
- [x] Riktade API- och UI-regressioner passerade: 43/43 över `exam-generation-pipeline-http`, `exam-generation-pipeline-postgres`, `exam-generation-pipeline`, `exam-generation-recovery`, `exam-regeneration-budget`, `exam-generation-progress` och `exam-partial-delivery`.
- [x] Oberoende read-only-granskning fann inga blockerare; granskaren föreslog en extra assertion för att bekräfta att quota-reservationen förblir `consumed` efter replay. Assertionen lades till och hela riktade paketet passerade igen 43/43.
- [ ] Detta är offlineverifiering med PGlite/mockad modell, inte bevis på verkligt modellutbyte, hosted migration/ACL eller förbättrad live-yield för 12 frågor. Den fulla webbläsarsviten kördes inte i denna uppföljning.

**PILOT NOT READY.** Nästa tekniska bevis kräver att exakt Preview och staging-schema är synkade; därefter behövs ett kostnadsbegränsat syntetiskt provanrop. Ingen push, deploy, migration eller providerförfrågan gjordes här.

## Read-only staging-/Preview-kontroll — 2026-10-22 13:32 UTC

- [x] Supabase staging `yhcinqejsocpmmetazpz` rapporterar migrationsversioner endast till `20261022092012_resumable_mock_exam_pipeline`; lokala migrationer för owner-claim, retention och cron (`20261022140100`–`20261022140300`) saknas fortfarande.
- [x] Den skyddade stagingbudgeten har en rad, cap `$5.000000`, spenderat `$0.208611`, reserverat `$0.225728`, kvar `$4.565661`, aktiv. Read-only-kontrollen läste inga användar-/provdata.
- [x] Senaste READY Vercel Preview för målbranchen är `dpl_CGLkFkw6u6XRYkq5YUgH3fgczVd5`, SHA `a66a7f1`; aktuell lokal HEAD är `dd0b4f1` med ändringar. Den Previewn är därför inte exakt arbetskoden och staging saknar dess nya RPC.
- [ ] Ingen schemaändring, push, deploy, merge eller modellförfrågan utfördes. En ny budgetavläsning krävs precis före ett godkänt liveanrop.

**LIVEVERIFIERING BLOCKERAD AV VERSIONSSKEVHET.** Först behövs separat godkännande för migration i staging och push/Preview; därefter kan ett syntetiskt 12-frågeförsök göras om budgeten fortfarande medger det.

## Intern reparationsbudget och migreringshärdning — 2026-10-22

- [x] Interna verifierade batchar använder nu en 4-sekunders efterreserv efter reparationsgranskning i stället för den vanliga 14-sekundersreserven för kvot/utfärdande. Vanliga elevanrop behåller 14 sekunder; oberoende verifiering och blindlösare är fortsatt obligatoriska.
- [x] Både strukturell reparation och verifierarstyrd reparation skickar rätt internbudget. Offline-regressionen kör en intern strukturell reparation med syntetisk tid där 14-sekundersreserven hade nekat försöket, och verifierar 3 av 3 kandidater oberoende.
- [x] Migrationerna är ordnade efter pipelinekärnan: `20261022140100` owner-claim, `20261022140200` cleanup och `20261022140300` cron-schedule. Cron-rollback avregistrerar bara det exakta job-ID som migrationen själv skapade; ett förbefintligt jobb med samma namn lämnas kvar.
- [x] Retentiontexten säger nu att jobb blir berättigade efter 24 timmar, medan 15-minuters schemaläggning är best effort med högst 100 poster per körning. Fördröjning/kö kan alltså överskrida 24 timmar; policy är fortfarande preliminär och måste godkännas av skolan.
- [x] PGlite-testet verifierar retentionströskeln, exakt quota-settlement, cron-schedule ownership, rollback samt avslag för inaktivt jobb eller fel database/user/kommando. Den slutliga riktade provsviten passerade 45/45; offlinepipeline och regenereringsbudgettest passerade.
- [!] Allt ovan är lokalt offlinebevis. Ingen Supabase-migration, push, Preview-deploy eller modellförfrågan gjordes. PGlite simulerar cron-katalogen; verklig `pg_cron`, hosted ACL, concurrency och providerlatens är inte verifierade.

**PILOT NOT READY.** Slutför riktad regressionssvit och oberoende review. Därefter krävs separat godkännande för exakt push/Preview och stagingmigrationer, färsk kostnadsavläsning och ett syntetiskt 12-frågeprov.

## Agent- och lärandearbetsflöde samt abortåterhämtning — 2026-10-22

- [x] Projektets agent-playbook och lärandelogg användes i den här sessionen: en huvudskribent, återanvända skrivskyddade timeout- och testgranskare, verifiering mot kod/test och en kort evidensmärkt lärdom. Detta återanvänder rollkort; det återställer inte alla historiska agentinstanser eller privata resonemang.
- [x] HTTP/PGlite-timeoutfallet kör nu ett steg genom den faktiska interna `generateVerifiedBatch`/`streamGeneration`-vägen. Den lokala fejkade OpenAI-strömmen avbryts endast när generatorns riktiga `AbortSignal` avbryter den; API:t behåller 2 redan checkpointade frågor och samma jobb kan därefter återupptas till 3 frågor.
- [x] Den oberoende API-/timeoutgranskaren fann inga blockerare eller väsentlig testkontaminering. Timer- och testnyckeloverride återställs i `finally`.
- [x] Fokuserad HTTP/PGlite-fil passerade 2/2; den fokuserade 7-fils pipeline-/UI-sviten passerade med exitkod 0; `git diff --check` passerade.
- [!] Detta är fortfarande offlinebevis. Strömmen avbryts innan SSE-innehåll anländer och återhämtningsbatchen använder befintlig mockgenerator. Det bevisar abortpropagering, bevarande av tidigare checkpoint och återupptagbar pipeline, inte partiell JSON-salvage, modellens 12-frågeyield eller liveförbättring.
- [ ] Ingen push, deploy, Supabase-ändring eller live-modellförfrågan gjordes. Exakt stagingversion/migreringssynk och kostnadsgräns måste verifieras innan tidigare godkänd liveverifiering kan utföras.

**PILOT NOT READY.** Nästa steg är att kontrollera exakt aktuell Preview/staging-synk och, om det fortfarande är godkänt och inom kostnadsramen, mäta ett syntetiskt 12-frågeprov. Behåll tydlig skillnad mellan lokala tester och liveutfall.

## Jobbkorrelerad telemetri och återhämtningsregression — 2026-10-22

- [x] Resumable pipeline skickar parent-jobbets UUID vidare till den interna verifierade batchen. Händelserna korreleras i befintliga textfältet `request_id` med prefixet `exam-pipeline:`; pipeline-id skrivs inte i `job_id`, eftersom den kolumnens FK pekar på den separata `generation_jobs`-tabellen.
- [x] Offlineintegrationen kontrollerar att generering, jämförande granskning och blindlösare loggas med samma pipeline-ID och att loggposterna saknar syntetiskt material och frågetext.
- [x] Reparationstestet ger nu generatorn 39 sekunder, vilket modellerar 6 sekunders setup inom worker-vägens 45-sekundersdeadline. En 14-sekunders första generering följs av 5 sekunders strukturell reparation och oberoende verifiering i offline-fixturen.
- [x] HTTP-regressionen täcker nu avbruten 12-frågegenerering med återupptagning, samt att terminalt prov under minsta delprovsgräns rensar payload/accepted questions och inte lämnar ett skenbart komplett prov.
- [x] Offlinepipeline-testet passerade. Den fokuserade 9-fils API/UI-sviten avslutades med exitkod 0. Syntaxkontroll för `generate-exam.js`, `_ai-usage.cjs` och `_exam-generation-pipeline.cjs` samt `git diff --check` passerade.
- [x] Tre oberoende read-only-roller granskade timeout/reparationsbudget, återhämtningsassertions samt säkerhet/idempotens/telemetri. Deras fynd verifierades och åtgärdades lokalt; slutgranskningen fann inga återstående blockers inom granskad kod.
- [!] Detta bevisar korrelation och återhämtning i lokal/offline-mockad körning, inte att en verklig modell konsekvent producerar 12 kvalitetsgodkända frågor. Nya jobbkorrelerade telemetrirader finns inte förrän kodrevisionen är deployad och körd.
- [!] Reparationsfixturen modellerar 6 sekunders route-setup genom att ge generatorn 39 sekunder av worker-vägens 45. Den går direkt in i generatorn och mockad provider svarar direkt; verklig setup- och modelllatens är inte mätt.
- [x] Senaste read-only stagingkontroll: projektet `yhcinqejsocpmmetazpz` var `ACTIVE_HEALTHY`; migrationshistoriken slutade vid `20261022092012`, medan owner-scoped claim-migration `20261022140100` saknades. Senaste READY Preview var SHA `a66a7f1`, före aktuell lokal HEAD `dd0b4f1`. Budgetläsningen visade `$4.565661` kvar under stagingtaket `$5`; detta är en ögonblicksbild, inte ny tillåtelse till kostnad.
- [ ] Push, Preview, migration och live-AI-anrop är inte gjorda i denna uppföljning. Liveverifiering är fortsatt blockerad av versions-/schema-skevhet.

**PILOT NOT READY.** Nästa steg kräver separat godkänd push/Preview och stagingmigration, därefter kontroll av exakt SHA/schema och endast då ett syntetiskt 12-frågetest inom en färsk kostnadskontroll.

## Full offline-regression och aktuell extern synk — 2026-10-22

- [x] Efter att `sitemap.xml`-posten för `app.html` uppdaterats till senaste Git-datumet passerade `tests/frontend/sitemap-lastmod.test.mjs`.
- [x] Hela upptäckta `*.test.mjs`/`*.test.js`-sviten under `tests/`, exklusive den uttryckligen livebaserade katalogen, kördes serialt och avslutades med exitkod 0. Detta inkluderar API-, PGlite-, bedömnings-, frontend- och examensgeneratorregressioner; inga live-provideranrop ingick.
- [x] Färsk read-only Supabase-kontroll: staging `yhcinqejsocpmmetazpz` är `ACTIVE_HEALTHY`, men migrationerna slutar vid `20261022092012`. Owner-scoped claim `20261022140100` och senare lokala pipeline-migrationer saknas.
- [x] Färsk read-only Vercel-kontroll: senaste READY branchtillhöriga deployment är fortfarande SHA `a66a7f1` (`dpl_CGLkFkw6u6XRYkq5YUgH3fgczVd5`), inte lokal HEAD `dd0b4f1` eller dess dirty ändringar.
- [x] Budgetläsningen visade cap `$5.000000`, spenderat `$0.208611`, reserverat `$0.225728`, kvar `$4.565661`, aktiv. Ingen modellförfrågan, migration, push eller deploy utfördes.
- [x] En aggregerad read-only join av de senaste 20 12-frågejobben mot `ai_usage_events.request_id` med både kvotreserv-ID och det nya pipeline-prefixet gav noll events för det observerade `OPERATION_DEADLINE`-jobbet med 0/12. Historiska AI-steg kan alltså inte kopplas till just det jobbet.
- [!] Offline-sviten visar att repo-regressionerna passerar; den bevisar inte hosted RPC/ACL, stagingtelemetri eller 12-frågeyield med den verkliga modellen. Live-test kräver att exakt revision och schema synkas efter separat godkännande.

**PILOT NOT READY.** Kod- och testsidan är starkare verifierad lokalt. Nästa nödvändiga evidens är ett syntetiskt stagingprov på exakt aktuell kodrevision och migrationskedja, inom en färsk budgetkontroll.

## Start-replay och reparationsfelgränser — 2026-10-22

- [x] HTTP/PGlite-testet kastar nu bort första handler-svaret i testklienten, hämtar operationen från beständig lagring och provar sedan samma idempotensnyckel igen: samma operation återanvänds, den riktiga `reserve_mock_exam_quota`-SQL-funktionen har skapat exakt en reservation och profilkvoten har bara ökats en gång. Kandidatdata och intern payload exponeras inte i retry-svaret.
- [x] Testmatrisen täcker uttömda batchförsök från både `generate` och `repair` för 3, 6 och 12 frågor, exakt vid och under delprovsgränsen. Den verifierar tydligt delprov eller terminalt fel, exakt en issuance/refund samt replay utan ny generering, finalisering eller kvoteffekt.
- [x] Den fokuserade sjufilssviten för pipeline, HTTP/PGlite, recovery, budget och progress avslutades med exitkod 0. `node --check` för HTTP-testet och advance-handlern samt `git diff --check` passerade.
- [x] Återupptagen read-only test-/recoverygranskare bekräftade efter testförstärkningen att den riktiga SQL-kvotfunktionen lämnar en reservation och en profilökning vid sekventiell start-replay; inget blockerande fynd. Harnessen modellerar inte verkligt nätverksbortfall eller samtidiga starter. Repair-matrisen börjar med seedade repair-jobb och bevisar inte övergången generate→repair. Framgångsreplay mäter wrapperanrop, inte OpenAI-anrop.
- [!] Evidensen är lokal/offline och säger inget om verklig modell-yield eller hosted RPC.
- [!] Ingen push, deploy, migration eller modellförfrågan utfördes. READY Preview och staging-schemat är fortsatt äldre än lokal arbetskopia enligt senaste read-only-kontrollen ovan.

**PILOT NOT READY.** Nästa bevissteg är oberoende granskning av testerna och därefter separat godkänd, versionssynkad Preview/staging-verifiering.

## Browser-återupptagning och gräns för klientens väntetid — 2026-10-22

- [x] Oberoende API-/timeoutgranskning följde klienten från `pipeline=start` genom advance/status och verifierade att samma användar-/payloadnyckel återupptar operationen, att bara ett svar med ett färdigställt prov räknas som success, samt att delprov och terminalt `incomplete_exam` visas separat.
- [x] Granskaren noterade att klientens 14-minutersgräns är mjuk: ett redan startat advance kan ta upp till 62 sekunder och en statuskontroll upp till 10 sekunder extra. Det kan förlänga vänteläget men visar inte provet som klart eller lämnar UI:t fast; klienten returnerar i stället återupptagningsstatus. Ingen ändring bedömdes nödvändig.
- [x] `tests/frontend/exam-generation-progress.test.mjs` och `tests/frontend/exam-flow.regression.mjs` passerade i samma riktade körning: 9/9 Node-tester och 186/186 browserregressioner.
- [!] Browserharnessen använder lokala/mokade scenarier och mäter inte riktig 14-minutersdrift eller live-Supabase. Den senaste read-only staging-/Preview-synken står kvar enligt tidigare status; inget provideranrop gjordes.

**PILOT NOT READY.** Lokal UI-/återupptagningsverifiering är grön. Kvar för att bekräfta riktig 12-frågeyield är versionssynkad Preview/staging och ett godkänt syntetiskt modellanrop.

## Reparationstelemetri och verifierarbudget — 2026-10-22

- [x] 12-fråge-HTTP-fixturen fångar nu sanerad `exam_generation_pipeline_batch`-telemetri och kräver både `repairAttempted=true` och `repairOutcomeStage=repair_combined`. Testet bevisar därmed den faktiska reparationsövergången i den integrerade mockade modellen, inte enbart att slutresultatet innehåller 12 frågor.
- [x] Oberoende API-/timeoutgranskning hittade en missvisande kommentar: 18 sekunder är internverifierarens maxtak, medan svarsmarginalen på 3 sekunder dras separat från återstående budget. Kommentar och budgettesternas beskrivningar är korrigerade; runtime-budgeten är oförändrad.
- [x] Riktad pipeline-/HTTP/PGlite-/recovery-/offline-/budgetsvit passerade 41/41. Syntaxkontroller och `git diff --check` passerade. Den fulla seriala sviten rapporterade ett fel i `tests/frontend/app-auth-gate.test.mjs`; samma test passerade 1/1 när det kördes isolerat efteråt, så ordnings-/miljöflakighet återstår att utreda.
- [!] Reparationstestets provider-, verifierar- och lösarsvar är deterministiska mockar. Det bevisar kodväg, telemetri och oförsvagade grindar, inte verklig modellkvalitet eller 12-frågeyield.
- [!] Ingen push, Preview, migration eller live-modellförfrågan utfördes. Senaste verifierade externa synk ovan visar fortfarande att staging/Preview ligger efter arbetskopian.

**PILOT NOT READY.** Nästa steg är att reda ut auth-gate-svitens flakighet och först därefter synka exakt revision och schema för ett separat godkänt stagingprov.

## Ny staging-Preview och syntetiskt 12-frågeprov — 2026-10-22

- [x] Tillämpade enbart repair-feedback-RPC-migreringen i staging
  `yhcinqejsocpmmetazpz`. Supabase registrerade den som version
  `20261022172446` (`checkpoint_exam_repair_feedback`). ACL-kontrollen visar
  `EXECUTE` för `service_role` och databasägaren; `anon` och `authenticated`
  saknar rättigheten.
- [x] Pushade endast `fadbb3a` och `d95daa8` till den befintliga
  feature-branchen. Vercel Preview `dpl_EKKRoewXkvjv2fzh6ryr95MA6qrN` blev
  READY på SHA `d95daa84c2919127e6631521bea5b081fbd9cd93`. Branchens variabler
  verifierades som Preview-scope utan att läsa värden; den publika runtime
  pekade på staging och innehöll inte produktionsprojektets URL.
- [!] Ett syntetiskt Matematik 2b/C/kortsvar-jobb, ID
  `3509275b-2696-44c7-a45f-a6e16e27acff`, bad om 12 frågor. Fem genererings-
  och reparationsbatchar tog cirka 30–38 sekunder vardera. Första batchen
  godkände 0/2; därefter steg godkända frågor till 1 och 2. Två senare
  reparationsbatchar godkände inga nya frågor. Totalt: 2/12, terminalt
  `STAGE_RETRY_LIMIT`; inget prov eller någon submission utfärdades.
- [x] UI:t visade progressräknaren och slutligen korrekt text: 2 av 12
  klarade kontrollen, inget prov lämnades ut. Telemetrin rapporterade inga
  strukturellt bortsorterade eller dubbla kandidater. De vanligaste
  granskningsfelen var källstöd, svarsalignment och scoring alignment.
- [x] Terminalkontroll visade att jobbpåslaget och accepterade checkpoints var
  rensade, idempotensraden var `retryable`, svarspayload saknades och
  `submission_id` var null. Ingen ny generering gjordes efter terminalstatus.
- [x] Stagingbudgeten ändrades från spenderat `$0.244268` till `$0.367660`;
  reserverat belopp låg kvar på `$0.225728`. Återstående av den befintliga
  totala `$5`-gränsen är `$4.406612`. Delta `$0.123392` är appens budgetbokning,
  inte en verifierad faktura från modellleverantören.
- [!] Livekörningen bekräftar att serverns reparationssteg startar, feedbacken
  påverkar fortsatta omgångar och felaktigt prov inte utfärdas. Den bekräftar
  inte tillförlitlig 12-frågeyield. Nästa förbättring måste öka andelen
  källförankrade och svarskorrekta kandidater utan att sänka granskningskraven.
  Ytterligare liveanrop kräver ny uttrycklig bekräftelse och en ny budgetkontroll.

**PILOT NOT READY.** Hosted version är nu uppdaterad, men detta accepterade
12-frågeprov misslyckades med 2/12 och använde cirka `$0.123392` av appens
stagingbudget. Fortsätt med kod-/promptanalys och offlinebevis innan en ny
begäran om stagingtest.

## Lokal reparationskvalitet efter stagingresultatet — 2026-10-22

- [x] Källgranskning fann en konkret promptinkonsekvens i reparationsvägar som
  översamplar: JSON-schemat och reparationsinstruktionen begärde `repairCount`,
  medan den ursprungliga användarprompten fortfarande angav `numQuestions`.
  Detta kan förvirra kandidatantalet i strukturell och inline-kvalitetsrepair.
  Det är inte bevisat som orsaken till stagingresultatet 2/12; de sparade,
  sanerade uppgifterna innehåller inte det ursprungliga prompt-/frågeinnehållet.
- [x] `buildExamPrompts` returnerar nu offset för sin genererade antalrad.
  Reparationen ändrar bara raden på exakt offset till `repairCount`; explicit
  saknad/felaktig offset avbryter fail-closed. Kursfält och studiematerial,
  även när de innehåller en liknande rad, lämnas oförändrade.
- [x] Den lokala pipelineändringen breddar endast senare repair-batcher efter
  upprepade resultatlösa försök från 3 till högst 5 kandidater. Den fortsätter
  att acceptera endast `verified`, avvisa dubbletter/fel typer och begränsa
  lagrade frågor till begärt antal. Kvalitetsgrindar och quota-/issueflöde är
  oförändrade.
- [x] `reviewer_other` gav tidigare ingen konkret reparationsväg trots att
  kategorin överlevde den säkra checkpointen. Svensk och engelsk repair-prompt
  ber nu om en annan direkt källstödd uppgift, bibehållen nivå, självständig
  lösning och en matris som motsvarar frågan. Råa reviewer-kommentarer sparas
  eller skickas fortfarande inte mellan batchar.
- [x] Fokuserad 9-filerssvit passerade 64/64; syntaxkontroll för generator och
  test, samt `git diff --check`, passerade. Oberoende API- och säkerhetsgranskare
  bekräftade att offsetkorrigeringen bevarar material och grindar; inga
  blockerare återstår i den granskade lokala diffen.
- [!] Denna kod är lokal ovanpå `d95daa8`; den har inte committats, pushats,
  deployats eller körts mot staging. Inget nytt modellanrop gjordes. Föregående
  stagingacceptans står kvar som 2/12; inget förbättrat live-utfall är visat.

**PILOT NOT READY.** Nästa evidenssteg kräver en separat godkänd push/Preview
och ett färskt stagingbudgetbesked före ett nytt syntetiskt modellanrop.

## Stagingverifiering av repair-prompt och adaptiv batch — 2026-10-22

- [x] Commit `a607edc608bebf80923aa88db3c612593f0e0534` pushades endast till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_GmjwwREV1JEPbrVcPx7nsXSkkF9m` blev READY på exakt denna SHA. Den
  befintliga branch-aliasen återanvände staginginloggningen; publikt runtime-
  config bekräftade `environment=pilot` och stagingref
  `yhcinqejsocpmmetazpz`, utan produktionsref.
- [x] Migrationslistan visade redan pipeline-, retention-, budget- och
  repair-feedback-migrationerna. Ingen migration tillämpades på nytt i denna
  körning; ingen produktionsdatabas ändrades.
- [x] Ett syntetiskt Matematik 2b-prov på C-nivå begärde 12 kortsvarsfrågor.
  UI:t öppnade ett prov med exakt 12 frågor. Genomgång av samtliga frågor i
  UI visade varierade uppgifter om nollställen, vertex, symmetrilinje,
  parabelriktning och linjära funktioner, inom det syntetiska materialets
  ämnesområde. Inga svar lämnades in och ingen rättning kördes.
- [x] Sanerad runtime-telemetri visar nio batcher: 12 frågor godkändes av
  oberoende granskning och accepterades successivt. Efter en batch utan
  framsteg växte reparationsbredden från 3 till 5 kandidater; nästa batch
  accepterade 3 frågor och den sista 3, vilket gav 12/12. Två tidigare
  repair-batcher rapporterade `insufficient_unique_repair` och en
  `repair_normalization`; inga underkända eller o-verifierade kandidater
  accepterades. Samlad batchlatens var cirka 286 sekunder över nio separata
  requests.
- [x] Appens stagingbudget före körningen var `$0.367660` spenderat och
  `$0.225728` reserverat. Efteråt: `$0.528050` spenderat, `$0.225728`
  reserverat, `$4.246222` kvar av det befintliga `$5`-taket. Delta
  `$0.160390` är intern appbokföring, inte leverantörsfaktura. Konto, roll,
  kvotkonfiguration och produktionsresurser ändrades inte.
- [x] Fokuserad lokal svit passerade 64/64, syntaxkontroll och
  `git diff --check` passerade. Oberoende granskning fann ingen blockerare;
  dess egen niofilssvit rapporterades som 65/65. Granskningen bekräftar att
  ägarskap, lease fencing, idempotens, kvotavräkning och utfärdandespärrar
  inte ändrades.
- [!] En lyckad livekörning visar att den här 12-frågebegäran kan fullföljas,
  inte att yield eller kvalitet är tillförlitlig i allmänhet. Adaptiv
  breddning ökar möjliga utdata inom oförändrad 45-sekunders arbetstid;
  agentgranskningen noterar att större payload kan nå verifierarens fasta
  60 000-teckensgräns. Det lokala HTTP-testet täcker nu en riktig 5-kandidat-
  reparationsbatch med en cirka 54–60k teckens verifierar-payload, simulerad
  ungefär 30-sekunders arbetstid och minst 12 sekunders deadline-reserv. Det
  använder mockade provider-/granskarresultat och fake clock; det bevisar inte
  live-yield, verklig latens eller timeoutbeteende.
- [!] Stagingprovet står öppet i testkontot och har inte lämnats in. Ingen
  cleanup eller ytterligare AI-körning utfördes.

**PILOT NOT READY.** Första färska livekörningen på `a607edc` nådde 12/12
utan att försvaga kvalitetsgrindarna. Nästa tekniska steg är att täcka
5-kandidatbatchens timeout-/payloadgränser offline och samla fler fristående
stagingresultat först efter ny budgetkontroll och uttryckligt godkännande.

## HTTP-reparation verifierad för 3, 6 och 12 — 2026-10-23

- [x] Den integrerade HTTP/PGlite-fixturen kör nu verifieraravslag och inline-
  reparation genom den riktiga interna generatorn för samtliga begärda antal:
  3, 6 och 12. Varje scenario kräver exakt fullständigt antal, verifierad
  slutcheckpoint, frånvaro av den avvisade frågan samt exakt en kvotförbrukning
  och issuance.
- [x] Riktad pipeline-, HTTP/PGlite-, recovery-, budget- och UI-svit passerade
  60/60. Separata verifierar-, lösar-, källstöds-, bedömnings- och
  idempotenskontroller passerade 22/22. `node --check` på HTTP-testet och
  `git diff --check` passerade. Hela seriella offline-sviten passerade 407/407
  tester på cirka 10 minuter. Efter sista granskarfeedbacken lade vi till
  replaykontroll av reservationsstatus samt en intern 4 001 ms-reparationstest
  med samtidiga verifierar-/lösar-timeouts; slutlig fokuserad omkörning av de
  tre berörda API-/generatorfilerna passerade 4/4, båda `node --check` och
  `git diff --check` passerade. Testgranskningen fann inga blockerare;
  timeoutgranskningen verifierar nu att fejkad parallell latens inte förkortar
  lösarens beräknade tidsfönster.
- [!] Provider-/granskarresultaten är mockade. Detta stärker offlinebevis för
  den count-känsliga `generate -> repair -> issue`-vägen men bevisar inte
  modellens live-yield, hosted schema/ACL eller beteende på staging.
- [x] Boundary-regressionen kör den interna reparationsströmmen med exakt
  4 001 ms generationstid; båda granskningsrollerna verifieras fortfarande,
  med fångade timeoutfönster 18 000/8 000 ms för verifieraren och
  19 001/8 000 ms för lösaren mellan första och reparationsrundan.
- [x] Replay efter 3/6/12-frågereparation returnerar samma svar utan nya
  modell-/usage-händelser, ytterligare kvot, ändrad reservationsstatus eller
  duplicerad utfärdning.
- [x] Test-/statusändringen pushades som `683d841` till
  `codex/exgen-generation-quality-2026-10-20`; PR #123 är fortsatt draft och
  Vercel Preview för exakt commiten blev `READY`. Ingen `main`-merge,
  produktionsdeploy, migration eller live-modellförfrågan utfördes.
- [!] Färsk read-only stagingkontroll i denna fortsättning: migrationshistoriken
  slutar vid `20261022172446_checkpoint_exam_repair_feedback`; migrationen
  `20261022220521_add_repeated_learning_objective_checkpoint_feedback.sql`
  saknas. Budgettabellen har en rad med tak `$5.000000`, bokfört `$0.581394`
  spenderat och `$0.225728` reserverat, men senaste `updated_at` var
  `2026-10-22 21:50 UTC`. Dessa värden är inte färska nog för att tillåta ett
  nytt liveanrop; inget liveanrop gjordes.

**PILOT NOT READY.** Nästa steg är fortsatt kod-/offlinegranskning och därefter
versionssynkad stagingverifiering efter godkänd stagingmigration och färsk
kostnadsavläsning. En ny read-only produktionsfråga i denna session fann inte
`public.mock_exam_generation_pipeline_jobs` eller de förväntade claim-,
checkpoint- och P.E.R.-kvots-RPC-signaturerna. Merge/deploy till produktion är
spärrad tills databasschemat är versionssynkat och verifierat.

## Salvage av kandidat före stream-timeout — 2026-10-23

- [x] Offline-regressionen i `tests/api/exam-pipeline-offline.test.mjs` kör
  repair-stream-timeout för begäranden om 3 och 6 frågor: strömmen lämnar en
  hel kandidat och hänger tills dess faktiska AbortSignal avbryter. Timern för
  startgenereringen behålls; endast repair-timern kortas i fixturen. HTTP-
  timeoutvägen för 12 frågor täcks separat i PGlite.
- [x] Båda scenarierna visar att kandidaten går till oberoende verifierare och blind
  lösare, båda usage-händelserna rapporterar godkänd kvalitetsgrind, den
  tidigare avslagna frågan förblir utesluten och provet endast utfärdas efter
  att repair-kandidaten fyllt sista platsen. Transporttelemetrin anger timeout.
- [x] Relevant pipeline-, PGlite/Postgres-, HTTP-, offlinegenerator-, budget-
  och progress-UI-svit passerade 54/54 efter ändringen; syntax- och diffkontroll
  passerade. Oberoende timeoutgranskare fann och fick åtgärdat en risk med
  globalt förkortad timer, och verifierade den avgränsade slutversionen utan
  kvarstående testfynd. Säkerhetsgranskningen fann inga åtgärdbara fynd i koden.
- [!] Alla provider-/granskarresultat är syntetiska mocks. Detta testar den
  integrerade timeout-/salvage-kontrollvägen, inte verklig modellyield,
  hostad RLS/ACL eller staging.
- [x] Status- och teständringarna committades som `00cace9` och pushades till
  feature-branchen. PR #123 pekar på den commiten; dess Vercel Preview byggs.
  `supabase/.temp/cli-latest` är en separat befintlig användarändring och har
  lämnats orörd.
- [!] GitHub PR #123 är fortfarande draft. Produktionskontrollen visar att
  `mock_exam_generation_pipeline_jobs`, `mock_exam_generation_requests` och
  pipeline-/kvots-RPC:erna saknas. Merge till `main`/Production görs därför
  inte innan separat, godkänd schemahantering och verifiering.

**PILOT NOT READY.** Kvar är färsk stagingmigrations-/budgetkontroll,
versionssynkad stagingverifiering och därefter säker produktionsschema-plan
innan PR #123 kan mergas.

## Fortsatt offline- och stagingaudit — 2026-10-23

- [x] Seriell offline-svit `node --test --test-concurrency=1 --test-reporter=dot $(rg --files tests -g '*.test.mjs' -g '*.test.js')`
  avslutades med exitkod 0 över samtliga 193 testfiler på den aktuella
  12-fråge full-/delprovssalvagediffen. Den riktade sviten passerade 54/54.
- [x] Tre återupptagna, read-only granskarroller (generering/timeout,
  teståterhämtning och säkerhet/kvot) fann ingen ny blockerare i aktuell kod.
  12-frågeflödet täcks genom HTTP/PGlite. Det interna repair-stream-
  salvagetestet täcker nu även 12 frågor genom två kompletta ersättningar före
  timeout efter att två ursprungsfrågor underkänts; samtliga utfärdade frågor
  måste vara unika och passera verifierare och blind lösare. Ett separat
  abortscenario med endast en av två ersättningar kräver exakt 11/12 och
  `meta.partial=true`; full 12/12 kräver `meta.partial=false`. Den slutliga
  teständringen passerade 54/54, syntax- och diffkontroll samt en oberoende
  read-only testgranskning utan blockerare. Granskningarna är statiska
  respektive offline och bevisar inte live-modellbeteende.
- [x] Färsk stagingläsning: pipeline-jobb-/requesttabeller samt claim,
  ägarskapsclaim, 7-arguments checkpoint och quota-reservation RPC finns.
  Migrationshistoriken slutar ändå vid `20261022172446`; migrationen
  `20261022220521_add_repeated_learning_objective_checkpoint_feedback.sql`
  saknas fortfarande.
- [!] Stagingbudgetens rad visar cap `$5.000000`, spenderat `$0.581394`,
  reserverat `$0.225728` och `updated_at=2026-10-22 21:50:17 UTC`. Den är inte
  färsk nog för ett nytt live-modellanrop; inget anrop eller någon migration
  utfördes.
- [!] PR #123 är öppen som draft. Preview för `96aa89f` blev `READY` och
  GitHub/Vercel-kontrollen är grön. Produktionsschemat saknar fortfarande
  pipelinekontrakten enligt separat read-only kontroll; ingen merge, deploy
  eller produktionsändring utfördes. Den befintliga ändringen i
  `supabase/.temp/cli-latest` är orörd.

**PILOT NOT READY.** Kvar är versionssynkad stagingmigration och ett nytt
syntetiskt end-to-end-prov inom färsk kostnadsgräns. Produktionsschema och
releaseordning måste granskas och godkännas separat före merge.

## P.E.R stale provvy och matteekvivalenta dubbletter — 2026-10-24

- [x] `api/explain.js` hanterar nu kvarlämnad `page=prov` när servern
  auktoritativt säger att inget prov finns: tydligt generell, orelaterad
  studiehjälp kan gå vidare efter att gammal fråge-/facitkontext rensats.
  Uttryckliga facitfrågor, okänd/obunden provstatus och övriga spärrade lägen
  förblir stängda; serverns atomiska svarslås används fortfarande.
- [x] `api/_assessment.js` deduplicerar samma normaliserade andragradspolynom
  när frågorna ber om att lösa ekvationen respektive hitta nollställena/rötterna.
  Olika ekvationer, andra färdigheter och uttryckligen olika lösningsmetoder
  (pq-formel/faktorisering/kvadratkomplettering/grafiskt) behålls som skilda.
- [x] API-regressioner för gammel provvy/facitspärr och matteekvivalens,
  skillnader i ekvation/färdighet/metod passerade. Den riktade kombinerade
  API-sviten passerade **109/109**; partial-delivery UI och P.E.R-kontext
  passerade; bred webbläsarregression passerade **188/188**. Syntaxkontroller
  och `git diff --check` passerade.
- [x] Oberoende slutgranskning kördes iterativt och avslutades utan blockerare.
  Metodnekningar, tillämpning kontra jämförelse, extra jämförelsekriterier och
  ordningen före generiska dubblettgenvägar granskades. Jämförelseparafraser
  med olik uppgiftstext behålls avsiktligt som separata; detta kan lämna kvar
  vissa matematiskt likvärdiga jämförelsefrågor men undviker att tappa extra
  kriterier.
- [x] Efter den sista granskningsjusteringen kördes `exam-pipeline-offline`
  igen; den passerade. Den kombinerade 109-testssviten och 188-kontrollers
  webbläsarsvit passerade strax före den sista jämförelsespärrens ordningsflytt.
- [!] Alla dessa tester är offline/mockade; ingen hosted stagingmigration,
  live-modellanvändning eller produktionsbeteende är verifierat. Den tidigare
  godkända stagingmigrationsåtgärden saknar bekräftelse i denna session och
  lämnas därför orörd. Budgeten och `appOrigin` behöver färsk kontroll före
  senare syntetiska liveprov.

**PILOT NOT READY.** Nästa steg efter slutgranskning är feature-Preview av
verifierad kod och sedan stagingmigration/liveprov endast efter bekräftad
stagingauktorisation, aktuell kostnadsavläsning och versionssynkad deployment.

## Kvotstädare och återupptagbar assembly — 2026-10-24

- [x] Read-only kontroll av `20261024140557` och efterföljande
  `20261024151433`: den första reaper-versionen kunde fatta beslut från en
  gammal progress-snapshot. Den senare ersätter villkoret och skyddar en
  reservation så länge tillhörande jobb är `queued` eller `running`, oavsett
  deadline, progress eller assembly-stage. Därför hittades ingen kvarstående
  kvotrace i den installerade SQL-logiken.
- [x] Oberoende SQL-/kvotgranskning kom till samma slutsats. Terminala
  completion-, failure- och retentionvägar låser jobbet och reglerar dess
  reservation inom samma transaktion; cleanup använder `FOR UPDATE SKIP
  LOCKED`. Detta är källgranskning, inte ett bevis från två samtidiga
  PostgreSQL-sessioner.
- [x] `node --test tests/api/exam-generation-pipeline-postgres.test.mjs`
  passerade **25/25**. Det inkluderar expired eligible partial, aktiva
  icke-deliverbara jobb, atomisk konsumtion vid issuance samt exakt återbetalning
  vid terminal failure. PGlite-fallet är sekventiellt och reproducerar inte en
  verklig konkurrerande session.
- [x] Färskare än föregående status men inte realtid: stagingbudgetraden visar
  cap `$5.000000`, spenderat `$1.379071`, reserverat `$0.263628`, aktiverad,
  `updated_at=2026-10-23 19:43:02 UTC`. Eftersom värdet nu är äldre än ett dygn
  och liveanrop har en separat `$2`-gräns kördes inget modelltest.
- [x] Stagingmigrationslistan slutar vid
  `20261024151433_protect_active_pipeline_quota_reaper`. Den lokala senare
  recovery-window-cleanup-migreringen `20261024165536` saknas där. Den ändrar
  inte den verifierade reaper-predicate men stagingens retentionbeteende är
  därför inte helt versionssynkat; migreringen tillämpades inte.
- [!] Sammanräknade Supabase-loggar för 2026-10-23 innehöll 452
  `postgres_logs`-rader, men ingen sanerad, specifik korrelation mellan ett
  provförsök och eventuell reaperhändelse har verifierats. Råa loggar eller
  användartext används inte som bevis.

**PILOT NOT READY.** Kvotreaper-felet är inte reproducerat i aktuell SQL och
skyddet finns i staging. Kvar före stark liveverifiering: ett reproducerbart
två-sessionstest eller motsvarande hostad stagingevidens, färsk budgetkontroll,
versionssynkad Preview/Auth-origin och det godkända syntetiska end-to-end-testet.

## Live 12-frågeprov och mattebredd — 2026-10-24

- [x] På Preview `dpl_HFV1vM54dy6S8oeXkHn2FZdabhYR` / commit `c63f04c`
  genomfördes det godkända syntetiska Matematik 2b-provet. Jobbet nådde terminalt
  tillstånd med **9/12** godkända frågor. Appen visade `9 AV 12 BEGÄRDA` och
  märkte resultatet uttryckligen som delprov; inget ofullständigt prov visades
  som komplett.
- [x] Sanerad runtime-telemetri visar initialt 3 godkända frågor och därefter
  reparation 3→6→7→9. Kvarvarande kandidater stoppades främst av
  `source_support`, `option_quality_failed`, faktagranskarens avslag och
  lösarkontroll (`solver_disagrees_on_key` / `solver_multiple_correct_options`).
  En reparationsbegäran misslyckades med `independent_check_unavailable`.
  Kvalitetsgrindarna fungerade; denna körning bevisar inte att 12/12 kan nås.
- [x] Granskning av de nio visade frågorna fann upprepning av samma linjära
  nollställesbegrepp med formuleringarna “representerar” och “beskriver”. Det
  stöds av den exakta visade frågetexten; orsaken i klassificeraren var att
  `representerar` inte normaliserades till samma förklaringsintent.
- [x] Lokalt, ännu ej deployat: `api/_assessment.js` normaliserar nu den
  observerade parafrasen men behåller en beräkningsfråga som separat uppgift.
  `api/generate-exam.js` ger vanliga matteprov konkreta ungefärliga mål för
  problemlösning/tillämpning/begrepp (12 frågor: 9/2/1); instruktionen används
  inte för grafprov eller prov med verifierat felträningsfokus. Inga grindar,
  kvoter eller authflöden har ändrats.
- [x] Oberoende granskning fann ingen blockerare. Efter granskning tillkom ett
  test som hindrar generell mattebalans från att konkurrera med felträningsfokus.
  Riktad svit för pipeline, HTTP, offlinegenerering och recovery passerade
  **35/35**; syntaxkontroll och `git diff --check` passerade.
- [!] Efter stagingkörningen lästes budgetraden som cap `$3.379071`, spenderat
  `$1.503307`, reserverat `$0.263628`, aktiverad. Före körningen var spenderat
  `$1.379071`; ökningen i redovisad spend var `$0.124236`. Ingen ytterligare
  modellkörning är verifierad efter den lokala prompt-/dubblettändringen.
- [!] De tre kod-/testfilerna är lokala, ocommittade ändringar på branchen
  `codex/exgen-school-pilot-integration-20261024`; Previewn motsvarar därför
  inte de nya ändringarna. `main`, Vercel Production och produktionsdatabasen
  är orörda.

**PILOT NOT READY.** Den rapporterade roten till att ett 12-frågeprov blev
ofullständigt är kandidatunderkännande i oberoende granskning/lösarkontroll,
inte ett falskt komplettresultat. Ny promptstyrning och dubblettnormalisering
är offline-verifierade men behöver pushad Preview och separat, godkänd
syntetisk liveverifiering innan modellförbättring kan bekräftas.

## Separat livekontroll av P.E.R. och bevarat delprov — 2026-10-24

- [x] Ny deployment `dpl_35gXL2AxsrfyB7oGbxStYDBB6L64` är `READY` på commit
  `6986b3491a67fa8a608550ed14f579355af54cb4`; branch-aliasen pekar på denna
  Preview. Branch-scopade Preview-variabler verifierades endast till namn,
  aldrig till värden.
- [x] I det befintliga syntetiska stagingprovet står 9/12 fortfarande
  obesvarade. Inga svar skickades in, provet avbröts inte och dess state är
  bevarat enligt användarens uttryckliga val.
- [x] Aktivt provläge: P.E.R. gav facitfria ledtrådar och metodstöd; direkt
  svar var låst tills verifierad inlämning. Startvyns allmänna hjälpsvar var
  däremot generiskt. Detta verifierar svarsspärren i just denna UI-session,
  inte ämnesrelevans eller modellkvalitet.
- [x] Read-only stagingkontroll fann tre bekräftade Auth-konton totalt. Ingen
  annan aktiv staginginloggning kunde säkert identifieras. En separat
  utloggad Preview-session är öppen för att användaren ska logga in med ett
  annat befintligt konto; inga konton, lösenord, roller eller kvoter ändrades.
- [!] Senast verifierad hård budget: cap `$3.379071`, spent `$1.616745`,
  reserved `$0.263628`, kvar efter reservation `$1.498698`. Detta ryms inom
  godkända maximala `$2`, men måste läsas om före ny modellkörning.
- [!] Live 12-frågeprov på den nya koden, vanlig P.E.R. med modellens
  ämnesgrundning och P.E.R. efter verifierad rättning återstår. Budget- och
  kontogränser lämnas oförändrade.

**PILOT NOT READY.** Nästa säkra steg är att användaren loggar in på den
separata Previewn med ett annat befintligt stagingkonto. Bevara det nuvarande
9/12-provet; kör därefter högst ett syntetiskt liveprov efter ny kontroll av
deployment, stagingkoppling och budget.

## Källspårning av P.E.R:s generiska svar — 2026-10-24

- [x] Kodspårningen bekräftar två olika beteenden. Utan giltig session skickar
  `shared.js` `landingMode`; utanför skolpilot svarar `api/explain.js` med den
  fasta publika guiden i `_per-public-guide.cjs` och anropar inte studiemodellen.
  I skolpilot sparas frågan lokalt och UI:t ber användaren logga in.
- [x] Med session går vanlig studiehjälp via teach-läget. `getPageContext()`
  skickar vald kurs och, när den finns i den aktiva studieytan, materialet;
  `_per-context.js` begränsar och paketerar detta, och `_per-core.js` placerar
  det i prompten som källdata. Befintliga test bekräftar att material når
  modellen escaped, medan saknad grafdata inte hittas på.
- [x] Källan för felträning kräver verifierat, ägarbundet och rättat prov samt
  matchande kurs/fråga; klientändringar av källan avvisas. Källtesterna täcker
  även operatorer i mattefrågor och felaktig kursblandning.
- [x] Riktade regressionssviter passerade **92/92**:
  `node --test tests/api/per-exam-review-handler.test.mjs tests/api/per-usage-stream.test.mjs tests/api/mistake-training-source.test.mjs tests/api/mistake-training-context.test.mjs tests/api/mistake-training-source-rest.test.mjs`.
  Testerna är offline/mockade och bevisar inte live-modellens relevans.
- [x] Prov-/återhämtningssviten passerade **54/54**:
  `node --test tests/api/exam-generation-pipeline.test.mjs tests/api/exam-generation-pipeline-postgres.test.mjs tests/api/exam-generation-pipeline-http.test.mjs tests/frontend/exam-partial-delivery.test.mjs tests/frontend/mistake-selection-identity.test.mjs tests/frontend/per-felbank-collision.test.mjs`.
  Den täcker bland annat exakt 3/6/12-frågeackumulering, fokustäckning i
  felträning, assembly-/kvotgränser och synlig delprovsstatus. Även dessa tester
  är lokala/offline.
- [x] `node --check` passerade för `api/explain.js`, `api/_per-core.js`,
  `api/_per-context.js`, `api/_exam-generation-pipeline.cjs`,
  `api/generate-exam.js` och `shared.js`; `git diff --check` passerade.
- [!] I staging-Preview `dpl_35gXL2AxsrfyB7oGbxStYDBB6L64` visas fortfarande
  inloggningsrutan. Den exakta Previewn öppnades på nytt i synlig webbläsarflik
  och inloggningsformuläret visas; ingen autentiserad startsida har verifierats.
  Ingen live-AI-körning utfördes. Senast kända budget är inte färsk nog för ett
  nytt anrop.
- [!] Ingen ny kodändring gjordes. Oberoende agentutrymme saknades under denna
  fortsättning; befintliga tidigare reviews finns dokumenterade ovan.

**PILOT NOT READY.** Nästa steg: verifiera att separat staging-Preview visar
autentiserad startsida; därefter färsk kontroll av deployment, stagingbudget och
konto utan aktivt prov innan någon syntetisk liveverifiering.

## Preview-inloggning verifierad — 2026-10-24

- [x] Fortsättningskontroll i synlig sidbrowser: Preview
  `https://provia-8i6mh5nrf-eltons-projects-4adfb1a3.vercel.app/app.html`
  visar den autentiserade ExGen-startvyn (`Skapa prov`), inte inloggningsgrinden.
- [x] Vercel bekräftar att deployment `dpl_35gXL2AxsrfyB7oGbxStYDBB6L64`
  är `READY` på commit `6986b3491a67fa8a608550ed14f579355af54cb4` i
  `codex/exgen-generation-quality-2026-10-20`.
- [!] Detta verifierar endast den aktuella webbläsarsessionens inloggning; det
  verifierar inte att övriga sessioner är inloggade eller att P.E.R./prov-AI
  fungerar live. Inget AI-anrop gjordes och inget prov ändrades.

**PILOT NOT READY.** Previewn kan nu användas i den öppna, autentiserade
sessionen. Före syntetiska liveanrop ska stagingbudgeten läsas färskt och
testkontot kontrolleras utan att röra befintliga öppna prov.

## P.E.R fail-closed recovery och pipeline deadline-reserve — 2026-10-24

- [x] Vanlig P.E.R-studiehjälp fungerar nu även om servern hittar ett gammalt
  avbrutet/utgånget prov, men bara efter att tillståndet verifierats igen vid
  leasespärren. Aktivt, graderande eller okänt tillstånd fortsätter att fallera
  stängt. Gamla provfrågor, material, historik, misstag och osäkra klientfält
  tas bort från fallback-prompten.
- [x] Oberoende P.E.R-review fann och testerna täcker nu en omskriven fråga som
  kunde se ut som allmän förklaring. Tre gemensamma innehållsord från en
  oavslutad fråga håller den bakom provgrinden; en bredare ämnesfråga med två
  gemensamma ord fortsätter att fungera. Aktiva prov använder fortsatt
  facitfria ledtrådar.
- [x] Pipeline-batcher lämnar nu 12 sekunders finaliseringsmarginal även mot
  jobbets sparade deadline, så en redan godkänd batch inte förloras före
  kvotavräkning/checkpoint. Ett jobb utan arbetsmarginal startar inte en ny
  modellbatch.
- [x] Offline-sviter passerade: P.E.R **56/56**;
  provgenerering/HTTP/PGlite **51/51**; material, felträning och P.E.R stream
  **39/39**. Syntaxkontroll för ändrade JS-filer och `git diff --check`
  passerade. Oberoende P.E.R-review fann ingen blockerande kvarvarande fråga
  i sin avgränsade granskning; pipeline-review fann ingen blockerare.
- [!] Ingen live-AI-körning gjordes. De ändrade filerna är fortfarande
  ocommittade. Inget ändrades i Supabase, Vercel Production, `main`, kvoter,
  konton eller hemligheter. Det befintliga syntetiska 9/12-provet är orört.
- [!] Staging-Previewn för de nya ändringarna och den färska kostnadsbudgeten
  behöver verifieras före syntetisk livekontroll. Offline-resultat bekräftar
  kodvägarna, inte modellrelevans eller att Previewn använder staging.

**PILOT NOT READY.** Nästa steg är att committa och pusha endast dessa
granskade ändringar till den godkända feature-branchen, verifiera exakt READY
Preview/stagingkoppling och därefter invänta inloggning på Previewn med ett
separat stagingkonto innan eventuellt syntetiskt AI-test inom färskt verifierad
budget.

## Feature-Preview publicerad — 2026-10-24

- [x] Ändringarna ovan är committade som `eba80345c64c18fd030e5d5988b72c58b42ad5b4`
  och pushade till `codex/exgen-generation-quality-2026-10-20`.
- [x] Vercel deployment `dpl_Cjq55BgXv1pxpd1vdYVv3xmGH7td` är `READY` på exakt
  denna commit. Preview URL:
  `https://provia-5tyiv6irc-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [x] Vercel API-env-listning svarade 403; read-only CLI-fallback bekräftade
  att Preview-variabler är branch-scope:ade till den avsedda branchen. Endast
  namn och krypterad status visades, aldrig värden.
- [!] Previewn är öppnad i synlig webbläsarflik men visar inloggningsgrinden.
  Ingen autentiserad session eller live-AI-körning är verifierad i denna nya
  Preview. Inget Supabase-/produktions-/kontotillstånd har ändrats.

**PILOT NOT READY.** Invanta att användaren loggar in i den öppna Previewn med
ett separat stagingkonto. Kontrollera därefter budgeten färskt och säkerställ
att kontot inte äger det bevarade 9/12-provet innan något syntetiskt AI-test.

## P.E.R aktiv-fråga verifiering — 2026-10-25

- [x] ExGen binder nu P.E.R:s aktiva provledtråd till en serverutfärdad,
  användar- och provbunden HMAC-profil av den aktuella frågan. Identitet,
  kurs, prov, position, frågetext, frågetyp, alternativ och graf-läge ingår.
- [x] Saknat eller ogiltigt bevis ger en neutral facitfri ledtråd; aktivt
  provläge faller inte tillbaka till osignerad klienttext. Replay av ett
  genererat prov får färska bevis. Långa frågor skickas intakta upp till den
  verifierade gränsen, i stället för att UI:t klipper signerat innehåll.
- [x] Oberoende granskning fann två blockerande luckor i första versionen:
  osignerad klientfallback i aktivt provläge och mismatch när långa frågor
  klipptes i klienten. Båda är åtgärdade och täcks av regressionstester.
- [x] Den oberoende slutgranskningen fann inga blockerare för facitläckage,
  ägar-/prov-/positionsbindning, replay eller neutral fallback. En icke-
  blockerande långfrågekant åtgärdades: lutningsdetekteringen använder nu hela
  den proof-verifierade frågan (upp till 4 000 tecken).
- [x] Riktade offline-kontroller efter korrigering: bevis- och manifesttester
  **41/41**; aktiv P.E.R-handler med ändrade proof/guard-fall **10/10**;
  provpipeline och klientkontext passerade; provsidans kontext **88/88**;
  startsidesmål **41/41**; P.E.R-landningskontroller gröna. Syntaxkontroller
  för ändrade JS-filer passerade.
- [x] Hela aktiva P.E.R-handler-sviten passerade **62/62** efter samtliga
  korrigeringar. Testfallen för ledtrådstrappan använder signerad kontext;
  saknad proof ger neutral hjälp; ett lutningsord efter tecken 620 väljer
  fortfarande rätt, facitfri vägledning.
- [!] Den godkända enstaka syntetiska ledtråden i den tidigare Previewn föll
  tillbaka på ett generiskt meddelande om att provet inte var öppet. Inget
  nytt betalt AI-anrop gjordes: aktuell kvarvarande budget verifierades inte,
  och det synliga provet lämnades orört.
- [x] Commit `07f7abb542b243c947b51c0632739d9109a6419c` är pushad enbart till
  `codex/exgen-generation-quality-2026-10-20`. Vercel deployment
  `dpl_FL1gTcAxHoMBxomiUjz2e3DhSFjo` är `READY` i det befintliga `provia-ai`
  projektet på exakt denna commit. Preview:
  `https://provia-9xd4xuoxp-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [!] Vercel CLI:s projektinspektion skapade oavsiktligt en separat, tom
  projektpost `provia-ai-staging-integration-20261024`
  (`prj_Ga6vAF17JCW5wy6BROUcexJIfxUH`). Den har ingen deployment eller
  miljövariabel. Ingen ytterligare åtgärd vidtas där i väntan på beslut om
  borttagning.
- [x] Inget ändrades i `main`, Vercel Production, Supabase, konton, kvoter
  eller hemligheter.

**PILOT NOT READY.** Nästa steg: granska den READY Previewn med en aktiv
staginginloggning. Liveverifiering kräver ny kontroll av stagingkoppling och
kvarvarande kostnadsbudget; det tidigare öppna provet ska inte ändras.

## P.E.R coach och frågespecifika ledtrådar — 2026-10-25

- [x] Startsidesfrågor går fortsatt till vanlig P.E.R-hjälp utan att startsidans
  namn behandlas som ett ämne eller kräver ett aktivt prov.
- [x] Förbättringssidans särskilda studiecoach bygger på verifierade resultat
  för det autentiserade kontot. Klientens historik, lokala misstag, poäng och
  svaghetslistor ignoreras i denna coachväg. Kursnamn måste lösas mot den
  statiska utbildningskatalogen; fria fel- och begreppsetiketter skickas inte
  till modellen. Ett medskickat helpLevel skapar inte längre en infererad
  profilskrivning i coachläget.
- [x] Saknas verifierade provresultat instrueras P.E.R att säga det och ge ett
  neutralt nästa steg, inte hitta på svagheter. Vanlig konversationshjälp är
  oförändrad.
- [x] Aktiva prov får proof-verifierade, stegvisa ledtrådar för fotosyntes och
  mitos/meios. Ledtrådarna hänvisar till materialet, ger inte facit och kräver
  inget modell- eller kvotanrop. Mitos/meios-steget pekar inte ut vilket
  förlopp som motsvarar vilken funktion.
- [x] Riktade API-tester: startsida, coach med resultat från konto A jämfört
  med overifierade/konto B/klientvärden, avsaknad av coachunderlag,
  prompt-injektion i fria taggar och kursnamn, helpLevel-sid-effekt, samt de
  tre nivåerna för fotosyntes och mitos/meios: **4/4**. Utbildningskatalog,
  P.E.R-scope/identitet, startsidemål **44/44**, provkontext **88/88**,
  manifest **29/29**, minnesproveniens, JS-syntax och `git diff --check`
  passerade.
- [!] Hela `tests/api/per-exam-review-handler.test.mjs` avslutades inte:
  Node rapporterade en väntande Promise efter 24 fall (23 passerade, inget
  assertionsfel). Det långsamma vanliga studiehjälpsfallet passerar isolerat.
  Detta är kvar som testlöpar-/svitbegränsning, inte bevis på att hela filen är
  grön.
- [!] Offlineverifiering endast. Ingen ny modellförfrågan, inget nytt staging-
  prov, ingen ändring av öppet prov, Supabase, konto, kvot, `main` eller
  Production gjordes.

**PILOT NOT READY.** Oberoende API-/säkerhetsgranskning efter korrigering
fann inga blockerare; provhint-granskningen fann inga blockerare. Commit
`357eee6f2ad957a891ae14dace110ee25aae39ac` är pushad enbart till
`codex/exgen-generation-quality-2026-10-20`; Vercel deployment
`dpl_3BfHriXqFBiFYk7kBjGreR63mUf9` är `READY` i projektet `provia-ai` för
exakt denna commit. Preview:
`https://provia-abhr93b6t-eltons-projects-4adfb1a3.vercel.app/`.
Livemodell, RLS och coachens faktiska stagingbeteende är ännu inte verifierade.
Före skolpilot behöver rätt stagingkonto och godkänd kvarvarande budget
bekräftas utan att röra öppna prov.

## P.E.R busy-lease felmeddelande — 2026-10-25

- [x] En syntetisk allmän fråga på startsidan nådde den aktuella, inloggade
  staging-Previewn. API:t svarade `409 PER_REQUEST_IN_PROGRESS`; den befintliga
  P.E.R-leasen var upptagen och klienten visade råkoden i stället för ett
  begripligt besked. Serverkoden returnerar detta före modellsteget. Frågan
  låg kvar i inmatningsfältet.
- [x] Klienten visar nu ett lokaliserat meddelande om att P.E.R redan hanterar
  en förfrågan, behåller frågan och låter eleven själv försöka igen när den är
  klar. Ingen automatisk retry infördes, så konkurrerande flikar inte skapar
  dubbla AI-anrop.
- [x] Regressionskontroll: `per-page-targets` **44/44**,
  `per-exam-context` **88/88**, `per-manifest` **29/29**; `node --check
  shared.js` och `git diff --check` passerade. P.E.R API-handlern ändrades inte.
- [x] Stagingens budgetrad lästes före och efter; den var oförändrad vid
  `$2.090394` spenderat och `$0.263628` reserverat mot intern cap `$3.379071`
  (senaste uppdatering `2026-10-24 23:35 UTC`). Denna försöksrunda använde
  ingen modellförfrågan enligt API:ts busy-lease-kodväg.
- [x] Commit `2216d157c6dccd6d65732dfebc7fbeec05e71357` är pushad enbart till
  `codex/exgen-generation-quality-2026-10-20`. Vercel deployment
  `dpl_5LLwyrTr5QTKt7iw8uGZ2ceTekqV` är `READY` från exakt denna commit i det
  befintliga `provia-ai`-projektet. Preview:
  `https://provia-3mxrzct8q-eltons-projects-4adfb1a3.vercel.app/`.
- [x] Den inloggade startsidesfliken laddades om efter att Previewn blev
  `READY`; den återställde frågan och visade att man kan skicka den igen.
  Ingen ny AI-förfrågan gjordes. Det befintliga ifyllda provet i en annan flik
  lämnades orört.
- [!] Oberoende granskning av underliggande P.E.R-proof-kedja hittade inga
  blockerande säkerhetsfel. Den noterade att aktiva provledtrådar fortfarande
  ofta är mallbaserade (P2), och att `exam-pipeline-offline.test.mjs` stoppade
  vid en separat assertion om logisk avgränsning innan replay-testet kördes.
  Aktiv ledtråd och replay behöver därför fortsatt verifiering; detta är inte
  löst av busy-meddelandet.

## P.E.R-frågespecifik upptagsledning — 2026-10-25

- [x] Ett uttryckligen godkänt syntetiskt Biologi 1-prov skapades på befintlig
  staging-Preview med inskickat fotosyntesmaterial: 3/3 frågor godkändes,
  samtliga matchade materialet, och verifierad rättning gav 6/6. Ingen fråga
  kom från felbanken. Inget tidigare öppet prov lämnades in, avbröts eller
  ändrades.
- [x] Den enda godkända P.E.R-frågan gällde fråga 1 under provet. Facitspärren
  fungerade, men svaret var en generell första ledtråd som inte nämnde
  vatten-/koldioxidupptag. Källkod visar att frågan föll igenom alla kända
  deterministiska ämnesmönster till standardtrappan; detta var brist på
  relevant specialisering, inte verifierat tapp av frågekontext.
- [x] Ny aktiv, facitfri trappa för frågor om hur växter tar upp vatten och
  koldioxid ber eleven dela upp ämnena och hitta deras väg i underlaget utan
  att ge rötter eller klyvöppningar som facit. Den gäller både svenska och
  engelska former, inklusive växten/växterna och CO₂.
- [x] Oberoende granskning upptäckte och blockerade en proof/text-kant:
  verifieraren och hintvalet kunde tidigare läsa olika textfält. Ledtrådsvalet
  använder nu samma kanoniska `question ?? text` som proof-signeringen.
  Regressionen bevarar en giltig proof med ett annat klientfält och bekräftar
  att det nya specialfallet inte väljs. Oberoende eftergranskning fann sedan
  inga kvarvarande blockerare eller facitläckage.
- [x] Fokuserade handler-regressioner passerade **4/4**: signerad upptagsfråga,
  CO₂/variation i frågeform, konflikt mellan signerad text och klienttext,
  manipulerad proof samt befintliga fotosyntes-, jämförelse- och
  proof-fallbackfall. JS-syntax och `git diff --check` passerade.
- [x] Stagingens budget före test: cap `$3.379071`, spenderat `$2.090394`,
  reserverat `$0.263628`, kvar `$1.025049`, 0 aktiva orättade prov. Efter
  generering, en P.E.R-fråga och rättning: spenderat `$2.102296`, reserverat
  oförändrat `$0.263628`, kvar `$1.013147`, 0 aktiva orättade prov.
- [x] Kodcheckpoint `785da1d23bcfcbe50f1dbe5f67169e0a3a2ae5ff` pushades endast
  till `codex/exgen-generation-quality-2026-10-20`. Vercel deployment
  `dpl_AbT3T8Y3ThLM5BGrjvWPSHytqLtT` är `READY` från exakt commit i befintliga
  `provia-ai`-projektet; `/app.html` svarade HTTP 200. Preview:
  `https://provia-61fginw9o-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [!] P.E.R-ledtråden observerades före den nya koden. Ingen andra liveledtråd
  gjordes efter deployen eftersom den uttryckligen godkända enda livefrågan
  redan användes. Den nya hinttrappan är därför offline-testad och deployad,
  men inte separat liveverifierad.
- [x] Inga ändringar i `main`, Vercel Production, Supabase-schema/data,
  konton, roller, kvoter eller hemligheter.

**PILOT NOT READY.** Nästa steg är separat uttrycklig tillåtelse för högst en
liveledtråd mot redan rättat syntetprov, om sådan verifikation fortfarande
behövs. Startsida och förbättringssida måste också fortsatt kontrolleras i
aktuell Preview; den här checkpointen avsåg aktiv provhjälp.

## P.E.R coachens verifierade cache — 2026-10-25

- [x] Coachrådets lokala cache valideras nu mot en HMAC-fingeravtrycksnyckel
  från serverns faktiska, verifierade coachunderlag. Fingeravtrycket är bundet
  till kontot och avslöjar inte resultatpoängen. En billig autentiserad kontroll
  avgör om ett sparat råd fortfarande matchar; den använder varken modelltoken
  eller P.E.R-kvot.
- [x] Om serverns verifierade underlag ändrats hämtas ett nytt råd. Vid ändrad
  kontosynkad historik ogiltigförklaras även pågående svar, så ett gammalt
  svar kan inte återställa en föråldrad cache. Konto kontrolleras igen efter
  asynkrona läsningar; vid misslyckad verifierad läsning återanvänds inte cache.
- [x] Kvalitetsgräns bevarad: fria koncept- och feltypstaggar skickas inte in i
  coachprompten. Bara serververifierade poäng och katalogvaliderade kursnamn
  påverkar den. Att bredda detta kräver en säker kanonisk ämnestaxonomi.
- [x] Regressioner: `per-page-targets` **50/50** (serverunderlag oförändrat,
  underlag ändrat utan lokal synk, ändrad lokal synk, fördröjt svar under synk,
  samt konto A/B-isolering); `forbattring-flow` **46/46**;
  `per-exam-review-handler` riktade coachtester **2/2**;
  `per-exam-memory-provenance` passerade. Tidigare i samma arbetsrunda:
  pilotruntime konto→provnavigering **1/1**, pilot-session recovery **1/1**,
  aktiv provkontext **88/88**, `per-manifest` **29/29** och
  `per-context-pack` passerade. Syntax- och whitespace-kontroller passerade.
- [x] Oberoende read-only review fann inga kvarvarande blockerande
  säkerhetsproblem efter att serverkällans mismatch och sena svarsrace
  hanterats.
- [!] Ingen ny live-AI-förfrågan gjordes. Det enda uttryckligen godkända
  stagingprovet i den här rundan har redan förbrukats. Den ändrade
  coachcachekedjan är offline-testad; staging-Preview måste byggas från denna
  checkpoint och livevalidering av svaret kräver separat budgetgodkännande.
- [!] Kvarstående produktluckor: anonym startsida använder avsiktligt en fast
  produktguide, inte fri ämnes-AI; förbättringscoachen är fortfarande
  resultats-/kursbaserad snarare än begreppsspecifik; coachens pedagogiska
  relevans är inte bevisad av mockade tester. Bevara dessa som nästa
  avgränsade förbättringspunkter, utan att skicka obetrodda taggar till modellen.
- [x] Inga ändringar i `main`, Production, Supabase-data/schema, konton,
  roller, kvoter eller hemligheter.

**PILOT NOT READY.** Nästa checkpoint ska pusha coachcachefixen och
pilotnavigatorns regression till befintliga feature-branchen, kontrollera
Previewns byggda commit och därefter fortsätta med säker, syntetisk
P.E.R-verifiering endast inom kvarvarande uttryckligt godkänd budget.

## P.E.R sidkontext och återhämtning — 2026-10-25

- [x] P.E.R:s sparade konversation visas nu bara på den sida vars verifierade
  meddelanden hör till. Provbundna och äldre osidbundna turer visas inte i
  widgeten; riktiga API-svar bär redan sidmetadata.
- [x] Vanliga inloggade frågor överlever avbruten begäran och omladdning som ett
  kortlivat `sessionStorage`-utkast. Utkastet är bundet till konto och sida,
  går ut efter 15 minuter, visas aldrig för fel konto/sida och skickas aldrig
  automatiskt. Vid utgången session ligger det dolt tills samma konto loggar
  in igen. Aktivt provs signerade proof återställs bara ihop med frågan och
  kräver fortsatt manuellt klick samt serververifiering.
- [x] Startsidesfrågor om produkten skriver inte längre hjälpnivå till elevens
  långsiktiga preferensminne. Startsidan är även borttagen ur senare
  långtidsminnesextraktion.
- [x] Förbättringscoachen använder fortfarande serververifierade resultat och
  katalogvaliderade kurser. Fria koncept-/feltexter från provmaterial skickas
  inte till modellen; endast felkoder från den fasta listan mappas till fasta
  svenska etiketter. Under aktivt prov skjuts personlig analys upp och UI:t
  säger varför i stället för att visa en allmän ledtråd som coachråd.
- [x] Oberoende säkerhetsgranskning efter ändringarna fann inga kvarvarande
  blockerare för etikettinjektion, sid-/kontogräns eller proof-återställning.
- [x] Aktuella riktade tester: `per-page-targets` **64/64**; riktade
  `per-exam-review-handler` **3/3**; `per-memory-epoch` passerade;
  `per-context-pack`, `per-scope-identity` och `per-exam-memory-provenance`
  passerade. Den kompletta handler-sviten passerade **71/71** före de sista
  små coachfilterändringarna; relevanta tre tester passerade igen efter dem.
  Aktiv provkontext passerade **88/88**, och pilotens återställning efter
  inloggning passerade **1/1**. JavaScript-syntax och `git diff --check`
  passerade.
- [!] Ingen ny live-AI-förfrågan gjordes. Den tidigare uttryckligt godkända
  stagingförbrukningen är redan använd; ändringarna är offlineverifierade.
  Feature-checkpoint `a3e91f2a8098a0368424ba3875152263e6f3cb99` är pushad till
  `codex/exgen-generation-quality-2026-10-20`; deployment
  `dpl_3WWwxS63tJ5uQsBgCvmopp6GokVc` i befintliga `provia-ai`-projektet är
  `READY` från exakt SHA. Preview:
  `https://provia-r548p6quq-eltons-projects-4adfb1a3.vercel.app/app.html`.
  HTTP-kontrollen får `302` till Vercel SSO, så appinnehållet efter
  autentisering är inte visuellt verifierat. Ingen `main`, Vercel Production,
  produktionsdatabas, konto, kvot eller hemlighet ändras.

**PILOT NOT READY.** Nästa steg: pushad feature-Preview verifieras mot exakt
commit. Ingen betald livekontroll görs utan verifierad kvarvarande budget och
nytt uttryckligt godkännande.

## P.E.R startsida: livekontroll och lokaldata-gräns — 2026-10-25

- [x] I den inloggade staging-Previewn gick P.E.R att öppna från startsidan.
  Ett enda generellt, syntetiskt test fick svaret att vanliga ämnesfrågor kan
  ställas direkt utan att skapa prov. Inget prov skapades eller ändrades.
- [!] Svaret var funktionellt korrekt men kort; detta verifierar startsidans
  routing och att den inte kräver ett prov, inte bred svarskvalitet.
- [x] En färsk budgetläsning före anropet visade `$0.972991` kvar av den
  aktiverade capen `$3.379071`; efter anropet visade den `$0.972151` kvar
  (`spent_usd` ökade `$0.000840`). Ingen cap, kvot eller roll ändrades.
- [x] Efter livekontrollen stängdes en integritetslucka i klienten: startsidan
  utelämnar nu lokalt snitt, svaghets-/kurs-/material-/provkontext och läser
  varken lokal resultat- eller felbankshistorik. API-serverns tidigare
  startsidesgräns som rensar kontext före modellprompten är oförändrad.
- [x] Oberoende read-only-granskare bekräftade att startsidesgränsen stänger
  fyndet; inga blockerande fynd kvarstod. Testet seedar gamla privata markörer,
  granskar fångad request och kontrollerar att båda lokala lagringsnycklarna
  inte läses av P.E.R-anropet.
- [x] Offline: `per-page-targets` **69/69**, `anon-per` **21/21**,
  `per-manifest` **29/29**, riktade API-tester för startsida, coach och
  aktivt prov **4/4**; syntax- och diffkontroller passerade.
- [!] Ett bredare seriellt API-testförsök nådde 58 godkända test utan
  assertionsfel men nådde test-runnerns 300-sekundersgräns innan hela filen
  slutfördes. Det räknas inte som en passerad fullständig svit.
- [x] Kodcheckpoint `70eca8c0bde90eeaf7bef105871a346c5b66115d` är pushad till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_2ZiLusWxUDGsodMZaYuiFzSwuCZn` är `READY` från exakt SHA på
  `https://provia-omsuzko1j-eltons-projects-4adfb1a3.vercel.app/`.
- [!] Den livefrågan kördes före klientgränsändringen, på den dåvarande
  Previewn. Den nya gränsen är verifierad offline och byggd i den READY
  Previewn, men inte separat liveinspekterad. Ingen ny fråga har skickats efter
  ändringen. Aktivt prov och coachsvar har inte live-testats på grund av
  befintlig prov-/historikdata i tillgängliga konton.
- [x] `main`, Production, Supabase-schema/data, konton, roller, kvoter och
  hemligheter lämnades orörda.

**PILOT NOT READY.** Nästa steg är att få en separat staging-session utan
personlig eller pågående provdata för livekontroll av aktiv provledtråd och
förbättringscoach. Startsidan behöver inget ytterligare betalt test nu.

## P.E.R utgånget prov: stagingkontroll — 2026-10-25

- [x] Den tidigare uttryckligen godkända syntetiska provfliken kontrollerades
  read-only innan en enda P.E.R-fråga skickades. UI:t visade fråga 1 av 12,
  obesvarad, med en provtid över 3 000 minuter. Ingen answer-, nästa-, lämna
  in- eller avbryt-åtgärd användes.
- [x] P.E.R svarade att provet inte längre är öppet för svar, gav endast en
  generell metodledtråd och höll fullständigt svar låst tills verifierad
  rättning. Provet förblev orört. Stagingens budgetsnapshot var oförändrad
  efter anropet, så inget modellanrop registrerades.
- [!] Detta verifierar livegrinden för utgånget prov, inte vägledning under ett
  faktiskt aktivt prov. Förbättringscoachens modellrespons har fortfarande
  inte live-testats med bekräftat syntetisk verifierad historik.
- [x] Inget provsvar, provstatus, resultat, kvot eller konto ändrades. Det
  skickade P.E.R-meddelandet kan sparas i kontots vanliga P.E.R-chathistorik.
  `main`, Production och Supabase-schema lämnades orörda.

**PILOT NOT READY.** Nästa blockerare för bredare liveverifiering är en
staging-session där den relevanta prov-/coachhistoriken är bekräftat syntetisk
och den aktuella provfrågan faktiskt är aktiv.

## P.E.R målavstämning — 2026-10-25

- [x] Aktuell feature-Preview `dpl_4gs6Cksht7pb6576K4kkNrTooN4R` är
  `READY` från exakt `5405222bd809ada6e6bd42a233d4ac367b638d50`;
  branch-aliasen pekar på denna deployment. Den separata URL:en
  `provia-mmqi4rbt6...` pekar däremot på äldre SHA `b71e630` och gav
  inloggningsgrind på app-routen; den används inte som bevis för nyaste koden.
- [x] Riktade tester på HEAD: `per-page-targets` **69/69**,
  `per-exam-context` **96/96**, `anon-per` **21/21**,
  `per-manifest` **29/29**, `per-memory-epoch` passerade och full
  `per-exam-review-handler` **72/72**. Node syntax- och diffkontroller
  passerade; ESM-varning i testharnessen är ofarlig.
- [x] Oberoende read-only review fann inga blockerande kodbrister i
  startsidans gräns, konto-/resultatbunden coachcache eller provkontextens
  avbrott. Reviewern bekräftade också att mocktester inte ersätter livebevis.
- [x] På branch-aliasens förbättringssida gav ett syntetiskt stagingkonto ett
  live coachsvar från serververifierad historik. Rådet kopplade nästa steg till
  verifierat kurs-/felmönster och bad kontrollera ett avvikande resultat innan
  slutsats drogs. Svaret följde dock den gamla promptens instruktion att ange
  "imorgon"; därför uppdateras coachprompten till "nästa studiepass" utan
  påhittad kalenderdag.
- [x] Coachpromptrevision bumpas från `verified-coach-v2` till `v3`, så en
  sparad rekommendation skapad med den gamla tidsinstruktionen inte återanvänds.
  Regressionstesterna verifierar både promptregeln och att gammalt
  v2-fingeravtryck invalidieras. Ändringen är ännu inte deployad i denna status.
- [!] Aktiv provhjälp på den exakta senaste koden är fortsatt inte live-testad.
  En flik på branch-aliasen visade tidigare ett ifyllt 12-frågeprov; inget svar
  ändrades och provet lämnades inte in eller avbröts. Efter vanlig navigation
  visades appens startsida; provets serverstatus kontrollerades inte på nytt.
- [x] Skrivskyddad budgetläsning efter coachanropet, 2026-10-25 11:27 UTC:
  cap `$3.379071`, spenderat `$2.143987`, reserverat `$0.263628`, kvar
  `$0.971456`. Delta för live coachsvaret var cirka `$0.000695` i appens
  budgetbokföring.

**PILOT NOT READY.** Live coachsvar har nu verifierats på föregående
Preview-version; ändringen som tar bort oombedd tidsplan och invalidierar dess
cache behöver pushas och verifieras på en ny Preview. Aktiv provledtråd saknar
fortfarande livebevis på exakt senaste kod med syntetiskt underlag. Ingen
Production, `main`, Supabase-data/schema, roll, kvot eller hemlighet ändrades.

## P.E.R coachkort under väntande svar — 2026-10-25

- [x] En ny liveförfrågan efter coachprompt v3 lämnade förbättringsvyn tom medan
  serveranropet väntade. Trolig och reproducerad rotorsak var en klientkapplöpning:
  `renderAll()` ersätter coachkortets DOM-nod vid navigation/synk, medan det
  väntande anropet tidigare behöll en referens till den borttagna noden.
- [x] `förbättring.html` uppdaterar nu den aktuella `#coachText`-noden efter
  varje asynkront steg. Om samma konto redan har en väntande förfrågan visas
  laddningsstatus i det nya kortet utan att starta ett andra modellanrop.
- [x] Regressionstestet i `tests/frontend/per-page-targets.test.mjs` fördröjer
  coachsvaret, lämnar och öppnar vyn igen, och verifierar svar i aktuellt kort,
  släckt laddningsindikator och exakt ett anrop.
- [x] `per-page-targets` **71/71** och `per-exam-review-handler` **72/72**;
  `explain-error-safety`, syntaxkontroll och `git diff --check` passerade.
- [!] `forbattring-flow` gav **44/46**: två äldre assertions om coachens
  hjälpttext/spärr utan data stämmer inte med nuvarande verifierade-underlag-
  beteende. De ligger utanför denna render-race och ändrades inte.
- [!] Den oberoende read-only granskaren fann inga blockerare i race-fixen.
  Ändringen har ännu inte pushats eller live-verifierats i Preview; det tidigare
  liveanropet stannade visuellt tomt på koden före fixen. Ingen ny AI-fråga,
  öppen provändring, Production-, `main`- eller databashandling gjordes.

**PILOT NOT READY.** Nästa steg är att skapa staging-Preview för race-fixen och
kontrollera coachkortet utan att starta om eller avbryta något öppet prov.

## P.E.R coach: livekontroll och säkra felmeddelanden — 2026-10-25

- [x] Race-fixen från `876286d` är pushad till feature-branchen och dess Vercel
  Preview `dpl_ECX3V5mkbDq1riiGRNddexuKNjiz` blev `READY` för exakt commit
  `876286db13a0633af52772699b89197f1cc5e118`.
- [x] En enda livekontroll i den uppdaterade coachvyn avslutades med ett tydligt
  fel och återförsöksknapp i stället för en tom laddningsruta. AI-budgetens
  senaste stagingrad var oförändrad (`$2.144983` spenderat, `$0.263628`
  reserverat av `$3.379071` cap; `$0.970460` kvar), vilket innebär att inget
  nytt modellbelopp registrerades. Inga fler liveförsök gjordes.
- [!] Exakt HTTP-fel kunde inte fastställas från den gamla klienten eftersom
  den visade samma generiska text för alla fel. Vercels runtime-loggar för
  deploymenten hade inga poster; Supabase-vyn visade ingen aktiv
  P.E.R-lease vid efterkontrollen. Detta lämnar serverorsaken till just det
  misslyckade anropet obekräftad.
- [x] Ny klientändring mappar endast kända HTTP-statusar/felkoder till korta,
  elevsäkra meddelanden. Okända fel, inklusive råa providersträngar, fortsätter
  att visas generiskt. Offlinetestet täcker både statusmeddelande och att
  godtycklig känslig feltext döljs.
- [x] Oberoende read-only granskning fann inga blockerande fel i
  felmappningen. Ändringen är ännu inte pushad eller live-verifierad.

**PILOT NOT READY.** Nästa steg är att pushdeploya felmappningen och vid behov
använda det nu säkra statusmeddelandet för att välja rätt åtgärd. Gör inget nytt
liveförsök förrän statusen och återstående stagingbudget har kontrollerats.

## P.E.R coach: senaste Preview-verifiering — 2026-10-25

- [x] Felmappningscommit `9c863b61f49e6600aa4c026e8ab6eb58bc5f27f8` är
  pushad till feature-branchen och Preview `dpl_DP1M1YXSPNbFDD7NF5p929qpBevz`
  är `READY` med branch-aliasen verifierad.
- [x] På den nya Previewn visades en rekommendation i coachkortet i stället för
  att rutan blev tom. Svaret var kopplat till verifierade historikfält och
  coachvyn gick ur laddningstillståndet.
- [!] Stagingens budgetrad var oförändrad efter kontrollen (`$2.144983`
  spenderat, `$0.263628` reserverat, `$0.970460` kvar). Därför är det inte
  verifierat om svaret kom från en redan sparad konto-/evidensbunden cache eller
  en ny modellgenerering; ingen ny AI-kostnad registrerades i budgetraden.
- [!] Den säkra felmappningen är deployad men dess statusgrenar har endast
  offline-testats. Den tidigare generiska livefelorsaken är fortfarande okänd.
  Aktiv-provsledtråd har inte live-testats på den exakta Previewn.

**PILOT NOT READY.** Den visuella coachleveransen är live-verifierad, men färsk
modellgenerering, felstatusens liveorsak och aktiv provhjälp återstår.

## P.E.R kontexttester och aktiv provhjälp — 2026-10-25

- [x] Två gamla frontendassertions uppdaterades i
  `tests/frontend/forbattring-flow.mjs`: coachvägen är avsiktligt tillgänglig
  även när lokal historik är tom, eftersom servern kan ha verifierat underlag;
  felbank och provlista förblir låsta när deras lokala data saknas. Testet
  verifierar nu denna skillnad i stället för att kräva en spärr som skulle
  hindra serverbaserad P.E.R.
- [x] `forbattring-flow` **46/46** och `per-page-targets` **73/73** passerade.
  Det senare täcker startsidans separata kontext, förbättringsvyn, konto-/sid-
  bundna coachsvar, avbrutna frågor, cachebevis och att servercoach går att nå
  utan lokal historik.
- [x] Sju riktade API-tester för aktiv provhjälp passerade: signerad
  frågekontext, svarsfri ledtråd, olika fråge-/hjälpintentioner, saknat bevis,
  konceptfrågor och fail-closed vid osäker provstatus.
- [x] Oberoende read-only review av aktivprovsvägen fann inga blockerare:
  aktivt prov ger deterministiska ledtrådar, kontrollerar frågebevis mot elev,
  prov och frågeposition, och passerar inte till OpenAI eller
  `reserve_per_chat_quota`.
- [x] En separat read-only testgranskning bekräftade att F3/F7 var föråldrade
  påståenden, inte produktfel: UI:t visar serververifierad vägledning och
  håller Felbank/Prov låsta när deras lokala underlag saknas.
- [!] Inget nytt staginganrop eller liveprov kördes. De riktade testerna är
  mock/offlinebevis och visar inte den aktuella Preview-sessionens livebeteende.

**PILOT NOT READY.** Lokala P.E.R-kontext- och aktivprovstester är nu gröna;
färsk modellgenerering och aktiv provhjälp behöver fortfarande verifieras live
med ett bekräftat syntetiskt stagingprov. Ingen öppen provstatus ändrades.

## P.E.R verifierad coach: kronologi och ren text — 2026-10-25

- [x] En enda generell P.E.R-fråga på branch-aliasens autentiserade Preview
  besvarades live med tydlig hjälp om att göra prov från egna anteckningar,
  rättning, modellsvar och felbank. Skrivskyddad budget efter svaret visade
  cap `$3.379071`, spent `$2.146696`, reserved `$0.263628`, kvar `$0.968747`.
- [!] Livecoachkortet visade en saklig tidsordningsmiss: appens senaste resultat
  var `100 %`, medan coachen kallade `0 %` senaste. Samma fem resultat fanns i
  båda vyerna i omvänd ordning. Rotorsak: serverfrågan hämtar verifierade rader
  nyast-först, men poängkonsumenterna räknar `sista minus första` som om listan
  vore äldst-först.
- [x] Stagingraden efter den enda coachförfrågan visade spent `$2.147307`,
  reserved `$0.263628`, kvar `$0.968136`. Inga fler livefrågor skickades efter
  upptäckten; inget prov eller resultat ändrades.
- [x] Kodfix: behåll de nyast-först hämtade raderna och vänd endast den
  verifierade poängserien till äldst-först. Gör ordningen explicit i coachens
  faktaunderlag och instruktion, bumpa coachrevisionen så gammal cache
  ogiltigförklaras, och normalisera Markdown i coachkortets vanliga textvisning.
- [x] Riktade offlinekontroller efter fix: `per-exam-memory-provenance`,
  `learner-context`, coachens verifierade evidens/cache-tester **2/2**,
  `per-scope-identity`, `forbattring-flow` **46/46** och
  `per-page-targets` **76/76** passerade. Syntaxkontroll och `git diff --check`
  passerade.
- [x] Oberoende read-only-granskning fann och hjälpte till att fånga Markdown-
  rubrik-, list-, citat- och länkmarkörer. Normaliseringen och regressionerna
  täcker nu färska och cacheade svar; granskaren rapporterade inga återstående
  konkreta fel i de granskade fallen.
- [!] Vid slutet av den lokala verifieringen men före nästa avsnitt var fixen
  ännu inte pushad. Aktiv provledtråd var inte live-testad; ett separat öppet
  prov lämnades orört.

## Coachfix verifierad i staging Preview — 2026-10-25

- [x] Checkpoint `7af89996177c3cba1370de0d23ec1da93c4d1bdf` pushad till den
  befintliga feature-branchen `codex/exgen-generation-quality-2026-10-20`.
- [x] Vercel Preview `dpl_HKuN5V8XTXonaKYPL9TZp3FBRb9E` nådde READY för exakt
  commit och den stabila branch-aliasen pekade på deploymenten. Ingen
  `main`/Production-deploy eller databasskrivning gjordes.
- [x] Ett syntetiskt coachsvar i den autentiserade staging-Previewn live-
  verifierade att P.E.R nu säger att resultaten stigit från `0 %` till `100 %`
  och listar de tre senaste som `92 %, 92 %, 100 %`. Det matchade sidans
  senaste `100 %` och trend `+67 p.p.`. Svaret visade ingen rå Markdown.
- [x] Skrivskyddad stagingbudget efter testet: cap `$3.379071`, spent
  `$2.147958`, reserved `$0.263628`, kvar `$0.967485`. En enda coachförfrågan
  kördes efter checkpointen; inga prov/resultat eller användarkvoter ändrades.

**PILOT NOT READY.** Resultatordning och ren text är nu verifierade live för
coachflödet på staging. Aktiv provledtråd är fortsatt inte live-verifierad;
inget öppet prov eller produktionsprov ändrades. Håll kvar ändringen på
feature-branch och gör ingen merge till `main`/Production utan separat uttryckligt
beslut.

## Coachkortets verifierade nyckeltal och aktivt P.E.R-test — 2026-10-25

- [x] På den redan inloggade staging-Previewn skapades ett syntetiskt
  Biologi 1-prov med tre frågor om fotosyntes från motsvarande underlag. Alla
  tre genererades; den granskade Calvin-cykelfrågan låg inom materialets ämne.
  P.E.R gav en ledtråd som bad eleven hitta belägg i materialet utan att ange
  svaret. UI:t höll facitsvaret låst under provet.
- [x] Användaren bekräftade att just testprovet fick avbrytas. Appen återgick
  till startsidan; inga andra prov lämnades in, avbröts eller ändrades.
- [x] Coachkortets Senaste/Trend/Fokus hämtas nu från samma autentiserade,
  verifierade resultatunderlag som serverns P.E.R-rekommendation, inte från
  obekräftad lokal `user_exams`-historik. Cachekontrollen returnerar även det
  färska serverunderlaget utan modell- eller kvotanrop.
- [x] UI:t visar laddning, avvaktande provstatus och otillgänglig historik
  separat. Saknat eller felaktigt underlag visas inte som nollresultat; en
  decimal trend avvisas i stället för att tyst rundas.
- [x] Offlinekontroller på slutdiff: `per-page-targets` **82/82**,
  `forbattring-flow` **46/46**, full `per-exam-review-handler` **72/72**;
  `node --check api/explain.js` och `git diff --check` passerade.
- [x] Oberoende read-only-review hittade en fractional-trend-valideringslucka;
  den är åtgärdad med heltalskontroll och ett regressionsfall. Övriga
  ägarskaps- och proveniensflöden bedömdes utan blockerare.
- [!] Ett prov och en P.E.R-ledtråd live-verifierades syntetiskt före
  avbrytandet. Ingen inlämning/rättning, coachmodellgenerering eller ny
  AI-förfrågan gjordes efteråt. Senaste lästa stagingbudget före testet var
  `$0.942541` kvar; den siffran är en tidigare ögonblicksbild och kan ha ändrats.
- [!] Coachkortets nya nyckeltal är ännu inte live-verifierade på den aktuella
  Previewn. De här ändringarna är lokala och ocommittade vid noteringstillfället;
  `main`, Production, databas, konto, kvot och hemligheter har inte ändrats.

**PILOT NOT READY.** Nästa steg är slutlig diffgranskning, checkpoint på den
befintliga feature-branchen och kontroll av READY Previewn. Inga fler live-AI-
anrop behövs för denna coachkortskorrigering.

### Efter checkpoint: Preview-kontroll — 2026-10-25

- [x] Commit `fcbf01db9ff01bee71b62f684919f6f7b2e33ab0` är pushad till
  `codex/exgen-generation-quality-2026-10-20`; `git ls-remote` bekräftade samma
  SHA på fjärrbranchen.
- [x] Vercel deployment `dpl_4963rUbEKEwt8U4WCGatesLRBaDc` är `READY` från
  exakt commit och använder den befintliga branch-aliasen
  `provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app`.
- [x] Read-only granskning av den öppna coachvyn på aliasen visade P.E.R:s
  sammanfattning av de tre senaste resultaten (`92 %, 92 %, 100 %`) tillsammans
  med senaste `100 %`, trend `+100 p.p.` och fokus `Biologi 1`. Nyckeltalen
  stämmer med textens trend och fokus. Ingen ny fråga skickades till modellen.
- [!] Denna synliga coachvy bekräftar sammanhanget och nyckeltalen på Previewn,
  men är inte en ny modellgenerering eller kontroll av alla möjliga användares
  historik. Ingen `main`, Production eller databasändring gjordes.

**PILOT NOT READY.** De tre P.E.R-lägena och den aktuella Previewn har kod-,
test- och liveevidens enligt avsnitten ovan. Allmän svarskvalitet kan inte
garanteras för alla frågor; skolpilot behöver fortsatt observerad användning.

## Publik P.E.R-produktguide — 2026-10-25

- [x] Den utloggade startsidan har fortfarande en fast, rate-limitad guide
  utan fri ämnes-AI. Den svarar nu mer direkt på vanliga produktfrågor om
  ExGen, provets rättning, felbanken och planval och vägleder till rätt sida.
  Priser lämnas dynamiska via prissidan; inga nya prisfakta hårdkodades.
- [x] Anonyma frågor om skolämnen/prov får fortsatt inte skickas till AI eller
  lösas av guiden. Rate limit och autentiserad elevhjälp är oförändrade.
- [x] Offline: `per-public-guide` **2/2**, anonym provfråga spärrad från AI
  **1/1**, pilotens API-scope och readiness **6/6**, `anon-per` **21/21**;
  syntax- och diffkontroll passerade.
- [x] Oberoende read-only-review fann inga blockerare och bekräftade att
  innehållet matchar aktuell produkttext samt att den anonyma vägen slutar före
  den autentiserade AI-rutten.
- [x] Kodcheckpoint `4d320761d681241ec1a3538e3d5db66520e20b04` är pushad till
  feature-branchen. Vercel deployment `dpl_31TBddeE9ErFfW6AoP4vRBnTursX` är
  `READY` från exakt SHA och behåller den befintliga branch-aliasen.
- [x] Den deployade startsidan öppnades read-only i sidpanelen; P.E.R-ingången,
  produktinnehållet och skolpilotens väg vidare visas. Ingen guidefråga
  skickades, så den nya anonyma FAQ-svarsgrenen är fortsatt offlineverifierad,
  inte live-funktionsprovad.
- [!] `main`, Production, Supabase, konton, kvoter och hemligheter är orörda.

## P.E.R rättelsevisning och frågedubbletter — 2026-10-25

- [x] Vanlig P.E.R-chatt ersätter nu ett allvarligt felaktigt svar i samma
  meddelandebubbla med den korta rättelsen. Den interna kvalitetsgranskningen
  fortsätter; självgranskningsmetadata exponeras inte i vanlig chatt.
- [x] Korrigerat svar visas/synkas först efter att den uppdaterade
  serversessionen sparats; ett misslyckat skriv får ett idempotent återförsök.
  P.E.R:s separata provläge och hint-/facitgrindar ändrades inte.
- [x] Dubblettkontrollen skyddar olika logiska strukturer och ordningskänsliga
  symboliska villkor mot att slås ihop. Omformuleringar och symmetriska
  jämförelsepar fortsätter dedupliceras. Testfixturen för aggregerad
  solver-feedback behåller nu tre skilda lärandemål.
- [x] Oberoende read-only granskning fann inga blockerare efter tester av
  klient-/serverhistorik, misslyckat historikspar och symmetriska jämförelser.
- [x] Offlineverifiering på slutdiff: P.E.R-/UI-/återställningspaket 23/23,
  provpipeline 3/6/12 och retry 59/59, aktiva prov-/P.E.R-grindar 72/72;
  P.E.R-granskarens fristående tester, syntaxkontroller och git diff --check
  passerade.
- [x] Commit 61e24430d8d63d49bc0b9f6dce775cfdcbb36ae4 är pushad till
  codex/exgen-generation-quality-2026-10-20. PR #124 är fortfarande Draft.
  Vercel Preview dpl_Do4YHdfQhZ1QRxT4Tp1u678H59RQ är READY för exakt commit
  och branch-aliasen är provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app.
- [!] Ingen live-AI-/Supabaseverifiering gjordes på exakt denna commit.
  Föregående status anger cirka $0.94 kvar under stagingtaket; det är en
  gammal budgetögonblicksbild, inte verifierad aktuell budget. Ingen elevdata
  eller öppet prov användes.
- [!] Produktionsmigrationen
  20261024212500_tighten_pipeline_integrity_bounds.sql kan avvisas om
  befintliga pipeline-rader bryter mot de nya count-gränserna. Hosted
  migrationsledger och rader verifierades inte. Ingen migration tillämpades.
  main, Production och exgen.se är oförändrade.

**PILOT NOT READY.** Nästa säkra steg är en färsk read-only stagingbudget-,
schema- och autentiseringskontroll utan AI-anrop. Liveanrop kräver bekräftad
syntetisk kontosession och uttryckligt verifierad kostnadsram; Production kräver
förkontroll av migrationsförutsättningarna och separat releasegodkännande.

## Releasekorrigeringar: kvotåterstart och P.E.R-rättelse — 2026-10-25

- [x] Reproducerat browserfel: ett definitivt HTTP 429-kvotsvar rensade den
  sparade återupptagningsjobbet men lämnade materialet i
  `exgen_pending_generation_input_v1`. Kvotgrenen rensar nu båda posterna;
  `tests/frontend/exam-pending-resume.test.mjs` passerar och bekräftar att
  omladdning inte erbjuder ett återstartbart jobb eller gör nytt AI-anrop.
- [x] Om P.E.R:s interna granskning hittar en allvarlig rättelse men båda
  rättelseskrivningarna misslyckas, skickar vanlig chatt nu en kort lokaliserad
  säkerhetsnotis i samma bubbla. Servern försöker ersätta felaktig historik med
  notisen; bakgrundsminnet uppdateras inte från den osäkra versionen.
  Självgranskningsmetadata visas inte. Prov-/facitgrindarna ändrades inte.
- [x] Offline-regressioner verifierade på aktuell lokal diff:
  provpipeline 3/6/12 och recovery 59/59; P.E.R streaming 18/18;
  P.E.R sidmål 82/82; P.E.R manifest/resultatsnitt 29/29;
  P.E.R provkontext 96/96; P.E.R browser-/kontåterhämtning 1/1;
  pending-generation-resume 1/1; misstagsträning 24/24;
  migrering/lease/kvot/rollback 34/34; bred provflödesbrowserregression
  192 godkända, 0 fel; ändrade JS-filer syntaxkontrollerade och diffkontroll
  ren.
- [x] Tre avgränsade read-only granskningar genomfördes. En påstådd lease-race
  drogs tillbaka efter verifiering av att owner-scoped claim förnyar parent
  lease till 300 sekunder medan child lease är högst 90 sekunder och HTTP-jobbet
  högst 57 sekunder. Granskningarna bekräftar att migrerings-/Productionläge
  ändå kräver hosted förkontroll.
- [x] Kodfixarna är committade som
  `84011d81fca2643b9805ba48d60f4a5b0b97ae7d` och pushade till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_3c4zRBWcQqw3rbL9N9c9y8Loo1N8` är READY från exakt den SHA; PR #124 pekar
  på samma commit och Vercel-kontrollerna passerar. PR:en är fortsatt Draft.
- [!] Denna statusnotering är en separat dokumentationsändring efter
  kodcheckpointen. Om den pushas som egen commit måste Vercel även verifieras
  för det nya exakta PR-huvudet; innehållet är i övrigt oförändrad kod.
- [!] Ingen live-AI eller hosted-databasändring gjordes. Stagingidentitet och
  aktuell budget verifierades inte. Production migrationsledger/raddata är
  fortsatt okontrollerade; ingen migration, `main` eller Production ändrades.

**PILOT NOT READY.** Nästa säkra steg är att verifiera ett syntetiskt,
autentiserat stagingflöde först när identitet och kostnadsram kan bekräftas.
Merge/deploy till exgen.se väntar dessutom på read-only förkontroll av
Production-migrationsledger och befintliga pipeline-rader, sedan separat
releasegodkännande.

## Read-only releasegrindar — 2026-10-25

- [x] Feature-branchens aktuella huvud är `7afb441fb2e2516bf5a629f1a9f31d4c850329b1`.
  PR #124 är öppen som Draft; Vercel deployment
  `dpl_HpfK8xpbBaoPX9kVGsDXAxtKLEqK` är READY från exakt SHA, branch-aliasen
  pekar på deploymenten och GitHub/Vercel-kontrollerna passerar.
- [x] Read-only Supabase metadata bekräftade stagingprojektet
  `exgen-pilot-staging` (`yhcinqejsocpmmetazpz`) och produktionsprojektet
  (`mnmotdluigzeehdjbhbu`) som ACTIVE_HEALTHY. Stagingens migrationsledger har
  motsvarande fyra senare pipeline-migrationer; produktionens ledger slutar vid
  `20261023104523` och saknar lokalt tillagda migrationer
  `20261024140557`, `20261024151433`, `20261024225011` och `20261024225017`.
- [x] Read-only aggregerad produktionspreflight för
  `mock_exam_generation_pipeline_jobs`: 1 rad totalt, 0 rader över begärda
  progress-/frågegränser och 0 aktiva jobb. Detta visar att de två nya
  count-constraints inte skulle avvisas av nuvarande rad, men ersätter inte
  full migrationsgranskning eller godkännande att tillämpa migrationer.
- [x] Färsk aggregerad stagingbudget: cap `$3.379071`, spent `$2.172902`,
  reserved `$0.263628`, kvar `$0.942541`, enabled. Ingen modellfråga skickades.
- [!] Den exakta Previewn i Codex-sidpanelen visar login gate. En befintlig
  Chrome-session på branch-aliasen visar en inloggad vy med ett öppet,
  obesvarat prov; vyn lämnades helt orörd. Därför gjordes inget live-AI-test
  och stagingkontots syntetiska identitet är inte verifierad.
- [!] Ingen produktionsmigration, `main`-merge, Production-deploy, konto-,
  kvot- eller hemlighetsändring gjordes. Denna notering är dokumentation och
  behöver en separat docs-checkpoint med exakt Preview-verifiering.

**PILOT NOT READY.** Nästa releasearbete kräver en ren staging-session utan
öppet prov samt en kostnadsram som räcker för ett enda avgränsat syntetiskt
test. Därefter kan en separat releaseprövning väga in de fyra saknade
produktionsmigrationerna; inga produktionsändringar är godkända av denna
read-only preflight.

- [x] Stagingmigrationernas faktiska versions-ID:n har nu verifierats mot
  funktions- och constraint-definitioner. Lokala filnamn och testreferenser
  använder `20261024225011` och `20261024225017`, samma versioner som stagingens
  ledger. SQL-innehållet är oförändrat; ingen migration kördes.

## Sanerad stagingtelemetri för provkvalitet — 2026-10-25

- [x] Read-only aggregate över senaste 14 dagarna, utan användar-ID:n, fråga-
  eller materialtext: av 12-frågejobb var 14 `succeeded` och 6 `failed`; de
  sex felen bestod av fyra `STAGE_RETRY_LIMIT`, ett `RETENTION_EXPIRED` och ett
  `OPERATION_DEADLINE`. För 3-frågejobb var 3 `succeeded` och 1 `failed` med
  `STAGE_RETRY_LIMIT`.
- [x] `ai_usage_events`: genereringssteg hade 157 event med 11,9 s medellatens
  och 26,0 s max; reparation hade 99 event med 13,9 s medellatens och 22,9 s
  max. Av 158 `verify_compare`-event med booleskt utfall hade 134 minst ett
  avslag och 24 inga avslag. Det är batchhändelser, inte antal frågor eller
  prov; de kan inte räknas om till en verifierad frågeacceptansgrad.
- [!] Aggregate kan inte koppla avslag till enskilda frågor, källutdrag,
  misstagsmål eller en viss generation. Kostnadsfältet var null i dessa event.
  Äldre enskild syntetisk körning med `sourceSectionCount=0` och avslag för
  källstöd är en diagnostisk ledtråd, inte belägg för att alla underlag saknar
  segmentering eller för en generell grundorsak.
- [!] Ingen modellförfrågan, kvotändring, databasändring, push eller deploy
  gjordes. Telemetrin stödjer att både kvalitetsavslag och återförsöks-/deadline-
  fel bidrar; den räcker inte för att ändra kvalitetsgrindar eller påstå att en
  viss reparationsändring löser problemet.

**Nästa steg:** behåll avvisningsgrindarna och använd feltypspecifika
reparationsspår i ett syntetiskt, versionsstyrt gold-set. Utöka aggregerad
diagnostik endast med integritetssäkra utfallskoder; gör ny liveverifiering
först efter färsk budget- och Previewkontroll.

## Feature-Preview verifierad efter kvalitetsfixar — 2026-10-25

- [x] GitHub-feature-branchen
  `codex/exgen-generation-quality-2026-10-20` pekar på commit
  `794ad2260c5ecd43910b21c179db231acb7d2716`
  (`Improve ExGen exam quality and PER context`). `main` står kvar på
  `ad60a68316a1dfaedb54a508e5b063bd1cc24bf4`.
- [x] Vercel Preview `dpl_G5S6AVuC7EwYKcsLpjY9PuhSENjg` är READY från exakt
  feature-branchens commit. Branch-aliasen pekar på deploymenten. En ny
  direkt-URL visar den avsedda skolpilotens inloggningsgrind; en befintlig
  inloggad branch-aliasflik har session, men inget AI-flöde kördes och inget
  befintligt prov ändrades.
- [x] Färsk, skrivskyddad stagingbudget kl. 12:24 UTC: cap `$3.379071`, spent
  `$2.172902`, reserved `$0.263628`, kvar `$0.942541`, enabled. Ingen
  modellförfrågan skickades; kvarvarande belopp räcker inte som verifierad
  kostnadsram för ett meningsfullt prov-/P.E.R.-test.
- [x] Bekräftat lokalt efter push: arbetskatalogen ren, feature-ref på
  `794ad2260c5ecd43910b21c179db231acb7d2716`, `main` oförändrad. Inga
  databasskrivningar, produktionsåtgärder, kontoförändringar eller
  kvotändringar gjordes.

**PILOT NOT READY.** Koden är publicerad i feature-Preview och offlinekontroller
är godkända, men ny modellbaserad semantisk kvalitet är inte liveverifierad.
Nästa steg är först en ny kostnadsram eller återställd budget, därefter ett
enda avgränsat syntetiskt stagingflöde med bekräftad autentiserad session.

## Verifierarens källbelägg vid felträning — 2026-10-25

- [x] Bekräftad kodrotorsak: servern återskapar `sourceEvidence` från elevens
  signerade, ägda och verifierat rättade prov. `verifyQuestions` mappade sedan
  dessa citat till `training_focus.source_evidence`, men dess egen
  `reviewInputWithinLimits`-allowlist avvisade fältet före granskaranropet som
  `invalid_review_input`. Därmed kunde en källbelagd felträning stoppas innan
  den oberoende granskaren fick bedöma om kandidaten tränade rätt misstag.
- [x] Allowlisten accepterar nu endast detta explicita källfält och validerar
  högst tre icke-tomma strängar om högst 500 tecken vardera. Övriga tillåtna
  fält, totalgränser, verifierartrösklar och utfärdandegrindar är oförändrade.
- [x] Gold-regressionen låter en strukturellt giltig och materialgrundad fråga
  som tränar fel del av en linjär funktion nå den riktiga verifierarparsern.
  Ett syntetiskt omdöme som saknar specifik felmatchning blockeras av befintlig
  godkännandegrind. Separata kontrakttester verifierar payloadfältet och
  avslag på mer än tre, tomma, feltypade eller över 500 tecken långa citat.
- [x] Riktade offline-tester passerade: quality-gold, verifier-output-contract,
  mistake-training-context, mistake-training-source **17/17**, riktade
  3/6/12/misstagspipelinetester **6/6**, HTTP-pipeline **2/2** och
  `git diff --check`.
- [!] Detta bekräftar en verklig kodvägsdefekt i verifierarindata, inte att den
  ensamt förklarar alla irrelevanta frågor eller alla misslyckade prov.
  Verifierartestet använder syntetiska svar; ingen live-modellkvalitet,
  stagingförfrågan eller faktisk elevupplevelse har verifierats efter fixen.
  Lokala ändringar är ocommittade och finns inte i Production `ad60a683` eller
  senaste kontrollerade Preview `590ac554`.

**Nästa steg:** gör färsk stagingkopplings- och budgetkontroll före högst ett
syntetiskt felträningsprov, först när autentiserad testdata kan verifieras utan
att röra befintliga prov. Separera därefter utfallet från offlinebevisen.

## Verifierarens exakta källmedlemskap och slutlig offlinekontroll — 2026-10-25

- [x] Förstärkt preflighten för `training_focus.source_evidence`: varje begränsat
  utdrag måste nu återfinnas i samma, avklippta `source_material` som faktiskt
  skickas till den oberoende granskaren. Saknade eller föråldrade utdrag stoppas
  före provideranrop; NFKC-/whitespace-normalisering tillåts och delträff inuti
  ett större ord räknas inte som belägg. Gransknings- och utfärdandetrösklarna
  har inte sänkts.
- [x] Regressioner täcker saknat/stale utdrag, exakt 500-teckensgräns,
  NFKC/whitespace, ordgräns, feltypade/tomma utdrag och UTF-16-gränser med
  emoji. Existerande fixtures korrigerades där de påstod källbelägg som inte
  fanns i testmaterialet.
- [x] Offlineverifiering denna session: verifier-output-contract, quality-gold,
  exam-generation-pipeline-http **2/2**, exam-generation-pipeline **28/28**,
  per-exam-review-handler **76/76**, per-page-targets **87/87**,
  per-manifest **31/31**, mistake-training-source **17/17**,
  mistake-training-context, per-context-pack och per-sales-data-minimization
  **4/4** passerade. `git diff --check` passerade vid kontrollen.
- [x] HTTP/PGlite-testet innehåller nu en syntetisk end-to-end-felträningsväg:
  signerad ägarbunden provkälla + verifierat underkänt svar → serverresolver →
  persistent pipelinejobb → riktig intern generator med syntetiska provider-
  svar över återupptagna batchar → oberoende verifierarkontrakt → verifierad
  checkpoint → exakt 12/12 utfärdade frågor och en kvotförbrukning. Testet
  observerar minst ett mellanliggande `202` före slutförandet.
- [x] Negativ kontrast i samma harness: den syntetiska oberoende granskaren
  nekar fokusmatchningen tills jobbet når terminalt fel. Inget prov utfärdas,
  inga kandidater når accepterad checkpoint, reservationen återbetalas och
  elevens kvot återgår till baslinjen.
- [!] Detta är test med syntetiska modeller/svar, inte en live-kontroll av
  modellernas semantiska relevans, staging, pilotanvändning eller
  produktionsupplevelse. Testets syntetiska granskare lämnar förutbestämda
  positiva omdömen; testet bevisar käll-/kontextflöde och oförsvagade
  godkännandekontrakt, inte att en verklig modell tränar rätt misstag.
  Aktuell Preview-branchkoppling och budget har nu verifierats read-only,
  men inga live-AI-anrop, pushar eller deployer gjordes.
- [x] Färsk fjärrkontroll: GitHub `main` och Vercels READY Production pekar på
  `ad60a683` (`dpl_5jhXXmoq94bp3gqyPwtJvLgEycd1`). Den befintliga
  feature-branchen och dess READY Preview pekar på `590ac554`
  (`dpl_4XzKHLY7Wb5k8JAkUWPt6Jwi3QSr`). De 15 lokalt ändrade filerna i denna
  arbetsgren finns inte i någon av dessa deployer.
- [x] Vercel Preview-miljövariabler kontrollerades utan att läsa hemliga
  värden. De tio förväntade stagingvariablerna är branch-scope:ade till
  `codex/exgen-generation-quality-2026-10-20`. Supabase staging
  `yhcinqejsocpmmetazpz` rapporterade `ACTIVE_HEALTHY`.
- [x] Stagingens read-only-budgetkontroll: tak `$3.379071`, spenderat
  `$2.172902`, reserverat `$0.263628`, återstående `$0.942541`. Inga AI-anrop
  gjordes; denna restbudget är inte tillräcklig grund för ett större liveprov.
- [x] Ett oavsiktligt tomt Vercel-projekt, `provia-ai-live-ad60`, skapades under
  CLI-inspektion. Det saknade deployment och miljövariabler och togs bort efter
  användarens uttryckliga godkännande; därefter verifierades att projektet inte
  längre fanns. Inga andra Vercel-projekt ändrades.

**Nästa steg:** granska den lokala diffen och efter separat uttryckligt
godkännande publicera en avgränsad feature-Preview. Gör inte liveprov förrän
stagingbudgeten räcker och kan verifieras på nytt. Behåll produktion, `main`
och produktionsdatabas orörda tills separat releasebeslut.

### Uppföljning 2026-10-25

- [x] Färsk riktad omkörning på arbetsgrenen: 115 Node-tester passerade, 0
  misslyckades. Den omfattade provpipeline, HTTP/PGlite, P.E.R API, verifierar,
  offline kvalitets-eval, frontend-kontext, sidmål och dataminimering.
- [x] Oberoende provkvalitetsgranskning bekräftade täckning för 3/6/12,
  reparation, retry, timeout, ofullständiga resultat och verifierad
  felträning. Den betonade att verklig semantisk modellprecision inte bevisas
  av mockade providers.
- [x] Oberoende säkerhets-/P.E.R.-granskning fann ingen blockerande regression
  i dataminimering, kvot-/leaseflöde, verifierad efterrättning eller spärr mot
  facit under aktivt prov. Granskningen bekräftade att kvalitetsgrindarna inte
  försvagats. Ingen livebeteendeverifiering gjordes.
- [!] De fyra P.E.R.-sidkontexterna har tester i API-/frontend-sviterna, men
  aktuell modellkvalitet och svarstid är ännu inte mätta mot verkliga
  modellutdata. Detta kräver en avgränsad staging-Preview som innehåller de
  lokala ändringarna och ett budgetgodkänt syntetiskt test.
- [x] Aktuell Git-kontroll: lokal `HEAD` och GitHub `main` är `ad60a683`;
  feature-branchen är `590ac554`. De 15 ändrade arbetsfilerna är lokala och
  ocommittade. Vercel Production följer `main`; feature-Preview följer den
  gamla feature-commiten. Ingen releaseåtgärd utfördes.
- [x] Ytterligare aktuell validering: `npm run a11y-audit` rapporterade 0
  tillgänglighetsöverträdelser och 0 konsolfel på granskade sidor, inklusive
  app, startsida och förbättringssida. `npm run xeliov:context:test` passerade
  4/4 tester, inklusive sekretessredigering och urval av verifierade lärdomar.
- [x] Read-only releasekontroll upprepad: Vercel Production READY kör fortfarande
  `ad60a683`; feature-Preview READY kör fortfarande `590ac554`. Stagingens
  enda budgetrad är aktiverad: tak `$3.379071`, spenderat `$2.172902`,
  reserverat `$0.263628`, kvar `$0.942541`. Inga modellanrop gjordes.

## Stagingfel för 12 naturvetenskapliga kortsvar och källankare — 2026-10-25

- [x] En livekontroll på staging använde syntetiskt Biologi 1-material och
  begärde 12 kortsvarsfrågor på A-nivå. Inget prov utfärdades: resultatet var
  uttryckligen `0 av 12`, och appen bad om mer relevant material eller snävare
  ämne. Kvalitetsgrinden fungerade fail-closed.
- [x] Sanerad Preview-telemetri för körningen visar att första 7 kandidaterna
  föll strukturellt på `source_answer_not_extractable`. En senare reparations-
  batch producerade 8 kandidater; 5 passerade strukturen men samtliga 5
  avvisades av den oberoende granskaren, främst för `source_support`, samt
  vissa utfall för nivå, fakta och bedömningskvalitet. Jobbet avslutades med
  `STAGE_RETRY_LIMIT`. Råfrågor, material, konton och elevinnehåll lästes inte.
- [x] Kodfixen lägger nu till ett begränsat urval av ordagranna svarankare från
  naturvetenskapligt material för kortsvar och blandade prov. Urvalet täcker
  hela materialet, bevarar källans radbrytningar och hanterar decimaler,
  förkortningar samt ofullständiga punktlistor. Reparation får samma
  ämnesspecifika instruktioner. A-nivå får inte etiketteras som analys om
  källan bara stöder återgivning.
- [x] Ingen strukturell kontroll, oberoende verifiering, godkännandetröskel,
  minsta leveransgräns eller kvotregel ändrades. Saknas tillräckligt källstöd
  ska provet fortsatt avvisas i stället för att fyllas med irrelevanta frågor.
- [x] Slutlig offlinekontroll efter ändringen: riktad prov/offline-quality
  **2/2**, relevant API-/HTTP-/P.E.R-/frontendsvit **115/115**,
  `node --check` för ändrade JavaScript-filer och `git diff --check` passerade.
  Oberoende read-only-granskning fann inga blockerare efter korrigering av
  meningssegmenteringen.
- [x] Commit `acdb5ae576355aaf2b3689c2e9c87107cc853be8` är pushad till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_C34aTHApQtKQ9brFvrY2YSaDD1oy` blev READY från exakt den SHA:n och
  branch-aliasen pekar på den. Ingen `main`, Production eller databas ändrades.
- [!] Den nya koden är ännu inte live-modellverifierad. Senaste lästa
  stagingbudget efter föregående test var `$0.941435` kvar under den
  branch-scope:ade gränsen; ingen ytterligare modellförfrågan gjordes.
  GitHub `main` står kvar på `ad60a683`, och Vercel Production READY kör
  fortsatt exakt den SHA:n.
- [x] Separat P.E.R-kontroll på startsidan fick ett relevant svar från
  `gpt-6-luna` på cirka 2,8 sekunder. Detta verifierar bara den generella
  startsidesfrågan, inte alla P.E.R-lägen.

**PILOT NOT READY.** Den nya prompt-/ankarförbättringen finns i feature-Preview,
men behöver en enda ny syntetisk körning när en färskt verifierad stagingbudget
räcker. Den tidigare körningen ska fortsatt redovisas som misslyckad 0/12;
offlinepass bevisar inte modellens framtida 12/12-resultat.

### Ny stagingpreflight — 2026-10-25

- [x] Aktuell Vercel Preview är READY från branchens dokumentationscheckpoint
  `9adeb87`; koden är från `acdb5ae`. De 10 nödvändiga stagingvariablernas
  namn är Preview-scope:ade till `codex/exgen-generation-quality-2026-10-20`;
  värdena förblev krypterade och olästa.
- [x] Skrivskyddad stagingbudgetkontroll: en budgetrad, cap `$3.379071`, spent
  `$2.223469`, reserved `$0.263628`, kvar `$0.891974`, enabled. Detta är en
  tidsbunden avläsning, inte ett nytt kostnadsgodkännande.
- [!] Den återanvända inloggade Previewn visar fortsatt det syntetiska
  genereringsförsökets `0/12`-fel och en icke-tom felbank. Eftersom historiken
  inte kan verifieras som syntetisk lämnades den orörd och inget nytt AI- eller
  provanrop gjordes.
- [x] `main` står kvar på `ad60a683`; Vercel Production READY fortsätter från
  samma SHA. Ingen staging-/produktionsdatabas, konto, kvot eller hemlighet
  ändrades.

**Nästa säkra steg:** använd en stagingidentitet vars testdata verifierats som
syntetisk, eller invänta ett godkänt separat stagingkonto. Kör därefter högst
ett 12-frågetest efter ny budgetkontroll. Fortsätt inte genom att återanvända
den befintliga felbanken eller skapa upprepade ofullständiga prov.

### Uppföljning: återanvändning av källankare — 2026-10-25

- [x] Oberoende granskning identifierade att kravet på ett "ännu oanvänt"
  ankare i första prompten i praktiken begränsade faktakortsvar till högst en
  fråga per källmening. Prompten tillåter nu samma exakta mening för ett annat
  tydligt avgränsat, uttryckligen stött svarsmål; parafraser och upprepningar
  förbjuds fortsatt.
- [x] Reparationsprompten fick samma avgränsade regel. Strukturell
  källextraktion, oberoende faktagranskning, poänggranskning, dubblettgrind,
  A-nivåns krav på underbyggt resonemang och kvotflöde är oförändrade.
- [x] Offline-regressionerna täcker återanvändning av en exakt mening för två
  olika svarsmål samt att en granskad dubblett fortsatt nekas.
- [x] Slutlig riktad svit efter ändringen: 2/2 testscripts; den breda
  provgenererings-/P.E.R.-sviten före det sista testtillägget passerade 203/203.
  Oberoende granskare fann inga blockerande fynd i promptändringen.
- [!] Ändringen är inte live-modellverifierad. Stagingbudgetens senaste
  skrivskyddade avläsning är fortsatt `$0.891974` kvar. Den återanvända
  sessionen visar en felbank och ett misslyckat 0/12-försök; eftersom dess
  historik inte kan verifieras som helt syntetisk lämnades den orörd och inget
  nytt modell-/provanrop gjordes.

**Nästa steg:** verifiera en ren, enbart syntetisk stagingidentitet innan ett
enda 12-frågetest. Offline- och mocktester bevisar inte live-modellens
12/12-prestanda.

### Uppföljning: svarutdrag och källbetydelse — 2026-10-25

- [x] Naturvetenskapliga faktakortsvar kan nu använda sitt eget korta,
  sammanhängande ordagranna svarutdrag när en källmening stöder flera skilda
  mål. Svaret instrueras att behålla nödvändiga villkor, negationer, enheter
  och orsakssamband; om kortningen tappar betydelse ska mer av meningen vara
  kvar. Källhänvisningen ska visa hela relevanta meningssammanhanget.
- [x] Den korta svarutdragsregeln är begränsad till naturvetenskap. Övriga
  ämnen behåller instruktionen om hela ordagranna källmeningar och korta
  källhänvisningar.
- [x] Oberoende granskaren instrueras uttryckligen att avvisa en ordagrann
  delsträng om borttagen negation, begränsning, villkor, enhet eller
  orsakssamband ändrar innebörden. En syntetisk regression visar att en sådan
  kandidat kan passera den rent strukturella substringkontrollen men avvisas
  av oberoende verifiering; godkännandegrindarna är oförändrade.
- [x] Offlinekontroller: syntax för fyra ändrade JavaScript-filer;
  exam-pipeline offline, quality-gold, verifier-beslut,
  verifier-output-contract och resumable-pipeline-testfiler passerade;
  `git diff --check` passerade.
- [!] Mockade verifierarutdata testar kodens avvisningsflöde, inte att en live
  modell alltid upptäcker varje semantisk qualifierförlust. Ingen live-AI,
  Supabase, databas, konto, kvot, `main` eller Production användes.

### Uppföljning: reparationsprompt på svenska — 2026-10-25

- [x] Slutgranskning fann att en äldre svensk reparationsinstruktion fortfarande
  krävde kortaste möjliga svarutdrag generellt, trots den ämnesspecifika regeln.
  Reparationsprompten använder nu samma villkorade svar- och källreferensregler
  som första genereringen: korta naturvetenskapliga svar endast när de behåller
  betydelsen; fullständiga källmeningar för övriga ämnen.
- [x] Regressionen kontrollerar att vanliga ämnen behåller hela källmeningar och
  inte får en “kortaste utdrag”-regel; naturvetenskaplig reparation behåller
  villkor, negationer, enheter och orsakssamband. Inga kvalitetsgrindar ändrades.
- [x] Oberoende slutgranskning: inga kvarvarande promptkonflikter eller
  försvagade kvalitetsgrindar hittades.

### Uppföljning: P.E.R felbankskontext — 2026-10-25

- [x] P.E.R får nu upp till tre markerade fel med fråga, elevsvar, feedback,
  modellsvar, ämne och poäng när eleven befinner sig i felbanken. Kontexten
  följer urvalsordningen och aktuellt kursfilter. Startsidan, andra
  förbättringssektioner och aktivt prov får inte denna lokala felkontext.
- [x] Servern begränsar och sanerar fälten, tar bort identifierare och märker
  dem uttryckligen som obetrodd, potentiellt gammal klientdata i både vanlig
  studie- och supportprompt. Promptens svarsspärrar och provgrindar ändras inte.
- [x] P.E.R avbryter nu ett pågående svar om någon promptrelevant del av det
  markerade felet ändras. Felbanken filtrerar också bort obesvarade eller
  tomma svar som annars hade presenterats som träningsbara fel.
- [x] Oberoende read-only-granskning fann först kurs-/urvalskantfall; de
  korrigerades och ett regressionstest bekräftar att synligt kursval inte
  trängs undan av dolda markeringar. Slutgranskning fann inga blockerare.
- [x] Offlineverifiering: `per-manifest` 34/34,
  `forbattring-behaviour` 32/32, `per-page-targets` 90/90 och
  `per-context-pack` passerade. Ändrade JavaScript-filer och de tre inline-
  skripten i förbättringssidan passerade syntaxkontroll; `git diff --check`
  passerade.
- [!] Ingen live-AI-fråga eller användardata användes. Stagingfunktionalitet
  är inte liveverifierad.
- [x] Kodcheckpoint `66bc7c2716f98e3941fd1069f5d1cc24a66a271a` är pushad till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_6e4jdBBNjyFS9M8KS8Qbrm6XVsHj` är READY från exakt den committen;
  `app.html` och `förbättring.html` svarar HTTP 200.
- [x] Ingen ändring av `main`, Production eller databas gjordes.

### P.E.R och kvalitetskontroll: uppföljning — 2026-10-25

- [x] På aktuell Preview för branch `codex/exgen-generation-quality-2026-10-20`
  (`4697a95`, dokumentationscheckpoint; applikationskod `66bc7c2`) skickades
  exakt en syntetisk allmän fråga via P.E.R på startsidan. Svaret förklarade
  konkret hur eleven tränar på egna biologianteckningar och hänvisade till
  Mockprov med kurs, nivå, frågetyp, rättning och modellsvar. Inget prov skapades.
- [!] Detta verifierar ett enda startsideanrop, inte modellens stabilitet eller
  P.E.R:s aktiva-prov-, efterrättnings- eller förbättringsläge. Frågetexten var
  syntetisk; ingen verifiering gjordes av en inloggad elevidentitet.
- [x] Read-only budget före/efter: cap `$3.379071`; spent `$2.223469` →
  `$2.225114`; reserved `$0.263628`; remaining `$0.891974` → `$0.890329`.
  Skillnaden är `$0.001645`, men kan inte säkert attribueras enbart till detta
  anrop. Inga kvoter eller budgetinställningar ändrades.
- [x] Offline: provpipeline-/recovery-/quality-gold-sviten avslutades med kod
  0. Fem P.E.R frontend-/kontextsviter avslutades med kod 0; de rapporterade
  bland annat 96 aktiva-provkontextfall, 90 sidmålsfall och 32
  förbättringsbeteendefall. Riktad P.E.R API-regression för fyra kontexter
  passerade 4/4 med `--test-timeout=90000`.
- [x] En första API-körning med en påtvingad 30-sekundersgräns avbröt ett
  långsamt test som tar cirka 42 sekunder. Resultatsidans test fick därefter
  en tillfällig falsk assertion när den avbrutna körningen fortfarande städade.
  Isolerat och i den slutliga sekventiella körningen passerade det. Ingen
  produktionsdefekt bekräftades. Oberoende granskare körde dessutom valda mock-
  tester (API 12/12, kvot/strömning 19/19 och kontextpaket 1/1); dessa är inte
  livebevis.
- [!] Granskningen fann inga blockerande facit-, ägarskaps- eller
  sidavgränsningsfel. Kvarstående risker: felbankstext är fortfarande
  modellinput trots avgränsning som obetrodd data, och en ny klientbegäran
  efter ett förlorat P.E.R-svar får ett nytt request-ID och kan ge ett nytt
  modell-anrop.
- [!] Ingen liveprovsgenerering kördes. Staging har `$0.890329` kvar enligt
  senaste read-only-kontroll, men aktuell syntetisk inloggad testidentitet är
  inte fastställd. Inga användardata, prov, konton, kvoter, hemligheter,
  produktionsresurser eller databasscheman ändrades.

### Kvalitetsmålet: verifiering efter Preview-push — 2026-10-25

- [x] Commit `4442f085e8c2eebca9593c59d0954e9605339ef4` innehåller endast
  denna statusdokumentation och är pushad till feature-branchen. Vercel Preview
  `dpl_4mwaSCfbmRyqB6nbzSMEZHVHWXfD` är READY från exakt den committen;
  applikationskoden är `66bc7c2716f98e3941fd1069f5d1cc24a66a271a`.
- [x] Read-only Vercel-kontroll: Production är READY på `main` commit
  `ad60a68316a1dfaedb54a508e5b063bd1cc24bf4` (merge av PR #124). Den aktuella
  feature-Previewn och Production är alltså inte samma deployment/källrevision;
  inga Promotion-, merge- eller produktionsåtgärder gjordes.
- [x] Ny offline-regression på applikationskoden: pipeline 3/6/12, HTTP/retry/
  partial delivery, verifierad felträning, quality-gold och P.E.R frontend-
  kontext (`per-context-pack`, `per-page-targets`, `per-exam-context`) passerade.
  Node summerade 51 tester utan fel; de egna kontextskripten rapporterade
  96/96 provkontext- och 90/90 sidmålskontroller.
- [x] Riktad P.E.R API-regression för aktivt prov, vanlig hjälp efter oavslutat
  prov, verifierad coachhistorik och resultatsidans kontext passerade 4/4.
  Syntaxkontroll för `generate-exam.js`, `_verifier.js` och
  `_exam-generation-pipeline.cjs` passerade.
- [!] Oberoende granskning fann inga nya blockerande käll-/fokusgrindar. Den
  bekräftar att delprov kan levereras när deadline nås efter en uttrycklig
  miniminivå; sådana svar är markerade och får inte kallas fullständiga. Live-
  modellens relevans och fulla frågeantal på nuvarande revision är fortfarande
  oprövade. P.E.R-risker som kräver separat bedömning: prompt-injektion via
  markerat felinnehåll och nytt modellanrop vid en ny klientbegäran efter
  förlorat svar.
- [!] Fresh read-only stagingbudget står kvar på cap `$3.379071`, spent
  `$2.225114`, reserved `$0.263628`, remaining `$0.890329` (`2026-10-25
  19:35:40 UTC`). Den öppna inloggade Preview-sessionen visar befintlig
  provhistorik; identiteten är inte verifierad som syntetisk. Inga liveprov
  eller ytterligare betalda AI-anrop gjordes, och ingen existerande provdata
  användes eller ändrades.
- [!] Målet är inte klart: stagingverifiering av 3/6/12-frågegenerering,
  verifierade misstag och P.E.R:s fyra sidlägen saknas på en bekräftat syntetisk
  identitet. `main`, Production, Supabase och konton lämnades orörda.

### Livekontroll och P.E.R-återförsök — 2026-10-25

- [x] På den inloggade staging-Previewn skapades ett syntetiskt Biologi 1-prov
  med tre frågor från syntetiskt material om fotosyntes/cellandning. Alla 3/3
  frågor visades, besvarades och rättades; resultatet var 6/6. P.E.R gav en
  ledtråd under aktivt prov utan att visa facit.
- [!] Frågorna var relevanta för materialets ämne, men svaga för begärd A-nivå:
  de var mest redogörande/förklarande trots märkningen `analysera`. Detta är en
  konkret generator-/granskningslucka att åtgärda separat; observationen bevisar
  inte att det visade 2/2-resultatet var fel enligt den aktuella rättningsrubriken.
- [x] Efter rättning gav ett P.E.R-anrop tillfälligt status-/leasefel. Källspår
  visade att en återförsökbar fråga kunde tappa sitt signerade efterrättningsbevis
  på klientsidan. Återförsöket bevarar nu beviset, medan serverns verifiering
  och aktiva provets facitfria grind är oförändrade. "Rensa" tar även bort det
  återställda beviset så att en identisk ny fråga inte återanvänder gammal kontext.
- [x] Offline-regression `tests/frontend/per-exam-context.test.mjs` passerade
  99/99, inklusive statusfel → retry med samma signerade bevis och rensa →
  identisk ny fråga utan gammalt bevis. Syntax- och diffkontroller passerade.
- [!] Ingen ny betald AI-förfrågan gjordes efter denna verifiering. Liveprovet
  visar en lyckad 3-frågekörning, inte tillförlitlig 6/12-generering eller att
  P.E.R:s efterrättningsretry nu lyckas efter att status-/leasefelet återhämtat
  sig. Budgeten ska läsas om innan eventuella fler AI-anrop.

### A-nivågrind och P.E.R återförsök — 2026-10-25

- [x] A-nivåns oberoende frågegranskning kräver nu strukturerad evidens:
  ordagranna utdrag ur frågan och bedömningsrubriken, minst två olika
  källcitat kopplade till både fråge- och svarsstöd, samt en stödd högre
  resonemangsoperation och rubrik-/slutsatssignaler. Befintliga kvalitetsmått
  och trösklar är oförändrade; övriga nivåer får inte det extra fältet.
- [!] Citatindex och textsignaler kan inte avgöra om parafraserade citat
  verkligen uttrycker olika fakta eller om en fråga semantiskt kräver A-nivå.
  Den oberoende granskarens ämnesbedömning är fortfarande nödvändig. Testerna
  använder mockade granskarutdata och är inte livebevis på modellens precision.
- [x] P.E.R:s signerade efterrättningsbevis binds nu till samma konto, fråga,
  sida och relevanta P.E.R-kontext samt högst 15 minuters återställningstid.
  Minnesrensning tar bort bevis även i vanliga appen. Pilotens förväntade
  övergång `startsida` → `app` efter återinloggning tillåts, men konto- och
  kontextkontroller behålls. Vid kontextbyte förklarar UI:t att frågan skickas
  som vanlig hjälp eller att resultatet behöver öppnas igen.
- [x] Riktade offlinekontroller passerade: verifierarens output-kontrakt,
  verifierarbeslut, provpipeline 28/28, P.E.R-kontext 102/102, pilotens
  återinloggning 1/1, quality-gold, syntaxkontroller och `git diff --check`.
- [!] En lyckad efterrättningsförklaring observerades tidigare på Preview
  `e6afb73`, före dessa ändringar. Ingen live-AI-kontroll av ny A-nivågrind eller
  denna uppdaterade återförsökskod har gjorts; det senast kända stagingvärdet
  `$0.839398` var avläst före den föregående liveförfrågan och lästes inte om
  efteråt. Inga ytterligare betalda anrop, databasskrivningar eller
  produktionsändringar gjordes.
- [x] Kodcheckpoint `bd558b7b0d54ddcafc88aa3701a6751f697bb2c0` är pushad till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_6jWACaLwi4T9vzyvifi9Ta3iNqSm` är `READY` från exakt SHA och har aliaset
  `provia-ai-git-codex-exgen-gener-b3c147-eltons-projects-4adfb1a3.vercel.app`.
- [!] Preview-hostnamnet returnerar Vercel SSO-omdirigering för anonyma
  förfrågningar. Deployment och commit är verifierade, men ingen ny
  autentiserad app- eller modellkontroll har gjorts.
- [!] Nästa steg: testa syntetiska 3/6/12-frågeprov på Preview endast efter en
  ny skrivskyddad budgetkontroll och bekräftad syntetisk testidentitet.

### A-nivågrind och P.E.R-utkast — fortsatt kvalitetssäkring 2026-10-25

- [x] Oberoende review av `f5e3c0f` reproducerade att A-grinden kunde godkänna
  en återgivningsfråga när granskaren felaktigt hävdade att negaterat resonemang
  var ett krav. `api/_verifier.js` kräver nu konkreta uppgiftsverb i stället för
  ämnesord som "samband" eller "orsak", och kontrollerar att resonemang och
  slutsats efterfrågas och belönas. Negationer, förbud och kontrastformer är
  adversarialt regressionstestade; slutlig avgränsad verifierargranskning fann
  inga blockerare. Heuristiken kan inte bevisa semantisk A-nivå på egen hand.
- [x] `shared.js` rensar ett avbrutet P.E.R-utkast när inloggad användare eller
  aktuell sida inte matchar utkastet, och rensar ogiltiga eller äldre än
  15 minuter utkast. Om ingen användarsession är tillgänglig ligger utkastet
  kvar dolt så samma elev kan återhämta det efter inloggning.
- [x] Riktade offlinekontroller: provpipeline 28/28, HTTP-återupptagbar
  3/6/12-pipeline 2/2, P.E.R-sidtester 90/90, P.E.R-provsammanhang 102/102,
  verifierarbeslut, A-nivåns outputkontrakt, quality-gold, syntax och
  `git diff --check` passerade.
- [!] A-nivåns verifierutdata är syntetiskt mockade i dessa regressioner. De
  visar att deterministiska grindar stoppar konkreta motsägelser, inte att
  produktionsmodellen alltid tolkar uppgiftens semantik korrekt.
- [!] Utan extern livekontroll kvarstår tidigare noterad lucka: provmekanik och
  felbankens provenance är testade, men semantisk relevans hos verkligt
  genererade frågor är inte bevisad av offline-testerna.
- [x] `shared.js`-ändringen är oberoende granskad utan blockerande fynd. Den
  först noterade testluckan för 15-minutersgränsen täcks i avsnittet nedan.
- [x] Kodcheckpoint `e1a64fabd4f403dda7578a1fded0ca025ba3a440` är pushad till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_DwH5xFHup1XPP6yMfuWaAe68gDzr` blev `READY` från exakt SHA med URL
  `https://provia-mno8zy0ep-eltons-projects-4adfb1a3.vercel.app`.
- [!] Deployment is verified, but no authenticated app/session or live-model
  check was performed. No Production, `main`, or database change was made.

### Granskningsfynd efter Preview-checkpointen — 2026-10-25

- [x] Oberoende adversarial granskning fann att jämförelsefrågor formulerade
  som "vilka skillnader finns" eller "how do ... differ" inte uppfyllde
  A-nivåns verbgrind. `api/_verifier.js` känner nu igen dessa vanliga svenska
  och engelska jämförelseverb/-fraser. Positiva regressionstester lades till;
  befintliga negationsfall förblir underkända.
- [x] Oberoende P.E.R-granskning fann att `savedAt` som saknas eller inte är
  numerisk ger åldern `NaN`, vilken kunde passera `< 0`/`> 15 min`-kontrollerna.
  `shared.js` kräver nu en ändlig numerisk tidsstämpel. Testerna täcker exakt
  15 minuter, strax över gränsen, framtida tid, saknad och ogiltig tidsstämpel.
- [x] Uppdaterat riktat testresultat: A-nivåns outputkontrakt och
  verifierarbeslut passerar; P.E.R-sidtester 95/95; provkontext 102/102.
  Provpipeline och HTTP-flöden 30/30; felträningskälla, proveniens, kontext
  och urvalsidentitet passerar sammantaget 55/55 i riktade testfiler.
- [x] Kodcheckpoint `b0653206e5de5305d33a15b31055178e9acc98db` är pushad till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_H7BGL1HV3kS7m1vaRWm1wTsk9m8A` är `READY` från exakt SHA med URL
  `https://provia-dokqtib67-eltons-projects-4adfb1a3.vercel.app`.
- [!] Deployment och commit är verifierade; inget autentiserat app-/live-AI-test
  gjordes. Previewn ovan ersätter den tidigare kodcheckpointen `e1a64fa`.
- [!] Fortsatt kvarstår att mockade tester inte bevisar verklig modellsemantik
  eller relevans hos AI-genererade frågor. Liveverifiering kräver först färsk
  kontroll av rätt stagingmiljö, syntetisk identitet och budget.

### A-nivåns språk- och bedömningssignaler — 2026-10-25

- [x] Oberoende granskning reproducerade att vanliga giltiga uppgiftsfraser
  ("discuss how", "what conclusion can we draw", "to what extent" och
  "integrate") kunde underkännas trots källstöd. Verifieraren känner nu igen
  dessa som uttryck för respektive högre resonemangsoperation.
- [x] A-nivåns rubrikbevis måste nu uttryckligen stödja den deklarerade
  operationen. Generiska resonemangs-/slutsatsord ersätter inte en operation
  som rubriken säger är valfri, onödig, utesluten, utelämnad eller inte
  poängsatt. Negerade och alternativa uppgiftsfraser fortsätter att stänga
  grinden.
- [x] Regressioner täcker engelska och svenska jämförelsefraser, fem vanliga
  positiva operationer, negationer/alternativ samt optional/unnecessary,
  shouldn't/mustn't/can't, waived/excluded/skipped och saknade poäng för
  operationen.
- [x] Oberoende read-only adversarial review fann inga blockerare i de senast
  kontrollerade disclaimer-formerna. Offlinekontroller passerade:
  verifierar-output-kontrakt, verifierarbeslut, quality-gold och
  prov-/felträningsflöden 55/55. `per-page-targets` 95/95 och
  `per-exam-context` 102/102 passerade tidigare i samma QA-omgång.
- [!] `tests/per/per-brain.test.mjs` har en separat befintlig inkonsistens:
  genererad modulgraf har 73 kanter medan källan har 75. Denna ändring berör
  inte grafkällor eller genererad fil; felet lämnas utanför checkpointen.
- [!] Alla granskningar och modellstubbar är offlinebevis. Ingen autentiserad
  live-Preview eller AI-generering har verifierats i detta steg; senaste
  Preview-sessionen visar fortfarande skolpilotens inloggningsgrind.
- [x] Kodcheckpoint `79ec4a3936ea619e68668cdf9290f5e0db9069bc` är pushad till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_8JFuqVGp6WoejrLW8QBWppK85Auf` är `READY` från exakt SHA på
  `https://provia-p9wj9ygfe-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [!] Preview-autentisering krävs fortfarande för användarflöde eller
  live-modellverifiering. `main`, Production, databasen, hemligheter, konton
  och kvoter har inte ändrats i detta steg.

### Fokuserad källgrundning vid felträning — 2026-10-25

- [x] Felträningens fokusutdrag härleds nu företrädesvis från den signerade
  gamla frågan, verifierat facit och rättningsfeedback. Korta, källverifierade
  citat behålls bara när de också överlappar det verifierade misstaget; hela
  eller orelaterade citat kan inte ensamma täcka ett fokus.
- [x] Om inget fokuserat källbevis kan beläggas stoppas begäran före
  jobbstart med `MISTAKE_TRAINING_FOCUS_UNAVAILABLE`. Ingen fråga eller
  kvalitetsgrind har släppts igenom lättare.
- [x] Regressioner täcker tre korta men orelaterade citat, svag källa utan
  härledbar koppling, giltig böjningsvariant, saknat bevis och den befintliga
  HTTP-12-frågors felträningskedjan.
- [x] Offline: käll-/pipeline-/quality-gold-sviten passerade **48/48**;
  HTTP 3/6/12 och felträning passerade **2/2**; fristående
  `mistake-training-source` passerade **19/19**. P.E.R-sidkontext passerade
  **95/95** och prov/resultatkontext **102/102**. Ämnesroutning, first-pass,
  syntax och `git diff --check` passerade.
- [!] Oberoende granskaren fann först att korta orelaterade citat kunde
  tränga undan fokus; därefter att reservvägen kunde acceptera sådana citat.
  Båda fynden och ett efterföljande ordningsfall åtgärdades med regressioner.
  Slutlig read-only-granskning fann inga kodblockerare.
- [!] Inget staging-/live-AI-test gjordes: den befintliga inloggade Previewn
  visar verklig studiehistorik, så syntetisk identitet kan inte säkerställas.
  Offline-stubbarna bevisar inte modellens semantiska precision.
- [x] Kodcheckpoint `284fbc2d8270650696068c33836872df01ab11fe` är pushad till
  `codex/exgen-generation-quality-2026-10-20`. Vercel deployment
  `dpl_4uqTnXZbXmCZ7sQs5hYEV4Vyja9o` är `READY` från exakt SHA på
  `https://provia-k560gb8cp-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [!] Ingen inloggad syntetisk testkörning eller live-AI användes; Previewn
  innehåller inte verifierad syntetisk konto-/historikstatus. `main`,
  Production, Supabase, hemligheter, konton och kvoter är orörda.

### Adversarial källkontroll för felträning — 2026-10-25

- [x] Oberoende granskning reproducerade att en verifierare som felaktigt
  markerar ett fokus kunde få en orelaterad fråga att passera när frågan bara
  citerade rätt material. Pipelinen kräver nu både fokusets citerade utdrag
  och ett begrepp från den specifika färdighets-/felkontexten, utöver ett
  allmänt ämne. Vanliga böjningar och lutning/riktningskoefficient/k-värde
  normaliseras. Befintliga strukturella, oberoende gransknings- och
  provgrindar är oförändrade.
- [x] Adversarial regression simulerar en fotosyntesmiss med en korrekt citerad
  mitosfråga, en bred ämnesfråga och en felriktad användningsfråga trots
  felaktigt positivt verifierarutlåtande. Dessa täcker inte fokus; relevanta
  inputfrågor och böjnings-/synonymformer täcks av separata positiva fall.
- [x] Efter ändringen passerade den kombinerade pipeline-/HTTP-/käll-/
  quality-gold-sviten **50/50**, inklusive återupptagna 3/6/12-flöden,
  HTTP-retry och tydlig partiell leverans.
  `node --check api/_exam-generation-pipeline.cjs` och `git diff --check`
  passerade. P.E.R-sid-/provkontext passerade tidigare i samma QA-session
  (95/95 respektive 102/102); P.E.R-källfilerna ändrades inte.
- [!] Textöverlappet är ett deterministiskt förfilter, inte semantisk entailment.
  En verifierare kan fortfarande överdriva relevans när en felriktad fråga
  delar ett specifikt färdighetsord med felbeviset; en relevant parafras utan
  delade eller normaliserade termer kan avvisas. Modellsvarens semantik är
  inte liveverifierad. En äldre kompatibilitetsgren för redan lagrade fokus
  utan `sourceEvidence` finns kvar oförändrad och är svagare.
- [!] Källavsnittens bredd är fortfarande en genereringsstyrning/rangordning,
  inte ett krav för utfärdande. Ett adversarialt test av en generator som
  ignorerar avsnittsmålet saknas; full avsnittstäckning är inte beslutad som
  ett hårt produktkrav eftersom prov kan ha färre frågor än materialavsnitt.
- [x] Oberoende slutgranskning bekräftade att den reproducerade felriktade
  gasfrågan avvisas och att k-värde-synonymer godkänns; inga blockerare i
  patchen. Granskaren bekräftade samtidigt att semantisk entailment och legacy-
  jobb utan källutdrag fortfarande inte bevisas eller ändras.
- [x] Kodcheckpoint `d94c34f056bf6ace9fffa6f6cf5e2ea36fc23b3e` är pushad till
  `codex/exgen-generation-quality-2026-10-20`. Vercel Preview
  `dpl_BgZN2mbFq8PUqxPTeSaSxU3gV5SL` är `READY` från exakt SHA på
  `https://provia-jyo00fls5-eltons-projects-4adfb1a3.vercel.app/app.html`.
- [!] Ingen staging- eller live-AI-körning gjordes: Preview-kontot och sparad
  historik har inte verifierats som syntetiska. Ingen kostnad, databas-, konto-,
  kvot-, `main`- eller Production-ändring gjordes.

### Återupptagning av legacy-felträning med källbevis — 2026-10-25

- [x] Äldre sparade jobb utan `sourceEvidence` kan nu återvinna ett litet antal
  ordagranna utdrag från sitt redan sparade material, separat härledda från
  ursprungsfråga, facit, färdighet och rättningsfeedback. Elevens felaktiga svar
  används inte som positivt källbevis. Saknat material eller otillräcklig
  kontext lämnar fokuset otäckt; explicit tomt `sourceEvidence` faller fortsatt
  stängt.
- [x] Ett legacy-fokus räknas bara som täckt när kandidatfrågan själv visar både
  källanknytning och en specifik färdighetssignal. Modellsvar, lärandemål,
  konceptetiketter eller enbart verifierarens match-ID kan inte fylla dessa
  beviskrav. Källhänvisningen måste vara ordagrant belagd i det sparade
  materialet och överlappa det härledda fokusutdraget.
- [x] Regressioner täcker återupptagna legacyjobb, separata textpassager för
  fråga/facit, saknat stöd, felaktigt svar, fel ämne med rätt citat, intilliggande
  men annorlunda färdighet, missvisande lärandemål och facitsvar som ensamt
  upprepar rätt källfakta.
- [x] Offline pipeline-/HTTP-/käll-/quality-gold-svit passerade **50/50**,
  inklusive 3/6/12 och återupptagning. Ändrade JavaScript-filer passerade
  syntaxkontroll; `git diff --check` passerade. Oberoende granskning av de
  reproducerade falska positiva fallen fann inga blockerare i slutdiffen.
- [!] Matchningen är fortsatt ett lexikalt deterministiskt förfilter, inte
  semantisk entailment. En giltig parafras utan delade termer kan lämnas otäckt;
  modellkvalitet och verkligt staging/livebeteende verifieras inte av dessa
  offlineprov.
- [!] Ingen syntetisk inloggning kunde bekräftas för det aktuella stagingkontot;
  därför gjordes ingen betald AI-körning. `main`, Production, Supabase, hemligheter,
  konton och kvoter är orörda.

### P.E.R efter resultatrecovery — 2026-10-25

- [x] Prov-/P.E.R-browserregressionen följer nu lyckad rättning, omladdning,
  återställning via verifierat resultat, klick på P.E.R och det efterföljande
  `/api/explain`-anropet. Testet jämför återhämtade frågor i ordning och elevsvar
  exakt mot rättningsåterspelningen och kontrollerar `examReview` samt provkvittot.
- [x] Gränstestet för framtida signerade P.E.R-bevis använder nu 60 sekunders
  marginal i stället för 1 millisekund för att undvika en tidsrace.
- [x] Offline: `EXAM_FLOW_ONLY_RESULT_RECOVERY=1 node
  tests/frontend/exam-flow.regression.mjs` passerade **133/133** och
  `node tests/frontend/per-exam-context.test.mjs` passerade **102/102** efter
  ändringarna. `node --check` för båda testerna och `git diff --check` passerade.
- [!] Oberoende granskning fann inga blockerare. Browserflödet använder mockade
  API-svar; det bevisar inte serverns kryptografiska kontroll eller live-/modellbeteende.
- [!] Ingen staging- eller live-AI-körning gjordes. `main`, Production,
  Supabase, hemligheter, konton och kvoter är orörda.

### Blandad partiell leverans vid slutmontering — 2026-10-25

- [x] Reproducerat med syntetiskt HTTP/PGlite-flöde: 8/12 godkända frågor
  (7 flervalsfrågor + 1 kortsvarsfråga) passerade pipeline-miniminivån men
  avvisades av slutmonteringens fullständiga 6/6-mixmål.
- [x] Slutmontering behåller nu alla frågor i ett kvalificerat delprov med
  faktisk skev fördelning, men fortsätter att kräva minst 60% av begärd mängd,
  båda formaten och varje befintlig strukturell/verifieringsgrind. Fullständiga
  blandade prov använder fortsatt den begärda balansen.
- [x] Ny HTTP-regression omfattar 7+1 av 12 och verifierar utfärdat antal,
  `partial=true`, engångskvot, engångsutfärdande och exakt replay. Den nya
  regressionsgrenen passerade `tests/api/exam-generation-pipeline-http.test.mjs`
  (2/2). Den fokuserade genererings-/kvalitetssviten passerade också 113/113.
- [x] Browserflödet bevarar nu ursprungligt begärt antal och delprovsflagga i
  rättningsmodellen. Ny 8/12-regression verifierar resultattext, lokal historik,
  lokalt sparat resultat och POST-payloaden till kontosparningen.
- [x] `tests/frontend/exam-flow.regression.mjs` passerade 202/202.
- [!] Detta är lokal offline/PGlite-evidens, inte bevis för hosted SQL eller
  live-modellkvalitet. Ingen migration, AI-anrop, staging- eller produktions-
  databasändring gjordes.

### Riktningsfel i misstagsträning — 2026-10-25

- [x] Reproducerat ett falskt positivt där en fråga om vilka ämnen som bildas
  vid fotosyntesen kunde täcka ett dokumenterat fokus på vilka ämnen växten
  använder. Delat ämne och källcitat räckte trots motsatt träningsriktning.
- [x] Matchningen avvisar nu endast tydliga input/output-riktningsmotsägelser
  mellan fokuset och frågeformuleringen. Befintliga käll-, färdighets- och
  verifieringsgrindar är oförändrade; motsägelser testas åt båda håll.
- [x] Offline: pipeline, pipeline-HTTP, felträningskällor och quality-gold
  passerade tillsammans; syntaxkontroll och `git diff --check` passerade.
- [!] Riktningskontrollen är ett deterministiskt lexikalt skydd, inte semantisk
  entailment. Sammansatta/indirekta formuleringar kan fortfarande kräva
  oberoende modellgranskning. Ingen staging-/live-AI-körning gjordes.

### P.E.R återförsök efter sidbyte — 2026-10-26

- [x] Browserregressionen reproducerade att ett felat efterprovssvar följt av
  sidbyte kunde lämna Skicka inaktiverad. En tidig retur efter kontextändring
  hoppade över knappåterställningen trots att frågan låg kvar.
- [x] Skicka återaktiveras nu i `finally` även vid avbrott eller tidig retur.
  Efterprovets signerade bevis rensas fortsatt när sidan byts; en ny begäran
  skickas som vanlig hjälp och utan provbevis, och det nya svaret renderas.
- [x] Offlinebrowser: `tests/frontend/per-exam-context.test.mjs` passerade
  **104/104**, inklusive retry efter avslutat fel och efter ett avbrutet
  in-flight-svar. Sidbyte mellan fel och retry sker först efter att knappens
  upplåsning bekräftats; det gamla signerade provbeviset skickas inte med.
  P.E.R `per-page-targets` rapporterade **95/95**; kontextpaket,
  `per-usage-stream` och `per-context-cap` avslutades utan testfel. Riktade
  P.E.R API-fall efter kontext-/resultatväxling avslutades med kod 0.
- [x] Riktade API-regressioner i `tests/api/per-exam-review-handler.test.mjs`
  passerade **6/6**: allmän startsideshjälp, förbättringscoach, vanlig P.E.R
  med kursens senaste misstag, resultatsidans verifierade svagheter, aktiv
  provhjälp och signerad efterprovförklaring.
- [!] En bred sammanslagen API-körning fastnade över fem minuter i
  `per-exam-review-handler.test.mjs` utan testtidsgräns och stoppades. Hela den
  filen är därför inte verifierad i denna körning; de avgränsade scenarierna
  ovan passerade.
- [!] Ändringen är endast lokal och offlineverifierad. Ingen ny commit, push,
  Preview, staging-/live-AI-körning, `main`, Production eller databasåtgärd
  utfördes efter den separata riktningsfixens Preview-checkpoint.

### Negerad handling i misstagsträning — 2026-10-26

- [x] Reproducerat att frågan "Vilka ämnen använder växten inte vid
  fotosyntesen?" kunde matcha ett verifierat fokus på vilka ämnen växten
  använder. Riktningsfiltret såg samma input-verb men jämförde inte negationen.
- [x] Pipeline-matchningen jämför nu negation nära identifierade handlingsverb
  innan en verifierarmärkt fokusmatch får räknas. Den hanterar även separerade
  partikelverb och skiljer objektkontrast från kontrast till en annan handling.
  Affirmativa kontrollfrågor och input/output-riktningskontrollerna behålls;
  inga kvalitetsgrindar sänktes.
- [x] Regressionerna täcker direkt negation, `varken ... eller`, separerat
  `tar ... inte upp`, objektkontrasterna `inte X utan/men Y`, en kontrast till
  en annan handling, skilda satser och ett verifieraranspråk på negerad fråga.
- [x] Oberoende, skrivskyddad granskning utmanade uttryckligen de tre
  kantfallen: `tar ... inte upp` avvisas, `inte, utan producerar` avvisas och
  `inte syre utan koldioxid` accepteras. Riktad regression passerade **3/3**;
  inga blockerare återstår i de granskade fallen.
- [x] Offline: `check-detection.mjs` klarade alla ämnesfixtures och motexempel.
  Pipeline, pipeline-HTTP, felträningskälla och quality-gold-sviten passerade
  **52/52**. Syntaxkontroller för alla ändrade JS-filer och `git diff --check`
  passerade.
- [!] Bevisningen är lokal med syntetiska/stubbade modellresultat; den mäter
  inte verklig semantisk modelltolkning eller staging/livebeteende. Ingen AI-
  anropskostnad, staging-DB, `main` eller Production ändrades. Preview skapas
  först efter den godkända feature-pushen.

### Relevans i prov från tidigare misstag — 2026-10-26

- [x] Utökade regressionsmaterialet från generiska platshållare till 3 realistiska
  syntetiska fokusfall: linjära funktioner, fotosyntesens in-/utflöden och
  oregelbundna engelska verb. Relevanta kandidater och närliggande men fel
  träningsmål prövas separat.
- [x] Pipeline-grinden kräver nu att varje kandidat i ett misstagsprov har
  källstött matchning mot minst ett valt fokus; en redan täckt lista av fokus
  räcker inte för att fylla resterande platser med orelaterade frågor.
- [x] Slutmonteringen räknar om fokusmatchningen innan utfärdning och failar
  stängt om en äldre sparad fråga inte längre har stöd. Kvalitets- och
  verifieringskraven har inte sänkts.
- [x] Tempusgrinden kräver en igenkänd målform, hanterar vanliga svenska
  tempusnamn och avvisar den tydliga motsägelsen "Yesterday, I have ...".
  Fotosyntesgrinden känner igen reaktant-/produktformuleringar och avvisar
  de testade felvända kopplingarna.
- [x] 3/6/12-fixtureflödet går nu genom pipeline-assembly och completion-kontrakt
  i offline-test. Separat befintligt 12-frågetest utövar riktig lokal
  finalisering, manifest och frågebevis; fixturetestets slutsteg är mockat.
- [x] Startsides-P.E.R. ger nu ett konkret svar på vanliga jämförelsefrågor om
  ExGen utan obekräftade påståenden om konkurrenters funktioner.
- [x] Offline: 74 riktade API-/pipeline-regressioner passerade; gold-eval och
  P.E.R.-guide passerade 10/10; syntaxkontroll och `git diff --check` passerade.
- [!] Oberoende granskning bekräftade att de tidigare specifika exemplen nu
  täcks. Lexikal handling-parning är fortfarande en avgränsad heuristik och
  assembly-avvikelse i äldre jobb kan återköas tills retrygränsen nås; detta
  avslutar säkert utan att utfärda en felaktig fråga men återställer inte jobbet.
  Ingen staging-/live-AI-verifiering gjordes. `main`, Production, Supabase,
  hemligheter, konton och kvoter förblir orörda.
