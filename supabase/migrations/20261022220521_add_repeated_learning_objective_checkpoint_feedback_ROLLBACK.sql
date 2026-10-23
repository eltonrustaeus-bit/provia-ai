-- Roll back the application revision that emits this category, stop new
-- generation traffic, then drain the pipeline before applying this SQL
-- rollback. Keep traffic stopped until it completes. Some Supabase CLI paths
-- execute files without a transaction block, so this guard stays
-- transaction-independent and refuses while any job is active.

do $$
begin
  if exists (
    select 1
    from public.mock_exam_generation_pipeline_jobs
    where state in ('queued', 'running')
  ) then
    raise exception 'Rollback refused while active pipeline jobs remain; drain the pipeline before reverting checkpoint feedback';
  end if;
end;
$$;

create or replace function public.checkpoint_mock_exam_generation_pipeline_batch(
  p_job_id uuid,
  p_lease_token uuid,
  p_expected_stage text,
  p_next_stage text,
  p_accepted_questions jsonb,
  p_progress_current integer,
  p_feedback jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.mock_exam_generation_pipeline_jobs%rowtype;
  v_result jsonb;
  v_group text;
  v_key text;
  v_value jsonb;
  v_allowed text[];
begin
  if p_expected_stage is null or p_expected_stage not in ('generate', 'repair') or
     p_next_stage is null or p_next_stage not in ('repair', 'assemble') or
     p_progress_current is null or p_accepted_questions is null or
     jsonb_typeof(p_accepted_questions) <> 'array' or
     p_progress_current <> jsonb_array_length(p_accepted_questions) or
     p_progress_current < 0 or p_progress_current > 20 or
     p_feedback is null or jsonb_typeof(p_feedback) <> 'object' or
     octet_length(p_feedback::text) > 2048 or
     p_feedback - array['reviewFailureCounts', 'solverFailureCounts', 'duplicateCount'] <> '{}'::jsonb or
     jsonb_typeof(p_feedback->'reviewFailureCounts') is distinct from 'object' or
     jsonb_typeof(p_feedback->'solverFailureCounts') is distinct from 'object' or
     coalesce((p_feedback->'duplicateCount')::text, '') !~ '^[0-3]$' then
    return jsonb_build_object('status', 'invalid_checkpoint');
  end if;
  foreach v_group in array array['reviewFailureCounts', 'solverFailureCounts'] loop
    v_allowed := case when v_group = 'reviewFailureCounts' then array[
      'low_factual_accuracy', 'high_ambiguity', 'difficulty_mismatch', 'low_source_alignment',
      'low_scoring_quality', 'low_language_quality', 'language_mismatch', 'option_quality_failed',
      'option_quality_contract_failed', 'answer_alignment', 'source_support', 'scoring_alignment',
      'question_clarity', 'language_quality', 'difficulty_match', 'reviewer_other'
    ] else array[
      'solver_implausible_option', 'solver_cannot_judge', 'solver_multiple_correct_options',
      'solver_no_single_answer', 'solver_index_verdict_mismatch', 'solver_disagrees_on_key',
      'solver_low_confidence'
    ] end;
    for v_key, v_value in select key, value from jsonb_each(p_feedback->v_group) loop
      if not (v_key = any(v_allowed)) or v_value::text !~ '^([1-9]|1[0-9]|20)$' then
        return jsonb_build_object('status', 'invalid_checkpoint');
      end if;
    end loop;
  end loop;

  select * into v_job from public.mock_exam_generation_pipeline_jobs
  where id = p_job_id for update;
  if not found or v_job.state <> 'running' or v_job.stage <> p_expected_stage or
     p_lease_token is null or v_job.lease_token is distinct from p_lease_token or
     v_job.lease_expires_at <= clock_timestamp() or v_job.deadline_at <= clock_timestamp() then
    return jsonb_build_object('status', 'fenced');
  end if;
  if not (p_accepted_questions @> v_job.accepted_questions) or exists (
    select 1 from jsonb_array_elements(p_accepted_questions) q
    where q->>'validation_status' is distinct from 'verified'
  ) then
    return jsonb_build_object('status', 'invalid_checkpoint');
  end if;

  if p_progress_current = v_job.progress_current then
    if p_next_stage <> 'repair' or p_accepted_questions <> v_job.accepted_questions then
      return jsonb_build_object('status', 'invalid_checkpoint');
    end if;
    v_result := public.retry_mock_exam_generation_pipeline_step(
      p_job_id, p_lease_token, 'NO_NEW_APPROVED_QUESTIONS'
    );
  else
    v_result := public.checkpoint_mock_exam_generation_pipeline_job(
      p_job_id, p_lease_token, p_expected_stage, p_next_stage,
      p_accepted_questions, p_progress_current
    );
  end if;
  if v_result->>'status' in ('checkpointed', 'retry_queued') then
    update public.mock_exam_generation_pipeline_jobs
    set stage = p_next_stage,
        payload = case when p_next_stage = 'repair'
          then jsonb_set(payload, '{repairFeedback}', p_feedback, true)
          else payload - 'repairFeedback' end
    where id = p_job_id and state = 'queued';
  end if;
  return v_result;
end;
$$;

revoke all on function public.checkpoint_mock_exam_generation_pipeline_batch(uuid, uuid, text, text, jsonb, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.checkpoint_mock_exam_generation_pipeline_batch(uuid, uuid, text, text, jsonb, integer, jsonb)
  to service_role;
