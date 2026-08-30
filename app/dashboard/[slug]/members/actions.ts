"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projectMembers, projects, users } from "@/lib/db/schema";
import { requireUser, hasRole, hasPermission } from "@/lib/auth/rbac";
import { joinOrganizationById } from "@/lib/organizations";
import { logActivity } from "@/lib/activity";

// Whoever can manage the project's organization roles (or, for orgless
// legacy projects, a legacy global admin) can manage this project's
// membership — "admin role in the project" in practice.
async function requireProjectManager(projectId: string) {
  const user = await requireUser();
  const [project] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const allowed = project?.organizationId
    ? await hasPermission(user.id, project.organizationId, "role.manage")
    : hasRole(user.role, "admin");
  if (!allowed) redirect("/dashboard");
  return { user, organizationId: project?.organizationId ?? null };
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  slug: string
) {
  const { user: actor } = await requireProjectManager(projectId);
  await db
    .insert(projectMembers)
    .values({ projectId, userId })
    .onConflictDoNothing();

  const [target] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  await logActivity({
    actorId: actor.id,
    projectId,
    action: "project_member.added",
    entityType: "project_member",
    entityId: userId,
    searchText: `Granted ${target?.name ?? userId} access to the project`,
  });

  revalidatePath(`/dashboard/${slug}/members`);
}

export async function addProjectMemberByEmail(
  projectId: string,
  email: string,
  slug: string
): Promise<{ error: string } | undefined> {
  const { user: actor, organizationId } = await requireProjectManager(projectId);
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

  if (organizationId) {
    await joinOrganizationById(target.id, organizationId);
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
  const { user: actor } = await requireProjectManager(projectId);
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
