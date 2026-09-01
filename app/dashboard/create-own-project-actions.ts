"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/rbac";
import { canCreateOwnProject, createProjectForUser } from "@/lib/project-access";
import { logActivity } from "@/lib/activity";

export async function createOwnProject(
  name: string
): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  if (!(await canCreateOwnProject(user.id))) {
    return { error: "You don't have an approved request yet." };
  }
  const trimmed = name.trim();
  if (!trimmed) return { error: "Project name is required." };

  const result = await createProjectForUser(user.id, trimmed);
  if ("error" in result) return result;
  const { project } = result;

  await logActivity({
    actorId: user.id,
    projectId: project.id,
    action: "project.created",
    entityType: "project",
    entityId: project.id,
    after: { name: trimmed, slug: project.slug },
    searchText: `Created project "${trimmed}"`,
  });

  redirect(`/dashboard/${project.slug}/work-items`);
}
