"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { roadmapItems } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";

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

  await db.insert(roadmapItems).values({
    projectId,
    title,
    description: description || null,
    milestone: milestone || null,
    targetDate: targetDate || null,
    status,
    createdBy: user.id,
  });

  revalidatePath(`/dashboard/${slug}/roadmap`);
}
