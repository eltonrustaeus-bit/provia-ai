-- Stable signed-exam identity makes replayed grading writes idempotent.
ALTER TABLE public.mock_results
  ADD COLUMN IF NOT EXISTS submission_id text;

CREATE UNIQUE INDEX IF NOT EXISTS mock_results_user_submission_id_uidx
  ON public.mock_results (user_id, submission_id);
