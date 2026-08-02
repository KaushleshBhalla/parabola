"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { roadmapItems } from "@/lib/db/schema";
import { requireUser, canAccessProject } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";

const STATUSES = ["planned", "in_progress", "done"] as const;
type Status = (typeof STATUSES)[number];

export async function createRoadmapItem(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const milestone = String(formData.get("milestone") ?? "").trim();
  const targetDate = String(formData.get("targetDate") ?? "").trim();
  const statusInput = String(formData.get("status") ?? "planned");
  const status: Status = (STATUSES as readonly string[]).includes(statusInput)
    ? (statusInput as Status)
    : "planned";

  if (!title || !projectId) return;
  if (!(await canAccessProject(user, projectId))) return;

  const [item] = await db
    .insert(roadmapItems)
    .values({
      projectId,
      title,
      description: description || null,
      milestone: milestone || null,
      targetDate: targetDate || null,
      status,
      createdBy: user.id,
    })
    .returning();

  await logActivity({
    actorId: user.id,
    projectId,
    action: "roadmap_item.created",
    entityType: "roadmap_item",
    entityId: item.id,
    after: { title, status, targetDate: targetDate || null },
    searchText: `Created roadmap item "${title}"`,
  });

  revalidatePath(`/dashboard/${slug}/roadmap`);
}

export async function updateRoadmapItemStatus(
  itemId: string,
  status: string,
  slug: string
) {
  const user = await requireUser();
  if (!(STATUSES as readonly string[]).includes(status)) return;

  const [item] = await db
    .select({
      projectId: roadmapItems.projectId,
      title: roadmapItems.title,
      status: roadmapItems.status,
    })
    .from(roadmapItems)
    .where(eq(roadmapItems.id, itemId))
    .limit(1);
  if (!item || !(await canAccessProject(user, item.projectId))) return;
  if (item.status === status) return;

  await db
    .update(roadmapItems)
    .set({ status: status as Status, updatedAt: new Date() })
    .where(eq(roadmapItems.id, itemId));

  await logActivity({
    actorId: user.id,
    projectId: item.projectId,
    action: "roadmap_item.status_changed",
    entityType: "roadmap_item",
    entityId: itemId,
    before: { status: item.status },
    after: { status },
    searchText: `Moved roadmap item "${item.title}" to ${status}`,
  });

  revalidatePath(`/dashboard/${slug}/roadmap`);
}

export async function deleteRoadmapItem(itemId: string, slug: string) {
  const user = await requireUser();

  const [item] = await db
    .select({ projectId: roadmapItems.projectId, title: roadmapItems.title })
    .from(roadmapItems)
    .where(eq(roadmapItems.id, itemId))
    .limit(1);
  if (!item || !(await canAccessProject(user, item.projectId))) return;

  await db.delete(roadmapItems).where(eq(roadmapItems.id, itemId));

  await logActivity({
    actorId: user.id,
    projectId: item.projectId,
    action: "roadmap_item.deleted",
    entityType: "roadmap_item",
    entityId: itemId,
    searchText: `Deleted roadmap item "${item.title}"`,
  });

  revalidatePath(`/dashboard/${slug}/roadmap`);
}
