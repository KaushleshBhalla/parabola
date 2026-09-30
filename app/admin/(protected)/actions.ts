"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accessRequests, projects, users } from "@/lib/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";

// Approving doesn't touch their existing demo project (that stays exactly
// as-is, still exploration-only) — it just clears them to self-serve create
// their own separate, real project from the dashboard. See
// app/dashboard/create-own-project-actions.ts for that step. If they'd
// previously been revoked (see revokeAccessApproval below), this also
// un-archives whatever real project they already built instead of leaving
// them to create a second one from scratch.
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

  let unarchivedCount = 0;
  if (request.userId) {
    const unarchived = await db
      .update(projects)
      .set({ archivedAt: null })
      .where(and(eq(projects.createdBy, request.userId), eq(projects.isDemo, false)))
      .returning({ id: projects.id });
    unarchivedCount = unarchived.length;
  }

  await logActivity({
    actorId: actor.id,
    action: "access_request.approved",
    entityType: "access_request",
    entityId: requestId,
    searchText: `Approved ${request.name} (${request.email}) to create their own project${unarchivedCount > 0 ? " (unarchived their existing project)" : ""}`,
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

/**
 * Takes back a previously-approved Pro grant: the request can't be used to
 * create (or re-unlock) a project again until re-approved, and any real
 * project they already created is archived — locked behind a "needs Pro
 * access" screen for every member, not deleted, so approving them again
 * (above) brings it right back.
 */
export async function revokeAccessApproval(requestId: string) {
  const actor = await requirePlatformAdmin();
  const [request] = await db
    .select()
    .from(accessRequests)
    .where(eq(accessRequests.id, requestId))
    .limit(1);
  if (!request || request.status !== "approved") return;

  await db
    .update(accessRequests)
    .set({ status: "revoked" })
    .where(eq(accessRequests.id, requestId));

  let archivedCount = 0;
  if (request.userId) {
    const archived = await db
      .update(projects)
      .set({ archivedAt: new Date() })
      .where(and(eq(projects.createdBy, request.userId), eq(projects.isDemo, false)))
      .returning({ id: projects.id });
    archivedCount = archived.length;
  }

  await logActivity({
    actorId: actor.id,
    action: "access_request.revoked",
    entityType: "access_request",
    entityId: requestId,
    searchText: `Revoked Pro access from ${request.name} (${request.email})${archivedCount > 0 ? ` and archived ${archivedCount} project${archivedCount === 1 ? "" : "s"}` : ""}`,
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
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

export async function setProjectDemoStatus(projectId: string, isDemo: boolean) {
  const actor = await requirePlatformAdmin();
  const [project] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return;

  await db
    .update(projects)
    .set(isDemo ? { isDemo: true } : { isDemo: false, demoCreationsUsed: 0 })
    .where(eq(projects.id, projectId));

  await logActivity({
    actorId: actor.id,
    projectId,
    action: isDemo ? "project.pro_revoked" : "project.pro_granted",
    entityType: "project",
    entityId: projectId,
    searchText: `${isDemo ? "Marked demo again" : "Marked as a real project"}: "${project.name}"`,
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${projectId}`);
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
