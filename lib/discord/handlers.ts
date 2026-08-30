import "server-only";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  users,
  organizations,
  organizationMembers,
  projects,
  workItems,
  workItemAssignees,
} from "@/lib/db/schema";
import { canAccessProject, hasPermission } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";
import { getDeadlineStatus, deadlineUrgencyRank } from "@/lib/deadline";
import { formatStatusLabel } from "@/lib/work-items";
import { extractMentionedDiscordIds } from "./resolve";
import { buildEmbed, DANGER_COLOR, SUCCESS_COLOR } from "./embeds";

export type CommandReply = { content?: string; embeds?: unknown[]; ephemeral?: boolean };
type DiscordOrg = typeof organizations.$inferSelect;
type DiscordUser = typeof users.$inferSelect;

function fail(message: string): CommandReply {
  return { embeds: [buildEmbed({ title: "Couldn't do that", description: message, color: DANGER_COLOR })], ephemeral: true };
}

async function resolveProject(organizationId: string, name: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.organizationId, organizationId), ilike(projects.name, name)))
    .limit(1);
  return project ?? null;
}

async function resolveMentionedUsers(text: string): Promise<{ found: DiscordUser[]; unlinkedCount: number }> {
  const discordIds = extractMentionedDiscordIds(text);
  if (discordIds.length === 0) return { found: [], unlinkedCount: 0 };
  const found = await db.select().from(users).where(inArray(users.discordUserId, discordIds));
  return { found, unlinkedCount: discordIds.length - found.length };
}

// ============ /setup ============

export async function handleSetup(discordUser: DiscordUser, guildId: string, orgName: string): Promise<CommandReply> {
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(
      and(
        eq(organizationMembers.userId, discordUser.id),
        sql`(${ilike(organizations.name, orgName)} or ${ilike(organizations.slug, orgName)})`
      )
    )
    .limit(1);
  if (!org) return fail(`I can't find an organization called "${orgName}" that you belong to.`);
  if (!(await hasPermission(discordUser.id, org.id, "role.manage"))) {
    return fail("You need role-management permission in that organization to link a server.");
  }

  await db.update(organizations).set({ discordGuildId: guildId }).where(eq(organizations.id, org.id));
  await logActivity({
    actorId: discordUser.id,
    action: "organization.discord_linked",
    entityType: "organization",
    entityId: org.id,
    searchText: `Linked Discord server to "${org.name}"`,
  });

  return { embeds: [buildEmbed({ title: "Server linked", description: `This server is now linked to **${org.name}**. Every command here resolves to that organization.`, color: SUCCESS_COLOR })] };
}

// ============ /task list ============

export async function handleTaskList(
  org: DiscordOrg,
  args: { project?: string; status?: string; assignee?: string }
): Promise<CommandReply> {
  let projectId: string | null = null;
  if (args.project) {
    const project = await resolveProject(org.id, args.project);
    if (!project) return fail(`No project called "${args.project}" in this organization.`);
    projectId = project.id;
  }

  const orgProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.organizationId, org.id));
  const orgProjectIds = orgProjects.map((p) => p.id);
  if (orgProjectIds.length === 0) return fail("This organization has no projects yet.");

  let itemIds: string[] | null = null;
  if (args.assignee) {
    const rows = await db
      .select({ workItemId: workItemAssignees.workItemId })
      .from(workItemAssignees)
      .where(eq(workItemAssignees.userId, args.assignee));
    itemIds = rows.map((r) => r.workItemId);
    if (itemIds.length === 0) return { embeds: [buildEmbed({ title: "No tasks found", description: "Nothing matches those filters." })] };
  }

  const conditions = [
    inArray(workItems.projectId, projectId ? [projectId] : orgProjectIds),
    args.status ? eq(workItems.status, args.status as never) : undefined,
    itemIds ? inArray(workItems.id, itemIds) : undefined,
  ].filter((c) => c !== undefined);

  const rows = await db
    .select({
      number: workItems.number,
      title: workItems.title,
      status: workItems.status,
      priority: workItems.priority,
      projectName: projects.name,
    })
    .from(workItems)
    .innerJoin(projects, eq(workItems.projectId, projects.id))
    .where(and(...conditions))
    .orderBy(desc(workItems.updatedAt))
    .limit(20);

  if (rows.length === 0) return { embeds: [buildEmbed({ title: "No tasks found", description: "Nothing matches those filters." })] };

  return {
    embeds: [
      buildEmbed({
        title: `${rows.length} task${rows.length === 1 ? "" : "s"}`,
        description: rows
          .map((r) => `**#${r.number}** ${r.title} — _${r.projectName}_ · ${formatStatusLabel(r.status)}${r.priority !== "none" ? ` · ${r.priority}` : ""}`)
          .join("\n"),
      }),
    ],
  };
}

// ============ /task view ============

