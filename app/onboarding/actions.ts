"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/rbac";
import { getUserOrganizations, createDemoOrganizationForUser } from "@/lib/organizations";
import { logActivity } from "@/lib/activity";

async function ensureDemoOrg() {
  const user = await requireUser();
  const existing = await getUserOrganizations(user.id);
  if (existing.length > 0) return existing[0];

  const org = await createDemoOrganizationForUser(user.id, user.name);
  await logActivity({
    actorId: user.id,
    action: "organization.created",
    entityType: "organization",
    entityId: org.id,
    after: { name: org.name, slug: org.slug, isDemo: true },
    searchText: `Created demo workspace "${org.name}"`,
  });
  return org;
}

export async function startDemo() {
  await ensureDemoOrg();
  redirect("/dashboard");
}

export async function requestProAccess() {
  await ensureDemoOrg();
  redirect("/dashboard/request-access");
}
