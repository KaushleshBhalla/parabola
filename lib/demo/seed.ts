import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  users,
  projects,
  projectCounters,
  projectMembers,
  workItems,
  workItemAssignees,
  workItemComments,
  labels,
  workItemLabels,
  roadmapItems,
  chatMessages,
} from "@/lib/db/schema";

const BOTS = {
  nova: { email: "nova-bot@parabola.internal", name: "Nova" },
  rex: { email: "rex-bot@parabola.internal", name: "Rex" },
} as const;

async function getOrCreateBot(email: string, name: string) {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({ email, name, role: "member", isBot: true })
    .returning();
  return created;
}

export async function ensureBotUsers() {
  const nova = await getOrCreateBot(BOTS.nova.email, BOTS.nova.name);
  const rex = await getOrCreateBot(BOTS.rex.email, BOTS.rex.name);
  return { nova, rex };
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function uniqueProjectSlug(base: string) {
  let slug = base;
  let suffix = 1;
  while (true) {
    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);
    if (!existing) return slug;
    slug = `${base}-${++suffix}`;
  }
}

type ItemSpec = {
  title: string;
  description: string;
  status: "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled";
  priority: "none" | "low" | "medium" | "high" | "urgent";
  assigneeId: string;
  dueDate?: string;
  labelIds?: string[];
};

