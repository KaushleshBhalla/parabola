"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accessRequests, organizations, users } from "@/lib/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";

// Approving doesn't touch their existing demo org (that stays exactly as-is,
// still exploration-only) — it just clears them to self-serve create their
// own real organization from the dashboard. See
// app/dashboard/create-organization-actions.ts for that step.
export async function approveAccessRequest(requestId: string) {
  const actor = await requirePlatformAdmin();
  const [request] = await db
    .select()
    .from(accessRequests)
    .where(eq(accessRequests.id, requestId))
    .limit(1);
  if (!request) return;

  await db
    .update(accessRequests)
    .set({ status: "approved" })
    .where(eq(accessRequests.id, requestId));

  await logActivity({
    actorId: actor.id,
    action: "access_request.approved",
    entityType: "access_request",
    entityId: requestId,
    searchText: `Approved ${request.name} (${request.email}) to create their own organization`,
  });

  revalidatePath("/admin");
}

export async function declineAccessRequest(requestId: string) {
  const actor = await requirePlatformAdmin();
  const [request] = await db
    .select({ name: accessRequests.name, email: accessRequests.email })
    .from(accessRequests)
    .where(eq(accessRequests.id, requestId))
    .limit(1);
  if (!request) return;

  await db
    .update(accessRequests)
    .set({ status: "declined" })
    .where(eq(accessRequests.id, requestId));

  await logActivity({
    actorId: actor.id,
    action: "access_request.declined",
    entityType: "access_request",
    entityId: requestId,
    searchText: `Declined access request from ${request.name} (${request.email})`,
  });

  revalidatePath("/admin");
}

export async function markAccessRequestContacted(requestId: string) {
  const actor = await requirePlatformAdmin();
  const [request] = await db
    .select({ name: accessRequests.name, email: accessRequests.email })
    .from(accessRequests)
    .where(eq(accessRequests.id, requestId))
    .limit(1);
  if (!request) return;

  await db
    .update(accessRequests)
    .set({ status: "contacted" })
    .where(eq(accessRequests.id, requestId));

  await logActivity({
    actorId: actor.id,
    action: "access_request.contacted",
    entityType: "access_request",
    entityId: requestId,
    searchText: `Marked ${request.name} (${request.email}) as contacted`,
  });

  revalidatePath("/admin");
}

export async function setOrgProStatus(organizationId: string, isDemo: boolean) {
  const actor = await requirePlatformAdmin();
  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) return;

  await db
    .update(organizations)
    .set(isDemo ? { isDemo: true } : { isDemo: false, demoCreationsUsed: 0 })
    .where(eq(organizations.id, organizationId));

  await logActivity({
    actorId: actor.id,
    action: isDemo ? "organization.pro_revoked" : "organization.pro_granted",
    entityType: "organization",
    entityId: organizationId,
    searchText: `${isDemo ? "Revoked Pro access from" : "Granted Pro access to"} "${org.name}"`,
  });

  revalidatePath("/admin/organizations");
  revalidatePath(`/admin/organizations/${organizationId}`);
}

export async function setUserActive(userId: string, isActive: boolean) {
  const actor = await requirePlatformAdmin();
  if (userId === actor.id) return;

  const [target] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) return;

  await db.update(users).set({ isActive }).where(eq(users.id, userId));

  await logActivity({
    actorId: actor.id,
    action: isActive ? "user.activated" : "user.deactivated",
    entityType: "user",
    entityId: userId,
    searchText: `${isActive ? "Activated" : "Deactivated"} ${target.name} (platform admin)`,
  });

  revalidatePath("/admin/users");
}

export async function setPlatformAdmin(userId: string, isPlatformAdmin: boolean) {
  const actor = await requirePlatformAdmin();
  if (userId === actor.id) return;

  const [target] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) return;

  await db.update(users).set({ isPlatformAdmin }).where(eq(users.id, userId));

  await logActivity({
    actorId: actor.id,
    action: isPlatformAdmin ? "user.platform_admin_granted" : "user.platform_admin_revoked",
    entityType: "user",
    entityId: userId,
    searchText: `${isPlatformAdmin ? "Granted" : "Revoked"} platform admin for ${target.name}`,
  });

  revalidatePath("/admin/users");
}
