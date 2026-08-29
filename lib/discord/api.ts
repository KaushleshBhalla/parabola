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
