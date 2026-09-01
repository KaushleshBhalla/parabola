-- Migration: /setmeet — project-wide meetings with a 5-minutes-before ping.
-- Additive, no existing data touched.
-- Run manually against production via the Supabase SQL Editor.
-- Recorded here for history/reproducibility — not tracked in drizzle's own journal.

CREATE TABLE "project_meetings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "scheduled_by" uuid NOT NULL,
  "title" text,
  "scheduled_at" timestamp with time zone NOT NULL,
  "discord_channel_id" text NOT NULL,
  "reminder_sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "project_meetings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "project_meetings_scheduled_by_users_id_fk" FOREIGN KEY ("scheduled_by") REFERENCES "users"("id")
);

CREATE INDEX "project_meetings_due_idx" ON "project_meetings" ("scheduled_at", "reminder_sent_at");
