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
