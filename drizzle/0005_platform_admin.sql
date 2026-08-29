-- Migration: dedicated platform-admin flag, decoupled from the legacy
-- owner/admin/member/viewer role and from the per-organization Discord-style
-- "Owner" role. Additive, no existing data touched.
-- Applied manually against production via the Supabase SQL Editor.
-- Recorded here for history/reproducibility — not tracked in drizzle's own journal.

ALTER TABLE "users" ADD COLUMN "is_platform_admin" boolean DEFAULT false NOT NULL;
