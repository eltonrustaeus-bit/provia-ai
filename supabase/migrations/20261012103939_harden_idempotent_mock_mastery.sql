-- A mock-exam grading retry may repeat the same trusted answers. Record each
-- user/submission/concept tuple in the same transaction as its mastery update.
begin;

create table if not exists public.mock_mastery_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id text not null check (submission_id ~ '^[a-f0-9]{32}$'),
  concept text not null check (char_length(concept) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (user_id, submission_id, concept)
);

alter table public.mock_mastery_events enable row level security;
revoke all on public.mock_mastery_events from public, anon, authenticated;

create or replace function public.apply_mock_mastery_once(
  p_user_id uuid,
  p_submission_id text,
  p_concept text,
  p_label text,
  p_ratio real,
  p_difficulty real default 0.5
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
  v_result jsonb;
begin
  if p_user_id is null
    or p_submission_id !~ '^[a-f0-9]{32}$'
    or p_concept is null
    or char_length(p_concept) not between 1 and 120
    or p_ratio is null or p_ratio < 0 or p_ratio > 1
    or p_difficulty is null or p_difficulty < 0 or p_difficulty > 1 then
    raise exception 'invalid mock mastery input';
  end if;

  insert into public.mock_mastery_events (user_id, submission_id, concept)
  values (p_user_id, p_submission_id, p_concept)
  on conflict do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select mastery -> p_concept into v_result
    from public.user_profiles where id = p_user_id;
    return v_result;
  end if;

  return public.apply_mock_mastery(p_user_id, p_concept, p_label, p_ratio, p_difficulty);
end;
$$;

revoke all on function public.apply_mock_mastery_once(uuid, text, text, text, real, real) from public, anon, authenticated;
grant execute on function public.apply_mock_mastery_once(uuid, text, text, text, real, real) to service_role;

commit;
