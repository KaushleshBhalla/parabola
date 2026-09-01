import "server-only";
import { randomBytes } from "node:crypto";
import { eq, and, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  projects,
  projectMembers,
  projectCounters,
  projectJoinRequests,
  users,
  accessRequests,
  notifications,
} from "@/lib/db/schema";
import { seedDemoProject } from "@/lib/demo/seed";

/**
 * Project admin = whoever created it, or anyone explicitly flagged as an
 * admin on that project's membership row. Replaces the whole
 * roles/permissions/organization system — one flat check, per project.
 */
async function getProjectAdminIds(projectId: string): Promise<string[]> {
  const [project] = await db
    .select({ createdBy: projects.createdBy })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const memberAdmins = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.isAdmin, true)));

  return [...new Set([project?.createdBy, ...memberAdmins.map((m) => m.userId)].filter((id): id is string => !!id))];
}

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
 * Adds a user to a project if they aren't already a member. Internal-only
 * now — the actual join surfaces (join code entry, /join/[code] link) go
 * through requestToJoinProject below, which respects each project's
 * auto-approve setting instead of always joining instantly.
 */
async function addProjectMember(userId: string, projectId: string) {
  await db.insert(projectMembers).values({ projectId, userId }).onConflictDoNothing();
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

/**
 * Real-project names are globally unique (demo projects are exempt — they're
 * all named "Parabola Demo" by design). `excludeProjectId` lets a rename
 * check ignore the project's own current name.
 */
export async function isProjectNameTaken(name: string, excludeProjectId?: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.name, name),
        eq(projects.isDemo, false),
        excludeProjectId ? ne(projects.id, excludeProjectId) : undefined
      )
    )
    .limit(1);
  return !!existing;
}

/** A real (non-demo) project, fully independent — the creator is its admin. */
export async function createProjectForUser(
  userId: string,
  name: string,
  description?: string | null
): Promise<{ project: typeof projects.$inferSelect } | { error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Project name is required." };
  if (await isProjectNameTaken(trimmed)) {
    return { error: `A project named "${trimmed}" already exists — pick a different name.` };
  }

  const slug = await uniqueSlug(slugify(trimmed) || "project");
  const project = await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(projects)
      .values({ name: trimmed, slug, description: description || null, createdBy: userId })
      .returning();
    await tx.insert(projectCounters).values({ projectId: p.id });
    await tx.insert(projectMembers).values({ projectId: p.id, userId, isAdmin: true });
    return p;
  });
  return { project };
}

/** Project admins can edit their project's name/description — name subject to the global-uniqueness rule. */
export async function updateProjectDetails(
  projectId: string,
  actorId: string,
  fields: { name?: string; description?: string | null }
): Promise<{ error: string } | undefined> {
  if (!(await isProjectAdmin(actorId, projectId))) return { error: "You can't manage that project." };

  const update: { name?: string; description?: string | null; updatedAt: Date } = { updatedAt: new Date() };

  if (fields.name !== undefined) {
    const trimmed = fields.name.trim();
    if (!trimmed) return { error: "Project name is required." };
    if (await isProjectNameTaken(trimmed, projectId)) {
      return { error: `A project named "${trimmed}" already exists — pick a different name.` };
    }
    update.name = trimmed;
  }

  if (fields.description !== undefined) {
    update.description = fields.description?.trim() || null;
  }

  await db.update(projects).set(update).where(eq(projects.id, projectId));
}

export async function setProjectAutoApprove(
  projectId: string,
  actorId: string,
  enabled: boolean
): Promise<{ error: string } | undefined> {
  if (!(await isProjectAdmin(actorId, projectId))) return { error: "You can't manage that project." };
  await db.update(projects).set({ autoApproveJoinRequests: enabled }).where(eq(projects.id, projectId));
}

/**
 * Self-service archive/unarchive — purely a "hide from my project list"
 * toggle, distinct from the platform-admin Pro-revoke lock (archivedAt).
 * An archived project is fully functional if visited directly.
 */
