import { NextRequest, NextResponse } from "next/server";
import { and, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { workItems } from "@/lib/db/schema";
import { logActivity } from "@/lib/activity";

// Runs daily (see vercel.json's "crons" — Vercel's Hobby plan only allows
// day-level granularity for scheduled functions, not hourly/per-minute), and
// sweeps any work item still active past its deadline back to Backlog. This
// is a real limitation worth knowing: a deadline set with Discord's "2hr"
// shorthand can only ever be *caught* by the next daily run, not the instant
// it lapses — the due-date column itself is date-only anyway (see
// lib/discord/deadline-parse.ts), so sub-day precision was never tracked to
// begin with. Upgrading past daily requires a paid Vercel plan.
export const preferredRegion = "hnd1";

const ACTIVE_STATUSES: ("todo" | "in_progress" | "in_review" | "review")[] = [
  "todo",
  "in_progress",
  "in_review",
  "review",
];

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const overdue = await db
    .select({ id: workItems.id, projectId: workItems.projectId, number: workItems.number, title: workItems.title, status: workItems.status })
    .from(workItems)
    .where(and(inArray(workItems.status, ACTIVE_STATUSES), lt(workItems.dueDate, today)));

  if (overdue.length > 0) {
    await db
      .update(workItems)
      .set({ status: "backlog", updatedAt: new Date() })
      .where(inArray(workItems.id, overdue.map((o) => o.id)));

    for (const item of overdue) {
      await logActivity({
        actorId: null,
        projectId: item.projectId,
        action: "work_item.status_changed",
        entityType: "work_item",
        entityId: item.id,
        before: { status: item.status },
        after: { status: "backlog" },
        searchText: `"#${item.number} ${item.title}" moved to Backlog — its deadline passed`,
      });
    }
  }

  return NextResponse.json({ checkedStatuses: ACTIVE_STATUSES, movedToBacklog: overdue.length });
}
