"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  workItems,
  workItemComments,
  projectCounters,
  notifications,
  users,
} from "@/lib/db/schema";
import { requireUser, canAccessProject, hasRole } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";

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

const POSITION_GAP = 1000;

export async function createWorkItem(
  formData: FormData
): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priorityInput = String(formData.get("priority") ?? "none");
  const assigneeIdInput = String(formData.get("assigneeId") ?? "");
  const dueDateInput = String(formData.get("dueDate") ?? "").trim();
  const priority: Priority = (PRIORITIES as readonly string[]).includes(
    priorityInput
  )
    ? (priorityInput as Priority)
    : "none";

  if (!title || !projectId) return { error: "Title is required." };
  if (!(await canAccessProject(user, projectId)))
    return { error: "You don't have access to this project." };
  if (assigneeIdInput && !dueDateInput)
    return { error: "A deadline is required when assigning a task." };

  const [counter, [top]] = await Promise.all([
    db
      .update(projectCounters)
      .set({ nextNumber: sql`${projectCounters.nextNumber} + 1` })
      .where(eq(projectCounters.projectId, projectId))
      .returning(),
    db
      .select({ position: workItems.position })
      .from(workItems)
      .where(
        and(eq(workItems.projectId, projectId), eq(workItems.status, "backlog"))
      )
      .orderBy(desc(workItems.position))
      .limit(1),
  ]);

  const assigneeId = assigneeIdInput || null;
  const dueDate = dueDateInput || null;
  const position = (top?.position ?? 0) + POSITION_GAP;

  const [workItem] = await db
    .insert(workItems)
    .values({
      projectId,
      number: counter[0].nextNumber - 1,
      title,
      description: description || null,
      priority,
      assigneeId,
      dueDate,
      position,
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

  await logActivity({
    actorId: user.id,
    projectId,
    action: "work_item.created",
    entityType: "work_item",
    entityId: workItem.id,
    after: { title, priority, assigneeId },
    searchText: `Created work item "#${workItem.number} ${title}"`,
  });

  revalidatePath(`/dashboard/${slug}/work-items`);
  revalidatePath("/dashboard/my-tasks");
  revalidatePath("/dashboard/team-tasks");
}

/**
 * Moves a work item to `status` at `position` (a value computed client-side
 * as the midpoint of its new neighbors, or ±POSITION_GAP at a column edge).
 * Handles both cross-column moves and same-column reordering.
 */
export async function moveWorkItem(
  workItemId: string,
  status: string,
  position: number,
  slug: string
) {
  const user = await requireUser();
  if (!(STATUSES as readonly string[]).includes(status)) return;

  const [item] = await db
    .select({
      projectId: workItems.projectId,
      title: workItems.title,
      number: workItems.number,
      status: workItems.status,
    })
    .from(workItems)
    .where(eq(workItems.id, workItemId))
    .limit(1);
  if (!item || !(await canAccessProject(user, item.projectId))) return;

  await db
    .update(workItems)
    .set({ status: status as Status, position, updatedAt: new Date() })
    .where(eq(workItems.id, workItemId));

  if (item.status !== status) {
    await logActivity({
      actorId: user.id,
      projectId: item.projectId,
      action: "work_item.status_changed",
      entityType: "work_item",
      entityId: workItemId,
      before: { status: item.status },
      after: { status },
      searchText: `Moved "#${item.number} ${item.title}" to ${status}`,
    });
  }

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
      number: workItems.number,
      dueDate: workItems.dueDate,
    })
    .from(workItems)
    .where(eq(workItems.id, workItemId))
    .limit(1);
  if (!item || !(await canAccessProject(user, item.projectId))) return;

  const isOwnerEdit = hasRole(user.role, "admin") && user.id !== item.assigneeId;
  const isSelfCommit = user.id === item.assigneeId;
  if (!isOwnerEdit && !isSelfCommit) return;
  if (!dueDate && item.assigneeId) return; // assigned tasks always need a deadline

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

  await logActivity({
    actorId: user.id,
    projectId: item.projectId,
    action: "work_item.due_date_changed",
    entityType: "work_item",
    entityId: workItemId,
    before: { dueDate: item.dueDate },
    after: { dueDate },
    searchText: `Set due date for "#${item.number} ${item.title}" to ${dueDate || "none"}`,
  });

  if (slug) revalidatePath(`/dashboard/${slug}/work-items`);
  revalidatePath("/dashboard/my-tasks");
  revalidatePath("/dashboard/team-tasks");
}

/**
 * Assigns (or reassigns) a work item to any active user. Anyone with access
 * to the project can call this — assignment isn't role-gated. A deadline is
 * mandatory whenever an assignee is set, since an assigned task with no due
 * date can't show up correctly in deadline-tracking views.
 */
