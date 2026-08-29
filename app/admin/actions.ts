"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accessRequests, organizations, users } from "@/lib/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";

export async function approveAccessRequest(requestId: string) {
  const actor = await requirePlatformAdmin();
  const [request] = await db
    .select()
    .from(accessRequests)
    .where(eq(accessRequests.id, requestId))
    .limit(1);
  if (!request) return;

  if (request.organizationId) {
    await db
      .update(organizations)
      .set({ isDemo: false })
      .where(eq(organizations.id, request.organizationId));
  }
  await db
    .update(accessRequests)
    .set({ status: "approved" })
    .where(eq(accessRequests.id, requestId));

  await logActivity({
    actorId: actor.id,
    action: "access_request.approved",
    entityType: "access_request",
    entityId: requestId,
    searchText: `Granted Pro access to ${request.name} (${request.email})`,
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
