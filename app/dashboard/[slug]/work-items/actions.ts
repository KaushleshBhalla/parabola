"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { workItems, projectCounters, notifications } from "@/lib/db/schema";
import { requireUser, canAccessProject, hasRole } from "@/lib/auth/rbac";

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
  if (!(await canAccessProject(user, projectId))) return;

  const [counter] = await db
    .update(projectCounters)
    .set({ nextNumber: sql`${projectCounters.nextNumber} + 1` })
    .where(eq(projectCounters.projectId, projectId))
    .returning();

  const assigneeId = assigneeIdInput || null;

  const [workItem] = await db
    .insert(workItems)
    .values({
      projectId,
      number: counter.nextNumber - 1,
      title,
      description: description || null,
      priority,
      assigneeId,
      createdBy: user.id,
    })
    .returning();

  if (assigneeId && assigneeId !== user.id) {
    await db.insert(notifications).values({
      userId: assigneeId,
      type: "work_item_assigned",
      body: `You were assigned "${title}".`,
      workItemId: workItem.id,
    });
  }

  revalidatePath(`/dashboard/${slug}/work-items`);
  revalidatePath("/dashboard/my-tasks");
}

export async function moveWorkItem(
  workItemId: string,
  status: string,
  slug: string
) {
  const user = await requireUser();
  if (!(STATUSES as readonly string[]).includes(status)) return;

  const [item] = await db
    .select({ projectId: workItems.projectId })
    .from(workItems)
    .where(eq(workItems.id, workItemId))
    .limit(1);
  if (!item || !(await canAccessProject(user, item.projectId))) return;

  await db
    .update(workItems)
    .set({ status: status as Status, updatedAt: new Date() })
    .where(eq(workItems.id, workItemId));

  revalidatePath(`/dashboard/${slug}/work-items`);
}

export async function commitDueDate(
  workItemId: string,
  dueDate: string,
  slug?: string
) {
  const user = await requireUser();

  const [item] = await db
    .select({
      projectId: workItems.projectId,
      assigneeId: workItems.assigneeId,
      title: workItems.title,
    })
    .from(workItems)
    .where(eq(workItems.id, workItemId))
    .limit(1);
  if (!item || !(await canAccessProject(user, item.projectId))) return;

  const isOwnerEdit = hasRole(user.role, "admin") && user.id !== item.assigneeId;
  const isSelfCommit = user.id === item.assigneeId;
  if (!isOwnerEdit && !isSelfCommit) return;

  await db
    .update(workItems)
    .set({ dueDate: dueDate || null, updatedAt: new Date() })
    .where(eq(workItems.id, workItemId));

  if (isOwnerEdit && item.assigneeId) {
    await db.insert(notifications).values({
      userId: item.assigneeId,
      type: "due_date_changed",
      body: `Owner changed your completion date for "${item.title}" to ${dueDate}.`,
      workItemId,
    });
  }

  if (slug) revalidatePath(`/dashboard/${slug}/work-items`);
  revalidatePath("/dashboard/my-tasks");
}
