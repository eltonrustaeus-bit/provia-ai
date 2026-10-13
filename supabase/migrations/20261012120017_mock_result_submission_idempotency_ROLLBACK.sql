-- The forward migration uses IF NOT EXISTS, so it cannot prove that these
-- objects were created by that migration rather than an earlier schema edit.
-- Refuse automatic rollback rather than risk dropping pre-existing data.
DO $$
BEGIN
  RAISE EXCEPTION 'Rollback blocked: reconcile the schema and use a reviewed forward migration.';
END;
$$;
