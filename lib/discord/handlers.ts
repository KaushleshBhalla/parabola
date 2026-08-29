import "server-only";
import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  users,
  organizations,
  organizationMembers,
  roles,
  memberRoles,
  projects,
  projectCounters,
  workItems,
  workItemAssignees,
  workItemComments,
  roadmapItems,
  notifications,
  activityLog,
} from "@/lib/db/schema";
import { canAccessProject, hasPermission } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";
import { getOrCreateInviteCode } from "@/lib/organizations";
import { getProjectDemoState, assertDemoCreationAllowed, incrementDemoUsage } from "@/lib/demo";
import { getDeadlineStatus, deadlineUrgencyRank } from "@/lib/deadline";
import { formatStatusLabel } from "@/lib/work-items";
import { extractMentionedDiscordIds } from "./resolve";
import { buildEmbed, DANGER_COLOR, SUCCESS_COLOR } from "./embeds";

const APP_URL = "https://parabolaa.vercel.app";
const POSITION_GAP = 1000;

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

// ============ /task new ============

export async function handleTaskNew(
  user: DiscordUser,
  org: DiscordOrg,
  args: { project: string; title: string; assignees?: string; priority?: string; due?: string }
): Promise<CommandReply> {
  const project = await resolveProject(org.id, args.project);
  if (!project) return fail(`No project called "${args.project}" in this organization.`);
  if (!(await canAccessProject(user, project.id))) return fail("You don't have access to that project.");

  const { found: assignees, unlinkedCount } = args.assignees
    ? await resolveMentionedUsers(args.assignees)
    : { found: [], unlinkedCount: 0 };
  if (assignees.length > 0 && !args.due) {
    return fail("A deadline is required when assigning a task — pass `due`.");
  }

  const demoState = await getProjectDemoState(project.id);
  const demoBlocked = assertDemoCreationAllowed(demoState);
  if (demoBlocked) return fail(demoBlocked);

  const [counter] = await db
    .update(projectCounters)
    .set({ nextNumber: sql`${projectCounters.nextNumber} + 1` })
    .where(eq(projectCounters.projectId, project.id))
    .returning();
  const [top] = await db
    .select({ position: workItems.position })
    .from(workItems)
    .where(and(eq(workItems.projectId, project.id), eq(workItems.status, "backlog")))
    .orderBy(desc(workItems.position))
    .limit(1);

  const priority = (["none", "low", "medium", "high", "urgent"] as const).includes(args.priority as never)
    ? (args.priority as "none" | "low" | "medium" | "high" | "urgent")
    : "none";

  const [item] = await db
    .insert(workItems)
    .values({
      projectId: project.id,
      number: counter.nextNumber - 1,
      title: args.title,
      priority,
      dueDate: args.due || null,
      position: (top?.position ?? 0) + POSITION_GAP,
      createdBy: user.id,
    })
    .returning();

  if (assignees.length > 0) {
    await db.insert(workItemAssignees).values(
      assignees.map((a) => ({ workItemId: item.id, userId: a.id, assignedBy: user.id }))
    );
    const notifyIds = assignees.map((a) => a.id).filter((id) => id !== user.id);
    if (notifyIds.length > 0) {
      await db.insert(notifications).values(
        notifyIds.map((userId) => ({
          userId,
          type: "work_item_assigned" as const,
          body: `You were assigned "${args.title}".`,
          workItemId: item.id,
        }))
      );
    }
  }
  if (demoState?.isDemo && demoState.organizationId) await incrementDemoUsage(demoState.organizationId);

  await logActivity({
    actorId: user.id,
    projectId: project.id,
    action: "work_item.created",
    entityType: "work_item",
    entityId: item.id,
    after: { title: args.title, priority },
    searchText: `Created work item "#${item.number} ${args.title}" via Discord`,
  });

  return {
    embeds: [
      buildEmbed({
        title: `#${item.number} ${item.title}`,
        description: `Created in ${project.name} · Backlog${unlinkedCount > 0 ? `\n\n_${unlinkedCount} mentioned user${unlinkedCount === 1 ? "" : "s"} haven't run \`/link\` yet, so they weren't assigned._` : ""}`,
        fields: [
          { name: "Assignees", value: assignees.length ? assignees.map((a) => a.name).join(", ") : "Unassigned", inline: true },
          { name: "Priority", value: priority, inline: true },
          ...(args.due ? [{ name: "Due", value: args.due, inline: true }] : []),
        ],
      }),
    ],
  };
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

  const [assignees, comments] = await Promise.all([
    db
      .select({ name: users.name })
      .from(workItemAssignees)
      .innerJoin(users, eq(workItemAssignees.userId, users.id))
      .where(eq(workItemAssignees.workItemId, item.id)),
    db
      .select({ body: workItemComments.body, authorName: users.name })
      .from(workItemComments)
      .innerJoin(users, eq(workItemComments.authorId, users.id))
      .where(eq(workItemComments.workItemId, item.id))
      .orderBy(desc(workItemComments.createdAt))
      .limit(3),
  ]);

  return {
    embeds: [
      buildEmbed({
        title: `#${item.number} ${item.title}`,
        description: item.description || undefined,
        fields: [
          { name: "Status", value: formatStatusLabel(item.status), inline: true },
          { name: "Priority", value: item.priority, inline: true },
          ...(item.qualityScore != null ? [{ name: "Quality score", value: `${item.qualityScore}/10`, inline: true }] : []),
          { name: "Assignees", value: assignees.length ? assignees.map((a) => a.name).join(", ") : "Unassigned" },
          ...(item.dueDate ? [{ name: "Due", value: item.dueDate, inline: true }] : []),
          ...(comments.length
            ? [{ name: `Recent comments (${comments.length})`, value: comments.map((c) => `**${c.authorName}:** ${c.body}`).join("\n") }]
            : []),
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
    const notifyIds = toAdd.map((a) => a.id).filter((id) => id !== user.id);
    if (notifyIds.length > 0) {
      await db.insert(notifications).values(
        notifyIds.map((userId) => ({ userId, type: "work_item_assigned" as const, body: `You were assigned "${item.title}".`, workItemId: item.id }))
      );
    }
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

// ============ /task move ============

export async function handleTaskMove(user: DiscordUser, org: DiscordOrg, args: { project: string; id: number; status: string }): Promise<CommandReply> {
  const project = await resolveProject(org.id, args.project);
  if (!project) return fail(`No project called "${args.project}" in this organization.`);
  if (!(await canAccessProject(user, project.id))) return fail("You don't have access to that project.");

  const [item] = await db
    .select()
    .from(workItems)
    .where(and(eq(workItems.projectId, project.id), eq(workItems.number, args.id)))
    .limit(1);
  if (!item) return fail(`No task #${args.id} in ${project.name}.`);

  const [top] = await db
    .select({ position: workItems.position })
    .from(workItems)
    .where(and(eq(workItems.projectId, project.id), eq(workItems.status, args.status as never)))
    .orderBy(desc(workItems.position))
    .limit(1);
  const position = (top?.position ?? 0) + POSITION_GAP;

  await db.update(workItems).set({ status: args.status as never, position, updatedAt: new Date() }).where(eq(workItems.id, item.id));

  if (item.status !== args.status) {
    if (args.status === "cancelled" && item.createdBy !== user.id) {
      await db.insert(notifications).values({ userId: item.createdBy, type: "work_item_cancelled", body: `"#${item.number} ${item.title}" was cancelled.`, workItemId: item.id });
    }
    await logActivity({
      actorId: user.id,
      projectId: project.id,
      action: "work_item.status_changed",
      entityType: "work_item",
      entityId: item.id,
      before: { status: item.status },
      after: { status: args.status },
      searchText: `Moved "#${item.number} ${item.title}" to ${args.status} via Discord`,
    });
  }

  return { embeds: [buildEmbed({ title: `#${item.number} ${item.title}`, description: `Moved to **${formatStatusLabel(args.status)}**.`, color: SUCCESS_COLOR })] };
}

// ============ /task comment ============

export async function handleTaskComment(user: DiscordUser, org: DiscordOrg, args: { project: string; id: number; message: string }): Promise<CommandReply> {
  const project = await resolveProject(org.id, args.project);
  if (!project) return fail(`No project called "${args.project}" in this organization.`);
  if (!(await canAccessProject(user, project.id))) return fail("You don't have access to that project.");

  const [item] = await db
    .select()
    .from(workItems)
    .where(and(eq(workItems.projectId, project.id), eq(workItems.number, args.id)))
    .limit(1);
  if (!item) return fail(`No task #${args.id} in ${project.name}.`);

  const demoState = await getProjectDemoState(project.id);
  const demoBlocked = assertDemoCreationAllowed(demoState);
  if (demoBlocked) return fail(demoBlocked);

  await db.insert(workItemComments).values({ workItemId: item.id, authorId: user.id, body: args.message });
  if (demoState?.isDemo && demoState.organizationId) await incrementDemoUsage(demoState.organizationId);

  await logActivity({
    actorId: user.id,
    projectId: project.id,
    action: "work_item_comment.posted",
    entityType: "work_item_comment",
    entityId: item.id,
    searchText: `Commented on "${item.title}" via Discord: "${args.message.slice(0, 120)}"`,
  });

  return { embeds: [buildEmbed({ title: `Comment added to #${item.number}`, description: args.message, color: SUCCESS_COLOR })] };
}

// ============ /task score ============

export async function handleTaskScore(user: DiscordUser, org: DiscordOrg, args: { project: string; id: number; score: number }): Promise<CommandReply> {
  const project = await resolveProject(org.id, args.project);
  if (!project) return fail(`No project called "${args.project}" in this organization.`);
  if (!(await canAccessProject(user, project.id))) return fail("You don't have access to that project.");
  if (!Number.isInteger(args.score) || args.score < 1 || args.score > 10) return fail("Score must be a whole number between 1 and 10.");

  const [item] = await db
    .select()
    .from(workItems)
    .where(and(eq(workItems.projectId, project.id), eq(workItems.number, args.id)))
    .limit(1);
  if (!item) return fail(`No task #${args.id} in ${project.name}.`);
  if (item.createdBy !== user.id) return fail("Only the creator can score this task.");

  await db.update(workItems).set({ qualityScore: args.score, updatedAt: new Date() }).where(eq(workItems.id, item.id));
  await logActivity({
    actorId: user.id,
    projectId: project.id,
    action: "work_item.scored",
    entityType: "work_item",
    entityId: item.id,
    after: { qualityScore: args.score },
    searchText: `Scored "${item.title}" ${args.score}/10 via Discord`,
  });

  return { embeds: [buildEmbed({ title: `#${item.number} ${item.title}`, description: `Scored **${args.score}/10**.`, color: SUCCESS_COLOR })] };
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

// ============ /projects ============

export async function handleProjects(org: DiscordOrg): Promise<CommandReply> {
  const rows = await db.select({ name: projects.name }).from(projects).where(eq(projects.organizationId, org.id));
  if (rows.length === 0) return { embeds: [buildEmbed({ title: "No projects yet" })] };
  return { embeds: [buildEmbed({ title: `Projects in ${org.name}`, description: rows.map((r) => `• ${r.name}`).join("\n") })] };
}

// ============ /teamtasks ============

export async function handleTeamTasks(org: DiscordOrg): Promise<CommandReply> {
  const orgProjects = await db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.organizationId, org.id));
  const orgProjectIds = orgProjects.map((p) => p.id);
  if (orgProjectIds.length === 0) return { embeds: [buildEmbed({ title: "No projects yet" })] };

  const rows = await db
    .select({ workItemId: workItems.id, status: workItems.status, dueDate: workItems.dueDate, projectId: workItems.projectId })
    .from(workItemAssignees)
    .innerJoin(workItems, eq(workItemAssignees.workItemId, workItems.id))
    .where(inArray(workItems.projectId, orgProjectIds))
    .groupBy(workItems.id, workItems.status, workItems.dueDate, workItems.projectId);

  const total = rows.length;
  const overdue = rows.filter((r) => getDeadlineStatus(r.dueDate, r.status) === "overdue").length;
  const dueSoon = rows.filter((r) => getDeadlineStatus(r.dueDate, r.status) === "due_soon").length;
  const done = rows.filter((r) => r.status === "done").length;

  const byProject = new Map<string, number>();
  for (const r of rows) byProject.set(r.projectId, (byProject.get(r.projectId) ?? 0) + 1);
  const projectLines = orgProjects
    .filter((p) => byProject.has(p.id))
    .map((p) => `**${p.name}**: ${byProject.get(p.id)} assigned`);

  return {
    embeds: [
      buildEmbed({
        title: "Team tasks",
        fields: [
          { name: "Assigned", value: String(total), inline: true },
          { name: "Overdue", value: String(overdue), inline: true },
          { name: "Due soon", value: String(dueSoon), inline: true },
          { name: "Done", value: String(done), inline: true },
        ],
        description: projectLines.join("\n") || undefined,
      }),
    ],
  };
}

// ============ /roadmap ============

export async function handleRoadmap(org: DiscordOrg, args: { project?: string }): Promise<CommandReply> {
  let projectIds: string[];
  if (args.project) {
    const project = await resolveProject(org.id, args.project);
    if (!project) return fail(`No project called "${args.project}" in this organization.`);
    projectIds = [project.id];
  } else {
    projectIds = (await db.select({ id: projects.id }).from(projects).where(eq(projects.organizationId, org.id))).map((p) => p.id);
  }
  if (projectIds.length === 0) return { embeds: [buildEmbed({ title: "No roadmap items" })] };

  const rows = await db
    .select({ title: roadmapItems.title, milestone: roadmapItems.milestone, targetDate: roadmapItems.targetDate, status: roadmapItems.status })
    .from(roadmapItems)
    .where(inArray(roadmapItems.projectId, projectIds))
    .orderBy(asc(roadmapItems.targetDate));

  if (rows.length === 0) return { embeds: [buildEmbed({ title: "No roadmap items yet" })] };
  return {
    embeds: [
      buildEmbed({
        title: "Roadmap",
        description: rows.map((r) => `**${r.title}** — ${r.milestone ?? "Unscheduled"} · ${r.status}${r.targetDate ? ` · target ${r.targetDate}` : ""}`).join("\n"),
      }),
    ],
  };
}

// ============ /activity ============

export async function handleActivity(org: DiscordOrg, args: { project?: string }): Promise<CommandReply> {
  let projectIds: string[] | undefined;
  if (args.project) {
    const project = await resolveProject(org.id, args.project);
    if (!project) return fail(`No project called "${args.project}" in this organization.`);
    projectIds = [project.id];
  } else {
    projectIds = (await db.select({ id: projects.id }).from(projects).where(eq(projects.organizationId, org.id))).map((p) => p.id);
  }
  if (!projectIds || projectIds.length === 0) return { embeds: [buildEmbed({ title: "No activity yet" })] };

  const rows = await db
    .select({ action: activityLog.action, searchText: activityLog.searchText, actorName: users.name, createdAt: activityLog.createdAt })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.actorId, users.id))
    .where(inArray(activityLog.projectId, projectIds))
    .orderBy(desc(activityLog.createdAt))
    .limit(10);

  if (rows.length === 0) return { embeds: [buildEmbed({ title: "No activity yet" })] };
  return { embeds: [buildEmbed({ title: "Recent activity", description: rows.map((r) => `**${r.actorName ?? "System"}** — ${r.searchText}`).join("\n") })] };
}

// ============ /roles list, /roles assign ============

export async function handleRolesList(org: DiscordOrg): Promise<CommandReply> {
  const rows = await db
    .select({ roleName: roles.name, memberName: users.name })
    .from(roles)
    .leftJoin(memberRoles, eq(memberRoles.roleId, roles.id))
    .leftJoin(organizationMembers, eq(memberRoles.organizationMemberId, organizationMembers.id))
    .leftJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(roles.organizationId, org.id));

  const byRole = new Map<string, string[]>();
  for (const r of rows) {
    const list = byRole.get(r.roleName) ?? [];
    if (r.memberName) list.push(r.memberName);
    byRole.set(r.roleName, list);
  }

  return {
    embeds: [
      buildEmbed({
        title: "Roles",
        description: [...byRole.entries()].map(([name, members]) => `**${name}** — ${members.length ? members.join(", ") : "no members"}`).join("\n"),
      }),
    ],
  };
}

export async function handleRolesAssign(user: DiscordUser, org: DiscordOrg, args: { discordUserId: string; role: string }): Promise<CommandReply> {
  if (!(await hasPermission(user.id, org.id, "role.manage"))) return fail("You don't have permission to manage roles.");

  const target = await db.select().from(users).where(eq(users.discordUserId, args.discordUserId)).limit(1);
  if (target.length === 0) return fail("That person hasn't run `/link` yet.");

  const [member] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.userId, target[0].id)))
    .limit(1);
  if (!member) return fail("That person isn't a member of this organization.");

  const [role] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.organizationId, org.id), ilike(roles.name, args.role), eq(roles.isOwnerRole, false)))
    .limit(1);
  if (!role) return fail(`No assignable role called "${args.role}".`);

  const [existing] = await db
    .select({ roleId: memberRoles.roleId })
    .from(memberRoles)
    .where(and(eq(memberRoles.organizationMemberId, member.id), eq(memberRoles.roleId, role.id)))
    .limit(1);
  if (!existing) {
    await db.insert(memberRoles).values({ organizationMemberId: member.id, roleId: role.id });
  }

  await logActivity({
    actorId: user.id,
    action: "member.roles_updated",
    entityType: "organization_member",
    entityId: member.id,
    searchText: `Granted "${role.name}" to ${target[0].name} via Discord`,
  });

  return { embeds: [buildEmbed({ title: "Role granted", description: `${target[0].name} now holds **${role.name}**.`, color: SUCCESS_COLOR })] };
}

// ============ /invite ============

export async function handleInvite(user: DiscordUser, org: DiscordOrg): Promise<CommandReply> {
  if (!(await hasPermission(user.id, org.id, "role.manage"))) return fail("You don't have permission to invite members.");
  const code = await getOrCreateInviteCode(org.id);
  return { embeds: [buildEmbed({ title: `Invite people to ${org.name}`, description: `${APP_URL}/join/${code}` })] };
}

// ============ /notifications ============

export async function handleNotifications(user: DiscordUser): Promise<CommandReply> {
  const rows = await db
    .select({ body: notifications.body, createdAt: notifications.createdAt })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)))
    .orderBy(desc(notifications.createdAt))
    .limit(10);

  if (rows.length === 0) return { embeds: [buildEmbed({ title: "You're all caught up" })], ephemeral: true };
  return { embeds: [buildEmbed({ title: `${rows.length} unread notification${rows.length === 1 ? "" : "s"}`, description: rows.map((r) => `• ${r.body}`).join("\n") })], ephemeral: true };
}
