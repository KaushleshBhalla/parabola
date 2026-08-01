import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects } from "@/lib/db/schema";
import { requireUser, hasRole } from "@/lib/auth/rbac";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewProjectDialog } from "./new-project-dialog";

export default async function DashboardPage() {
  const user = await requireUser();
  const canCreate = hasRole(user.role, "admin");
  const allProjects = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.createdAt));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Projects</h1>
        {canCreate && <NewProjectDialog />}
      </div>

      {allProjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No projects yet.{canCreate ? " Create one to get started." : ""}
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
