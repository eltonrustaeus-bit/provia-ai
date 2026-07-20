-- Provia Knowledge & Learning Engine V1 — Fas 2: kärnschema, RLS, feature flags.
-- Se docs/provia-knowledge-engine/07-proposed-v1-architecture.md och docs/adr/0001-0004
-- för det fullständiga resonemanget bakom valen nedan.
--
-- RLS-princip (avsiktligt STRÄNGARE än hp_*-mönstret): varje user-owned tabell får bara en
-- SELECT-policy (user_id = auth.uid()) — ingen INSERT/UPDATE/DELETE-policy för authenticated/anon.
-- Alla skrivningar sker uteslutande via api/knowledge.js med service_role (ADR 0001/0003), som
-- bypassar RLS oavsett. hp_mastery/hp_attempts/hp_progress/hp_sessions tillåter idag klienten att
-- skriva sina egna rader direkt (`for all using(...) with check(...)`) — det var precis den typen
-- av klienttillit (även om scopead till "sin egen rad") som gjorde profiles-privilegie-eskaleringen
-- möjlig (se docs/provia-knowledge-engine/02-security-findings.md): en policy som bara kollar
-- ägarskap, inte VILKA FÄLT som får ändras, är inte skydd mot att en AI-beräknad kolumn (mastery,
-- verification_status, roll) manipuleras av kontot den tillhör. De nya tabellerna har inget sådant
-- hål eftersom de inte har någon skrivpolicy alls för klienten.
--
-- Referensdata (knowledge_sources/documents/chunks, concepts, chunk_concepts, feature_flags) har
-- RLS PÅ men ingen policy alls — samma deny-by-default-mönster som hp_normering/hp_ord_lexicon/
-- hp_questions, service_role-only.
--
-- Embedding-kolumn på knowledge_chunks är MEDVETET UTELÄMNAD — pgvector-extensionen är inte
-- installerad i detta projekt och ingen embeddingmodell/dimension är vald än (uppdragets §20).
-- Läggs till i en Fas 4-migration.

-- ── ai_usage_events — byggs/aktiveras FÖRST, oberoende av resten (docs/.../05-cost-baseline.md) ──
create table if not exists public.ai_usage_events (
  id                    uuid primary key default gen_random_uuid(),
  request_id            text,
  job_id                uuid,
  user_id               uuid references auth.users(id) on delete cascade,
  school_id             uuid,
  subscription_tier     text check (subscription_tier in ('gratis','basic','premium','admin','teacher')),
  feature               text not null,
  pipeline_step         text not null check (pipeline_step in (
                           'classify','blueprint','embed','retrieve','generate','validate',
                           'verify_blind','verify_compare','repair','assemble','grade',
                           'error_classify','mastery_update'
                         )),
  subject               text,
  course                text,
  provider              text not null default 'openai' check (provider in ('openai')),
  model                 text not null,
  prompt_version        text,
  pipeline_version      text,
  corpus_version        text,
  input_tokens          integer not null default 0 check (input_tokens >= 0),
  cached_input_tokens   integer not null default 0 check (cached_input_tokens >= 0),
  output_tokens         integer not null default 0 check (output_tokens >= 0),
  embedding_tokens      integer not null default 0 check (embedding_tokens >= 0),
  retrieval_candidates  integer check (retrieval_candidates >= 0),
  retrieved_chunks      integer check (retrieved_chunks >= 0),
  latency_ms            integer not null default 0 check (latency_ms >= 0),
  cache_hit             boolean,
  retry_count           integer not null default 0 check (retry_count >= 0),
  verification_passed   boolean,
  estimated_cost        numeric(10,6) check (estimated_cost >= 0),
  currency              text not null default 'USD',
  created_at            timestamptz not null default now()
);
create index if not exists idx_ai_usage_events_user on public.ai_usage_events(user_id, created_at desc);
create index if not exists idx_ai_usage_events_feature on public.ai_usage_events(feature, pipeline_step, created_at desc);

