import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projectDiscordChannels } from "@/lib/db/schema";
import { isProjectAdmin } from "@/lib/project-access";
import {
  parseChannelInput,
  getChannelInfo,
  fetchChannelMessages,
} from "@/lib/discord/api";

export async function listProjectDiscordChannels(projectId: string) {
  return db
    .select({
      id: projectDiscordChannels.id,
      discordChannelId: projectDiscordChannels.discordChannelId,
      name: projectDiscordChannels.discordChannelName,
    })
    .from(projectDiscordChannels)
    .where(eq(projectDiscordChannels.projectId, projectId))
    .orderBy(projectDiscordChannels.createdAt);
}

export async function addProjectDiscordChannel(
  projectId: string,
  actorId: string,
  input: string
): Promise<{ error: string } | { name: string | null }> {
  if (!(await isProjectAdmin(actorId, projectId))) return { error: "You can't manage that project." };

  const channelId = parseChannelInput(input);
  if (!channelId) {
    return { error: "That doesn't look like a channel ID or link — paste a Discord channel link, or its ID." };
  }

  const info = await getChannelInfo(channelId);
  if (!info) {
    return { error: "Parabola's bot can't see that channel. Make sure the bot is in the server and has access to it." };
  }

  await db
    .insert(projectDiscordChannels)
    .values({ projectId, discordChannelId: channelId, discordChannelName: info.name, addedBy: actorId })
    .onConflictDoNothing();

  return { name: info.name };
}

export async function removeProjectDiscordChannel(
  projectId: string,
  actorId: string,
  discordChannelId: string
): Promise<{ error: string } | undefined> {
  if (!(await isProjectAdmin(actorId, projectId))) return { error: "You can't manage that project." };
  await db
    .delete(projectDiscordChannels)
    .where(
      and(
        eq(projectDiscordChannels.projectId, projectId),
        eq(projectDiscordChannels.discordChannelId, discordChannelId)
      )
    );
}

export type TimeRange = "24h" | "3d" | "7d" | "30d" | "all";

function sinceFor(range: TimeRange): Date | undefined {
  const now = Date.now();
  switch (range) {
    case "24h":
      return new Date(now - 24 * 3_600_000);
    case "3d":
      return new Date(now - 3 * 86_400_000);
    case "7d":
      return new Date(now - 7 * 86_400_000);
    case "30d":
      return new Date(now - 30 * 86_400_000);
    case "all":
      return undefined;
  }
}

// Hard cap so an "all time" fetch over a busy channel can't run forever,
// blow the LLM context, or trip Discord rate limits. ~1500 msgs ≈ 15 REST
// calls per channel.
const MAX_PER_CHANNEL = 1500;

/**
 * Builds the plain-text block of Discord chat that gets handed to the model,
 * plus a note on how much was pulled (and whether it was truncated).
 */
export async function buildDiscordContext(
  projectId: string,
  opts: { channelIds?: string[]; range: TimeRange }
): Promise<{ text: string; summary: string; channelsRead: number; messageCount: number }> {
  const linked = await listProjectDiscordChannels(projectId);
  const targets = opts.channelIds?.length
    ? linked.filter((c) => opts.channelIds!.includes(c.discordChannelId))
    : linked;

  if (targets.length === 0) {
    return {
      text: "(No Discord channels are linked to this project, so there's no chat history to draw on.)",
      summary: "no channels linked",
      channelsRead: 0,
      messageCount: 0,
    };
  }

  const since = sinceFor(opts.range);
  const blocks: string[] = [];
  let total = 0;
  let anyTruncated = false;

  for (const channel of targets) {
    let messages;
    try {
      messages = await fetchChannelMessages(channel.discordChannelId, {
        since,
        maxMessages: MAX_PER_CHANNEL,
      });
    } catch {
      blocks.push(`## #${channel.name ?? channel.discordChannelId}\n(Couldn't read this channel.)`);
      continue;
    }
    if (messages.length >= MAX_PER_CHANNEL) anyTruncated = true;

    // Discord returns newest-first; read chronologically.
    const lines = messages
      .slice()
      .reverse()
      .filter((m) => m.content.trim())
      .map((m) => {
        const who = m.author.global_name || m.author.username;
        const when = new Date(m.timestamp).toISOString().slice(0, 16).replace("T", " ");
        return `[${when}] ${who}: ${m.content.replace(/\n/g, " ")}`;
      });

    total += lines.length;
    blocks.push(`## #${channel.name ?? channel.discordChannelId}\n${lines.join("\n") || "(no text messages in this range)"}`);
  }

  const rangeLabel = opts.range === "all" ? "all time" : `last ${opts.range}`;
  const summary = `${total} message${total === 1 ? "" : "s"} from ${targets.length} channel${targets.length === 1 ? "" : "s"}, ${rangeLabel}${anyTruncated ? " (older messages were cut off — narrow the range or pick fewer channels for full coverage)" : ""}`;

  return {
    text: blocks.join("\n\n"),
    summary,
    channelsRead: targets.length,
    messageCount: total,
  };
}
