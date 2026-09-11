import "server-only";
import { and, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  users,
  projects,
  projectCounters,
  projectMembers,
  projectMeetings,
  workItems,
  workItemAssignees,
  workItemComments,
  notifications,
} from "@/lib/db/schema";
import { isProjectAdmin } from "@/lib/project-access";
import { getProjectDemoState, assertDemoCreationAllowed, incrementDemoUsage } from "@/lib/demo";
import { logActivity } from "@/lib/activity";
import { getDeadlineStatus, deadlineUrgencyRank } from "@/lib/deadline";
import { formatStatusLabel } from "@/lib/work-items";
import { setUserAiKey } from "@/lib/ai/user-keys";
import { guessProvider, PROVIDER_LABELS, type AiProvider } from "@/lib/ai/types";
import { resolveProjectWorkItem } from "./resolve";
import { parseDeadlineInput } from "./deadline-parse";
import { parseMeetingTime } from "./meeting-time";
import { listGuildMembers } from "./api";
import { buildEmbed, DANGER_COLOR, SUCCESS_COLOR } from "./embeds";

export type CommandReply = { content?: string; embeds?: unknown[]; ephemeral?: boolean };
type DiscordProject = typeof projects.$inferSelect;
type DiscordUser = typeof users.$inferSelect;

function fail(message: string): CommandReply {
  return { embeds: [buildEmbed({ title: "Couldn't do that", description: message, color: DANGER_COLOR })], ephemeral: true };
}

/**
 * Resolves the fixed person1..5 USER options on /assign to linked Parabola
 * accounts. These are real Discord user picks (option type 6), not free
 * text — a plain STRING field never gets Discord's member-picker UI, so
 * typing "@name" there stays literal text and never parses as a mention;
 * that was the bug behind /assign always failing with "mention someone
 * who's linked" even for people who definitely had.
 */
