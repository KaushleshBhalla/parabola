"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { workItems, projectCounters } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";

const STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
] as const;
type Status = (typeof STATUSES)[number];

const PRIORITIES = ["none", "low", "medium", "high", "urgent"] as const;
type Priority = (typeof PRIORITIES)[number];

export async function createWorkItem(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priorityInput = String(formData.get("priority") ?? "none");
  const assigneeIdInput = String(formData.get("assigneeId") ?? "");
  const priority: Priority = (PRIORITIES as readonly string[]).includes(
    priorityInput
  )
    ? (priorityInput as Priority)
    : "none";

  if (!title || !projectId) return;

  const [counter] = await db
    .update(projectCounters)
    .set({ nextNumber: sql`${projectCounters.nextNumber} + 1` })
    .where(eq(projectCounters.projectId, projectId))
    .returning();

  await db.insert(workItems).values({
    projectId,
    number: counter.nextNumber - 1,
    title,
    description: description || null,
    priority,
    assigneeId: assigneeIdInput || null,
    createdBy: user.id,
  });

  revalidatePath(`/dashboard/${slug}/work-items`);
}

export async function moveWorkItem(
  workItemId: string,
  status: string,
  slug: string
) {
  await requireUser();
  if (!(STATUSES as readonly string[]).includes(status)) return;

  await db
    .update(workItems)
    .set({ status: status as Status, updatedAt: new Date() })
    .where(eq(workItems.id, workItemId));

  revalidatePath(`/dashboard/${slug}/work-items`);
}
