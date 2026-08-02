import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects, workItems, users } from "@/lib/db/schema";
import { requireUser, hasRole } from "@/lib/auth/rbac";
import { WorkItemsBoard, type BoardItem } from "./board";
import { NewWorkItemDialog } from "./new-work-item-dialog";

export default async function WorkItemsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);
  if (!project) notFound();

  const [rows, activeUsers] = await Promise.all([
    db
      .select({
        id: workItems.id,
        number: workItems.number,
        title: workItems.title,
        priority: workItems.priority,
        status: workItems.status,
        assigneeId: workItems.assigneeId,
        assigneeName: users.name,
        assigneeDeletedAt: users.deletedAt,
        dueDate: workItems.dueDate,
      })
      .from(workItems)
      .leftJoin(users, eq(workItems.assigneeId, users.id))
      .where(eq(workItems.projectId, project.id)),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.isActive, true)),
  ]);

  const items: BoardItem[] = rows.map((r) => ({
    id: r.id,
    number: r.number,
    title: r.title,
    priority: r.priority,
    status: r.status,
    assigneeId: r.assigneeId,
    assigneeName: r.assigneeName
      ? r.assigneeName + (r.assigneeDeletedAt ? " (deleted)" : "")
      : r.assigneeName,
    dueDate: r.dueDate,
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
      />
    </div>
  );
}
