import "server-only";
import { randomBytes } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects, projectMembers, projectCounters, users, accessRequests } from "@/lib/db/schema";
import { seedDemoProject } from "@/lib/demo/seed";

/**
 * Project admin = whoever created it, or anyone explicitly flagged as an
 * admin on that project's membership row. Replaces the whole
 * roles/permissions/organization system — one flat check, per project.
 */
export async function isProjectAdmin(userId: string, projectId: string): Promise<boolean> {
  const [project] = await db
    .select({ createdBy: projects.createdBy })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (project?.createdBy === userId) return true;

  const [member] = await db
    .select({ isAdmin: projectMembers.isAdmin })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return member?.isAdmin ?? false;
}

/**
 * Adds a user to a project if they aren't already a member. Shared by the
 * shareable invite-link flow (app/join/[code]/page.tsx).
 */
export async function joinProjectById(userId: string, projectId: string) {
  const [existing] = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  if (existing) return;

  await db.insert(projectMembers).values({ projectId, userId });
}

export async function getOrCreateProjectInviteCode(projectId: string) {
  const [project] = await db
    .select({ inviteCode: projects.inviteCode })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (project?.inviteCode) return project.inviteCode;

  const code = randomBytes(6).toString("base64url");
  await db.update(projects).set({ inviteCode: code }).where(eq(projects.id, projectId));
  return code;
}

/**
 * Active users assignable to work items — scoped to the project's own
 * members so people never see or assign work to strangers on other projects.
 */
export async function getProjectMemberUsers(projectId: string) {
  return db
    .select({ id: users.id, name: users.name })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(and(eq(projectMembers.projectId, projectId), eq(users.isActive, true)));
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(base: string) {
  let slug = base;
  let suffix = 1;
  while (true) {
    const [existing] = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug)).limit(1);
    if (!existing) return slug;
    slug = `${base}-${++suffix}`;
  }
}

/** A real (non-demo) project, fully independent — the creator is its admin. */
export async function createProjectForUser(userId: string, name: string) {
  const slug = await uniqueSlug(slugify(name) || "project");
  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({ name, slug, createdBy: userId })
      .returning();
    await tx.insert(projectCounters).values({ projectId: project.id });
    await tx.insert(projectMembers).values({ projectId: project.id, userId, isAdmin: true });
    return project;
  });
}

export async function createDemoProjectForUser(userId: string) {
  return seedDemoProject(userId);
}

export async function hasRealProject(userId: string): Promise<boolean> {
  const [realProject] = await db
    .select({ id: projects.id })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(and(eq(projectMembers.userId, userId), eq(projects.isDemo, false)))
    .limit(1);
  return !!realProject;
}

/**
 * True once an admin has approved this user's access request and they
 * haven't already created a real project — gates the "create your project"
 * prompt shown on their demo project.
 */
export async function canCreateOwnProject(userId: string): Promise<boolean> {
  if (await hasRealProject(userId)) return false;

  const [approved] = await db
    .select({ id: accessRequests.id })
    .from(accessRequests)
    .where(and(eq(accessRequests.userId, userId), eq(accessRequests.status, "approved")))
    .limit(1);
  return !!approved;
}
