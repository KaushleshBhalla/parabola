"use server";

import { redirect } from "next/navigation";
import { destroySession, getCurrentUser } from "./session";
import { logActivity } from "@/lib/activity";

export async function logout() {
  const user = await getCurrentUser();
  await destroySession();

  if (user) {
    await logActivity({
      actorId: user.id,
      action: "user.logout",
      entityType: "user",
      entityId: user.id,
      searchText: `${user.name} logged out`,
    });
  }

  redirect("/login");
}
