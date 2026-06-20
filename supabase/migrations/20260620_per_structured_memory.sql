-- D1: Add structured JSONB column to per_long_memory for richer AI coaching signals
ALTER TABLE per_long_memory
  ADD COLUMN IF NOT EXISTS structured JSONB;
