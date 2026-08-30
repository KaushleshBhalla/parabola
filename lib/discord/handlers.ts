import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  users,
  projects,
  projectCounters,
  workItems,
  workItemAssignees,
} from "@/lib/db/schema";
import { isProjectAdmin } from "@/lib/project-access";
import { getProjectDemoState, assertDemoCreationAllowed, incrementDemoUsage } from "@/lib/demo";
import { logActivity } from "@/lib/activity";
import { getDeadlineStatus, deadlineUrgencyRank } from "@/lib/deadline";
import { formatStatusLabel } from "@/lib/work-items";
import { extractMentionedDiscordIds } from "./resolve";
import { buildEmbed, DANGER_COLOR, SUCCESS_COLOR } from "./embeds";

export type CommandReply = { content?: string; embeds?: unknown[]; ephemeral?: boolean };
type DiscordProject = typeof projects.$inferSelect;
type DiscordUser = typeof users.$inferSelect;

function fail(message: string): CommandReply {
  return { embeds: [buildEmbed({ title: "Couldn't do that", description: message, color: DANGER_COLOR })], ephemeral: true };
}

async function resolveMentionedUsers(text: string): Promise<{ found: DiscordUser[]; unlinkedCount: number }> {
  const discordIds = extractMentionedDiscordIds(text);
  if (discordIds.length === 0) return { found: [], unlinkedCount: 0 };
  const found = await db.select().from(users).where(inArray(users.discordUserId, discordIds));
  return { found, unlinkedCount: discordIds.length - found.length };
}

// ============ /setup ============

export async function handleSetup(discordUser: DiscordUser, guildId: string, project: DiscordProject): Promise<CommandReply> {
  if (!(await isProjectAdmin(discordUser.id, project.id))) {
    return fail("You need to be an admin on that project to link a server to it.");
  }

  await db.update(projects).set({ discordGuildId: guildId }).where(eq(projects.id, project.id));
  await logActivity({
    actorId: discordUser.id,
    projectId: project.id,
    action: "project.discord_linked",
    entityType: "project",
    entityId: project.id,
    searchText: `Linked Discord server to "${project.name}"`,
  });

  return { embeds: [buildEmbed({ title: "Server linked", description: `This server is now linked to **${project.name}**. \`/task\` and \`/assign\` default to this project from here on.`, color: SUCCESS_COLOR })] };
}

// ============ /task list ============

export async function handleTaskList(
  project: DiscordProject,
  args: { status?: string; assignee?: string }
): Promise<CommandReply> {
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
    eq(workItems.projectId, project.id),
    args.status ? eq(workItems.status, args.status as never) : undefined,
    itemIds ? inArray(workItems.id, itemIds) : undefined,
  ].filter((c) => c !== undefined);

  const rows = await db
    .select({
      number: workItems.number,
      title: workItems.title,
      status: workItems.status,
      priority: workItems.priority,
    })
    .from(workItems)
    .where(and(...conditions))
    .orderBy(desc(workItems.updatedAt))
    .limit(20);

  if (rows.length === 0) return { embeds: [buildEmbed({ title: "No tasks found", description: "Nothing matches those filters." })] };

  return {
    embeds: [
      buildEmbed({
        title: `${rows.length} task${rows.length === 1 ? "" : "s"} in ${project.name}`,
        description: rows
          .map((r) => `**#${r.number}** ${r.title} — ${formatStatusLabel(r.status)}${r.priority !== "none" ? ` · ${r.priority}` : ""}`)
          .join("\n"),
      }),
    ],
  };
}

// ============ /task view ============

export async function handleTaskView(project: DiscordProject, args: { id: number }): Promise<CommandReply> {
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

// ============ /assign ============

const PRIORITIES = ["low", "medium", "high"] as const;

export async function handleAssign(
  user: DiscordUser,
  project: DiscordProject,
  args: { mentions: string; work: string; priority?: string; deadline?: string }
): Promise<CommandReply> {
  const demoState = await getProjectDemoState(project.id);
  const demoBlocked = assertDemoCreationAllowed(demoState);
  if (demoBlocked) return fail(demoBlocked);

  const priority = args.priority && (PRIORITIES as readonly string[]).includes(args.priority) ? args.priority : "none";
  const { found: assignees, unlinkedCount } = await resolveMentionedUsers(args.mentions);
  if (assignees.length === 0) return fail("Mention at least one person who's linked their Parabola account with `/link`.");

  const [counter] = await db
    .update(projectCounters)
    .set({ nextNumber: sql`${projectCounters.nextNumber} + 1` })
    .where(eq(projectCounters.projectId, project.id))
    .returning();

  const [item] = await db
    .insert(workItems)
    .values({
      projectId: project.id,
      number: counter.nextNumber - 1,
      title: args.work,
      priority: priority as "none" | "low" | "medium" | "high",
      dueDate: args.deadline || null,
      position: Date.now(),
      createdBy: user.id,
    })
    .returning();

  await db.insert(workItemAssignees).values(
    assignees.map((a) => ({ workItemId: item.id, userId: a.id, assignedBy: user.id }))
  );

  if (demoState?.isDemo) {
    await incrementDemoUsage(project.id);
  }

  await logActivity({
    actorId: user.id,
    projectId: project.id,
    action: "work_item.created",
    entityType: "work_item",
    entityId: item.id,
    after: { title: args.work, priority, assigneeIds: assignees.map((a) => a.id) },
    searchText: `Created "#${item.number} ${args.work}" via Discord`,
  });

  return {
    embeds: [
      buildEmbed({
        title: `#${item.number} ${item.title}`,
        description: `Created in **${project.name}** and assigned to ${assignees.map((a) => a.name).join(", ")}.${args.deadline ? `\nDue ${args.deadline}.` : ""}${unlinkedCount > 0 ? `\n\n_${unlinkedCount} mentioned user${unlinkedCount === 1 ? "" : "s"} haven't run \`/link\` yet, so they weren't assigned._` : ""}`,
        color: SUCCESS_COLOR,
      }),
    ],
  };
}

// ============ /mytasks ============

export async function handleMyTasks(user: DiscordUser): Promise<CommandReply> {
  const myIds = (await db.select({ workItemId: workItemAssignees.workItemId }).from(workItemAssignees).where(eq(workItemAssignees.userId, user.id))).map((r) => r.workItemId);
  if (myIds.length === 0) return { embeds: [buildEmbed({ title: "Nothing assigned to you right now" })], ephemeral: true };

  const rows = await db
    .select({ number: workItems.number, title: workItems.title, status: workItems.status, dueDate: workItems.dueDate, projectName: projects.name })
    .from(workItems)
    .innerJoin(projects, eq(workItems.projectId, projects.id))
    .where(inArray(workItems.id, myIds));

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
