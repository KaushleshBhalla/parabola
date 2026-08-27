import Link from "next/link";
import { eq, isNotNull, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { workItems, projects, users, projectMembers } from "@/lib/db/schema";
import { requireUser, hasRole } from "@/lib/auth/rbac";
import { getPrimaryOrganization, getOrganizationMemberUsers } from "@/lib/organizations";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AssignWorkItemDialog } from "@/app/dashboard/[slug]/work-items/assign-work-item-dialog";
import { DeadlineBadge } from "@/components/deadline-badge";
import { getDeadlineStatus, deadlineUrgencyRank } from "@/lib/deadline";

export default async function TeamTasksPage() {
  const user = await requireUser();
  const isPrivileged = hasRole(user.role, "admin");
  const org = await getPrimaryOrganization(user.id);

  let visibleProjectIds: string[] | null = null;
  if (!isPrivileged) {
    const memberships = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, user.id));
    visibleProjectIds = memberships.map((m) => m.projectId);
  }

  const hasNoMemberships =
    visibleProjectIds !== null && visibleProjectIds.length === 0;

  const activeUsersPromise = getOrganizationMemberUsers(org?.id ?? null);

  const rows = hasNoMemberships
    ? []
    : await db
        .select({
          id: workItems.id,
          number: workItems.number,
          title: workItems.title,
          status: workItems.status,
          priority: workItems.priority,
          dueDate: workItems.dueDate,
          assigneeId: workItems.assigneeId,
          assigneeName: users.name,
          projectId: projects.id,
          projectName: projects.name,
          projectSlug: projects.slug,
        })
        .from(workItems)
        .innerJoin(projects, eq(workItems.projectId, projects.id))
        .innerJoin(users, eq(workItems.assigneeId, users.id))
        .where(
          visibleProjectIds
            ? inArray(workItems.projectId, visibleProjectIds)
            : isNotNull(workItems.assigneeId)
        );

  const activeUsers = await activeUsersPromise;
  const visibleRows = rows;

  const total = visibleRows.length;
  const overdue = visibleRows.filter(
    (r) => getDeadlineStatus(r.dueDate, r.status) === "overdue"
  ).length;
  const dueSoon = visibleRows.filter(
    (r) => getDeadlineStatus(r.dueDate, r.status) === "due_soon"
  ).length;
  const done = visibleRows.filter((r) => r.status === "done").length;

  const byProject = new Map<
    string,
    { name: string; slug: string; items: typeof visibleRows }
  >();
  for (const row of visibleRows) {
    const group = byProject.get(row.projectId) ?? {
      name: row.projectName,
      slug: row.projectSlug,
      items: [],
    };
    group.items.push(row);
    byProject.set(row.projectId, group);
  }

  for (const group of byProject.values()) {
    group.items.sort((a, b) => {
      const rankA = deadlineUrgencyRank(getDeadlineStatus(a.dueDate, a.status));
      const rankB = deadlineUrgencyRank(getDeadlineStatus(b.dueDate, b.status));
      if (rankA !== rankB) return rankA - rankB;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return 0;
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Team tasks</h1>
        <p className="text-sm text-muted-foreground">
          {isPrivileged
            ? "Every assigned work item across all projects."
            : "Assigned work items across the projects you're a member of."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Assigned" value={total} />
        <StatCard label="Overdue" value={overdue} tone="destructive" />
        <StatCard label="Due soon" value={dueSoon} tone="warning" />
        <StatCard label="Done" value={done} />
      </div>

      {byProject.size === 0 ? (
        <p className="text-sm text-muted-foreground">
          No assigned work items to show.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {[...byProject.values()].map((group) => {
            const doneCount = group.items.filter(
              (i) => i.status === "done"
            ).length;
            const pct =
              group.items.length === 0
                ? 0
                : Math.round((doneCount / group.items.length) * 100);
            return (
              <div key={group.slug} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/dashboard/${group.slug}/work-items`}
                    className="text-sm font-medium hover:underline"
                  >
                    {group.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {doneCount}/{group.items.length} done
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 rounded-lg bg-card p-3 text-sm ring-1 ring-foreground/10"
                    >
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/dashboard/${group.slug}/work-items`}
                          className="font-medium hover:underline"
                        >
                          #{item.number} {item.title}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="capitalize">
                            {item.status.replace("_", " ")}
                          </Badge>
                          {item.priority !== "none" && (
                            <Badge variant="secondary" className="capitalize">
                              {item.priority}
                            </Badge>
                          )}
                          <DeadlineBadge
                            dueDate={item.dueDate}
                            status={item.status}
                          />
                        </div>
                      </div>
                      <AssignWorkItemDialog
                        workItemId={item.id}
                        slug={group.slug}
                        currentAssigneeId={item.assigneeId}
                        currentAssigneeName={item.assigneeName}
                        currentDueDate={item.dueDate}
                        assignees={activeUsers}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            {item.assigneeName}
                          </span>
                          <Avatar size="sm">
                            <AvatarFallback>
                              {item.assigneeName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </AssignWorkItemDialog>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "destructive" | "warning";
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={
            tone === "destructive"
              ? "text-destructive"
              : tone === "warning"
                ? "text-amber-600 dark:text-amber-400"
                : undefined
          }
        >
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
