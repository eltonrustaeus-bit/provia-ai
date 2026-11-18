# ExGen student data inventory — 2026-11-18

Working technical map for the school-pilot review. A retention value below is
an observed code rule, not a verified legal period or proof that hosted cleanup
ran. No real student records were read for this inventory.

| Data and purpose | Location and access boundary | Retention or deletion found in code | External recipient / open proof |
| --- | --- | --- | --- |
| Account email, identity, role and billing links: login and entitlements | Supabase Auth and `profiles`; browser session in `localStorage`; server role checks in `api/_auth.js` and `api/check-role.js` | Free learner self-deletion calls Auth hard delete after global refresh-session revocation (`api/check-role.js`); full cascade and browser cleanup unverified | Supabase; payment links also relate to Stripe. Historical server-key revocation still needs metadata proof. |
| Study material, submitted study/handwritten-solution images, exam questions, answers and results: practice and feedback | Browser history/material and account-keyed draft/progress (`app.html`, `js/exam-flow.js`, `js/account-storage.js`); Supabase exam/result tables behind owner/RLS rules | The feature Preview at `b07e57f` scopes history, mistakes, last result, material, training selection and custom courses by account and discards ambiguous legacy keys. Production has not received this cutover. No general saved-exam expiry verified; explicit exam-history clear is separate from account deletion | OpenAI receives selected material, answers and OCR images through server exam/grading/OCR routes (`api/ocr.js`). Test hosted deletion and another-device behavior. |
| Class membership and teacher-visible progress: class teaching and follow-up | `classes`, `class_members` and teacher-facing routes in `api/check-role.js`; authorized teachers can view class progress and per-student history | No general class-membership or teacher-report retention period verified; class write ACLs are restricted but the full authenticated route journey remains untested | Supabase and authorized teacher accounts; school access policy and deletion responsibility need a decision. |
| P.E.R conversation and learning profile: tutoring and continuity | Browser P.E.R history plus Supabase `per_sessions`, `per_long_memory` and learner facts (`api/explain.js`, `api/_per-memory.js`, `api/_learner-profile.js`) | A feature Preview scopes P.E.R transcripts by account and discards ambiguous legacy history; Production has not received it. Long memory is treated as stale after 90 days and deleted on eligible read, not on a verified schedule; explicit memory clear exists. No general session or browser-history lifetime verified | OpenAI receives relevant prompt/context via `api/_per-core.js`; exact project retention and contractual settings unverified. |
| P.E.R answer cache: reuse of generic answers when enabled | `per_answer_cache` stores free-form question and answer text without a user ID (`api/_per-cache.js`, `supabase/migrations/20260821_per_answer_cache.sql`) | A 30-day expiry limits reuse but does not physically purge rows; account deletion cannot attribute entries. The flag was off and a prior hosted aggregate found zero rows; recheck before enabling | Supabase and possibly OpenAI embeddings. Treat this as a latent design risk; redesign or remove the cache before pupil content can enter it. |
| Generation jobs, replay and replacement payloads: resume, idempotency and quota integrity | Private Supabase pipeline/request/replacement tables (`api/_exam-generation-pipeline.cjs`, migrations cited below) | Pipeline payloads become eligible after deadline plus 24 hours; best-effort batches of 50 on a 15-minute cron. Request replay expires by row timestamp. Replacement payload purge is scheduled every 15 minutes; hosted execution/backlog needs readback | Supabase and OpenAI. Lineage/metadata rows can remain after payload scrub; duration requires policy decision. |
| AI usage and quota metadata: spend control and abuse prevention | `ai_usage_events`, quota/reservation tables and structured server logs (`api/_ai-usage.cjs`) | No general event/log lifetime verified | OpenAI receives provider requests; Responses calls on the feature branch use `store:false`. Provider abuse-monitoring retention and ExGen account settings need separate verification. |
| Email and payment records: signup, billing, notices | Supabase profile billing IDs; Stripe customers/events; Resend messages (`api/signup.js`, `api/create-checkout-session.js`, `api/stripe-webhook.js`) | No complete cross-provider deletion or retention period verified; billing-related accounts are held for manual deletion review | Stripe and Resend. Confirm each service's actual retention and applicable records before pilot. |
| Operational errors: diagnose incidents | Vercel logs; selected structured events in API handlers | Host log retention not verified. Feature-branch payment logs exclude raw provider/database errors and direct customer identifiers in reviewed paths | Vercel and possibly provider logs; review other paths and dashboard settings. |

