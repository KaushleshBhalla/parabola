import { NextRequest, NextResponse } from "next/server";
import { verifyKey } from "discord-interactions";
import { createLinkToken } from "@/lib/discord/link-token";
import { sendDirectMessage } from "@/lib/discord/api";
import { buildEmbed, DANGER_COLOR } from "@/lib/discord/embeds";
import {
  resolveUserByDiscordId,
  resolveCommandProject,
  resolveUserProject,
  listUserProjects,
  listProjectWorkItemChoices,
} from "@/lib/discord/resolve";
import {
  type CommandReply,
  handleTaskList,
  handleTaskView,
  handleBoard,
  handleAssign,
  handleProgress,
  handleSetMeet,
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
      "**/task list [project] [status] [assignee]** — list work items in one of your projects.",
      "**/task view id:<#> [project]** — show one task's full detail.",
      "**/board [project] [column]** — see the whole board (every column) at a glance, or just one column (Todo, In Progress, Testing Pending, etc.).",
      "**/assign person1:<@who> [person2-5] [work_item] [work] [project] [priority] [deadline]** — two modes in one command: pass `work_item` (autocomplete, any status) to add people to an existing task, or `work` to create a new one (starts in Todo). Up to 5 people, picked from the member list (not free text). `deadline` takes `2d`, `5hr`, `1w`, or `YYYY-MM-DD`.",
      "**/progress project:<name> work_item:<#> comment:<text>** — move a task one step forward (Todo/In Progress → Testing Pending → In Review) with a required comment. Everything here is required, unlike elsewhere.",
      "**/setmeet time:<e.g. 10pm today> timezone:<e.g. Indian> [project] [title]** — schedule a meeting; I'll ping every project member, right here, 5 minutes before. Project admins only.",
      "`project` is optional everywhere else above (autocomplete over every project you're in) — it defaults to your only project if you're just in one, otherwise you'll be asked to pick.",
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
  if (!discordUserId || !focused) return { choices: [] };
  const user = await resolveUserByDiscordId(discordUserId);
  if (!user) return { choices: [] };

  const query = typeof focused.value === "string" ? focused.value : "";

  if (focused.name === "project") {
    const matches = await listUserProjects(user.id, query || undefined);
    return { choices: matches.map((p) => ({ name: p.name, value: p.id })) };
  }

  if (focused.name === "id" || focused.name === "work_item") {
    const { args } = flattenOptions(interaction.data.options);
    const projectInput = args.project ? String(args.project) : undefined;
    const resolved = await resolveCommandProject(user.id, projectInput);
    if ("error" in resolved) return { choices: [{ name: resolved.error.slice(0, 100), value: "" }] };
    const items = await listProjectWorkItemChoices(resolved.project.id, query || undefined);
    return { choices: items.map((i) => ({ name: i.label, value: i.id })) };
  }

  return { choices: [] };
}

async function routeCommand(interaction: {
  channel_id?: string;
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

  const user = discordUserId ? await resolveUserByDiscordId(discordUserId) : null;
  if (!user) return fail("Link your account first with `/link`.");

  if (commandName === "mytasks") {
    return handleMyTasks(user);
  }

  if (commandName === "board") {
    const resolved = await resolveCommandProject(user.id, args.project ? String(args.project) : undefined);
    if ("error" in resolved) return fail(resolved.error);
    return handleBoard(resolved.project, { column: args.column ? String(args.column) : undefined });
  }

  if (commandName === "assign") {
    const resolved = await resolveCommandProject(user.id, args.project ? String(args.project) : undefined);
    if ("error" in resolved) return fail(resolved.error);
    const personDiscordIds = [args.person1, args.person2, args.person3, args.person4, args.person5]
      .filter((v): v is string | number => v !== undefined)
      .map(String);
    return handleAssign(user, resolved.project, {
      personDiscordIds,
      workItemInput: args.work_item ? String(args.work_item) : undefined,
      work: args.work ? String(args.work) : undefined,
      priority: args.priority ? String(args.priority) : undefined,
      deadline: args.deadline ? String(args.deadline) : undefined,
    });
  }

  if (commandName === "task") {
    const resolved = await resolveCommandProject(user.id, args.project ? String(args.project) : undefined);
    if ("error" in resolved) return fail(resolved.error);
    const { project } = resolved;

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
        return handleTaskView(project, { input: String(args.id ?? "") });
      default:
        return fail("Unknown /task subcommand.");
    }
  }

  if (commandName === "progress") {
    const projectInput = args.project ? String(args.project) : "";
    if (!projectInput) return fail("Pass a `project`.");
    const project = await resolveUserProject(user.id, projectInput);
    if (!project) return fail(`No project called "${projectInput}" that you belong to.`);

    const workItemInput = args.work_item ? String(args.work_item) : "";
    if (!workItemInput) return fail("Pass a `work_item`.");

    const comment = args.comment ? String(args.comment).trim() : "";
    if (!comment) return fail("Pass a `comment`.");

    return handleProgress(user, project, { workItemInput, comment });
  }

  if (commandName === "setmeet") {
    if (!interaction.channel_id) return fail("This command only works inside a server channel.");
    const resolved = await resolveCommandProject(user.id, args.project ? String(args.project) : undefined);
    if ("error" in resolved) return fail(resolved.error);
    return handleSetMeet(user, resolved.project, {
      channelId: interaction.channel_id,
      time: String(args.time ?? ""),
      timezone: String(args.timezone ?? ""),
      title: args.title ? String(args.title) : undefined,
    });
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

