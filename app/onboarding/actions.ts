"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import { createOrganizationForUser } from "@/lib/organizations";
import { logActivity } from "@/lib/activity";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export type CreateOrgState = { error: string } | null;

export async function createOrganizationAction(
  _prevState: CreateOrgState,
  formData: FormData
): Promise<CreateOrgState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Organization name is required." };

  const baseSlug = slugify(name) || "org";
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

  const org = await createOrganizationForUser(user.id, name, slug);

  await logActivity({
    actorId: user.id,
    action: "organization.created",
    entityType: "organization",
    entityId: org.id,
    after: { name, slug, paymentStatus: org.paymentStatus },
    searchText: `Created organization "${name}"`,
  });

  redirect("/dashboard");
}
