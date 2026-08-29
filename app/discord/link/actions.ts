"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import { verifyLinkToken } from "@/lib/discord/link-token";
import { logActivity } from "@/lib/activity";

export async function confirmDiscordLink(token: string): Promise<{ error: string } | undefined> {
  const parsed = verifyLinkToken(token);
  if (!parsed) return { error: "This link has expired. Run /link in Discord again." };

  const user = await requireUser();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.discordUserId, parsed.discordUserId))
    .limit(1);
  if (existing && existing.id !== user.id) {
    return { error: "That Discord account is already linked to a different Parabola account." };
  }

  await db
    .update(users)
    .set({ discordUserId: parsed.discordUserId, discordUsername: parsed.discordUsername })
    .where(eq(users.id, user.id));

  await logActivity({
    actorId: user.id,
    action: "user.discord_linked",
    entityType: "user",
    entityId: user.id,
    searchText: `Linked Discord account @${parsed.discordUsername}`,
  });

  redirect("/dashboard");
}
