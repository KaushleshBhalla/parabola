"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { organizationMembers } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import { getUserOrganizations, createDemoOrganizationForUser } from "@/lib/organizations";
import { logActivity } from "@/lib/activity";

async function ensureDemoOrg() {
  const user = await requireUser();
  const existing = await getUserOrganizations(user.id);
  if (existing.length > 0) return existing[0];

  try {
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
  } catch {
    // A double-click (or slow first attempt + retry) can race two calls for
    // the same brand-new user — both see no existing org, both try to
    // create one, and the second hits the deterministic slug's unique
    // constraint. Fall back to whichever attempt actually won, same
    // approach as requireUser()'s race handling in lib/auth/rbac.ts.
    // (Queried directly, bypassing getUserOrganizations' request-level
    // cache() — that cache would just replay the earlier "no org yet" miss.)
    const [winner] = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, user.id))
      .limit(1);
    if (winner) return { id: winner.organizationId };
    throw new Error("Failed to set up your workspace. Please try again.");
  }
}

export async function startDemo() {
  await ensureDemoOrg();
  redirect("/dashboard");
}

export async function requestProAccess() {
  await ensureDemoOrg();
  redirect("/dashboard/request-access");
}
