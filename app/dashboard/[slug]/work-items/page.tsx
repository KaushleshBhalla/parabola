import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { workItems, workItemAssignees, users } from "@/lib/db/schema";
import { requireUser, hasRole } from "@/lib/auth/rbac";
import { getOrganizationMemberUsers } from "@/lib/organizations";
import { getProjectBySlug } from "@/lib/projects";
import { WorkItemsBoard, type BoardItem } from "./board";
import { NewWorkItemDialog } from "./new-work-item-dialog";

export default async function WorkItemsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [user, project] = await Promise.all([requireUser(), getProjectBySlug(slug)]);
  if (!project) notFound();

  const [rows, assigneeRows, activeUsers] = await Promise.all([
    db
      .select({
        id: workItems.id,
        number: workItems.number,
        title: workItems.title,
        priority: workItems.priority,
        status: workItems.status,
        dueDate: workItems.dueDate,
        position: workItems.position,
        qualityScore: workItems.qualityScore,
        createdBy: workItems.createdBy,
      })
      .from(workItems)
      .where(eq(workItems.projectId, project.id)),
    db
      .select({
        workItemId: workItemAssignees.workItemId,
        id: users.id,
        name: users.name,
        deletedAt: users.deletedAt,
      })
      .from(workItemAssignees)
      .innerJoin(users, eq(workItemAssignees.userId, users.id))
      .innerJoin(workItems, eq(workItemAssignees.workItemId, workItems.id))
      .where(eq(workItems.projectId, project.id)),
    getOrganizationMemberUsers(project.organizationId),
  ]);

  const assigneesByItem = new Map<string, { id: string; name: string }[]>();
  for (const a of assigneeRows) {
    const list = assigneesByItem.get(a.workItemId) ?? [];
    list.push({ id: a.id, name: a.name + (a.deletedAt ? " (deleted)" : "") });
    assigneesByItem.set(a.workItemId, list);
  }

  const items: BoardItem[] = rows.map((r) => ({
    id: r.id,
    number: r.number,
    title: r.title,
    priority: r.priority,
    status: r.status,
    assignees: assigneesByItem.get(r.id) ?? [],
    dueDate: r.dueDate,
    position: r.position,
    qualityScore: r.qualityScore,
    createdBy: r.createdBy,
  }));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end px-6 pt-4">
        <NewWorkItemDialog
          projectId={project.id}
          slug={slug}
          assignees={activeUsers}
        />
      </div>
      <WorkItemsBoard
        items={items}
        slug={slug}
        currentUserId={user.id}
        canEditAnyDueDate={hasRole(user.role, "admin")}
        assignees={activeUsers}
      />
    </div>
  );
}
