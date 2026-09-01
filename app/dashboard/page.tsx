import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects, projectMembers } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewProjectDialog } from "./new-project-dialog";
import { UnarchiveShortcut } from "./unarchive-shortcut";

export default async function DashboardPage() {
  const user = await requireUser();

  const allProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      description: projects.description,
      isDemo: projects.isDemo,
      archivedAt: projects.archivedAt,
      ownerArchivedAt: projects.ownerArchivedAt,
      createdBy: projects.createdBy,
      isAdmin: projectMembers.isAdmin,
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, user.id))
    .orderBy(desc(projects.createdAt));

  const active = allProjects.filter((p) => !p.ownerArchivedAt);
  const archived = allProjects.filter((p) => p.ownerArchivedAt);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Projects</h1>
        <NewProjectDialog />
      </div>

      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have access to any projects yet. Ask its owner to
          add you.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {active.map((project) => (
            <Link key={project.id} href={`/dashboard/${project.slug}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle>{project.name}</CardTitle>
                    {project.isDemo && <Badge variant="secondary">Demo</Badge>}
                    {project.archivedAt && (
                      <Badge variant="outline">Needs Pro</Badge>
                    )}
                  </div>
                  {project.description && (
                    <CardDescription>{project.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Archived ({archived.length})
          </h2>
          <div className="flex flex-col gap-2">
            {archived.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-4 py-2.5 text-sm"
              >
                <Link href={`/dashboard/${project.slug}`} className="font-medium hover:underline">
                  {project.name}
                </Link>
                {(project.isAdmin || project.createdBy === user.id) && (
                  <UnarchiveShortcut projectId={project.id} slug={project.slug} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
