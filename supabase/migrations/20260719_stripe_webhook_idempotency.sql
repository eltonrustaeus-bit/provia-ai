-- Fix: api/stripe-webhook.js had no event.id deduplication. Stripe's
-- at-least-once redelivery caused duplicate confirmation/admin emails,
-- and a DB failure during processing still returned 200 (no retry),
-- so a paying customer could end up with no role upgrade and no
-- automatic recovery.
--
-- This table is the idempotency claim: the handler inserts a row before
-- processing (INSERT ... ON CONFLICT DO NOTHING — a conflict means this
-- event was already claimed) and deletes it if processing throws, so a
-- genuine retry can reclaim and reprocess. A row that survives means the
-- event was fully handled — a later redelivery is a no-op.

create table if not exists public.stripe_webhook_events (
  event_id     text primary key,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
-- No policy: only the webhook handler (service_role) ever touches this table.
