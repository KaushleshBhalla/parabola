import { differenceInCalendarDays, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { getDeadlineStatus } from "@/lib/deadline";

export function DeadlineBadge({
  dueDate,
  status,
}: {
  dueDate: string | null;
  status: string;
}) {
  const deadlineStatus = getDeadlineStatus(dueDate, status);
  if (deadlineStatus === "none" || !dueDate) return null;

  if (deadlineStatus === "overdue") {
    return <Badge variant="destructive">Overdue</Badge>;
  }

  if (deadlineStatus === "due_soon") {
    const days = differenceInCalendarDays(parseISO(dueDate), new Date());
    return (
      <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
        {days <= 0 ? "Due today" : `Due in ${days}d`}
      </Badge>
    );
  }

  return <Badge variant="outline">Due {dueDate}</Badge>;
}
