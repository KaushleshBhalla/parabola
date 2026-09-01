import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projectMeetings, projects, projectMembers, users } from "@/lib/db/schema";
import { sendChannelMessage } from "@/lib/discord/api";

// Vercel's own cron can't run more often than once a day on the Hobby plan
// (see app/api/cron/expire-deadlines/route.ts's comment for the same
// limitation), which is useless for "5 minutes before" — so this endpoint is
// instead driven by a GitHub Actions workflow on a 5-minute schedule
// (.github/workflows/meeting-reminders.yml). GitHub's scheduler isn't
// second-precise either (it can slip by several minutes under load), so
// treat "5 minutes before" as "roughly 5 minutes before", not a guarantee —
// the due-window below is intentionally 10 minutes wide so a slow tick still
// catches everything before its meeting starts, without ever double-pinging
// (reminderSentAt guards that regardless of how many times this runs).
export const preferredRegion = "hnd1";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 5 * 60_000);

  const due = await db
    .select({
      id: projectMeetings.id,
      projectId: projectMeetings.projectId,
      projectName: projects.name,
      title: projectMeetings.title,
      scheduledAt: projectMeetings.scheduledAt,
      discordChannelId: projectMeetings.discordChannelId,
    })
    .from(projectMeetings)
    .innerJoin(projects, eq(projectMeetings.projectId, projects.id))
    .where(
      and(
        isNull(projectMeetings.reminderSentAt),
        gte(projectMeetings.scheduledAt, now),
        lte(projectMeetings.scheduledAt, windowEnd)
      )
    );

  let pinged = 0;
  for (const meeting of due) {
    const members = await db
      .select({ discordUserId: users.discordUserId })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(and(eq(projectMembers.projectId, meeting.projectId), eq(users.isActive, true)));

    const mentions = members.filter((m) => m.discordUserId).map((m) => `<@${m.discordUserId}>`);
    const unlinkedCount = members.length - mentions.length;
    const unixSeconds = Math.floor(meeting.scheduledAt.getTime() / 1000);

    const content = [
      mentions.length > 0 ? mentions.join(" ") : null,
      `📅 **${meeting.projectName}** meeting${meeting.title ? ` — ${meeting.title}` : ""} starts <t:${unixSeconds}:R> (<t:${unixSeconds}:t>)!`,
      unlinkedCount > 0
        ? `_${unlinkedCount} project member${unlinkedCount === 1 ? "" : "s"} haven't run \`/link\` yet, so they weren't mentioned._`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await sendChannelMessage(meeting.discordChannelId, { content });
    } catch (err) {
      console.error(`Failed to send meeting reminder for ${meeting.id}:`, err);
      continue; // leave reminderSentAt unset so the next sweep retries
    }

    await db.update(projectMeetings).set({ reminderSentAt: new Date() }).where(eq(projectMeetings.id, meeting.id));
    pinged++;
  }

  return NextResponse.json({ due: due.length, pinged });
}
