"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  users,
  sessions,
  projects,
  projectMembers,
  workItems,
  workItemComments,
  chatMessages,
  roadmapItems,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { hashPassword, encryptReversible } from "@/lib/auth/password";
import { logActivity } from "@/lib/activity";

const ASSIGNABLE_ROLES = ["admin", "member"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

function isAssignableRole(value: string): value is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

export async function createUser(formData: FormData) {
  const actor = await requireRole("admin");
  const name = String(formData.get("name") ?? "").trim();
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roleInput = String(formData.get("role") ?? "member");
  const role: AssignableRole = isAssignableRole(roleInput) ? roleInput : "member";

  if (!name || !login || !password) return;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, login))
    .limit(1);
  if (existing) return;

  const [newUser] = await db
    .insert(users)
    .values({
      name,
      email: login,
      passwordHash: await hashPassword(password),
      passwordEncrypted: encryptReversible(password),
      role,
    })
    .returning();

  await logActivity({
    actorId: actor.id,
    action: "user.created",
    entityType: "user",
    entityId: newUser.id,
    after: { name, login, role },
    searchText: `Created user "${name}" (${login}) as ${role}`,
  });

  revalidatePath("/dashboard/team");
}

export async function updateUserRole(userId: string, role: string) {
  const actor = await requireRole("admin");
  if (!isAssignableRole(role)) return;
  if (role === "admin" && actor.role !== "owner") return;

  const [target] = await db
    .select({ name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) return;

  await db.update(users).set({ role }).where(eq(users.id, userId));

  await logActivity({
    actorId: actor.id,
    action: "user.role_changed",
    entityType: "user",
    entityId: userId,
    before: { role: target.role },
    after: { role },
    searchText: `Changed ${target.name}'s role to ${role}`,
  });

  revalidatePath("/dashboard/team");
}

export async function setUserActive(userId: string, isActive: boolean) {
  const actor = await requireRole("admin");

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
    searchText: `${isActive ? "Activated" : "Deactivated"} ${target.name}`,
  });

  revalidatePath("/dashboard/team");
}

export async function deleteUser(userId: string, purgeContent: boolean) {
  const actor = await requireRole("admin");
  if (userId === actor.id) return;

  const [target] = await db
    .select({ name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target || target.role === "owner") return;

  if (purgeContent) {
    await db.delete(workItems).where(eq(workItems.createdBy, userId));
    await db
      .delete(workItemComments)
      .where(eq(workItemComments.authorId, userId));
    await db.delete(chatMessages).where(eq(chatMessages.authorId, userId));
    await db.delete(roadmapItems).where(eq(roadmapItems.createdBy, userId));
  }

  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(projectMembers).where(eq(projectMembers.userId, userId));
  await db
    .update(users)
    .set({ deletedAt: new Date(), isActive: false })
    .where(eq(users.id, userId));

  await logActivity({
    actorId: actor.id,
    action: "user.deleted",
    entityType: "user",
    entityId: userId,
    searchText: purgeContent
      ? `Deleted ${target.name} and everything they created`
      : `Deleted ${target.name} (their content was kept)`,
  });

  revalidatePath("/dashboard/team");
}

export async function setUserProjectAccess(
  userId: string,
  projectIds: string[]
) {
  const actor = await requireRole("admin");

  const [target] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) return;

  await db.transaction(async (tx) => {
    if (projectIds.length > 0) {
      await tx
        .delete(projectMembers)
        .where(
          and(
            eq(projectMembers.userId, userId),
            notInArray(projectMembers.projectId, projectIds)
          )
        );
      await tx
        .insert(projectMembers)
        .values(projectIds.map((projectId) => ({ projectId, userId })))
        .onConflictDoNothing();
    } else {
      await tx.delete(projectMembers).where(eq(projectMembers.userId, userId));
    }
  });

  const grantedNames = projectIds.length
    ? (
        await db
          .select({ name: projects.name })
          .from(projects)
          .where(inArray(projects.id, projectIds))
      )
        .map((p) => p.name)
        .join(", ")
    : "no projects";

  await logActivity({
    actorId: actor.id,
    action: "user.project_access_updated",
    entityType: "user",
    entityId: userId,
    after: { projectIds },
    searchText: `Set ${target.name}'s project access to: ${grantedNames}`,
  });

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard");
}
