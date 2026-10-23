# Unverified exam abandonment rollback note

There is no executable rollback for `20261020170431_fix_unverified_exam_abandonment_state.sql`.
Restoring the legacy completion check could treat an unverified `mock_results` row as proof that
the exam was graded, which can unlock answer-bearing P.E. help. Any recovery must be a separately
reviewed forward migration that preserves the verified-result requirement. Do not execute a
rollback script.

The paired `_ROLLBACK.sql` file intentionally raises an exception and makes no schema changes.
