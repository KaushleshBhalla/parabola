-- Migration: "Ask AI" over Discord chat — link Discord channels to a
-- project, and store the per-project AI conversation.
-- Additive, no existing data touched.
-- Run manually against production via the Supabase SQL Editor.
-- Recorded here for history/reproducibility — not tracked in drizzle's own journal.

CREATE TYPE "public"."ai_chat_role" AS ENUM('user', 'assistant');

CREATE TABLE "project_discord_channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "discord_channel_id" text NOT NULL,
  "discord_channel_name" text,
  "added_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "project_discord_channels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "project_discord_channels_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "users"("id")
);
CREATE UNIQUE INDEX "project_discord_channels_unique_idx" ON "project_discord_channels" ("project_id", "discord_channel_id");

CREATE TABLE "ai_chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "user_id" uuid,
  "role" "ai_chat_role" NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_chat_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "ai_chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX "ai_chat_messages_project_created_idx" ON "ai_chat_messages" ("project_id", "created_at");
