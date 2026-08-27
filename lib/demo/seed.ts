import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  users,
  projects,
  projectCounters,
  workItems,
  workItemComments,
  chatMessages,
} from "@/lib/db/schema";

const BOTS = {
  nova: {
    email: "nova-bot@parabola.internal",
    name: "Nova",
  },
  rex: {
    email: "rex-bot@parabola.internal",
    name: "Rex",
  },
} as const;

async function getOrCreateBot(email: string, name: string) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
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

// Inserted directly (not via the normal create actions), so this seeded content never counts against the demo-creation cap in lib/demo.ts.
export async function seedDemoProject(organizationId: string, realUserId: string) {
  const { nova, rex } = await ensureBotUsers();

  const baseSlug = "demo";
  let slug = `${baseSlug}-${organizationId.slice(0, 8)}`;
  let suffix = 1;
  while (true) {
    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);
    if (!existing) break;
    slug = `${baseSlug}-${organizationId.slice(0, 8)}-${++suffix}`;
  }

  const [project] = await db
    .insert(projects)
    .values({
      name: "Parabola Demo",
      slug,
      description: "A guided tour of Parabola — try the tasks below.",
      organizationId,
      createdBy: nova.id,
    })
    .returning();

  await db.insert(projectCounters).values({ projectId: project.id, nextNumber: 6 });

  const tourItems = [
    {
      title: "👋 Drag me across the board",
      description:
        "Try moving this task from Backlog to Todo to In Progress — that's how your team tracks work in Parabola.",
      status: "backlog" as const,
      priority: "low" as const,
    },
    {
      title: "💬 Reply to this task",
      description: "Leave a comment below to see how discussions work on each task.",
      status: "todo" as const,
      priority: "none" as const,
    },
    {
      title: "📅 Set a due date",
      description: "Open this task and set a due date to see deadline tracking in action.",
      status: "todo" as const,
      priority: "medium" as const,
    },
    {
      title: "✅ Mark this one Done",
      description: "When you're done exploring, mark this task complete.",
      status: "in_review" as const,
      priority: "none" as const,
    },
    {
      title: "🧭 Check Team Tasks and the Activity Log",
      description:
        "Head over to the Team Tasks and Activity Log pages in the sidebar to see how visibility works across a team.",
      status: "backlog" as const,
      priority: "none" as const,
    },
  ];

  const insertedItems = await db
    .insert(workItems)
    .values(
      tourItems.map((item, i) => ({
        projectId: project.id,
        number: i + 1,
        title: item.title,
        description: item.description,
        status: item.status,
        priority: item.priority,
        assigneeId: realUserId,
        createdBy: nova.id,
        position: i,
      }))
    )
    .returning();

  await db.insert(workItemComments).values({
    workItemId: insertedItems[1].id,
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
