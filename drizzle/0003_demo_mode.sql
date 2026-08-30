-- Migration: demo sandbox mode + Request Pro Access, replacing self-serve paid org creation.
-- Additive, no existing data touched.
-- Applied manually against production via the Supabase SQL Editor.
-- Recorded here for history/reproducibility — not tracked in drizzle's own journal.

CREATE TYPE "public"."access_request_status" AS ENUM('pending', 'contacted', 'approved', 'declined');

ALTER TABLE "users" ADD COLUMN "is_bot" boolean DEFAULT false NOT NULL;

ALTER TABLE "organizations" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;
ALTER TABLE "organizations" ADD COLUMN "demo_creations_used" integer DEFAULT 0 NOT NULL;

CREATE TABLE "access_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid,
  "user_id" uuid,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "message" text,
  "status" "access_request_status" DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "access_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL,
  CONSTRAINT "access_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX "access_requests_status_idx" ON "access_requests" ("status");