Sources for the bounded payload rules: `supabase/migrations/20261022140200_mock_exam_pipeline_retention.sql`,
`supabase/migrations/20261022140300_schedule_mock_exam_pipeline_retention.sql`,
`supabase/migrations/20261116140100_schedule_exam_question_replacement_retention.sql`.
The account-deletion and hosted-test gaps are tracked in
`docs/codex/12_DATA_DELETION_GAP.md` and
`docs/security/pilot-security-status-2026-11-17.md`.

A read-only hosted aggregate on 2026-11-18 found zero Supabase Storage
objects in both staging and production (staging: zero buckets; production:
one bucket). This is a point-in-time count, not a Storage deletion test or
a guarantee about future uploads. The browser OCR path sends images to its
server route; its provider-side retention remains an open check.

The feature-branch OpenAI wrapper sets `store: false` on every Responses API
request, and an offline test verifies the override for both normal and
budgeted staging calls. `origin/main` does not yet contain that default.
This addresses provider application-state retention for that endpoint; it
does not remove prompt/image content from default abuse-monitoring logs. OpenAI
currently documents those logs as retaining prompts/responses for up to 30
days in the default configuration, subject to approved organization controls
([data controls](https://platform.openai.com/docs/guides/your-data)). ExGen's
actual organization setting is unverified.

The P.E.R text sanitizer targets prompt-injection phrases and length limits;
it is not a personal-data redactor. Names, emails, school details and other
identifiers in pasted material, student answers or OCR images may reach the
provider when needed by the feature. No tested general redaction policy was
found. Preserve this as an open data-minimization item rather than claiming
that identifiers are scrubbed.

The local browser-storage tests and source were rechecked on 2026-11-18. The
app can retain account-scoped drafts, progress and unsynced results when a
user chooses to keep them at logout; the current key definitions have no
expiry. Explicit clearing is tested locally, but adding automatic expiration
would risk deleting recoverable work until the school defines the retention
period and user-facing recovery behavior.

## Browser-role grants on server-side tables — metadata check 2026-11-18

A metadata-only catalog query found 15 public tables in production and 14 in
staging with RLS enabled, no policies, and effective `SELECT`, `INSERT`,
`UPDATE`, `DELETE` and `TRUNCATE` privileges for `anon` and `authenticated`.
The production set is `ai_usage_events`, `anon_rate_limit`, `chunk_concepts`,
`concepts`, `exam_questions`, `feature_flags`, `hp_normering`,
`hp_ord_lexicon`, `hp_questions`, `knowledge_chunks`, `knowledge_documents`,
`knowledge_sources`, `per_quota_counters`, `question_verifications` and
`stripe_webhook_events`; staging has the same set except `anon_rate_limit`.
`anon_rate_limit` is the sole exception in staging, where its browser-role
privileges are absent; production still has them. With RLS enabled and no
policy, ordinary row reads and writes are denied. This does not establish a
current row-data breach. However, RLS does not protect `TRUNCATE`, and these
grants exceed least privilege for server-managed data.

Source search found no direct browser-client use of the listed tables. The
active code uses relevant tables through server routes/modules, including
`concepts`, `feature_flags`, `per_quota_counters`, `stripe_webhook_events`,
`ai_usage_events`, `exam_questions`, `question_verifications`,
`knowledge_documents` and `knowledge_chunks`. This supports a staged ACL
reduction, but a staging migration and route regression checks are still
needed before deciding whether and how to change production. No hosted grant
was changed during this check. A separate public invoker RPC,
`match_knowledge_chunks(...)`, is executable by browser roles although its
source tables deny rows by RLS; server-side retrieval uses it. No browser
caller was found, so removing browser EXECUTE is a reasonable least-privilege
candidate, not a response to proven data disclosure.

Before real pupil data: the school and privacy owner must decide purpose,
controller/processor responsibilities, lawful basis, retention for each row,
guardian information, backups, support access and incident handling. A technical
cache expiry alone does not set those decisions.
