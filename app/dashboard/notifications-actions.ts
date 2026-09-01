"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";

export async function markNotificationsRead() {
  const user = await requireUser();
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(eq(notifications.userId, user.id), eq(notifications.isRead, false))
    );
  revalidatePath("/dashboard", "layout");
}

export async function markNotificationRead(notificationId: string) {
  const user = await requireUser();
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, user.id)));
  revalidatePath("/dashboard", "layout");
}
