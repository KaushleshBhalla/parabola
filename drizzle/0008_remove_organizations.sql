-- Migration: projects become the sole tenant unit, replacing organizations.
-- Additive only — organizations/roles/role_permissions/organization_members/
-- member_roles tables are left in place, just unused by the app from here on.
-- Applied manually against production via the Supabase SQL Editor.
-- Recorded here for history/reproducibility — not tracked in drizzle's own journal.

ALTER TABLE "projects" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;
ALTER TABLE "projects" ADD COLUMN "demo_creations_used" integer DEFAULT 0 NOT NULL;
ALTER TABLE "projects" ADD COLUMN "discord_guild_id" text UNIQUE;
ALTER TABLE "projects" ADD COLUMN "invite_code" text UNIQUE;

ALTER TABLE "project_members" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;
