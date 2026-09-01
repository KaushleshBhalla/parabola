"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projectMembers, users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import {
  isProjectAdmin,
  renameProject,
  setProjectAutoApprove,
  getOrCreateProjectInviteCode,
  approveJoinRequest,
  declineJoinRequest,
} from "@/lib/project-access";
import { logActivity } from "@/lib/activity";

async function requireProjectManager(projectId: string) {
  const user = await requireUser();
  if (!(await isProjectAdmin(user.id, projectId))) redirect("/dashboard");
  return user;
}

export async function updateProjectName(
  projectId: string,
  slug: string,
  name: string
): Promise<{ error: string } | undefined> {
  const actor = await requireProjectManager(projectId);
  const result = await renameProject(projectId, actor.id, name);
  if (result?.error) return result;

  await logActivity({
    actorId: actor.id,
    projectId,
    action: "project.renamed",
    entityType: "project",
    entityId: projectId,
    after: { name: name.trim() },
    searchText: `Renamed the project to "${name.trim()}"`,
  });

  revalidatePath(`/dashboard/${slug}/members`);
  revalidatePath("/dashboard");
}

export async function setAutoApprove(projectId: string, slug: string, enabled: boolean) {
  const actor = await requireProjectManager(projectId);
  await setProjectAutoApprove(projectId, actor.id, enabled);

  await logActivity({
    actorId: actor.id,
    projectId,
    action: "project.auto_approve_changed",
    entityType: "project",
    entityId: projectId,
    after: { autoApproveJoinRequests: enabled },
    searchText: `${enabled ? "Turned on" : "Turned off"} auto-approve for join requests`,
  });

  revalidatePath(`/dashboard/${slug}/members`);
}

export async function ensureInviteCode(projectId: string) {
  await requireProjectManager(projectId);
  return getOrCreateProjectInviteCode(projectId);
}

export async function respondToJoinRequest(
  requestId: string,
  projectId: string,
  slug: string,
  approve: boolean
): Promise<{ error: string } | undefined> {
  const actor = await requireProjectManager(projectId);
  const result = approve
    ? await approveJoinRequest(requestId, actor.id)
    : await declineJoinRequest(requestId, actor.id);
  if (result?.error) return result;

  revalidatePath(`/dashboard/${slug}/members`);
}

export async function addProjectMemberByEmail(
  projectId: string,
  email: string,
  slug: string
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

  await db.insert(projectMembers).values({ projectId, userId: target.id }).onConflictDoNothing();

  await logActivity({
    actorId: actor.id,
    projectId,
    action: "project_member.added",
    entityType: "project_member",
    entityId: target.id,
    searchText: `Added ${target.name} (${normalized}) to the project by email`,
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
