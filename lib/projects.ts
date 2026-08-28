import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects } from "@/lib/db/schema";

// Cached per-request: a project's layout and its active page both look this
// up by slug — dedupe so it's one DB round trip, not two, per navigation.
export const getProjectBySlug = cache(async function getProjectBySlug(
  slug: string
) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);
  return project ?? null;
});
