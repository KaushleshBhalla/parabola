-- Migration: add the "revoked" access request status, distinct from
-- "declined" (never granted). Backs the admin's ability to take back a
-- previously-approved Pro grant.
-- Additive, no existing data touched.
-- Run manually against production via the Supabase SQL Editor.
-- Recorded here for history/reproducibility — not tracked in drizzle's own journal.

ALTER TYPE "public"."access_request_status" ADD VALUE 'revoked';
