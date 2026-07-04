-- Provia HP V2 — additive schema for the generation-quality layer.
-- Evolve-in-place: no renames, no data migration. Everything here is optional/nullable so the
-- live engine keeps working unchanged until each piece is seeded/wired.
--   1. hp_ord_lexicon  — validated Swedish HP-level vocabulary; ORD items whose headword or any
--                        option is NOT in this table are rejected (no repair). The gate in api/hp.js
--                        is FAIL-OPEN while the table is empty, so ORD generation is unaffected until
--                        the lexicon is seeded (see scripts/hp-seed-lexicon.mjs). Same posture as
--                        _hp-facit (empty until imported) and hp_normering (JSON fallback until seeded).
--   2. hp_questions.validation / quality_score — optional audit of the validator verdict per item.
--   3. pg_trgm + stem trigram index — our-bank near-duplicate guard (we deliberately store no real
--                        HP text, so similarity is measured against our OWN generated bank).

-- ── 1. hp_ord_lexicon ───────────────────────────────────────────────────────
create table if not exists public.hp_ord_lexicon (
  word        text primary key,          -- normalized lowercase headword/lemma
  source      text not null default 'seed',  -- 'saldo' | 'seed' | 'manual'
  tags        text[] not null default '{}',  -- akademisk|juridik|ekonomi|äldre|abstrakt
  created_at  timestamptz not null default now()
);
-- RLS on with NO policy => no anon/authenticated access; only service_role (used by api/hp.js)
-- can read/write. The lexicon is an internal validation asset, never exposed to clients.
alter table public.hp_ord_lexicon enable row level security;

-- ── 2. validator audit columns on the shared item bank ──────────────────────
alter table public.hp_questions
  add column if not exists validation    jsonb,      -- {pass, score, reasons[], validator_model}
  add column if not exists quality_score smallint;    -- 0..100; <80 => quality='rejected'

-- ── 3. near-duplicate guard against our own generated bank ──────────────────
create extension if not exists pg_trgm;
create index if not exists idx_hp_questions_stem_trgm
  on public.hp_questions using gin (stem gin_trgm_ops);
