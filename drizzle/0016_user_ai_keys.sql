-- Migration: bring-your-own AI key — each user stores their own free
-- Gemini or Groq API key, encrypted at rest.
-- Additive, no existing data touched.
-- Run manually against production via the Supabase SQL Editor.
-- Recorded here for history/reproducibility — not tracked in drizzle's own journal.

CREATE TYPE "public"."ai_provider" AS ENUM('gemini', 'groq');

CREATE TABLE "user_ai_keys" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "provider" "ai_provider" NOT NULL,
  "key_ciphertext" text NOT NULL,
  "key_hint" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_ai_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