async function resolveMentionedUsers(discordIds: string[]): Promise<{ found: DiscordUser[]; unlinkedCount: number }> {
  if (discordIds.length === 0) return { found: [], unlinkedCount: 0 };
  const found = await db.select().from(users).where(inArray(users.discordUserId, discordIds));
  return { found, unlinkedCount: discordIds.length - found.length };
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

// ============ /board ============

const BOARD_COLUMNS: { status: string; label: string }[] = [
  { status: "backlog", label: "Backlog" },
  { status: "todo", label: "Todo" },
  { status: "in_progress", label: "In Progress" },
  { status: "in_review", label: "Testing Pending" },
  { status: "review", label: "In Review" },
  { status: "done", label: "Done" },
  { status: "cancelled", label: "Cancelled" },
];

export async function handleBoard(project: DiscordProject, args: { column?: string }): Promise<CommandReply> {
  if (args.column) {
    const label = BOARD_COLUMNS.find((c) => c.status === args.column)?.label ?? args.column;
    const rows = await db
      .select({ number: workItems.number, title: workItems.title, priority: workItems.priority })
      .from(workItems)
      .where(and(eq(workItems.projectId, project.id), eq(workItems.status, args.column as never)))
      .orderBy(desc(workItems.updatedAt))
      .limit(20);

    return {
      embeds: [
        buildEmbed({
          title: `${label} — ${project.name} (${rows.length})`,
          description: rows.length
            ? rows.map((r) => `**#${r.number}** ${r.title}${r.priority !== "none" ? ` · ${r.priority}` : ""}`).join("\n")
            : "Nothing in this column.",
        }),
      ],
    };
  }

  const rows = await db
    .select({ number: workItems.number, title: workItems.title, status: workItems.status })
    .from(workItems)
    .where(eq(workItems.projectId, project.id))
    .orderBy(desc(workItems.updatedAt));

  const byStatus = new Map<string, { number: number; title: string }[]>();
  for (const r of rows) {
    const list = byStatus.get(r.status) ?? [];
    list.push({ number: r.number, title: r.title });
    byStatus.set(r.status, list);
  }

  const SHOWN_PER_COLUMN = 8;
  const fields = BOARD_COLUMNS.map(({ status, label }) => {
    const columnItems = byStatus.get(status) ?? [];
    const shown = columnItems.slice(0, SHOWN_PER_COLUMN);
    const rest = columnItems.length - shown.length;
    const value =
      shown.length === 0
        ? "—"
        : shown.map((i) => `#${i.number} ${i.title}`).join("\n") + (rest > 0 ? `\n_+${rest} more_` : "");
    return { name: `${label} (${columnItems.length})`, value, inline: true };
  });

  return {
    embeds: [
      buildEmbed({
        title: `${project.name} — board (${rows.length} total)`,
        fields,
      }),
    ],
  };
}

// ============ /task view ============

export async function handleTaskView(project: DiscordProject, args: { input: string }): Promise<CommandReply> {
  const item = await resolveProjectWorkItem(project.id, args.input);
  if (!item) return fail(`Couldn't find "${args.input}" in ${project.name}.`);

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

/**
 * One command, two modes: pass `workItemInput` to add assignees to an
 * existing task (any status, not just fresh ones) — everything else about
 * it (title, status) is left alone. Leave it out to create a brand new task
 * (status Todo) the way /assign always used to work. Either way, `priority`
 * and `deadline` apply if given.
 */
export async function handleAssign(
  user: DiscordUser,
  project: DiscordProject,
  args: { personDiscordIds: string[]; workItemInput?: string; work?: string; priority?: string; deadline?: string }
): Promise<CommandReply> {
  const { found: assignees, unlinkedCount } = await resolveMentionedUsers(args.personDiscordIds);
  if (assignees.length === 0) return fail("Pick at least one person who's linked their Parabola account with `/link`.");

  const memberIds = new Set(
    (
      await db
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, project.id))
    ).map((m) => m.userId)
  );
  const notInProject = assignees.filter((a) => !memberIds.has(a.id));
  if (notInProject.length > 0) {
    return fail(
      `${notInProject.map((a) => a.name).join(", ")} ${notInProject.length === 1 ? "isn't" : "aren't"} in **${project.name}** — add them from the project's Members page first.`
    );
  }

  let dueDate: string | null | undefined;
  let deadlineRounded = false;
  if (args.deadline) {
    const parsed = parseDeadlineInput(args.deadline);
    if ("error" in parsed) return fail(parsed.error);
    dueDate = parsed.date;
    deadlineRounded = parsed.rounded;
  }
  const priority =
    args.priority && (PRIORITIES as readonly string[]).includes(args.priority)
      ? (args.priority as "low" | "medium" | "high")
      : undefined;

  if (args.workItemInput) {
    const item = await resolveProjectWorkItem(project.id, args.workItemInput);
    if (!item) return fail(`Couldn't find "${args.workItemInput}" in ${project.name}.`);

    const current = await db
      .select({ userId: workItemAssignees.userId })
      .from(workItemAssignees)
      .where(eq(workItemAssignees.workItemId, item.id));
    const currentIds = new Set(current.map((c) => c.userId));
    const toAdd = assignees.filter((a) => !currentIds.has(a.id));

    const update: { priority?: "none" | "low" | "medium" | "high" | "urgent"; dueDate?: string | null; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (priority) update.priority = priority;
    if (dueDate !== undefined) update.dueDate = dueDate;
    if (Object.keys(update).length > 1) {
      await db.update(workItems).set(update).where(eq(workItems.id, item.id));
    }

    if (toAdd.length > 0) {
      await db.insert(workItemAssignees).values(toAdd.map((a) => ({ workItemId: item.id, userId: a.id, assignedBy: user.id })));
      const notifyIds = toAdd.map((a) => a.id).filter((id) => id !== user.id);
      if (notifyIds.length > 0) {
        await db.insert(notifications).values(
          notifyIds.map((userId) => ({
            userId,
            type: "work_item_assigned" as const,
            body: `You were assigned "${item.title}".`,
            workItemId: item.id,
          }))
        );
      }
    }

    await logActivity({
      actorId: user.id,
      projectId: project.id,
      action: "work_item.assigned",
      entityType: "work_item",
      entityId: item.id,
      after: { addedAssigneeIds: toAdd.map((a) => a.id) },
      searchText: `Assigned "#${item.number} ${item.title}" via Discord`,
    });

    const allAssignees = [...current.map((c) => c.userId), ...toAdd.map((a) => a.id)];
    return {
      embeds: [
        buildEmbed({
          title: `#${item.number} ${item.title}`,
          description: `${toAdd.length > 0 ? `Added ${toAdd.map((a) => a.name).join(", ")}. ` : ""}Now assigned to ${allAssignees.length} ${allAssignees.length === 1 ? "person" : "people"} total, still ${formatStatusLabel(item.status)}.${dueDate ? `\nDue ${dueDate}${deadlineRounded ? " (rounded — deadlines only track a date, not a time of day)" : ""}.` : ""}${unlinkedCount > 0 ? `\n\n_${unlinkedCount} mentioned user${unlinkedCount === 1 ? "" : "s"} haven't run \`/link\` yet, so they weren't added._` : ""}`,
          color: SUCCESS_COLOR,
        }),
      ],
    };
  }

  if (!args.work) return fail("Pass `work` — what the task is — or `work_item` to add assignees to an existing one instead.");

  const demoState = await getProjectDemoState(project.id);
  const demoBlocked = assertDemoCreationAllowed(demoState);
  if (demoBlocked) return fail(demoBlocked);

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
      status: "todo",
      priority: priority ?? "none",
      dueDate: dueDate ?? null,
      position: Date.now(),
      createdBy: user.id,
    })
    .returning();

  await db.insert(workItemAssignees).values(
    assignees.map((a) => ({ workItemId: item.id, userId: a.id, assignedBy: user.id }))
  );
  const notifyIds = assignees.map((a) => a.id).filter((id) => id !== user.id);
  if (notifyIds.length > 0) {
    await db.insert(notifications).values(
      notifyIds.map((userId) => ({
        userId,
        type: "work_item_assigned" as const,
        body: `You were assigned "${item.title}".`,
        workItemId: item.id,
      }))
    );
  }

  if (demoState?.isDemo) {
    await incrementDemoUsage(project.id);
  }

  await logActivity({
    actorId: user.id,
    projectId: project.id,
    action: "work_item.created",
    entityType: "work_item",
    entityId: item.id,
    after: { title: args.work, priority: priority ?? "none", assigneeIds: assignees.map((a) => a.id) },
    searchText: `Created "#${item.number} ${args.work}" via Discord`,
  });

  return {
    embeds: [
      buildEmbed({
        title: `#${item.number} ${item.title}`,
        description: `Created in **${project.name}**, status **Todo**, assigned to ${assignees.map((a) => a.name).join(", ")}.${dueDate ? `\nDue ${dueDate}${deadlineRounded ? " (deadlines only track a date, not a time of day, so an hour-based deadline rounds to this)" : ""}.` : ""}${unlinkedCount > 0 ? `\n\n_${unlinkedCount} mentioned user${unlinkedCount === 1 ? "" : "s"} haven't run \`/link\` yet, so they weren't assigned._` : ""}`,
        color: SUCCESS_COLOR,
      }),
    ],
  };
}

