-- Migration: multi-tenant organizations + Discord-style custom roles/permissions.
-- Phase 1 of the org/roles rebuild (schema only) — additive, no existing data touched.
-- Applied manually against production via the Supabase SQL Editor.
-- Recorded here for history/reproducibility — not tracked in drizzle's own journal.

CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid');

CREATE TABLE "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "created_by" uuid,
  "payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
  "razorpay_order_id" text,
  "razorpay_payment_id" text,
  "amount_cents" integer DEFAULT 4900 NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id")
);

CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "color" text,
  "position" double precision DEFAULT 0 NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "is_owner_role" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "roles_org_name_idx" ON "roles" ("organization_id","name");
CREATE INDEX "roles_org_idx" ON "roles" ("organization_id");

CREATE TABLE "role_permissions" (
  "role_id" uuid NOT NULL,
  "permission_key" text NOT NULL,
  CONSTRAINT "role_permissions_role_id_permission_key_pk" PRIMARY KEY("role_id","permission_key"),
  CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE
);

CREATE TABLE "organization_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "org_members_org_user_idx" ON "organization_members" ("organization_id","user_id");
CREATE INDEX "org_members_user_idx" ON "organization_members" ("user_id");

CREATE TABLE "member_roles" (
  "organization_member_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  CONSTRAINT "member_roles_organization_member_id_role_id_pk" PRIMARY KEY("organization_member_id","role_id"),
  CONSTRAINT "member_roles_organization_member_id_organization_members_id_fk" FOREIGN KEY ("organization_member_id") REFERENCES "organization_members"("id") ON DELETE CASCADE,
  CONSTRAINT "member_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE
);

ALTER TABLE "projects" ADD COLUMN "organization_id" uuid;
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
