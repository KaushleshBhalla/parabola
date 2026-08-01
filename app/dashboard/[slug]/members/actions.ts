"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projectMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";

export async function addProjectMember(
  projectId: string,
  userId: string,
  slug: string
) {
  await requireRole("admin");
  await db
    .insert(projectMembers)
    .values({ projectId, userId })
    .onConflictDoNothing();
  revalidatePath(`/dashboard/${slug}/members`);
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
  slug: string
) {
  await requireRole("admin");
  await db
    .delete(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    );
  revalidatePath(`/dashboard/${slug}/members`);
}
