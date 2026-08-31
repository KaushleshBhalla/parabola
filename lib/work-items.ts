export type WorkItemStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "review"
  | "done"
  | "cancelled";

// "in_review" displays as "Testing Pending" everywhere — display-only, the
// DB enum value stays in_review so this needs no migration. "review" is a
// separate, newer status ("In Review") that sits between Testing Pending
// and Done — an easy pair to confuse by name, so take care when touching
// either.
export const STATUS_LABELS: Record<WorkItemStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "Testing Pending",
  review: "In Review",
  done: "Done",
  cancelled: "Cancelled",
};

export function formatStatusLabel(status: string): string {
  return STATUS_LABELS[status as WorkItemStatus] ?? status.replace("_", " ");
}
