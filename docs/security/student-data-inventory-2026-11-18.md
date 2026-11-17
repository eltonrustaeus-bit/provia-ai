# ExGen student data inventory — 2026-11-18

Working technical map for the school-pilot review. A retention value below is
an observed code rule, not a verified legal period or proof that hosted cleanup
ran. No real student records were read for this inventory.

| Data and purpose | Location and access boundary | Retention or deletion found in code | External recipient / open proof |
| --- | --- | --- | --- |
| Account email, identity, role and billing links: login and entitlements | Supabase Auth and `profiles`; browser session in `localStorage`; server role checks in `api/_auth.js` and `api/check-role.js` | Free learner self-deletion calls Auth hard delete after global refresh-session revocation (`api/check-role.js`); full cascade and browser cleanup unverified | Supabase; payment links also relate to Stripe. Historical server-key revocation still needs metadata proof. |
| Study material, uploaded study/handwritten-solution images, exam questions, answers and results: practice and feedback | Browser history/material and account-keyed draft/progress (`app.html`, `js/exam-flow.js`, `js/account-storage.js`); Supabase exam/result tables behind owner/RLS rules | Browser private caches clear on sign-out or owner change, but shared keys can race with another tab. No general saved-exam expiry verified; explicit exam-history clear is separate from account deletion | OpenAI receives selected material, answers and OCR images through server exam/grading/OCR routes (`api/ocr.js`). Test hosted deletion and another-device behavior. |
| Class membership and teacher-visible progress: class teaching and follow-up | `classes`, `class_members` and teacher-facing routes in `api/check-role.js`; authorized teachers can view class progress and per-student history | No general class-membership or teacher-report retention period verified; class write ACLs are restricted but the full authenticated route journey remains untested | Supabase and authorized teacher accounts; school access policy and deletion responsibility need a decision. |
| P.E.R conversation and learning profile: tutoring and continuity | Browser P.E.R history plus Supabase `per_sessions`, `per_long_memory` and learner facts (`api/explain.js`, `api/_per-memory.js`, `api/_learner-profile.js`) | Long memory is treated as stale after 90 days and deleted on eligible read, not on a verified schedule; explicit memory clear exists. No general session or browser-history lifetime verified | OpenAI receives relevant prompt/context via `api/_per-core.js`; exact project retention and contractual settings unverified. |
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

Before real pupil data: the school and privacy owner must decide purpose,
controller/processor responsibilities, lawful basis, retention for each row,
guardian information, backups, support access and incident handling. A technical
cache expiry alone does not set those decisions.