export async function handleTaskView(org: DiscordOrg, args: { project: string; id: number }): Promise<CommandReply> {
  const project = await resolveProject(org.id, args.project);
  if (!project) return fail(`No project called "${args.project}" in this organization.`);

  const [item] = await db
    .select()
    .from(workItems)
    .where(and(eq(workItems.projectId, project.id), eq(workItems.number, args.id)))
    .limit(1);
  if (!item) return fail(`No task #${args.id} in ${project.name}.`);

  const assignees = await db
    .select({ name: users.name })
    .from(workItemAssignees)
    .innerJoin(users, eq(workItemAssignees.userId, users.id))
    .where(eq(workItemAssignees.workItemId, item.id));

  return {
    embeds: [
      buildEmbed({
        title: `#${item.number} ${item.title}`,
        description: item.description || undefined,
        fields: [
          { name: "Status", value: formatStatusLabel(item.status), inline: true },
          { name: "Priority", value: item.priority, inline: true },
          { name: "Assignees", value: assignees.length ? assignees.map((a) => a.name).join(", ") : "Unassigned" },
          ...(item.dueDate ? [{ name: "Due", value: item.dueDate, inline: true }] : []),
        ],
      }),
    ],
  };
}

// ============ /task assign ============

export async function handleTaskAssign(
  user: DiscordUser,
  org: DiscordOrg,
  args: { project: string; id: number; mentions: string; due?: string }
): Promise<CommandReply> {
  const project = await resolveProject(org.id, args.project);
  if (!project) return fail(`No project called "${args.project}" in this organization.`);
  if (!(await canAccessProject(user, project.id))) return fail("You don't have access to that project.");

  const [item] = await db
    .select()
    .from(workItems)
    .where(and(eq(workItems.projectId, project.id), eq(workItems.number, args.id)))
    .limit(1);
  if (!item) return fail(`No task #${args.id} in ${project.name}.`);

  const { found: newAssignees, unlinkedCount } = await resolveMentionedUsers(args.mentions);
  if (newAssignees.length > 0 && !args.due) return fail("A deadline is required when assigning a task — pass `due`.");

  const current = await db
    .select({ userId: workItemAssignees.userId })
    .from(workItemAssignees)
    .where(eq(workItemAssignees.workItemId, item.id));
  const currentIds = current.map((c) => c.userId);
  const newIds = newAssignees.map((a) => a.id);
  const toAdd = newAssignees.filter((a) => !currentIds.includes(a.id));
  const toRemove = currentIds.filter((id) => !newIds.includes(id));

  await db.update(workItems).set({ dueDate: args.due || null, updatedAt: new Date() }).where(eq(workItems.id, item.id));
  if (toRemove.length > 0) {
    await db.delete(workItemAssignees).where(and(eq(workItemAssignees.workItemId, item.id), inArray(workItemAssignees.userId, toRemove)));
  }
  if (toAdd.length > 0) {
    await db.insert(workItemAssignees).values(toAdd.map((a) => ({ workItemId: item.id, userId: a.id, assignedBy: user.id })));
  }

  await logActivity({
    actorId: user.id,
    projectId: project.id,
    action: "work_item.assigned",
    entityType: "work_item",
    entityId: item.id,
    after: { assigneeIds: newIds },
    searchText: `Assigned "${item.title}" via Discord`,
  });

  return {
    embeds: [
      buildEmbed({
        title: `#${item.number} ${item.title}`,
        description: `Now assigned to ${newAssignees.length ? newAssignees.map((a) => a.name).join(", ") : "no one"}.${unlinkedCount > 0 ? `\n\n_${unlinkedCount} mentioned user${unlinkedCount === 1 ? "" : "s"} haven't run \`/link\` yet._` : ""}`,
        color: SUCCESS_COLOR,
      }),
    ],
  };
}

// ============ /mytasks ============

export async function handleMyTasks(user: DiscordUser, org: DiscordOrg): Promise<CommandReply> {
  const orgProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.organizationId, org.id));
  const orgProjectIds = orgProjects.map((p) => p.id);
  if (orgProjectIds.length === 0) return { embeds: [buildEmbed({ title: "Nothing assigned to you", description: "This organization has no projects yet." })] };

  const myIds = (await db.select({ workItemId: workItemAssignees.workItemId }).from(workItemAssignees).where(eq(workItemAssignees.userId, user.id))).map((r) => r.workItemId);
  if (myIds.length === 0) return { embeds: [buildEmbed({ title: "Nothing assigned to you right now" })] };

  const rows = await db
    .select({ number: workItems.number, title: workItems.title, status: workItems.status, dueDate: workItems.dueDate, projectName: projects.name })
    .from(workItems)
    .innerJoin(projects, eq(workItems.projectId, projects.id))
    .where(and(inArray(workItems.id, myIds), inArray(workItems.projectId, orgProjectIds)));

  const sorted = rows.sort((a, b) => deadlineUrgencyRank(getDeadlineStatus(a.dueDate, a.status)) - deadlineUrgencyRank(getDeadlineStatus(b.dueDate, b.status)));

  return {
    embeds: [
      buildEmbed({
        title: `Your tasks (${sorted.length})`,
        description: sorted.map((r) => `**#${r.number}** ${r.title} — _${r.projectName}_ · ${formatStatusLabel(r.status)}${r.dueDate ? ` · due ${r.dueDate}` : ""}`).join("\n"),
      }),
    ],
    ephemeral: true,
  };
}
