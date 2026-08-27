import Link from "next/link";
import { desc, eq, or, isNull, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects, projectMembers } from "@/lib/db/schema";
import { requireUser, hasRole } from "@/lib/auth/rbac";
import { getPrimaryOrganization } from "@/lib/organizations";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewProjectDialog } from "./new-project-dialog";

export default async function DashboardPage() {
  const user = await requireUser();
  const org = await getPrimaryOrganization(user.id);
  const canCreate = hasRole(user.role, "admin");

  // Org-scoped projects, plus any legacy pre-org projects the old
  // role/membership rules already grant access to (until the Phase 5 cutover).
  const orgFilter = org
    ? or(eq(projects.organizationId, org.id), isNull(projects.organizationId))
    : isNull(projects.organizationId);

  const allProjects = canCreate
    ? await db
        .select()
        .from(projects)
        .where(orgFilter)
        .orderBy(desc(projects.createdAt))
    : await db
        .select({
          id: projects.id,
          name: projects.name,
          slug: projects.slug,
          description: projects.description,
          color: projects.color,
          createdBy: projects.createdBy,
          archivedAt: projects.archivedAt,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
        })
        .from(projects)
        .innerJoin(
          projectMembers,
          eq(projectMembers.projectId, projects.id)
        )
        .where(and(eq(projectMembers.userId, user.id), orgFilter))
        .orderBy(desc(projects.createdAt));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Projects</h1>
        {canCreate && <NewProjectDialog />}
      </div>

      {allProjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canCreate
            ? "No projects yet. Create one to get started."
            : "You don't have access to any projects yet. Ask an admin to add you."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {allProjects.map((project) => (
            <Link key={project.id} href={`/dashboard/${project.slug}/work-items`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  {project.description && (
                    <CardDescription>{project.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
