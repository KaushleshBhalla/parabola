import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects, projectMembers } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewProjectDialog } from "./new-project-dialog";

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
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, user.id))
    .orderBy(desc(projects.createdAt));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Projects</h1>
        <NewProjectDialog />
      </div>

      {allProjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have access to any projects yet. Ask its owner to
          add you.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {allProjects.map((project) => (
            <Link key={project.id} href={`/dashboard/${project.slug}/work-items`}>
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
    </div>
  );
}
