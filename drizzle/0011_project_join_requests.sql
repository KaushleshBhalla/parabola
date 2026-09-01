-- Migration: globally-unique real-project names + a join-request flow
-- (join by code -> pending by default, or instant if the project turns on
-- auto-approve).
-- Run manually against production via the Supabase SQL Editor.
-- Recorded here for history/reproducibility — not tracked in drizzle's own journal.

-- Pre-existing duplicate real-project names (leftover dev/demo data from
-- before per-project isDemo existed) would reject the unique index below —
-- disambiguate them first instead of requiring manual cleanup. Keeps the
-- oldest of each name, suffixes newer duplicates as "Name (2)", "Name (3)", etc.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY name ORDER BY created_at) AS rn
  FROM "projects"
  WHERE is_demo = false
)
UPDATE "projects"
SET name = "projects".name || ' (' || ranked.rn || ')'
FROM ranked
WHERE "projects".id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX "projects_name_unique_real_idx" ON "projects" ("name") WHERE NOT "is_demo";

ALTER TABLE "projects" ADD COLUMN "auto_approve_join_requests" boolean DEFAULT false NOT NULL;

CREATE TYPE "public"."project_join_request_status" AS ENUM('pending', 'approved', 'declined');

CREATE TABLE "project_join_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "status" "project_join_request_status" DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid,
  CONSTRAINT "project_join_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "project_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "project_join_requests_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "users"("id")
);

CREATE INDEX "project_join_requests_project_status_idx" ON "project_join_requests" ("project_id", "status");
CREATE UNIQUE INDEX "project_join_requests_pending_unique_idx" ON "project_join_requests" ("project_id", "user_id") WHERE "status" = 'pending';
