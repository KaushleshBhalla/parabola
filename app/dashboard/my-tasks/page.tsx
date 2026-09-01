import Link from "next/link";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { workItems, workItemAssignees, projects, projectMembers, users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import { Badge } from "@/components/ui/badge";
import { DueDateEditor } from "@/app/dashboard/[slug]/work-items/due-date-editor";
import { AssignWorkItemDialog } from "@/app/dashboard/[slug]/work-items/assign-work-item-dialog";
import { DeadlineBadge } from "@/components/deadline-badge";
import { getDeadlineStatus, deadlineUrgencyRank } from "@/lib/deadline";
import { formatStatusLabel } from "@/lib/work-items";

export default async function MyTasksPage() {
  const user = await requireUser();

  const myItemIds = (
    await db
      .select({ workItemId: workItemAssignees.workItemId })
      .from(workItemAssignees)
      .where(eq(workItemAssignees.userId, user.id))
  ).map((r) => r.workItemId);

  const [items, allAssignees, projectMemberRows] =
    myItemIds.length === 0
      ? [[], [], []]
      : await Promise.all([
          db
            .select({
              id: workItems.id,
              number: workItems.number,
              title: workItems.title,
              status: workItems.status,
              priority: workItems.priority,
              dueDate: workItems.dueDate,
              projectId: workItems.projectId,
              projectName: projects.name,
              projectSlug: projects.slug,
            })
            .from(workItems)
            .innerJoin(projects, eq(workItems.projectId, projects.id))
            .where(
              and(
                inArray(workItems.id, myItemIds),
                isNull(projects.archivedAt),
                isNull(projects.ownerArchivedAt)
              )
            ),
          db
            .select({
              workItemId: workItemAssignees.workItemId,
              id: users.id,
              name: users.name,
            })
            .from(workItemAssignees)
            .innerJoin(users, eq(workItemAssignees.userId, users.id))
            .where(inArray(workItemAssignees.workItemId, myItemIds)),
          db
            .select({ projectId: projectMembers.projectId, id: users.id, name: users.name })
            .from(projectMembers)
            .innerJoin(users, eq(projectMembers.userId, users.id))
            .where(eq(users.isActive, true)),
        ]);

  const assigneesByItem = new Map<string, { id: string; name: string }[]>();
  for (const a of allAssignees) {
    const list = assigneesByItem.get(a.workItemId) ?? [];
    list.push({ id: a.id, name: a.name });
    assigneesByItem.set(a.workItemId, list);
  }

  const membersByProject = new Map<string, { id: string; name: string }[]>();
  for (const m of projectMemberRows) {
    const list = membersByProject.get(m.projectId) ?? [];
    list.push({ id: m.id, name: m.name });
    membersByProject.set(m.projectId, list);
  }

  const sorted = [...items].sort((a, b) => {
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
                    {formatStatusLabel(item.status)}
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
                  currentAssignees={assigneesByItem.get(item.id) ?? []}
                  currentDueDate={item.dueDate}
                  assignees={membersByProject.get(item.projectId) ?? []}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
