-- Migration: Discord bot integration — account linking and server/org linking.
-- Additive, no existing data touched.
-- Applied manually against production via the Supabase SQL Editor.
-- Recorded here for history/reproducibility — not tracked in drizzle's own journal.

ALTER TABLE "users" ADD COLUMN "discord_user_id" text UNIQUE;
ALTER TABLE "users" ADD COLUMN "discord_username" text;

ALTER TABLE "organizations" ADD COLUMN "discord_guild_id" text UNIQUE;
ALTER TABLE "organizations" ADD COLUMN "discord_notify_channel_id" text;
