"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import { canCreateOwnOrganization, createOrganizationForUser } from "@/lib/organizations";
import { logActivity } from "@/lib/activity";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createOwnOrganization(
  name: string
): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  if (!(await canCreateOwnOrganization(user.id))) {
    return { error: "You don't have an approved request yet." };
  }
  const trimmed = name.trim();
  if (!trimmed) return { error: "Organization name is required." };

  const baseSlug = slugify(trimmed) || "org";
  let slug = baseSlug;
  let suffix = 1;
  while (true) {
    const [existing] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (!existing) break;
    slug = `${baseSlug}-${++suffix}`;
  }

  const org = await createOrganizationForUser(user.id, trimmed, slug);
  await logActivity({
    actorId: user.id,
    action: "organization.created",
    entityType: "organization",
    entityId: org.id,
    after: { name: trimmed, slug },
    searchText: `Created organization "${trimmed}"`,
  });

  redirect("/dashboard");
}