export async function assignWorkItem(
  workItemId: string,
  slug: string,
  assigneeId: string | null,
  dueDate: string | null
): Promise<{ error: string } | undefined> {
  const user = await requireUser();

  const [item] = await db
    .select({
      projectId: workItems.projectId,
      title: workItems.title,
      assigneeId: workItems.assigneeId,
    })
    .from(workItems)
    .where(eq(workItems.id, workItemId))
    .limit(1);
  if (!item) return { error: "Work item not found." };
  if (!(await canAccessProject(user, item.projectId)))
    return { error: "You don't have access to this project." };
  if (assigneeId && !dueDate)
    return { error: "A deadline is required when assigning a task." };

  await db
    .update(workItems)
    .set({ assigneeId, dueDate, updatedAt: new Date() })
    .where(eq(workItems.id, workItemId));

  if (assigneeId && assigneeId !== item.assigneeId && assigneeId !== user.id) {
    await db.insert(notifications).values({
      userId: assigneeId,
      type: "work_item_assigned",
      body: `You were assigned "${item.title}".`,
      workItemId,
    });
  }

  await logActivity({
    actorId: user.id,
    projectId: item.projectId,
    action: "work_item.assigned",
    entityType: "work_item",
    entityId: workItemId,
    before: { assigneeId: item.assigneeId },
    after: { assigneeId, dueDate },
    searchText: `Assigned "${item.title}"`,
  });

  revalidatePath(`/dashboard/${slug}/work-items`);
  revalidatePath("/dashboard/my-tasks");
  revalidatePath("/dashboard/team-tasks");
}

export async function updateWorkItem(
  workItemId: string,
  slug: string,
  fields: {
    title?: string;
    description?: string;
    priority?: string;
    assigneeId?: string | null;
  }
) {
  const user = await requireUser();

  const [item] = await db
    .select({
      projectId: workItems.projectId,
      title: workItems.title,
      assigneeId: workItems.assigneeId,
    })
    .from(workItems)
    .where(eq(workItems.id, workItemId))
    .limit(1);
  if (!item || !(await canAccessProject(user, item.projectId))) return;

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.title !== undefined) {
    const title = fields.title.trim();
    if (!title) return;
    update.title = title;
  }
  if (fields.description !== undefined) {
    update.description = fields.description.trim() || null;
  }
  if (
    fields.priority !== undefined &&
    (PRIORITIES as readonly string[]).includes(fields.priority)
  ) {
    update.priority = fields.priority;
  }
  if (fields.assigneeId !== undefined) {
    update.assigneeId = fields.assigneeId || null;
  }

  await db.update(workItems).set(update).where(eq(workItems.id, workItemId));

  if (
    fields.assigneeId !== undefined &&
    fields.assigneeId &&
    fields.assigneeId !== item.assigneeId &&
    fields.assigneeId !== user.id
  ) {
    await db.insert(notifications).values({
      userId: fields.assigneeId,
      type: "work_item_assigned",
      body: `You were assigned "${fields.title ?? item.title}".`,
      workItemId,
    });
  }

  await logActivity({
    actorId: user.id,
    projectId: item.projectId,
    action: "work_item.updated",
    entityType: "work_item",
    entityId: workItemId,
    after: fields,
    searchText: `Updated work item "${fields.title ?? item.title}"`,
  });

  revalidatePath(`/dashboard/${slug}/work-items`);
  revalidatePath("/dashboard/my-tasks");
  revalidatePath("/dashboard/team-tasks");
}

export async function getWorkItemDetail(workItemId: string) {
  const user = await requireUser();

  const [item] = await db
    .select()
    .from(workItems)
    .where(eq(workItems.id, workItemId))
    .limit(1);
  if (!item || !(await canAccessProject(user, item.projectId))) return null;

  const comments = await db
    .select({
      id: workItemComments.id,
      body: workItemComments.body,
      createdAt: workItemComments.createdAt,
      authorId: workItemComments.authorId,
      authorName: users.name,
      authorDeletedAt: users.deletedAt,
    })
    .from(workItemComments)
    .innerJoin(users, eq(workItemComments.authorId, users.id))
    .where(eq(workItemComments.workItemId, workItemId))
    .orderBy(asc(workItemComments.createdAt));

  return { item, comments };
}

export async function addWorkItemComment(
  workItemId: string,
  body: string,
  slug: string
) {
  const user = await requireUser();
  const trimmed = body.trim();
  if (!trimmed) return;

  const [item] = await db
    .select({ projectId: workItems.projectId, title: workItems.title })
    .from(workItems)
    .where(eq(workItems.id, workItemId))
    .limit(1);
  if (!item || !(await canAccessProject(user, item.projectId))) return;

  await db.insert(workItemComments).values({
    workItemId,
    authorId: user.id,
    body: trimmed,
  });

  await logActivity({
    actorId: user.id,
    projectId: item.projectId,
    action: "work_item_comment.posted",
    entityType: "work_item_comment",
    entityId: workItemId,
    searchText: `Commented on "${item.title}": "${trimmed.slice(0, 120)}"`,
  });

  revalidatePath(`/dashboard/${slug}/work-items`);
}
