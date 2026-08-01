"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { chatMessages } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";

export async function postMessage(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!body || !projectId) return;

  await db.insert(chatMessages).values({
    projectId,
    authorId: user.id,
    body,
  });

  revalidatePath(`/dashboard/${slug}/chat`);
}
