import { config } from "dotenv";
config({ path: ".env.local" });

import { discordCommands } from "../lib/discord/commands";

async function main() {
  const appId = process.env.DISCORD_APPLICATION_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!appId || !token) {
    throw new Error("DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN must be set in .env.local");
  }

  const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
    method: "PUT",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(discordCommands),
  });

  if (!res.ok) {
    console.error(`Registration failed (${res.status}):`, await res.text());
    process.exit(1);
  }

  const data = await res.json();
  console.log(`Registered ${data.length} top-level commands globally (can take up to an hour to appear everywhere; instant in the server you test in).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
