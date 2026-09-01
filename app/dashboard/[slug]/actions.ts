"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/rbac";
import {
  isProjectAdmin,
  updateProjectDetails,
  setProjectAutoApprove,
  setProjectOwnerArchived,
  getOrCreateProjectInviteCode,
} from "@/lib/project-access";
import { logActivity } from "@/lib/activity";

async function requireProjectManager(projectId: string) {
  const user = await requireUser();
  if (!(await isProjectAdmin(user.id, projectId))) redirect("/dashboard");
  return user;
}

export async function updateProject(
  projectId: string,
  slug: string,
  fields: { name?: string; description?: string }
): Promise<{ error: string } | undefined> {
  const actor = await requireProjectManager(projectId);
  const result = await updateProjectDetails(projectId, actor.id, fields);
  if (result?.error) return result;

  await logActivity({
    actorId: actor.id,
    projectId,
    action: "project.updated",
    entityType: "project",
    entityId: projectId,
    after: fields,
    searchText: fields.name ? `Renamed the project to "${fields.name.trim()}"` : "Updated the project's description",
  });

  revalidatePath(`/dashboard/${slug}`);
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

  revalidatePath(`/dashboard/${slug}`);
}

export async function ensureInviteCode(projectId: string) {
  await requireProjectManager(projectId);
  return getOrCreateProjectInviteCode(projectId);
}

export async function setArchived(projectId: string, slug: string, archived: boolean) {
  const actor = await requireProjectManager(projectId);
  await setProjectOwnerArchived(projectId, actor.id, archived);

  await logActivity({
    actorId: actor.id,
    projectId,
    action: archived ? "project.archived" : "project.unarchived",
    entityType: "project",
    entityId: projectId,
    searchText: archived ? "Archived the project" : "Unarchived the project",
  });

  revalidatePath(`/dashboard/${slug}`);
  revalidatePath("/dashboard");
}
