import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { organizations, users } from "@/lib/db/schema";

export async function resolveOrgByGuild(guildId: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.discordGuildId, guildId))
    .limit(1);
  return org ?? null;
}

export async function resolveUserByDiscordId(discordUserId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.discordUserId, discordUserId))
    .limit(1);
  return user ?? null;
}

/** Discord mention strings look like <@123456> or <@!123456> (nickname form). */
export function extractMentionedDiscordIds(text: string): string[] {
  const matches = text.matchAll(/<@!?(\d+)>/g);
  return [...new Set([...matches].map((m) => m[1]))];
}
