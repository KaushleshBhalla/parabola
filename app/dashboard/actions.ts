"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects, projectCounters } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { getPrimaryOrganization } from "@/lib/organizations";
import { logActivity } from "@/lib/activity";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createProject(formData: FormData) {
  const user = await requireRole("admin");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return;

  const baseSlug = slugify(name) || "project";
  let slug = baseSlug;
  let suffix = 1;
  while (true) {
    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);
    if (!existing) break;
    slug = `${baseSlug}-${++suffix}`;
  }

  const org = await getPrimaryOrganization(user.id);

  const [project] = await db
    .insert(projects)
    .values({
      name,
      slug,
      description: description || null,
      organizationId: org?.id,
      createdBy: user.id,
    })
    .returning();

  await db.insert(projectCounters).values({ projectId: project.id });

  await logActivity({
    actorId: user.id,
    projectId: project.id,
    action: "project.created",
    entityType: "project",
    entityId: project.id,
    after: { name, slug },
    searchText: `Created project "${name}"`,
  });

  revalidatePath("/dashboard");
}