// Inserted directly (not via the normal create actions), so this seeded content never counts against the demo-creation cap in lib/demo.ts.
export async function seedDemoProject(organizationId: string, realUserId: string) {
  const { nova, rex } = await ensureBotUsers();
  const team = [realUserId, nova.id, rex.id];

  // ---- Project 1: Product Launch (full Kanban tour) ----
  const launchSlug = await uniqueProjectSlug(`demo-launch-${organizationId.slice(0, 8)}`);
  const [launch] = await db
    .insert(projects)
    .values({
      name: "Product Launch",
      slug: launchSlug,
      description: "A guided tour of the board — try the tasks below.",
      organizationId,
      createdBy: nova.id,
    })
    .returning();
  await db.insert(projectMembers).values(team.map((userId) => ({ projectId: launch.id, userId })));

  const [frontendLabel, backendLabel, designLabel] = await db
    .insert(labels)
    .values([
      { projectId: launch.id, name: "Frontend", color: "#3b82f6" },
      { projectId: launch.id, name: "Backend", color: "#8b5cf6" },
      { projectId: launch.id, name: "Design", color: "#ec4899" },
    ])
    .returning();

  const launchItems: ItemSpec[] = [
    {
      title: "👋 Drag me across the board",
      description: "Try moving this task from Backlog to Todo to In Progress.",
      status: "backlog",
      priority: "low",
      assigneeId: realUserId,
      labelIds: [frontendLabel.id],
    },
    {
      title: "💬 Reply to this task",
      description: "Leave a comment below to see how discussions work.",
      status: "todo",
      priority: "none",
      assigneeId: realUserId,
      labelIds: [designLabel.id],
    },
    {
      title: "📅 Set a due date",
      description: "Open this task and set a due date to see deadline tracking in action.",
      status: "todo",
      priority: "medium",
      assigneeId: realUserId,
      labelIds: [backendLabel.id],
    },
    {
      title: "📌 Overdue example",
      description: "This one's overdue on purpose — see how the deadline badge looks.",
      status: "todo",
      priority: "high",
      assigneeId: realUserId,
      dueDate: daysFromNow(-3),
      labelIds: [backendLabel.id],
    },
    {
      title: "🔍 Ready for review",
      description: "Sample task sitting in the In Review column.",
      status: "in_review",
      priority: "none",
      assigneeId: realUserId,
      labelIds: [frontendLabel.id],
    },
    {
      title: "✅ Completed task example",
      description: "This is what a finished task looks like.",
      status: "done",
      priority: "none",
      assigneeId: realUserId,
    },
    {
      title: "🐛 Fix login bug (assigned to a bot)",
      description: "Tasks can be assigned to anyone on the team — even Nova.",
      status: "in_progress",
      priority: "urgent",
      assigneeId: nova.id,
      dueDate: daysFromNow(1),
      labelIds: [backendLabel.id],
    },
    {
      title: "🧭 Check Team Tasks and the Activity Log",
      description: "Head over to the Team Tasks and Activity Log pages in the sidebar.",
      status: "backlog",
      priority: "none",
      assigneeId: realUserId,
    },
  ];
  const insertedLaunchItems = await insertWorkItems(launch.id, nova.id, launchItems);
  await db.insert(workItemComments).values({
    workItemId: insertedLaunchItems[1].id,
    authorId: rex.id,
    body: "Hey, I'm Rex 🤖 — reply here to see how comments work!",
  });
  await db.insert(chatMessages).values([
    {
      projectId: launch.id,
      authorId: nova.id,
      body: "👋 Welcome to Parabola! I'm Nova — I set up a few tasks for you to try. Take a look at your board!",
    },
    {
      projectId: launch.id,
      authorId: rex.id,
      body: "And I'm Rex 🤖 — I'll be hanging around here too. Try posting a message of your own!",
    },
  ]);

  // ---- Project 2: Marketing Campaign (roadmap tour) ----
  const campaignSlug = await uniqueProjectSlug(`demo-campaign-${organizationId.slice(0, 8)}`);
  const [campaign] = await db
    .insert(projects)
    .values({
      name: "Marketing Campaign",
      slug: campaignSlug,
      description: "See how roadmaps and milestones work in Parabola.",
      organizationId,
      createdBy: nova.id,
    })
    .returning();
  await db.insert(projectMembers).values(team.map((userId) => ({ projectId: campaign.id, userId })));

  await insertWorkItems(campaign.id, nova.id, [
    {
      title: "📣 Draft social copy",
      description: "A normal task living alongside a roadmap.",
      status: "todo",
      priority: "medium",
      assigneeId: realUserId,
    },
    {
      title: "🎨 Review campaign assets",
      description: "Assigned to Rex — check the comment below.",
      status: "in_review",
      priority: "low",
      assigneeId: rex.id,
    },
  ]);
  await db.insert(roadmapItems).values([
    {
      projectId: campaign.id,
      title: "Landing page redesign",
      description: "Refresh the launch landing page.",
      milestone: "v1.0",
      targetDate: daysFromNow(18),
      status: "planned",
      createdBy: nova.id,
    },
    {
      projectId: campaign.id,
      title: "Email campaign launch",
      description: "Send the announcement sequence.",
      milestone: "v1.0",
      targetDate: daysFromNow(2),
      status: "in_progress",
      createdBy: nova.id,
    },
    {
      projectId: campaign.id,
      title: "Post-launch retro",
      description: "Review what worked.",
      milestone: "v1.1",
      targetDate: daysFromNow(-10),
      status: "done",
      createdBy: nova.id,
    },
  ]);
  await db.insert(chatMessages).values({
    projectId: campaign.id,
    authorId: nova.id,
    body: "This project tracks the marketing push — check the Roadmap tab in the sidebar too!",
  });

  // ---- Project 3: Bug Tracker (chat + triage tour) ----
  const bugsSlug = await uniqueProjectSlug(`demo-bugs-${organizationId.slice(0, 8)}`);
  const [bugs] = await db
    .insert(projects)
    .values({
      name: "Bug Tracker",
      slug: bugsSlug,
      description: "A lightweight triage board with team chat.",
      organizationId,
      createdBy: rex.id,
    })
    .returning();
  await db.insert(projectMembers).values(team.map((userId) => ({ projectId: bugs.id, userId })));

  const [bugLabel, criticalLabel] = await db
    .insert(labels)
    .values([
      { projectId: bugs.id, name: "Bug", color: "#ef4444" },
      { projectId: bugs.id, name: "Critical", color: "#f97316" },
    ])
    .returning();

  const bugItems: ItemSpec[] = [
    {
      title: "🔥 Checkout page crashes on Safari",
      description: "High-priority bug, actively being worked.",
      status: "in_progress",
      priority: "urgent",
      assigneeId: realUserId,
      labelIds: [bugLabel.id, criticalLabel.id],
    },
    {
      title: "🐞 Typo in footer",
      description: "Low priority, assigned to Nova.",
      status: "backlog",
      priority: "low",
      assigneeId: nova.id,
      labelIds: [bugLabel.id],
    },
    {
      title: "🔍 Investigate slow query",
      description: "See Rex's comment below.",
      status: "todo",
      priority: "medium",
      assigneeId: realUserId,
      labelIds: [bugLabel.id],
    },
  ];
  const insertedBugItems = await insertWorkItems(bugs.id, rex.id, bugItems);
  await db.insert(workItemComments).values({
    workItemId: insertedBugItems[2].id,
    authorId: rex.id,
    body: "I can reproduce this — looks like it's the missing index on created_at. 🕵️",
  });
  await db.insert(chatMessages).values([
    {
      projectId: bugs.id,
      authorId: nova.id,
      body: "Welcome to the Bug Tracker demo — this is where issues get triaged.",
    },
    {
      projectId: bugs.id,
      authorId: rex.id,
      body: "I'll ping here whenever something breaks. 🤖",
    },
  ]);

  return launch;
}

async function insertWorkItems(projectId: string, defaultCreatedBy: string, items: ItemSpec[]) {
  await db.insert(projectCounters).values({ projectId, nextNumber: items.length + 1 });

  const inserted = await db
    .insert(workItems)
    .values(
      items.map((item, i) => ({
        projectId,
        number: i + 1,
        title: item.title,
        description: item.description,
        status: item.status,
        priority: item.priority,
        dueDate: item.dueDate ?? null,
        createdBy: defaultCreatedBy,
        position: i,
      }))
    )
    .returning();

  await db.insert(workItemAssignees).values(
    items.map((item, i) => ({
      workItemId: inserted[i].id,
      userId: item.assigneeId,
      assignedBy: defaultCreatedBy,
    }))
  );

  const labelRows = items.flatMap((item, i) =>
    (item.labelIds ?? []).map((labelId) => ({ workItemId: inserted[i].id, labelId }))
  );
  if (labelRows.length > 0) {
    await db.insert(workItemLabels).values(labelRows);
  }

  return inserted;
}
