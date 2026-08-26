import { differenceInCalendarDays, parseISO } from "date-fns";

export const DUE_SOON_DAYS = 2;

export type DeadlineStatus = "overdue" | "due_soon" | "on_track" | "none";

export function getDeadlineStatus(
  dueDate: string | null,
  status: string
): DeadlineStatus {
  if (!dueDate) return "none";
  if (status === "done" || status === "cancelled") return "none";

  const days = differenceInCalendarDays(parseISO(dueDate), new Date());
  if (days < 0) return "overdue";
  if (days <= DUE_SOON_DAYS) return "due_soon";
  return "on_track";
}

const URGENCY_RANK: Record<DeadlineStatus, number> = {
  overdue: 0,
  due_soon: 1,
  on_track: 2,
  none: 3,
};

export function deadlineUrgencyRank(status: DeadlineStatus) {
  return URGENCY_RANK[status];
}