// ============ /progress ============

// Discord's single-step progression: Todo and In Progress both advance
// straight to Testing Pending (the website's board still has a distinct
// In Progress column reachable by drag-and-drop; /progress just doesn't
// stop there) — then Testing Pending -> In Review. In Review is the last
// step /progress can take; moving to Done needs the project creator to
// review and score the work, which only the website supports right now.
const PROGRESS_STEPS: Record<string, "todo" | "in_review" | "review"> = {
  backlog: "todo",
  todo: "in_review",
  in_progress: "in_review",
  in_review: "review",
};

export async function handleProgress(
  user: DiscordUser,
  project: DiscordProject,
  args: { workItemInput: string; comment: string }
): Promise<CommandReply> {
  const item = await resolveProjectWorkItem(project.id, args.workItemInput);
  if (!item) return fail(`Couldn't find "${args.workItemInput}" in ${project.name}.`);

  const next = PROGRESS_STEPS[item.status];
  if (!next) {
    if (item.status === "review") {
      return fail(
        `**#${item.number} ${item.title}** is already In Review — moving it to Done needs ${project.name}'s creator to review and score the work, from the website.`
      );
    }
    return fail(`**#${item.number} ${item.title}** is ${formatStatusLabel(item.status)} — nothing to progress.`);
  }

  await db.update(workItems).set({ status: next, updatedAt: new Date() }).where(eq(workItems.id, item.id));
  await db.insert(workItemComments).values({ workItemId: item.id, authorId: user.id, body: args.comment });

  if (item.createdBy && item.createdBy !== user.id) {
    await db.insert(notifications).values({
      userId: item.createdBy,
      type: "work_item_status_changed",
      body: `"#${item.number} ${item.title}" moved to ${formatStatusLabel(next)} by ${user.name}.`,
      workItemId: item.id,
    });
  }

  await logActivity({
    actorId: user.id,
    projectId: project.id,
    action: "work_item.status_changed",
    entityType: "work_item",
    entityId: item.id,
    before: { status: item.status },
    after: { status: next },
    searchText: `Moved "#${item.number} ${item.title}" from ${item.status} to ${next} via Discord`,
  });

  return {
    embeds: [
      buildEmbed({
        title: `#${item.number} ${item.title}`,
        description: `${formatStatusLabel(item.status)} → **${formatStatusLabel(next)}**\n\n${args.comment}`,
        color: SUCCESS_COLOR,
      }),
    ],
  };
}

