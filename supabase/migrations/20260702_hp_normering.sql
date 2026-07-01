-- Provia HP — editable normering table (råpoäng → skalpoäng), 2026-07-02.
-- Replaces the redeploy-bound norm_tables.json anchor curve with an editable DB source
-- so exact UHR normeringstabeller can be added per administration WITHOUT a code deploy.
-- Server (api/hp.js) reads via service_role; _hp-norm.js keeps the JSON curve as fallback
-- when no rows exist for a section. Normering values are public UHR facts (no PII).

-- ── hp_normering: one row per (section, [prov_id], raw_score) ────────────────
--   section  = 'verbal' | 'kvant'
--   prov_id  = specific administration id (e.g. '2024-04'); NULL = generic table
--   raw_score / raw_total = correct-of-total the row maps from
--   normerad = scaled score 0.00..2.00 (step 0.05)
create table if not exists public.hp_normering (
  id          bigserial primary key,
  section     text not null check (section in ('verbal', 'kvant')),
  prov_id     text,                          -- NULL = generic; else per-administration exact
  raw_score   integer not null check (raw_score >= 0),
  raw_total   integer not null check (raw_total > 0),
  normerad    numeric(3,2) not null check (normerad >= 0 and normerad <= 2),
  source      text not null default 'manual',
  created_at  timestamptz not null default now()
);

-- One normerad per (section, prov bucket, raw_score). NULL prov_id is the generic bucket;
-- coalesce so the unique index treats all generic rows as the same bucket key ''.
create unique index if not exists idx_hp_normering_key
  on public.hp_normering (section, coalesce(prov_id, ''), raw_score);
create index if not exists idx_hp_normering_lookup
  on public.hp_normering (section, prov_id, raw_score);

-- ── RLS: deny-default (mirrors hp_questions post-fix) ────────────────────────
-- No permissive policy → anon/authenticated cannot read directly. service_role
-- bypasses RLS, so api/hp.js is unaffected. Keeps one consistent access path.
alter table public.hp_normering enable row level security;
