-- Class membership must only be created through the authenticated server route,
-- which checks and rate-limits the teacher-issued join code before writing.
-- The service-role API client bypasses RLS; direct client inserts do not.
drop policy if exists class_members_student_join on public.class_members;

-- RLS is the primary boundary, and the browser has no direct insert flow.
-- Remove the table privilege too so a later policy mistake cannot reopen it.
revoke insert on table public.class_members from public, anon, authenticated;