// ============ /setmeet ============

export async function handleSetMeet(
  user: DiscordUser,
  project: DiscordProject,
  args: { channelId: string; time: string; timezone: string; title?: string }
): Promise<CommandReply> {
  if (!(await isProjectAdmin(user.id, project.id))) {
    return fail("You need to be an admin on that project to schedule a meeting for it.");
  }

  const parsed = parseMeetingTime(args.time, args.timezone);
  if ("error" in parsed) return fail(parsed.error);

  await db.insert(projectMeetings).values({
    projectId: project.id,
    scheduledBy: user.id,
    title: args.title || null,
    scheduledAt: parsed.utc,
    discordChannelId: args.channelId,
  });

  const unixSeconds = Math.floor(parsed.utc.getTime() / 1000);

  await logActivity({
    actorId: user.id,
    projectId: project.id,
    action: "project_meeting.scheduled",
    entityType: "project",
    entityId: project.id,
    after: { scheduledAt: parsed.utc.toISOString(), title: args.title },
    searchText: `Scheduled a meeting${args.title ? ` ("${args.title}")` : ""} for "${project.name}" via Discord`,
  });

  return {
    embeds: [
      buildEmbed({
        title: `Meeting set for ${project.name}${args.title ? ` — ${args.title}` : ""}`,
        description: `<t:${unixSeconds}:F> (<t:${unixSeconds}:R>). I'll ping everyone on the project right here, 5 minutes before.`,
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
    .where(and(inArray(workItems.id, myIds), isNull(projects.archivedAt), isNull(projects.ownerArchivedAt)));

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

// ============ /setkey (with an inline key) ============

export async function handleSetKey(
  user: DiscordUser,
  apiKey: string,
  providerArg?: string
): Promise<CommandReply> {
  const provider: AiProvider =
    providerArg === "gemini" || providerArg === "groq" ? providerArg : guessProvider(apiKey);

  const result = await setUserAiKey(user.id, provider, apiKey);
  if (result?.error) return fail(result.error);

  await logActivity({
    actorId: user.id,
    action: "ai_key.set",
    entityType: "user",
    entityId: user.id,
    after: { provider },
    searchText: `Set their ${PROVIDER_LABELS[provider]} API key via Discord`,
  });

  return {
    embeds: [
      buildEmbed({
        title: `${PROVIDER_LABELS[provider]} key saved`,
        description:
          "Verified and stored (encrypted). The **Ask AI** tab on your projects will use it now.\n\n_Since you passed it here, the key went through Discord's servers — if that's a concern, rotate it in the provider's console and set the new one from the website._",
        color: SUCCESS_COLOR,
      }),
    ],
    ephemeral: true,
  };
}

// ============ /test ============

export async function handleTest(user: DiscordUser): Promise<CommandReply> {
  const checks: { label: string; ok: boolean; detail: string }[] = [];

  const dbStart = Date.now();
  try {
    await db.select({ id: projects.id }).from(projects).limit(1);
    checks.push({ label: "Database", ok: true, detail: `reachable (${Date.now() - dbStart}ms)` });
  } catch {
    checks.push({ label: "Database", ok: false, detail: "unreachable — this is a real outage, not a you problem" });
  }

  checks.push({ label: "Discord account link", ok: true, detail: `linked as ${user.name}` });

  const myProjects = await db
    .select({ name: projects.name })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, user.id));
  checks.push({
    label: "Your projects",
    ok: myProjects.length > 0,
    detail: myProjects.length > 0 ? myProjects.map((p) => p.name).join(", ") : "none yet — ask a project admin to add you",
  });

  const allOk = checks.every((c) => c.ok);
  return {
    embeds: [
      buildEmbed({
        title: allOk ? "Everything's working" : "Something needs attention",
        description: checks.map((c) => `${c.ok ? "✅" : "❌"} **${c.label}** — ${c.detail}`).join("\n"),
        color: allOk ? SUCCESS_COLOR : DANGER_COLOR,
      }),
    ],
    ephemeral: true,
  };
}

// ============ /teammates ============

export async function handleTeammates(
  user: DiscordUser,
  guildId: string,
  projectFilter?: string
): Promise<CommandReply> {
  const myMemberships = await db
    .select({ projectId: projectMembers.projectId, projectName: projects.name })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, user.id));
  if (myMemberships.length === 0) return fail("You're not in any projects yet.");

  let relevantProjectIds = myMemberships.map((m) => m.projectId);
  if (projectFilter) {
    const match = myMemberships.find(
      (m) => m.projectId === projectFilter || m.projectName.toLowerCase() === projectFilter.toLowerCase()
    );
    if (!match) return fail(`No project called "${projectFilter}" that you belong to.`);
    relevantProjectIds = [match.projectId];
  }

  let guildMembers;
  try {
    guildMembers = await listGuildMembers(guildId);
  } catch {
    return fail(
      'Couldn\'t read this server\'s member list — Parabola\'s bot may need "Server Members Intent" enabled in its Discord settings.'
    );
  }

  const guildDiscordIds = guildMembers.filter((m) => !m.user.bot).map((m) => m.user.id);
  if (guildDiscordIds.length === 0) return fail("Couldn't find any members in this server.");

  const linkedUsers = await db.select().from(users).where(inArray(users.discordUserId, guildDiscordIds));
  const others = linkedUsers.filter((u) => u.id !== user.id);
  if (others.length === 0) return fail("No one else in this server has linked their Parabola account with `/link` yet.");

  const otherIds = others.map((o) => o.id);
  const theirMemberships = await db
    .select({ userId: projectMembers.userId, projectId: projectMembers.projectId, projectName: projects.name })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(and(inArray(projectMembers.userId, otherIds), inArray(projectMembers.projectId, relevantProjectIds)));

  const sharedByUser = new Map<string, { projectIds: string[]; projectNames: string[] }>();
  for (const m of theirMemberships) {
    const entry = sharedByUser.get(m.userId) ?? { projectIds: [], projectNames: [] };
    entry.projectIds.push(m.projectId);
    entry.projectNames.push(m.projectName);
    sharedByUser.set(m.userId, entry);
  }

  if (sharedByUser.size === 0) {
    return {
      embeds: [
        buildEmbed({
          title: "No teammates here yet",
          description: "No one else in this server shares a project with you.",
        }),
      ],
    };
  }

  const allSharedProjectIds = [...new Set([...sharedByUser.values()].flatMap((v) => v.projectIds))];
  const pendingRows = await db
    .select({
      userId: workItemAssignees.userId,
      number: workItems.number,
      title: workItems.title,
      status: workItems.status,
    })
    .from(workItemAssignees)
    .innerJoin(workItems, eq(workItemAssignees.workItemId, workItems.id))
    .where(
      and(
        inArray(workItemAssignees.userId, [...sharedByUser.keys()]),
        inArray(workItems.projectId, allSharedProjectIds),
        notInArray(workItems.status, ["done", "cancelled"])
      )
    );

  const pendingByUser = new Map<string, { number: number; title: string; status: string }[]>();
  for (const r of pendingRows) {
    const list = pendingByUser.get(r.userId) ?? [];
    list.push({ number: r.number, title: r.title, status: r.status });
    pendingByUser.set(r.userId, list);
  }

  const SHOWN_PENDING = 5;
  const fields = others
    .filter((o) => sharedByUser.has(o.id))
    .map((o) => {
      const shared = sharedByUser.get(o.id)!;
      const pending = pendingByUser.get(o.id) ?? [];
      const shown = pending.slice(0, SHOWN_PENDING);
      const rest = pending.length - shown.length;
      const value = [
        `Shared: ${[...new Set(shared.projectNames)].join(", ")}`,
        pending.length === 0
          ? "No pending tasks."
          : shown.map((p) => `#${p.number} ${p.title} — ${formatStatusLabel(p.status)}`).join("\n") +
            (rest > 0 ? `\n_+${rest} more_` : ""),
      ].join("\n");
      return { name: o.name, value: value.slice(0, 1024), inline: false };
    });

  return {
    embeds: [
      buildEmbed({
        title: `Teammates here (${fields.length})`,
        fields: fields.slice(0, 25),
      }),
    ],
  };
}
