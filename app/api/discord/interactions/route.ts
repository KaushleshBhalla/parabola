import { NextRequest, NextResponse } from "next/server";
import { verifyKey } from "discord-interactions";
import { createLinkToken } from "@/lib/discord/link-token";
import { sendDirectMessage } from "@/lib/discord/api";
import { buildEmbed, DANGER_COLOR } from "@/lib/discord/embeds";
import {
  resolveProjectByGuild,
  resolveUserByDiscordId,
  resolveUserProject,
  listUserProjects,
} from "@/lib/discord/resolve";
import { canAccessProject } from "@/lib/auth/roles";
import {
  type CommandReply,
  handleSetup,
  handleTaskList,
  handleTaskView,
  handleBoard,
  handleAssign,
  handleMyTasks,
} from "@/lib/discord/handlers";

// This route's DB round trips all go to Supabase in ap-northeast-1 (Tokyo)
// and it does nothing else region-sensitive (Discord's own API is globally
// anycast), so pin it near the database instead of the app's default
// region — cuts real time off every command that touches the DB, which is
// most of them, against Discord's tight 3-second interaction deadline.
export const preferredRegion = "hnd1";

const APP_URL = "https://parabolaa.vercel.app";

function fail(message: string): CommandReply {
  return { embeds: [buildEmbed({ title: "Couldn't do that", description: message, color: DANGER_COLOR })], ephemeral: true };
}

type RawOption = {
  name: string;
  type: number;
  value?: string | number | boolean;
  focused?: boolean;
  options?: RawOption[];
};

function flattenOptions(options: RawOption[] = []) {
  let subcommand: string | undefined;
  const args: Record<string, string | number | boolean> = {};
  for (const opt of options) {
    if (opt.type === 1) {
      subcommand = opt.name;
      for (const sub of opt.options ?? []) {
        if (sub.value !== undefined) args[sub.name] = sub.value;
      }
    } else if (opt.value !== undefined) {
      args[opt.name] = opt.value;
    }
  }
  return { subcommand, args };
}

function findFocusedOption(options: RawOption[] = []): RawOption | null {
  for (const opt of options) {
    if (opt.focused) return opt;
    if (opt.options) {
      const nested = findFocusedOption(opt.options);
      if (nested) return nested;
    }
  }
  return null;
}

function guideEmbed() {
  return buildEmbed({
    title: "Parabola commands",
    description: [
      "**/link** — connect your Discord account to your Parabola login (DMs you a link).",
      "**/setup project:<name>** — link this server to one of your projects (project admins only). `/task` and `/assign` then default to it.",
      "**/task list [status] [assignee]** — list work items in this server's linked project.",
      "**/task view id:<#>** — show one task's full detail.",
      "**/board [column]** — see the whole board (every column) at a glance, or just one column (Todo, In Progress, Testing Pending, etc.).",
      "**/assign mentions:<@people> work:<title> [project] [priority] [deadline]** — create a task and assign it. Project defaults to this server's linked one; priority and deadline are optional.",
      "**/mytasks** — your assigned tasks across every project you're in.",
      "",
      `[Full guide with screenshots](${APP_URL}/discord/guide)`,
    ].join("\n"),
  });
}

async function routeAutocomplete(interaction: {
  member?: { user?: { id: string } };
  user?: { id: string };
  data: { options?: RawOption[] };
}) {
  const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;
  const focused = findFocusedOption(interaction.data.options);
  if (!discordUserId || !focused || focused.name !== "project") {
    return { choices: [] };
  }
  const user = await resolveUserByDiscordId(discordUserId);
  if (!user) return { choices: [] };

  const query = typeof focused.value === "string" ? focused.value : "";
  const matches = await listUserProjects(user.id, query || undefined);
  return { choices: matches.map((p) => ({ name: p.name, value: p.id })) };
}

