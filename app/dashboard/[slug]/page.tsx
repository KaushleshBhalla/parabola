import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projectMembers, workItems } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import { isProjectAdmin, getOrCreateProjectInviteCode } from "@/lib/project-access";
import { getProjectBySlug } from "@/lib/projects";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProjectSettings } from "./project-settings";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [user, project] = await Promise.all([requireUser(), getProjectBySlug(slug)]);
  if (!project) notFound();

  const canManage = await isProjectAdmin(user.id, project.id);

  const [[memberCount], [workItemCount], inviteCode] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, project.id)),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(workItems)
      .where(eq(workItems.projectId, project.id)),
    canManage ? getOrCreateProjectInviteCode(project.id) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Members</CardDescription>
            <CardTitle>{memberCount?.count ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Work items</CardDescription>
            <CardTitle>{workItemCount?.count ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Created</CardDescription>
            <CardTitle className="text-base">
              {project.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {canManage && inviteCode && (
        <ProjectSettings
          projectId={project.id}
          slug={slug}
          name={project.name}
          description={project.description}
          inviteCode={inviteCode}
          autoApprove={project.autoApproveJoinRequests}
          isArchived={!!project.ownerArchivedAt}
        />
      )}
    </div>
  );
}
