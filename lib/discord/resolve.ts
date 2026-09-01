import "server-only";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects, projectMembers, users, workItems } from "@/lib/db/schema";
import { formatStatusLabel } from "@/lib/work-items";

export async function resolveUserByDiscordId(discordUserId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordUserId, discordUserId))
    .limit(1);
  return user ?? null;
}

/** Every project a user belongs to — backs the `project` autocomplete everywhere it appears. */
export async function listUserProjects(userId: string, query?: string) {
  return db
    .select({ id: projects.id, name: projects.name })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(
      and(
        eq(projectMembers.userId, userId),
        query ? ilike(projects.name, `%${query}%`) : undefined
      )
    )
    .limit(25);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves whatever a user typed into the `project` option — the autocomplete
 * suggestion's id if they picked one, or free-typed text matched by id or
 * name — scoped to projects they actually belong to.
 */
export async function resolveUserProject(userId: string, input: string) {
  const matchesInput = UUID_RE.test(input)
    ? or(eq(projects.id, input), ilike(projects.name, input))
    : ilike(projects.name, input);

  const [project] = await db
    .select({ project: projects })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(and(eq(projectMembers.userId, userId), matchesInput))
    .limit(1);
  return project?.project ?? null;
}

/**
 * Shared project resolution for every command that needs exactly one
 * project: an explicit `project` option always wins; otherwise, since
 * there's no more one-server-one-project link, default to the user's only
 * project if they have just one, or ask them to pick (there's no server-wide
 * fallback — everyone just sees all of their own projects, picked by name).
 */
export async function resolveCommandProject(
  userId: string,
  explicitInput: string | undefined
): Promise<{ project: typeof projects.$inferSelect } | { error: string }> {
  if (explicitInput) {
    const project = await resolveUserProject(userId, explicitInput);
    if (!project) return { error: `No project called "${explicitInput}" that you belong to.` };
    return { project };
  }

  const mine = await listUserProjects(userId);
  if (mine.length === 0) return { error: "You're not in any projects yet." };
  if (mine.length > 1) {
    return {
      error: `You're in ${mine.length} projects — pass \`project\` to pick one: ${mine.map((p) => p.name).join(", ")}.`,
    };
  }

  const project = await resolveUserProject(userId, mine[0].id);
  if (!project) return { error: "Couldn't load your project — try again." };
  return { project };
}

/**
 * Resolves whatever a user typed into a work-item option — the autocomplete
 * suggestion's id if they picked one, or a free-typed task number (with or
 * without a leading "#") — scoped to one already-known project.
 */
export async function resolveProjectWorkItem(projectId: string, input: string) {
  const trimmed = input.trim();
  if (UUID_RE.test(trimmed)) {
    const [item] = await db
      .select()
      .from(workItems)
      .where(and(eq(workItems.id, trimmed), eq(workItems.projectId, projectId)))
      .limit(1);
    return item ?? null;
  }

  const number = parseInt(trimmed.replace(/^#/, ""), 10);
  if (Number.isNaN(number)) return null;
  const [item] = await db
    .select()
    .from(workItems)
    .where(and(eq(workItems.number, number), eq(workItems.projectId, projectId)))
    .limit(1);
  return item ?? null;
}

/**
 * Work-item choices for a project's autocomplete — every suggestion always
 * shows the task number, title, AND current status together (e.g.
 * "#3 Fix login bug — Testing Pending") so picking one never means picking
 * blind.
 */
export async function listProjectWorkItemChoices(projectId: string, query?: string) {
  const rows = await db
    .select({ id: workItems.id, number: workItems.number, title: workItems.title, status: workItems.status })
    .from(workItems)
    .where(eq(workItems.projectId, projectId))
    .orderBy(desc(workItems.updatedAt))
    .limit(100);

  const q = (query ?? "").trim().toLowerCase().replace(/^#/, "");
  const matches = q
    ? rows.filter((r) => String(r.number).includes(q) || r.title.toLowerCase().includes(q))
    : rows;

  return matches.slice(0, 25).map((r) => ({
    id: r.id,
    label: `#${r.number} ${r.title} — ${formatStatusLabel(r.status)}`.slice(0, 100),
  }));
}
