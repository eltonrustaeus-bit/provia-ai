begin;

-- All class mutations use api/check-role.js, which verifies the caller's role
-- and checks/rate-limits a join code before creating a membership. Browser
-- clients have no legitimate direct write path to either table.
revoke insert, update, delete on table public.classes
  from public, anon, authenticated;
revoke insert, update, delete on table public.class_members
  from public, anon, authenticated;

-- Keep the database policy aligned with the server-only join design even if
-- the earlier direct-join restriction migration was skipped on a project.
drop policy if exists class_members_student_join on public.class_members;

-- Server routes must retain explicit table access after PUBLIC grants go away.
grant select, insert, update, delete on table public.classes to service_role;
grant select, insert, update, delete on table public.class_members to service_role;

commit;
