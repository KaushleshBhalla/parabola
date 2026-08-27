-- Migration: replace custom bcrypt/session auth with Clerk.
-- Applied manually against production via the Supabase SQL Editor
-- (drizzle-kit push couldn't run non-interactively for this rename-ambiguous change).
-- Recorded here for history/reproducibility — not tracked in drizzle's own journal.

ALTER TABLE users ADD COLUMN clerk_user_id text;
CREATE UNIQUE INDEX users_clerk_user_id_idx ON users (clerk_user_id);
ALTER TABLE users DROP COLUMN password_hash;
ALTER TABLE users DROP COLUMN password_encrypted;
DROP TABLE sessions;