export async function setProjectOwnerArchived(
  projectId: string,
  actorId: string,
  archived: boolean
): Promise<{ error: string } | undefined> {
  if (!(await isProjectAdmin(actorId, projectId))) return { error: "You can't manage that project." };
  await db
    .update(projects)
    .set({ ownerArchivedAt: archived ? new Date() : null })
    .where(eq(projects.id, projectId));
}

type JoinOutcome =
  | { status: "already_member"; project: { id: string; name: string; slug: string } }
  | { status: "approved"; project: { id: string; name: string; slug: string } }
  | { status: "pending"; project: { id: string; name: string } }
  | { error: string };

/**
 * The one entry point for both join surfaces (the sidebar's code-entry form
 * and the /join/[code] link): resolves a project's invite code, then either
 * joins instantly (auto-approve on) or files a pending request an admin has
 * to act on (manual, the default) — never joins outright otherwise.
 */
export async function requestToJoinProject(userId: string, code: string): Promise<JoinOutcome> {
  const trimmed = code.trim();
  if (!trimmed) return { error: "Enter a join code." };

  const [project] = await db.select().from(projects).where(eq(projects.inviteCode, trimmed)).limit(1);
  if (!project) return { error: "That code doesn't match any project." };

  const [existingMember] = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, userId)))
    .limit(1);
  if (existingMember) {
    return { status: "already_member", project: { id: project.id, name: project.name, slug: project.slug } };
  }

  if (project.autoApproveJoinRequests) {
    await addProjectMember(userId, project.id);
    return { status: "approved", project: { id: project.id, name: project.name, slug: project.slug } };
  }

  const [inserted] = await db
    .insert(projectJoinRequests)
    .values({ projectId: project.id, userId })
    .onConflictDoNothing()
    .returning({ id: projectJoinRequests.id });

  if (inserted) {
    const [requester] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
    const adminIds = (await getProjectAdminIds(project.id)).filter((id) => id !== userId);
    if (adminIds.length > 0) {
      await db.insert(notifications).values(
        adminIds.map((adminId) => ({
          userId: adminId,
          type: "project_join_request" as const,
          body: `${requester?.name ?? "Someone"} asked to join "${project.name}".`,
          projectId: project.id,
        }))
      );
    }
  }

  return { status: "pending", project: { id: project.id, name: project.name } };
}

export async function getPendingJoinRequests(projectId: string) {
  return db
    .select({
      id: projectJoinRequests.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      createdAt: projectJoinRequests.createdAt,
    })
    .from(projectJoinRequests)
    .innerJoin(users, eq(projectJoinRequests.userId, users.id))
    .where(and(eq(projectJoinRequests.projectId, projectId), eq(projectJoinRequests.status, "pending")))
    .orderBy(projectJoinRequests.createdAt);
}

async function resolveJoinRequest(
  requestId: string,
  actorId: string,
  outcome: "approved" | "declined"
): Promise<{ error: string } | undefined> {
  const [request] = await db
    .select()
    .from(projectJoinRequests)
    .where(eq(projectJoinRequests.id, requestId))
    .limit(1);
  if (!request || request.status !== "pending") return { error: "That request is no longer pending." };
  if (!(await isProjectAdmin(actorId, request.projectId))) return { error: "You can't manage that project." };

  await db.transaction(async (tx) => {
    if (outcome === "approved") {
      await tx.insert(projectMembers).values({ projectId: request.projectId, userId: request.userId }).onConflictDoNothing();
    }
    await tx
      .update(projectJoinRequests)
      .set({ status: outcome, resolvedAt: new Date(), resolvedBy: actorId })
      .where(eq(projectJoinRequests.id, requestId));
  });
}

export const approveJoinRequest = (requestId: string, actorId: string) =>
  resolveJoinRequest(requestId, actorId, "approved");

export const declineJoinRequest = (requestId: string, actorId: string) =>
  resolveJoinRequest(requestId, actorId, "declined");

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
 * True only if the real project is also unarchived — unlike hasRealProject,
 * this goes false again once an admin revokes Pro access (which archives
 * the project rather than deleting it). Drives the sidebar's Pro badge.
 */
export async function hasActiveRealProject(userId: string): Promise<boolean> {
  const [realProject] = await db
    .select({ id: projects.id })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projects.isDemo, false),
        isNull(projects.archivedAt)
      )
    )
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