async function routeCommand(interaction: {
  guild_id?: string;
  member?: { user?: { id: string; username: string; global_name?: string | null } };
  user?: { id: string; username: string; global_name?: string | null };
  data: { name: string; options?: RawOption[] };
}): Promise<CommandReply> {
  const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;
  const discordUsername =
    interaction.member?.user?.global_name ??
    interaction.member?.user?.username ??
    interaction.user?.global_name ??
    interaction.user?.username ??
    "there";
  const guildId = interaction.guild_id;
  const commandName = interaction.data.name;
  const { subcommand, args } = flattenOptions(interaction.data.options);

  if (commandName === "guide") {
    return { embeds: [guideEmbed()], ephemeral: true };
  }

  if (commandName === "link") {
    if (!discordUserId) return fail("Couldn't identify you.");
    const token = createLinkToken(discordUserId, discordUsername);
    try {
      await sendDirectMessage(discordUserId, {
        embeds: [
          buildEmbed({
            title: "Connect your Parabola account",
            description: `[Click here to finish linking](${APP_URL}/discord/link?token=${encodeURIComponent(token)}). This link expires in 10 minutes.`,
          }),
        ],
      });
      return { embeds: [buildEmbed({ title: "Check your DMs", description: "I've sent you a private link to connect your Parabola account." })], ephemeral: true };
    } catch {
      return fail("I couldn't DM you — check that you allow direct messages from server members.");
    }
  }

  if (commandName === "setup") {
    if (!guildId) return fail("This only works inside a server.");
    const discordUser = discordUserId ? await resolveUserByDiscordId(discordUserId) : null;
    if (!discordUser) return fail("Link your account first with `/link`.");
    const project = await resolveUserProject(discordUser.id, String(args.project ?? ""));
    if (!project) return fail(`No project called "${args.project}" that you belong to.`);
    return handleSetup(discordUser, guildId, project);
  }

  const user = discordUserId ? await resolveUserByDiscordId(discordUserId) : null;
  if (!user) return fail("Link your account first with `/link`.");

  if (commandName === "mytasks") {
    return handleMyTasks(user);
  }

  if (commandName === "board") {
    if (!guildId) return fail("This command only works inside a server.");
    const project = await resolveProjectByGuild(guildId);
    if (!project) return fail("This server isn't linked to a project yet — an admin should run `/setup`.");
    return handleBoard(project, { column: args.column ? String(args.column) : undefined });
  }

  if (commandName === "assign") {
    let project = null;
    if (args.project) {
      project = await resolveUserProject(user.id, String(args.project));
      if (!project) return fail(`No project called "${args.project}" that you belong to.`);
    } else if (guildId) {
      project = await resolveProjectByGuild(guildId);
    }
    if (!project) return fail("Pass a `project`, or run `/setup` to link this server to one first.");
    if (!(await canAccessProject(user, project.id))) return fail("You don't have access to that project.");
    return handleAssign(user, project, {
      mentions: String(args.mentions ?? ""),
      work: String(args.work ?? ""),
      priority: args.priority ? String(args.priority) : undefined,
      deadline: args.deadline ? String(args.deadline) : undefined,
    });
  }

  if (commandName === "task") {
    if (!guildId) return fail("This command only works inside a server.");
    const project = await resolveProjectByGuild(guildId);
    if (!project) return fail("This server isn't linked to a project yet — an admin should run `/setup`.");

    switch (subcommand) {
      case "list": {
        let assigneeId: string | undefined;
        if (args.assignee) {
          const assigneeUser = await resolveUserByDiscordId(String(args.assignee));
          if (!assigneeUser) return fail("That person hasn't run `/link` yet.");
          assigneeId = assigneeUser.id;
        }
        return handleTaskList(project, {
          status: args.status ? String(args.status) : undefined,
          assignee: assigneeId,
        });
      }
      case "view":
        return handleTaskView(project, { id: Number(args.id) });
      default:
        return fail("Unknown /task subcommand.");
    }
  }

  return fail("Unknown command.");
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  const rawBody = await req.text();

  if (!signature || !timestamp || !publicKey) {
    return new NextResponse("Bad request", { status: 401 });
  }
  const isValid = await verifyKey(rawBody, signature, timestamp, publicKey);
  if (!isValid) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody);

  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  if (interaction.type === 4) {
    try {
      const result = await routeAutocomplete(interaction);
      return NextResponse.json({ type: 8, data: result });
    } catch (err) {
      console.error("Discord autocomplete error:", err);
      return NextResponse.json({ type: 8, data: { choices: [] } });
    }
  }

  if (interaction.type === 2) {
    try {
      const reply = await routeCommand(interaction);
      return NextResponse.json({
        type: 4,
        data: {
          content: reply.content,
          embeds: reply.embeds,
          flags: reply.ephemeral ? 64 : undefined,
        },
      });
    } catch (err) {
      console.error("Discord interaction error:", err);
      return NextResponse.json({
        type: 4,
        data: { content: "Something went wrong running that command.", flags: 64 },
      });
    }
  }

  return new NextResponse("Unhandled interaction type", { status: 400 });
}

