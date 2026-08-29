-- Migration: extra optional detail fields on access_requests (for admin triage).
-- Additive, no existing data touched.
-- Applied manually against production via the Supabase SQL Editor.
-- Recorded here for history/reproducibility — not tracked in drizzle's own journal.

ALTER TABLE "access_requests" ADD COLUMN "company" text;
ALTER TABLE "access_requests" ADD COLUMN "job_title" text;
ALTER TABLE "access_requests" ADD COLUMN "phone" text;
ALTER TABLE "access_requests" ADD COLUMN "team_size" text;
ALTER TABLE "access_requests" ADD COLUMN "website" text;
ALTER TABLE "access_requests" ADD COLUMN "how_heard" text;
