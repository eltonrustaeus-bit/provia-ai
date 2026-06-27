-- Teacher Dashboard (B2B) — classes + class membership
-- Enables a teacher to see aggregated progress for students in their classes.
-- Security model: API uses service_role (bypasses RLS) and gates access in code.
-- RLS below is defense-in-depth for any future anon/authenticated client access.
-- Rollback: supabase/migrations_rollback/20260627_teacher_dashboard_ROLLBACK.sql

-- 1. Classes owned by a teacher
create table if not exists public.classes (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  join_code  text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists classes_teacher_idx on public.classes(teacher_id);

-- 2. Student membership in a class
create table if not exists public.class_members (
  class_id   uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (class_id, student_id)
);

create index if not exists class_members_student_idx on public.class_members(student_id);

-- 3. Row level security (defense in depth; primary gate is server-side in check-role.js)
alter table public.classes enable row level security;
alter table public.class_members enable row level security;

-- Teacher manages own classes
drop policy if exists classes_owner on public.classes;
create policy classes_owner on public.classes
  for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

-- Teacher reads members of own classes
drop policy if exists class_members_teacher_read on public.class_members;
create policy class_members_teacher_read on public.class_members
  for select
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_members.class_id
        and c.teacher_id = auth.uid()
    )
  );

-- Student reads own memberships
drop policy if exists class_members_student_read on public.class_members;
create policy class_members_student_read on public.class_members
  for select
  using (auth.uid() = student_id);

-- Student joins (inserts self) / leaves (deletes self)
drop policy if exists class_members_student_join on public.class_members;
create policy class_members_student_join on public.class_members
  for insert
  with check (auth.uid() = student_id);

drop policy if exists class_members_student_leave on public.class_members;
create policy class_members_student_leave on public.class_members
  for delete
  using (auth.uid() = student_id);
