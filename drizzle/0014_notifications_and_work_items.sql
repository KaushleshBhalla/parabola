-- Migration: broader notifications (status changes, join requests) + work
-- item delete/edit support (no schema needed for delete/edit themselves —
-- both use existing columns/tables).
-- Additive, no existing data touched.
-- Run manually against production via the Supabase SQL Editor.
-- Recorded here for history/reproducibility — not tracked in drizzle's own journal.

ALTER TYPE "public"."notification_type" ADD VALUE 'work_item_status_changed';
ALTER TYPE "public"."notification_type" ADD VALUE 'project_join_request';

ALTER TABLE "notifications" ADD COLUMN "project_id" uuid;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;
