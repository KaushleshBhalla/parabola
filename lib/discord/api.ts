import "server-only";

const DISCORD_API = "https://discord.com/api/v10";

function botHeaders() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");
  return {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  };
}

export async function sendChannelMessage(
  channelId: string,
  body: { content?: string; embeds?: unknown[] }
) {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: botHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Discord sendChannelMessage failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Every member of a Discord server, paginated (Discord caps a single page
 * at 1000). Requires the bot to have the "Server Members Intent" privileged
 * intent enabled in the Developer Portal (Bot -> Privileged Gateway
 * Intents) — without it Discord returns only partial/empty results even
 * though the request itself succeeds.
 */
export async function listGuildMembers(guildId: string): Promise<{ user: { id: string; username: string; bot?: boolean } }[]> {
  const members: { user: { id: string; username: string; bot?: boolean } }[] = [];
  let after = "0";
  while (true) {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members?limit=1000&after=${after}`, {
      headers: botHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Discord listGuildMembers failed: ${res.status} ${await res.text()}`);
    }
    const page: { user: { id: string; username: string; bot?: boolean } }[] = await res.json();
    members.push(...page);
    if (page.length < 1000) break;
    after = page[page.length - 1].user.id;
  }
  return members;
}

const SNOWFLAKE_RE = /^\d{15,25}$/;
const CHANNEL_LINK_RE = /discord(?:app)?\.com\/channels\/\d+\/(\d+)/;

/** Pulls a channel id out of a raw id or a full discord.com/channels/... link. */
export function parseChannelInput(input: string): string | null {
  const trimmed = input.trim();
  if (SNOWFLAKE_RE.test(trimmed)) return trimmed;
  const m = trimmed.match(CHANNEL_LINK_RE);
  return m ? m[1] : null;
}

/** Confirms the bot can see a channel and returns its name — null if it can't. */
export async function getChannelInfo(
  channelId: string
): Promise<{ id: string; name: string | null; guildId: string | null } | null> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}`, { headers: botHeaders() });
  if (!res.ok) return null;
  const c = await res.json();
  return { id: c.id, name: c.name ?? null, guildId: c.guild_id ?? null };
}

type DiscordMessage = {
  id: string;
  content: string;
  timestamp: string;
  author: { username: string; global_name?: string | null; bot?: boolean };
};

/**
 * Messages from one channel, newest-first, paginated backwards. Stops at
 * `maxMessages` or once messages predate `since`. Needs the bot to have the
 * "Message Content Intent" privileged intent enabled — without it every
 * `content` comes back as an empty string.
 */
export async function fetchChannelMessages(
  channelId: string,
  opts: { since?: Date; maxMessages: number }
): Promise<DiscordMessage[]> {
  const out: DiscordMessage[] = [];
  let before: string | undefined;
  const sinceMs = opts.since?.getTime();

  while (out.length < opts.maxMessages) {
    const url = new URL(`${DISCORD_API}/channels/${channelId}/messages`);
    url.searchParams.set("limit", "100");
    if (before) url.searchParams.set("before", before);

    const res = await fetch(url, { headers: botHeaders() });
    if (!res.ok) {
      throw new Error(`Discord fetchChannelMessages failed: ${res.status} ${await res.text()}`);
    }
    const page: DiscordMessage[] = await res.json();
    if (page.length === 0) break;

    for (const msg of page) {
      if (sinceMs !== undefined && new Date(msg.timestamp).getTime() < sinceMs) {
        return out;
      }
      out.push(msg);
      if (out.length >= opts.maxMessages) return out;
    }
    before = page[page.length - 1].id;
    if (page.length < 100) break;
  }
  return out;
}

export async function sendDirectMessage(
  discordUserId: string,
  body: { content?: string; embeds?: unknown[] }
) {
  const dmChannel = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: "POST",
    headers: botHeaders(),
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  if (!dmChannel.ok) {
    throw new Error(`Discord DM channel open failed: ${dmChannel.status} ${await dmChannel.text()}`);
  }
  const { id: channelId } = await dmChannel.json();
  await sendChannelMessage(channelId, body);
}
