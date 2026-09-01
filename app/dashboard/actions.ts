"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/rbac";
import { hasRealProject, canCreateOwnProject, createProjectForUser } from "@/lib/project-access";
import { logActivity } from "@/lib/activity";

export async function createProject(
  formData: FormData
): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return;

  if (!(await hasRealProject(user.id)) && !(await canCreateOwnProject(user.id))) {
    return { error: "Request project access before creating a project." };
  }

  const result = await createProjectForUser(user.id, name, description || null);
  if ("error" in result) return result;
  const { project } = result;

  await logActivity({
    actorId: user.id,
    projectId: project.id,
    action: "project.created",
    entityType: "project",
    entityId: project.id,
    after: { name: project.name, slug: project.slug },
    searchText: `Created project "${project.name}"`,
  });

  revalidatePath("/dashboard");
}
