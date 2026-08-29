export type WorkItemStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "cancelled";

// "in_review" displays as "Testing Pending" everywhere — display-only, the
// DB enum value stays in_review so this needs no migration.
export const STATUS_LABELS: Record<WorkItemStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "Testing Pending",
  done: "Done",
  cancelled: "Cancelled",
};

export function formatStatusLabel(status: string): string {
  return STATUS_LABELS[status as WorkItemStatus] ?? status.replace("_", " ");
}
