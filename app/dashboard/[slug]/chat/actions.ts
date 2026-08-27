"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { chatMessages } from "@/lib/db/schema";
import { requireUser, canAccessProject } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";
import {
  getProjectDemoState,
  assertDemoCreationAllowed,
  incrementDemoUsage,
} from "@/lib/demo";

export async function postMessage(
  formData: FormData
): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!body || !projectId) return;
  if (!(await canAccessProject(user, projectId))) return;

  const demoState = await getProjectDemoState(projectId);
  const demoBlocked = assertDemoCreationAllowed(demoState);
  if (demoBlocked) return { error: demoBlocked };

  const [message] = await db
    .insert(chatMessages)
    .values({
      projectId,
      authorId: user.id,
      body,
    })
    .returning();

  if (demoState?.isDemo && demoState.organizationId) {
    await incrementDemoUsage(demoState.organizationId);
  }

  await logActivity({
    actorId: user.id,
    projectId,
    action: "chat_message.posted",
    entityType: "chat_message",
    entityId: message.id,
    searchText: `Posted a message: "${body.slice(0, 120)}"`,
  });

  revalidatePath(`/dashboard/${slug}/chat`);
}
