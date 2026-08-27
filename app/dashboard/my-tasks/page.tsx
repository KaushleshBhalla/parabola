import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { workItems, projects } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import { getPrimaryOrganization, getOrganizationMemberUsers } from "@/lib/organizations";
import { Badge } from "@/components/ui/badge";
import { DueDateEditor } from "@/app/dashboard/[slug]/work-items/due-date-editor";
import { AssignWorkItemDialog } from "@/app/dashboard/[slug]/work-items/assign-work-item-dialog";
import { DeadlineBadge } from "@/components/deadline-badge";
import { getDeadlineStatus, deadlineUrgencyRank } from "@/lib/deadline";

export default async function MyTasksPage() {
  const user = await requireUser();
  const org = await getPrimaryOrganization(user.id);

  const [rows, activeUsers] = await Promise.all([
    db
      .select({
        id: workItems.id,
        number: workItems.number,
        title: workItems.title,
        status: workItems.status,
        priority: workItems.priority,
        dueDate: workItems.dueDate,
        projectName: projects.name,
        projectSlug: projects.slug,
      })
      .from(workItems)
      .innerJoin(projects, eq(workItems.projectId, projects.id))
      .where(eq(workItems.assigneeId, user.id)),
    getOrganizationMemberUsers(org?.id ?? null),
  ]);

  const sorted = [...rows].sort((a, b) => {
    const rankA = deadlineUrgencyRank(getDeadlineStatus(a.dueDate, a.status));
    const rankB = deadlineUrgencyRank(getDeadlineStatus(b.dueDate, b.status));
    if (rankA !== rankB) return rankA - rankB;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return 0;
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">My tasks</h1>
        <p className="text-sm text-muted-foreground">
          Work items assigned to you across every project you can access.
        </p>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing assigned to you right now.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 rounded-lg bg-card p-3 text-sm ring-1 ring-foreground/10"
            >
              <div className="flex flex-col gap-1">
                <Link
                  href={`/dashboard/${item.projectSlug}/work-items`}
                  className="font-medium hover:underline"
                >
                  #{item.number} {item.title}
                </Link>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{item.projectName}</span>
                  <Badge variant="outline" className="capitalize">
                    {item.status.replace("_", " ")}
                  </Badge>
                  {item.priority !== "none" && (
                    <Badge variant="secondary" className="capitalize">
                      {item.priority}
                    </Badge>
                  )}
                  <DeadlineBadge dueDate={item.dueDate} status={item.status} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DueDateEditor
                  workItemId={item.id}
                  dueDate={item.dueDate}
                  slug={item.projectSlug}
                  canEdit
                />
                <AssignWorkItemDialog
                  workItemId={item.id}
                  slug={item.projectSlug}
                  currentAssigneeId={user.id}
                  currentAssigneeName={user.name}
                  currentDueDate={item.dueDate}
                  assignees={activeUsers}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
