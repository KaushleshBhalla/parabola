"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projectMembers, users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";

export async function addProjectMember(
  projectId: string,
  userId: string,
  slug: string
) {
  const actor = await requireRole("admin");
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

export async function removeProjectMember(
  projectId: string,
  userId: string,
  slug: string
) {
  const actor = await requireRole("admin");
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
