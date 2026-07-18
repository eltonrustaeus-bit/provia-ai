-- Fix: profiles_update_own allowed any authenticated user to update ANY column
-- on their own row (auth.uid()=id, no column restriction) — including role,
-- approved, quota_*, stripe_customer_id, stripe_subscription_id. This let a
-- client update their own role to 'admin' and reset quotas via the public
-- anon/publishable key, no special access required.
--
-- All legitimate writes to profiles already go through service_role in
-- api/check-role.js, api/stripe-webhook.js, api/create-checkout-session.js,
-- which bypass RLS entirely — dropping the client UPDATE policy breaks no
-- existing flow. profiles_select_own and profiles_insert_own are untouched.

drop policy if exists "profiles_update_own" on public.profiles;
