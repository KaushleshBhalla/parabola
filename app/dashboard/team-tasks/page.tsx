import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { workItems, workItemAssignees, projects, users, projectMembers } from "@/lib/db/schema";
import { requireUser, hasRole } from "@/lib/auth/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AssignWorkItemDialog } from "@/app/dashboard/[slug]/work-items/assign-work-item-dialog";
import { DeadlineBadge } from "@/components/deadline-badge";
import { getDeadlineStatus, deadlineUrgencyRank } from "@/lib/deadline";
import { formatStatusLabel } from "@/lib/work-items";

type Row = {
  id: string;
  number: number;
  title: string;
  status: "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled";
  priority: "none" | "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  projectId: string;
  projectName: string;
  projectSlug: string;
  assignees: { id: string; name: string }[];
};

export default async function TeamTasksPage() {
  const user = await requireUser();
  const isPrivileged = hasRole(user.role, "admin");

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

  const assignmentRows = hasNoMemberships
    ? []
    : await db
        .select({
          id: workItems.id,
          number: workItems.number,
          title: workItems.title,
          status: workItems.status,
          priority: workItems.priority,
          dueDate: workItems.dueDate,
          projectId: projects.id,
          projectName: projects.name,
          projectSlug: projects.slug,
          assigneeId: users.id,
          assigneeName: users.name,
        })
        .from(workItemAssignees)
        .innerJoin(workItems, eq(workItemAssignees.workItemId, workItems.id))
        .innerJoin(projects, eq(workItems.projectId, projects.id))
        .innerJoin(users, eq(workItemAssignees.userId, users.id))
        .where(
          visibleProjectIds ? inArray(workItems.projectId, visibleProjectIds) : undefined
        );

  const itemsById = new Map<string, Row>();
  for (const r of assignmentRows) {
    const existing = itemsById.get(r.id);
    if (existing) {
      existing.assignees.push({ id: r.assigneeId, name: r.assigneeName });
    } else {
      itemsById.set(r.id, {
        id: r.id,
        number: r.number,
        title: r.title,
        status: r.status,
        priority: r.priority,
        dueDate: r.dueDate,
        projectId: r.projectId,
        projectName: r.projectName,
        projectSlug: r.projectSlug,
        assignees: [{ id: r.assigneeId, name: r.assigneeName }],
      });
    }
  }
  const visibleRows = [...itemsById.values()];

  // Each item can belong to a different, independent project now, so the
  // assign dialog needs that project's own member list — not one shared pool.
  const distinctProjectIds = [...new Set(visibleRows.map((r) => r.projectId))];
  const memberRows = distinctProjectIds.length
    ? await db
        .select({ projectId: projectMembers.projectId, id: users.id, name: users.name })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .where(
          inArray(projectMembers.projectId, distinctProjectIds)
        )
    : [];
  const membersByProject = new Map<string, { id: string; name: string }[]>();
  for (const m of memberRows) {
    const list = membersByProject.get(m.projectId) ?? [];
    list.push({ id: m.id, name: m.name });
    membersByProject.set(m.projectId, list);
  }

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
    { name: string; slug: string; items: Row[] }
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
                            {formatStatusLabel(item.status)}
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
                        currentAssignees={item.assignees}
                        currentDueDate={item.dueDate}
                        assignees={membersByProject.get(item.projectId) ?? []}
                      >
                        <span className="text-xs text-muted-foreground">
                          {item.assignees.map((a) => a.name).join(", ")}
                        </span>
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
