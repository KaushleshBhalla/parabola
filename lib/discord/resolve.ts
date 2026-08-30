import "server-only";
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects, projectMembers, users } from "@/lib/db/schema";

export async function resolveProjectByGuild(guildId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.discordGuildId, guildId))
    .limit(1);
  return project ?? null;
}

export async function resolveUserByDiscordId(discordUserId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordUserId, discordUserId))
    .limit(1);
  return user ?? null;
}

/** Discord mention strings look like <@123456> or <@!123456> (nickname form). */
export function extractMentionedDiscordIds(text: string): string[] {
  const matches = text.matchAll(/<@!?(\d+)>/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

/** Every project a user belongs to — backs the `project` autocomplete on /setup and /assign. */
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
