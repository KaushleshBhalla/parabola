-- Migration: self-service project archive/unarchive, kept deliberately
-- separate from the existing archived_at (which means "Pro access revoked
-- by a platform admin" and fully locks the project).
-- Additive, no existing data touched.
-- Run manually against production via the Supabase SQL Editor.
-- Recorded here for history/reproducibility — not tracked in drizzle's own journal.

ALTER TABLE "projects" ADD COLUMN "owner_archived_at" timestamp with time zone;
