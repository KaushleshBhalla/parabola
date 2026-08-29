-- Migration: multi-assignee, quality score, cancellation notifications, org invite links.
-- Additive, no existing data touched.
-- Applied manually against production via the Supabase SQL Editor.
-- Recorded here for history/reproducibility — not tracked in drizzle's own journal.

ALTER TYPE "public"."notification_type" ADD VALUE 'work_item_cancelled';

ALTER TABLE "organizations" ADD COLUMN "invite_code" text UNIQUE;

ALTER TABLE "work_items" ADD COLUMN "quality_score" integer;

CREATE TABLE "work_item_assignees" (
  "work_item_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "assigned_by" uuid,
  "assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "work_item_assignees_work_item_id_user_id_pk" PRIMARY KEY("work_item_id","user_id"),
  CONSTRAINT "work_item_assignees_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE CASCADE,
  CONSTRAINT "work_item_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "work_item_assignees_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "users"("id")
);
CREATE INDEX "work_item_assignees_user_idx" ON "work_item_assignees" ("user_id");
