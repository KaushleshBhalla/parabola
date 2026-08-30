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

/**
 * Every new sign-up gets one of these automatically, no approval needed: a
 * solo, sandboxed demo project pre-loaded with a bot-guided tour. Inserted
 * directly (not via the normal create actions), so this content never counts
 * against the demo-creation cap in lib/demo.ts.
 */
export async function seedDemoProject(userId: string) {
  const { nova, rex } = await ensureBotUsers();
  const team = [userId, nova.id, rex.id];

  const slug = await uniqueProjectSlug(`demo-${userId.slice(0, 8)}`);
  const [project] = await db
    .insert(projects)
    .values({
      name: "Parabola Demo",
      slug,
      description: "A guided tour of the board — try the tasks below.",
      createdBy: nova.id,
      isDemo: true,
    })
    .returning();

  await db.insert(projectMembers).values(
    team.map((memberId, i) => ({ projectId: project.id, userId: memberId, isAdmin: i === 0 }))
  );

  const [frontendLabel, backendLabel, designLabel] = await db
    .insert(labels)
    .values([
      { projectId: project.id, name: "Frontend", color: "#3b82f6" },
      { projectId: project.id, name: "Backend", color: "#8b5cf6" },
      { projectId: project.id, name: "Design", color: "#ec4899" },
    ])
    .returning();

  const items: ItemSpec[] = [
    {
      title: "👋 Drag me across the board",
      description: "Try moving this task from Backlog to Todo to In Progress.",
      status: "backlog",
      priority: "low",
      assigneeId: userId,
      labelIds: [frontendLabel.id],
    },
    {
      title: "💬 Reply to this task",
      description: "Leave a comment below to see how discussions work.",
      status: "todo",
      priority: "none",
      assigneeId: userId,
      labelIds: [designLabel.id],
    },
    {
      title: "📅 Set a due date",
      description: "Open this task and set a due date to see deadline tracking in action.",
      status: "todo",
      priority: "medium",
      assigneeId: userId,
      labelIds: [backendLabel.id],
    },
    {
      title: "📌 Overdue example",
      description: "This one's overdue on purpose — see how the deadline badge looks.",
      status: "todo",
      priority: "high",
      assigneeId: userId,
      dueDate: daysFromNow(-3),
      labelIds: [backendLabel.id],
    },
    {
      title: "🔍 Ready for review",
      description: "Sample task sitting in the In Review column.",
      status: "in_review",
      priority: "none",
      assigneeId: userId,
      labelIds: [frontendLabel.id],
    },
    {
      title: "✅ Completed task example",
      description: "This is what a finished task looks like.",
      status: "done",
      priority: "none",
      assigneeId: userId,
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
      assigneeId: userId,
    },
  ];

  await db.insert(projectCounters).values({ projectId: project.id, nextNumber: items.length + 1 });

  const inserted = await db
    .insert(workItems)
    .values(
      items.map((item, i) => ({
        projectId: project.id,
        number: i + 1,
        title: item.title,
        description: item.description,
        status: item.status,
        priority: item.priority,
        dueDate: item.dueDate ?? null,
        createdBy: nova.id,
        position: i,
      }))
    )
    .returning();

  await db.insert(workItemAssignees).values(
    items.map((item, i) => ({ workItemId: inserted[i].id, userId: item.assigneeId, assignedBy: nova.id }))
  );

  const labelRows = items.flatMap((item, i) =>
    (item.labelIds ?? []).map((labelId) => ({ workItemId: inserted[i].id, labelId }))
  );
  if (labelRows.length > 0) {
    await db.insert(workItemLabels).values(labelRows);
  }

  await db.insert(workItemComments).values({
    workItemId: inserted[1].id,
    authorId: rex.id,
    body: "Hey, I'm Rex 🤖 — reply here to see how comments work!",
  });

  await db.insert(chatMessages).values([
    {
      projectId: project.id,
      authorId: nova.id,
      body: "👋 Welcome to Parabola! I'm Nova — I set up a few tasks for you to try. Take a look at your board!",
    },
    {
      projectId: project.id,
      authorId: rex.id,
      body: "And I'm Rex 🤖 — I'll be hanging around here too. Try posting a message of your own!",
    },
  ]);

  return project;
}
