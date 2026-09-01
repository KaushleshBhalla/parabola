"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  workItems,
  workItemComments,
  workItemAssignees,
  projectCounters,
  notifications,
  users,
} from "@/lib/db/schema";
import { requireUser, canAccessProject, hasRole } from "@/lib/auth/rbac";
import { isProjectAdmin } from "@/lib/project-access";
import { logActivity } from "@/lib/activity";
import { formatStatusLabel } from "@/lib/work-items";
import {
  getProjectDemoState,
  assertDemoCreationAllowed,
  incrementDemoUsage,
} from "@/lib/demo";

const STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "review",
  "done",
  "cancelled",
] as const;
type Status = (typeof STATUSES)[number];

// Entering any of these requires a comment explaining the update. "done" is
// gated separately below (assignor-only, requires both a comment and a
// quality score).
const COMMENT_REQUIRED_STATUSES: readonly Status[] = ["in_progress", "in_review", "review"];

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
  const assigneeIds = formData.getAll("assigneeIds").map(String).filter(Boolean);
  const dueDateInput = String(formData.get("dueDate") ?? "").trim();
  const priority: Priority = (PRIORITIES as readonly string[]).includes(
    priorityInput
  )
    ? (priorityInput as Priority)
    : "none";

  if (!title || !projectId) return { error: "Title is required." };
  if (!(await canAccessProject(user, projectId)))
    return { error: "You don't have access to this project." };
  if (assigneeIds.length > 0 && !dueDateInput)
    return { error: "A deadline is required when assigning a task." };

  const demoState = await getProjectDemoState(projectId);
  const demoBlocked = assertDemoCreationAllowed(demoState);
  if (demoBlocked) return { error: demoBlocked };

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
      dueDate,
      position,
      createdBy: user.id,
    })
    .returning();

  if (assigneeIds.length > 0) {
    await db.insert(workItemAssignees).values(
      assigneeIds.map((userId) => ({
        workItemId: workItem.id,
        userId,
        assignedBy: user.id,
      }))
    );
    const notifyIds = assigneeIds.filter((id) => id !== user.id);
    if (notifyIds.length > 0) {
      await db.insert(notifications).values(
        notifyIds.map((userId) => ({
          userId,
          type: "work_item_assigned" as const,
          body: `You were assigned "${title}".`,
          workItemId: workItem.id,
        }))
      );
    }
  }

  if (demoState?.isDemo) {
    await incrementDemoUsage(projectId);
  }

  await logActivity({
    actorId: user.id,
    projectId,
    action: "work_item.created",
    entityType: "work_item",
    entityId: workItem.id,
    after: { title, priority, assigneeIds },
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
 *
 * Entering In Progress -> Testing Pending -> In Review requires a note
 * (`extra.comment`) explaining the update. Entering Done is restricted to
 * whoever created the task (the assignor, regardless of which column it's
 * coming from — an assignee can never drag it there) and requires both a
 * closing comment and a quality score out of 10 for the work, passed in now
 * (`extra.comment` / `extra.qualityScore`) or the score already set on the
 * item. Callers without the required extra should collect it first (see
 * move-work-item-dialog.tsx) and retry; a same-column reorder (status
 * unchanged) skips all of this.
 */
export async function moveWorkItem(
  workItemId: string,
  status: string,
  position: number,
  slug: string,
  extra?: { comment?: string; qualityScore?: number }
): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  if (!(STATUSES as readonly string[]).includes(status)) return { error: "Unknown status." };

  const [item] = await db
    .select({
      projectId: workItems.projectId,
      title: workItems.title,
      number: workItems.number,
      status: workItems.status,
      createdBy: workItems.createdBy,
      qualityScore: workItems.qualityScore,
    })
    .from(workItems)
    .where(eq(workItems.id, workItemId))
    .limit(1);
  if (!item || !(await canAccessProject(user, item.projectId)))
    return { error: "You don't have access to this project." };

  const isTransition = item.status !== status;
  const comment = extra?.comment?.trim() || undefined;
  let qualityScore: number | undefined;

  if (isTransition) {
    if (status === "done") {
      if (item.createdBy !== user.id) {
        return { error: "Only the person who created this task can mark it done." };
      }
      if (!comment) {
        return { error: "Add a closing comment before marking it done." };
      }
      const score = extra?.qualityScore ?? item.qualityScore ?? undefined;
      if (score == null) {
        return { error: "Rate the work out of 10 before marking it done." };
      }
      if (!Number.isInteger(score) || score < 1 || score > 10) {
        return { error: "Score must be a whole number between 1 and 10." };
      }
      qualityScore = score;
    } else if (COMMENT_REQUIRED_STATUSES.includes(status as Status)) {
      if (!comment) {
        return { error: "Add a comment about this update before moving it." };
      }
    }
  }

  await db
    .update(workItems)
    .set({
      status: status as Status,
      position,
      updatedAt: new Date(),
      ...(qualityScore !== undefined ? { qualityScore } : {}),
    })
    .where(eq(workItems.id, workItemId));

  if (comment) {
    await db.insert(workItemComments).values({ workItemId, authorId: user.id, body: comment });
  }

  if (isTransition) {
    if (item.createdBy && item.createdBy !== user.id) {
      if (status === "cancelled") {
        await db.insert(notifications).values({
          userId: item.createdBy,
          type: "work_item_cancelled",
          body: `"#${item.number} ${item.title}" was cancelled.`,
          workItemId,
        });
      } else {
        await db.insert(notifications).values({
          userId: item.createdBy,
          type: "work_item_status_changed",
          body: `"#${item.number} ${item.title}" moved to ${formatStatusLabel(status)} by ${user.name}.`,
          workItemId,
        });
      }
    }
    await logActivity({
      actorId: user.id,
      projectId: item.projectId,
      action: "work_item.status_changed",
      entityType: "work_item",
      entityId: workItemId,
      before: { status: item.status },
      after: { status, ...(qualityScore !== undefined ? { qualityScore } : {}) },
      searchText: `Moved "#${item.number} ${item.title}" to ${status}${qualityScore !== undefined ? ` and scored it ${qualityScore}/10` : ""}`,
    });
  }

  revalidatePath(`/dashboard/${slug}/work-items`);
  revalidatePath("/dashboard/my-tasks");
  revalidatePath("/dashboard/team-tasks");
  return undefined;
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
      title: workItems.title,
      number: workItems.number,
      dueDate: workItems.dueDate,
    })
    .from(workItems)
    .where(eq(workItems.id, workItemId))
    .limit(1);
  if (!item || !(await canAccessProject(user, item.projectId))) return;

  const assignedUserIds = (
    await db
      .select({ userId: workItemAssignees.userId })
      .from(workItemAssignees)
      .where(eq(workItemAssignees.workItemId, workItemId))
  ).map((a) => a.userId);
  const isAssignee = assignedUserIds.includes(user.id);
  const isOwnerEdit = hasRole(user.role, "admin") && !isAssignee;
  const isSelfCommit = isAssignee;
  if (!isOwnerEdit && !isSelfCommit) return;
  if (!dueDate && assignedUserIds.length > 0) return; // assigned tasks always need a deadline

  await db
    .update(workItems)
    .set({ dueDate: dueDate || null, updatedAt: new Date() })
    .where(eq(workItems.id, workItemId));

  if (isOwnerEdit && assignedUserIds.length > 0) {
    const notifyIds = assignedUserIds.filter((id) => id !== user.id);
    if (notifyIds.length > 0) {
      await db.insert(notifications).values(
        notifyIds.map((userId) => ({
          userId,
          type: "due_date_changed" as const,
          body: `Owner changed your completion date for "${item.title}" to ${dueDate}.`,
          workItemId,
        }))
      );
    }
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
 * Assigns (or reassigns) a work item to any number of active users, including
 * the actor themselves. Anyone with access to the project can call this —
 * assignment isn't role-gated. A deadline is mandatory whenever at least one
 * assignee is set, since an assigned task with no due date can't show up
 * correctly in deadline-tracking views.
 */
export async function assignWorkItem(
  workItemId: string,
  slug: string,
  assigneeIds: string[],
  dueDate: string | null
): Promise<{ error: string } | undefined> {
  const user = await requireUser();

  const [item] = await db
    .select({ projectId: workItems.projectId, title: workItems.title })
    .from(workItems)
    .where(eq(workItems.id, workItemId))
    .limit(1);
  if (!item) return { error: "Work item not found." };
  if (!(await canAccessProject(user, item.projectId)))
    return { error: "You don't have access to this project." };
  if (assigneeIds.length > 0 && !dueDate)
    return { error: "A deadline is required when assigning a task." };

  const current = await db
    .select({ userId: workItemAssignees.userId })
    .from(workItemAssignees)
    .where(eq(workItemAssignees.workItemId, workItemId));
  const currentIds = current.map((c) => c.userId);
  const toAdd = assigneeIds.filter((id) => !currentIds.includes(id));
  const toRemove = currentIds.filter((id) => !assigneeIds.includes(id));

  await db
    .update(workItems)
    .set({ dueDate, updatedAt: new Date() })
    .where(eq(workItems.id, workItemId));

  if (toRemove.length > 0) {
    await db
      .delete(workItemAssignees)
      .where(
        and(
          eq(workItemAssignees.workItemId, workItemId),
          inArray(workItemAssignees.userId, toRemove)
        )
      );
  }
  if (toAdd.length > 0) {
    await db.insert(workItemAssignees).values(
      toAdd.map((userId) => ({ workItemId, userId, assignedBy: user.id }))
    );
    const notifyIds = toAdd.filter((id) => id !== user.id);
    if (notifyIds.length > 0) {
      await db.insert(notifications).values(
        notifyIds.map((userId) => ({
          userId,
          type: "work_item_assigned" as const,
          body: `You were assigned "${item.title}".`,
          workItemId,
        }))
      );
    }
  }

  await logActivity({
    actorId: user.id,
    projectId: item.projectId,
    action: "work_item.assigned",
    entityType: "work_item",
    entityId: workItemId,
    before: { assigneeIds: currentIds },
    after: { assigneeIds, dueDate },
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
  }
) {
  const user = await requireUser();

  const [item] = await db
    .select({ projectId: workItems.projectId, title: workItems.title })
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

  await db.update(workItems).set(update).where(eq(workItems.id, workItemId));

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

/** Destructive — restricted to whoever created the task or a project admin. */
export async function deleteWorkItem(
  workItemId: string,
  slug: string
): Promise<{ error: string } | undefined> {
  const user = await requireUser();

  const [item] = await db
    .select({ projectId: workItems.projectId, title: workItems.title, number: workItems.number, createdBy: workItems.createdBy })
    .from(workItems)
    .where(eq(workItems.id, workItemId))
    .limit(1);
  if (!item) return { error: "Work item not found." };
  if (!(await canAccessProject(user, item.projectId))) return { error: "You don't have access to this project." };
  if (item.createdBy !== user.id && !(await isProjectAdmin(user.id, item.projectId))) {
    return { error: "Only the creator or a project admin can delete this task." };
  }

  await db.delete(workItems).where(eq(workItems.id, workItemId));

  await logActivity({
    actorId: user.id,
    projectId: item.projectId,
    action: "work_item.deleted",
    entityType: "work_item",
    entityId: workItemId,
    before: { title: item.title },
    searchText: `Deleted "#${item.number} ${item.title}"`,
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

  const [comments, assignees] = await Promise.all([
    db
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
      .orderBy(asc(workItemComments.createdAt)),
    db
      .select({ id: users.id, name: users.name })
      .from(workItemAssignees)
      .innerJoin(users, eq(workItemAssignees.userId, users.id))
      .where(eq(workItemAssignees.workItemId, workItemId)),
  ]);

  const isCreator = item.createdBy === user.id;
  return {
    item,
    comments,
    assignees,
    isCreator,
    canDelete: isCreator || (await isProjectAdmin(user.id, item.projectId)),
  };
}

export async function setWorkItemQualityScore(
  workItemId: string,
  slug: string,
  score: number
): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    return { error: "Score must be a whole number between 1 and 10." };
  }

  const [item] = await db
    .select({
      projectId: workItems.projectId,
      title: workItems.title,
      createdBy: workItems.createdBy,
    })
    .from(workItems)
    .where(eq(workItems.id, workItemId))
    .limit(1);
  if (!item || !(await canAccessProject(user, item.projectId))) return;
  if (item.createdBy !== user.id) {
    return { error: "Only the creator can score this work item." };
  }

  await db
    .update(workItems)
    .set({ qualityScore: score, updatedAt: new Date() })
    .where(eq(workItems.id, workItemId));

  await logActivity({
    actorId: user.id,
    projectId: item.projectId,
    action: "work_item.scored",
    entityType: "work_item",
    entityId: workItemId,
    after: { qualityScore: score },
    searchText: `Scored "${item.title}" ${score}/10`,
  });

  revalidatePath(`/dashboard/${slug}/work-items`);
}

export async function addWorkItemComment(
  workItemId: string,
  body: string,
  slug: string
): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  const trimmed = body.trim();
  if (!trimmed) return;

  const [item] = await db
    .select({ projectId: workItems.projectId, title: workItems.title })
    .from(workItems)
    .where(eq(workItems.id, workItemId))
    .limit(1);
  if (!item || !(await canAccessProject(user, item.projectId))) return;

  const demoState = await getProjectDemoState(item.projectId);
  const demoBlocked = assertDemoCreationAllowed(demoState);
  if (demoBlocked) return { error: demoBlocked };

  await db.insert(workItemComments).values({
    workItemId,
    authorId: user.id,
    body: trimmed,
  });

  if (demoState?.isDemo) {
    await incrementDemoUsage(item.projectId);
  }

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
