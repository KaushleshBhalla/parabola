"use server";

import { requireUser } from "@/lib/auth/rbac";
import { requestToJoinProject } from "@/lib/project-access";
import { logActivity } from "@/lib/activity";

export type JoinCodeState =
  | { error: string }
  | { message: string; slug?: string }
  | null;

export async function submitJoinCode(
  _prev: JoinCodeState,
  formData: FormData
): Promise<JoinCodeState> {
  const user = await requireUser();
  const code = String(formData.get("code") ?? "");

  const result = await requestToJoinProject(user.id, code);
  if ("error" in result) return { error: result.error };

  if (result.status === "already_member") {
    return { message: `You're already a member of ${result.project.name}.`, slug: result.project.slug };
  }

  if (result.status === "approved") {
    await logActivity({
      actorId: user.id,
      projectId: result.project.id,
      action: "project_member.joined_via_link",
      entityType: "project",
      entityId: result.project.id,
      searchText: `${user.name} joined "${result.project.name}" via join code`,
    });
    return { message: `You're in! Welcome to ${result.project.name}.`, slug: result.project.slug };
  }

  await logActivity({
    actorId: user.id,
    projectId: result.project.id,
    action: "project_join_request.submitted",
    entityType: "project",
    entityId: result.project.id,
    searchText: `${user.name} requested to join "${result.project.name}" via join code`,
  });
  return { message: `Request sent — ${result.project.name} requires approval, and you'll get access once that happens.` };
}
