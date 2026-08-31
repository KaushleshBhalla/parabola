-- Migration: add the "review" work item status (displayed "In Review"),
-- sitting between "in_review" (displayed "Testing Pending") and "done".
-- Additive, no existing data touched.
-- Run manually against production via the Supabase SQL Editor.
-- Recorded here for history/reproducibility — not tracked in drizzle's own journal.

ALTER TYPE "public"."work_item_status" ADD VALUE 'review' BEFORE 'done';
