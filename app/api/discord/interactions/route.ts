import { NextRequest, NextResponse } from "next/server";
import { verifyKey } from "discord-interactions";
import { createLinkToken } from "@/lib/discord/link-token";
import { sendDirectMessage } from "@/lib/discord/api";
import { buildEmbed, DANGER_COLOR } from "@/lib/discord/embeds";
import { resolveOrgByGuild, resolveUserByDiscordId } from "@/lib/discord/resolve";
import {
  type CommandReply,
  handleSetup,
  handleTaskNew,
  handleTaskList,
  handleTaskView,
  handleTaskAssign,
  handleTaskMove,
  handleTaskComment,
  handleTaskScore,
  handleMyTasks,
  handleProjects,
  handleTeamTasks,
  handleRoadmap,
  handleActivity,
  handleRolesList,
  handleRolesAssign,
  handleInvite,
  handleNotifications,
} from "@/lib/discord/handlers";

const APP_URL = "https://parabolaa.vercel.app";

function fail(message: string): CommandReply {
  return { embeds: [buildEmbed({ title: "Couldn't do that", description: message, color: DANGER_COLOR })], ephemeral: true };
}

type RawOption = { name: string; type: number; value?: string | number | boolean; options?: RawOption[] };

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
    const target = args.for === "admin" ? "#admin-setup" : args.for === "user" ? "#getting-started" : "";
    return {
      embeds: [
        buildEmbed({
          title: "Vertex Guide",
          description: `[Open the full guide](${APP_URL}/discord/guide${target}) — every command, what it does, and how to set things up.`,
        }),
      ],
      ephemeral: true,
    };
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
    return handleSetup(discordUser, guildId, String(args.org ?? ""));
  }

  if (!guildId) return fail("This command only works inside a server.");
  const org = await resolveOrgByGuild(guildId);
  if (!org) return fail("This server isn't linked to a Parabola organization yet — an admin should run `/setup`.");
  const user = discordUserId ? await resolveUserByDiscordId(discordUserId) : null;
  if (!user) return fail("Link your account first with `/link`.");

  switch (commandName) {
    case "task": {
      switch (subcommand) {
        case "new":
          return handleTaskNew(user, org, {
            project: String(args.project),
            title: String(args.title),
            assignees: args.assignees ? String(args.assignees) : undefined,
            priority: args.priority ? String(args.priority) : undefined,
            due: args.due ? String(args.due) : undefined,
          });
        case "list": {
          let assigneeId: string | undefined;
          if (args.assignee) {
            const assigneeUser = await resolveUserByDiscordId(String(args.assignee));
            if (!assigneeUser) return fail("That person hasn't run `/link` yet.");
            assigneeId = assigneeUser.id;
          }
          return handleTaskList(org, {
            project: args.project ? String(args.project) : undefined,
            status: args.status ? String(args.status) : undefined,
            assignee: assigneeId,
          });
        }
        case "view":
          return handleTaskView(org, { project: String(args.project), id: Number(args.id) });
        case "assign":
          return handleTaskAssign(user, org, {
            project: String(args.project),
            id: Number(args.id),
            mentions: String(args.mentions),
            due: args.due ? String(args.due) : undefined,
          });
        case "move":
          return handleTaskMove(user, org, { project: String(args.project), id: Number(args.id), status: String(args.status) });
        case "comment":
          return handleTaskComment(user, org, { project: String(args.project), id: Number(args.id), message: String(args.message) });
        case "score":
          return handleTaskScore(user, org, { project: String(args.project), id: Number(args.id), score: Number(args.score) });
        default:
          return fail("Unknown /task subcommand.");
      }
    }
    case "mytasks":
      return handleMyTasks(user, org);
    case "projects":
      return handleProjects(org);
    case "teamtasks":
      return handleTeamTasks(org);
    case "roadmap":
      return handleRoadmap(org, { project: args.project ? String(args.project) : undefined });
    case "activity":
      return handleActivity(org, { project: args.project ? String(args.project) : undefined });
    case "roles": {
      if (subcommand === "list") return handleRolesList(org);
      if (subcommand === "assign") return handleRolesAssign(user, org, { discordUserId: String(args.user), role: String(args.role) });
      return fail("Unknown /roles subcommand.");
    }
    case "invite":
      return handleInvite(user, org);
    case "notifications":
      return handleNotifications(user);
    default:
      return fail("Unknown command.");
  }
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
