"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projectMembers, users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import { isProjectAdmin, approveJoinRequest, declineJoinRequest, setMemberRole } from "@/lib/project-access";
import { logActivity } from "@/lib/activity";

async function requireProjectManager(projectId: string) {
  const user = await requireUser();
  if (!(await isProjectAdmin(user.id, projectId))) redirect("/dashboard");
  return user;
}

export async function respondToJoinRequest(
  requestId: string,
  projectId: string,
  slug: string,
  approve: boolean,
  isAdmin = false
): Promise<{ error: string } | undefined> {
  const actor = await requireProjectManager(projectId);
  const result = approve
    ? await approveJoinRequest(requestId, actor.id, isAdmin)
    : await declineJoinRequest(requestId, actor.id);
  if (result?.error) return result;

  if (approve) {
    await logActivity({
      actorId: actor.id,
      projectId,
      action: "project_join_request.approved",
      entityType: "project_join_request",
      entityId: requestId,
      after: { isAdmin },
      searchText: `Approved a join request as ${isAdmin ? "Admin" : "Member"}`,
    });
  }

  revalidatePath(`/dashboard/${slug}/members`);
}

export async function addProjectMemberByEmail(
  projectId: string,
  email: string,
  slug: string,
  isAdmin = false
): Promise<{ error: string } | undefined> {
  const actor = await requireProjectManager(projectId);
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { error: "Email is required." };

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  if (!target) {
    return { error: "No account found for that email — ask them to sign up first, then try again." };
  }

  await db.insert(projectMembers).values({ projectId, userId: target.id, isAdmin }).onConflictDoNothing();

  await logActivity({
    actorId: actor.id,
    projectId,
    action: "project_member.added",
    entityType: "project_member",
    entityId: target.id,
    searchText: `Added ${target.name} (${normalized}) to the project by email as ${isAdmin ? "Admin" : "Member"}`,
  });

  revalidatePath(`/dashboard/${slug}/members`);
}

export async function changeMemberRole(
  projectId: string,
  userId: string,
  slug: string,
  isAdmin: boolean
): Promise<{ error: string } | undefined> {
  const actor = await requireProjectManager(projectId);
  const result = await setMemberRole(projectId, actor.id, userId, isAdmin);
  if (result?.error) return result;

  const [target] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  await logActivity({
    actorId: actor.id,
    projectId,
    action: "project_member.role_changed",
    entityType: "project_member",
    entityId: userId,
    after: { isAdmin },
    searchText: `Changed ${target?.name ?? userId}'s role to ${isAdmin ? "Admin" : "Member"}`,
  });

  revalidatePath(`/dashboard/${slug}/members`);
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
  slug: string
) {
  const actor = await requireProjectManager(projectId);
  await db
    .delete(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    );

  const [target] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  await logActivity({
    actorId: actor.id,
    projectId,
    action: "project_member.removed",
    entityType: "project_member",
    entityId: userId,
    searchText: `Revoked ${target?.name ?? userId}'s access to the project`,
  });

  revalidatePath(`/dashboard/${slug}/members`);
}
