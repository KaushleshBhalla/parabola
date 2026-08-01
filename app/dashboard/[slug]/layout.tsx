import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects } from "@/lib/db/schema";
import { requireUser, canAccessProject, hasRole } from "@/lib/auth/rbac";
import { ProjectNav } from "./project-nav";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);

  if (!project) notFound();
  if (!(await canAccessProject(user, project.id))) notFound();

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="font-heading text-xl font-semibold">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
      </div>
      <ProjectNav slug={slug} canManage={hasRole(user.role, "admin")} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
