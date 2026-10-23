# Grading-claim fencing rollback note

There is no executable rollback for `20261020170419_fence_stale_exam_grading_claims.sql`.
Re-enabling the old unfenced claim behavior could allow a timed-out grading request to
persist or release a later request's claim. Any recovery must be a separately reviewed
forward migration that keeps stale writers fenced. Do not execute a rollback script.

This note is deliberately outside `supabase/migrations/`; it is not a migration and
must not be applied to staging or production.