alter table public.ai_usage_events enable row level security;
-- Ingen policy: interna metrics, service_role-only (skrivs av api/knowledge.js, läses av framtida admin-vy).

-- ── feature_flags ──
create table if not exists public.feature_flags (
  key                 text primary key,
  enabled             boolean not null default false,
  rollout_percentage  integer not null default 0 check (rollout_percentage between 0 and 100),
  allowed_user_ids    uuid[] not null default '{}',
  configuration       jsonb not null default '{}'::jsonb,
  updated_at          timestamptz not null default now()
);

alter table public.feature_flags enable row level security;
-- Ingen policy: kontrolleras uteslutande server-side (uppdragets §14.12), aldrig läst av klienten.

insert into public.feature_flags (key, enabled) values
  ('knowledge_engine_enabled', false),
  ('legal_rag_enabled', false),
  ('legal_shadow_mode', false),
  ('per_legal_rag_enabled', false),
  ('mastery_light_enabled', false),
  ('citation_ui_enabled', false),
  ('internal_credits_enabled', false)
on conflict (key) do nothing;

-- ── knowledge_sources ──
create table if not exists public.knowledge_sources (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  source_type       text not null,
  authority_level   integer not null default 0,
  publisher         text,
  subject           text not null,
  course            text,
  canonical_url     text,
  valid_from        date,
  valid_to          date,
  license_status    text not null default 'pending' check (license_status in ('pending','approved','blocked')),
  license_metadata  jsonb,
  review_status     text not null default 'pending' check (review_status in ('pending','approved','blocked')),
  version           text not null default 'v1',
  content_hash      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.knowledge_sources enable row level security;
-- Ingen policy: referensdata, service_role-only (ingestion-script, api/knowledge.js).

-- ── knowledge_documents ──
create table if not exists public.knowledge_documents (
  id              uuid primary key default gen_random_uuid(),
  source_id       uuid not null references public.knowledge_sources(id) on delete cascade,
  title           text not null,
  document_type   text,
  status          text not null default 'pending' check (status in ('pending','approved','blocked')),
  corpus_version  text not null default 'v1',
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_knowledge_documents_source on public.knowledge_documents(source_id);

alter table public.knowledge_documents enable row level security;
-- Ingen policy: referensdata, service_role-only.

-- ── concepts (Curriculum Map Light, uppdragets §14.4) ──
create table if not exists public.concepts (
  id              uuid primary key default gen_random_uuid(),
  subject         text not null,
  course          text,
  topic           text,
  name            text not null,
  slug            text not null,
  definition      text,
  curriculum_ref  text,
  common_errors   text[] not null default '{}',
  review_status   text not null default 'pending' check (review_status in ('pending','approved','blocked')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (subject, slug)
);

alter table public.concepts enable row level security;
-- Ingen policy: referensdata, service_role-only. Klientexponering (citation_ui_enabled) inte öppnad än.

-- ── knowledge_chunks ──
create table if not exists public.knowledge_chunks (
  id               uuid primary key default gen_random_uuid(),
  document_id      uuid not null references public.knowledge_documents(id) on delete cascade,
  parent_chunk_id  uuid references public.knowledge_chunks(id) on delete set null,
  content          text not null,
  content_tsv      tsvector generated always as (to_tsvector('swedish', content)) stored,
  chunk_type       text,
  section_ref      text,
  valid_from       date,
  valid_to         date,
  review_status    text not null default 'pending' check (review_status in ('pending','approved','blocked')),
  metadata         jsonb,
  content_hash     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_knowledge_chunks_document on public.knowledge_chunks(document_id);
create index if not exists idx_knowledge_chunks_tsv on public.knowledge_chunks using gin(content_tsv);
create index if not exists idx_knowledge_chunks_review on public.knowledge_chunks(review_status);

alter table public.knowledge_chunks enable row level security;
-- Ingen policy: referensdata, service_role-only. Endast review_status=approved chunks får användas
-- i publicerad generering (§18/§24) — kontrolleras i applikationskod, inte via RLS.

-- ── chunk_concepts ──
create table if not exists public.chunk_concepts (
  chunk_id      uuid not null references public.knowledge_chunks(id) on delete cascade,
  concept_id    uuid not null references public.concepts(id) on delete cascade,
  relation_type text not null default 'covers',
  relevance     real,
  created_at    timestamptz not null default now(),
  primary key (chunk_id, concept_id)
);

alter table public.chunk_concepts enable row level security;
-- Ingen policy: referensdata, service_role-only.

-- ── exam_blueprints ──
create table if not exists public.exam_blueprints (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  school_id            uuid,
  source_material_ref  text,
  subject              text not null,
  course               text,
  level                text not null check (level in ('E','C','A')),
  question_count       integer not null check (question_count > 0),
  question_mix         jsonb,
  spec                 jsonb,
  status               text not null default 'draft' check (status in ('draft','generating','completed','failed')),
  pipeline_version     text,
  corpus_version       text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_exam_blueprints_user on public.exam_blueprints(user_id, created_at desc);

alter table public.exam_blueprints enable row level security;
create policy exam_blueprints_select_own on public.exam_blueprints
  for select using (user_id = auth.uid());
-- Ingen insert/update/delete-policy — se filhuvudets RLS-princip.

-- ── exam_questions ──
create table if not exists public.exam_questions (
  id                    uuid primary key default gen_random_uuid(),
  blueprint_id          uuid not null references public.exam_blueprints(id) on delete cascade,
  position              integer not null,
  question_type         text not null check (question_type in ('multiple_choice','short_answer')),
  payload               jsonb not null,
  verification_status   text not null default 'pending' check (verification_status in ('pending','passed','repaired','rejected','manual_review')),
  generator_provider    text,
  generator_model       text,
  prompt_version        text,
  pipeline_version      text,
  -- source_chunk_ids/concept_ids: uuid[], inte FK — Postgres stödjer inte FK på array-element.
  -- Giltighet (pekar på knowledge_chunks med review_status=approved / existerande concepts)
  -- kontrolleras av deterministisk validering i api/knowledge.js (uppdragets §24), inte av DB:n.
  source_chunk_ids      uuid[] not null default '{}',
  concept_ids           uuid[] not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (blueprint_id, position)
);
create index if not exists idx_exam_questions_blueprint on public.exam_questions(blueprint_id);

alter table public.exam_questions enable row level security;
create policy exam_questions_select_own on public.exam_questions
  for select using (
    exists (
      select 1 from public.exam_blueprints eb
      where eb.id = exam_questions.blueprint_id and eb.user_id = auth.uid()
    )
  );
-- Ingen insert/update/delete-policy — se filhuvudets RLS-princip.

-- ── question_verifications ──
create table if not exists public.question_verifications (
  id                  uuid primary key default gen_random_uuid(),
  question_id         uuid not null references public.exam_questions(id) on delete cascade,
  verification_run    integer not null default 1,
  verifier_provider   text,
  verifier_model      text,
  result              jsonb not null,
  passed              boolean not null,
  failure_codes       text[] not null default '{}',
  repair_recommended  boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists idx_question_verifications_question on public.question_verifications(question_id, created_at desc);

alter table public.question_verifications enable row level security;
-- Ingen policy: intern verifieringsdetalj, inte klientexponerad i V1 (§15). service_role-only.

-- ── generation_jobs ──
create table if not exists public.generation_jobs (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  school_id                uuid,
  job_type                 text not null default 'legal_exam_generation' check (job_type in ('legal_exam_generation')),
  status                   text not null default 'queued' check (status in (
                              'queued','planning','retrieving','generating','validating',
                              'verifying','repairing','assembling','completed',
                              'partially_completed','failed','cancelled'
                            )),
  step                     text,
  progress_current         integer not null default 0 check (progress_current >= 0),
  progress_total           integer not null default 0 check (progress_total >= 0),
  input_json               jsonb,
  result_json              jsonb,
  error_code               text,
  error_message_sanitized  text,
  retry_count              integer not null default 0 check (retry_count >= 0),
  idempotency_key          text not null,
  pipeline_version         text not null default 'v1',
  prompt_version           text,
  corpus_version           text,
  created_at               timestamptz not null default now(),
  started_at               timestamptz,
  updated_at               timestamptz not null default now(),
  completed_at             timestamptz,
  unique (idempotency_key)
);
create index if not exists idx_generation_jobs_user on public.generation_jobs(user_id, created_at desc);

alter table public.generation_jobs enable row level security;
create policy generation_jobs_select_own on public.generation_jobs
  for select using (user_id = auth.uid());
-- Ingen insert/update/delete-policy — se filhuvudets RLS-princip.

-- ── student_error_events ──
create table if not exists public.student_error_events (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  question_id        uuid references public.exam_questions(id) on delete set null,
  concept_id         uuid references public.concepts(id) on delete set null,
  error_code         text not null check (error_code in (
                        'MISSING_CORE_CONCEPT','CONFUSES_TWO_CONCEPTS','CORRECT_RULE_WRONG_APPLICATION',
                        'UNSUPPORTED_CONCLUSION','INCOMPLETE_REASONING','MISREADS_FACT_PATTERN',
                        'USES_OUTDATED_RULE','LANGUAGE_CLARITY','OTHER_REVIEW_REQUIRED'
                      )),
  severity           text not null check (severity in ('low','medium','high')),
  source_attempt_id  uuid,
  created_at         timestamptz not null default now()
);
create index if not exists idx_student_error_events_user on public.student_error_events(user_id, created_at desc);
create index if not exists idx_student_error_events_concept on public.student_error_events(concept_id);

alter table public.student_error_events enable row level security;
create policy student_error_events_select_own on public.student_error_events
  for select using (user_id = auth.uid());
-- Ingen insert/update/delete-policy — skrivs av felkod-klassificeraren (service_role), Fas 9.

-- ── student_mastery ──
create table if not exists public.student_mastery (
  user_id            uuid not null references auth.users(id) on delete cascade,
  concept_id         uuid not null references public.concepts(id) on delete cascade,
  -- 0–100-skala, matchar den redan etablerade konventionen i apply_hp_mastery
  -- (supabase/migrations/20260701_hp_fixes.sql / 20260719_fix_hp_mastery_race.sql).
  mastery_score      real not null default 0 check (mastery_score between 0 and 100),
  confidence         real not null default 0 check (confidence between 0 and 1),
  attempts           integer not null default 0,
  correct_attempts   integer not null default 0,
  last_result        boolean,
  last_practiced_at  timestamptz,
  updated_at         timestamptz not null default now(),
  primary key (user_id, concept_id)
);

alter table public.student_mastery enable row level security;
create policy student_mastery_select_own on public.student_mastery
  for select using (user_id = auth.uid());
-- Ingen insert/update/delete-policy — uppdateras av en framtida apply_legal_mastery()-RPC
-- (service_role), byggd med samma låsmönster som den redan fixade apply_hp_mastery
-- (supabase/migrations/20260719_fix_hp_mastery_race.sql). Byggs i Fas 9, inte denna migration.

-- ── Efterhandstillagd FK (kräver att generation_jobs redan finns) ──
-- ai_usage_events.job_id är en korrelations-id till det jobb som orsakade AI-anropet.
-- on delete set null (inte cascade): om jobbposten försvinner ska usage/kostnadshistoriken
-- ändå finnas kvar (kostnadsdata är värdefull även utan ett levande jobb att peka på) —
-- själva raderingen av användarens usage-events sköts redan av user_id-kaskaden ovan.
alter table public.ai_usage_events
  add constraint ai_usage_events_job_id_fkey
  foreign key (job_id) references public.generation_jobs(id) on delete set null;
