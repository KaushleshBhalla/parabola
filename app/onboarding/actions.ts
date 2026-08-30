"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projectMembers } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import { createDemoProjectForUser } from "@/lib/project-access";
import { logActivity } from "@/lib/activity";

async function ensureDemoProject() {
  const user = await requireUser();
  const [existing] = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, user.id))
    .limit(1);
  if (existing) return existing.projectId;

  try {
    const project = await createDemoProjectForUser(user.id);
    await logActivity({
      actorId: user.id,
      projectId: project.id,
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      after: { name: project.name, slug: project.slug, isDemo: true },
      searchText: `Created demo project "${project.name}"`,
    });
    return project.id;
  } catch {
    // A double-click (or slow first attempt + retry) can race two calls for
    // the same brand-new user — both see no existing project, both try to
    // create one, and the second hits the deterministic slug's unique
    // constraint. Fall back to whichever attempt actually won, same
    // approach as requireUser()'s race handling in lib/auth/rbac.ts.
    const [winner] = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, user.id))
      .limit(1);
    if (winner) return winner.projectId;
    throw new Error("Failed to set up your workspace. Please try again.");
  }
}

export async function startDemo() {
  await ensureDemoProject();
  redirect("/dashboard");
}

export async function requestProAccess() {
  await ensureDemoProject();
  redirect("/dashboard/request-access");
}
