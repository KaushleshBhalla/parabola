import { notFound } from "next/navigation";
import { requireUser, canAccessProject, hasRole } from "@/lib/auth/rbac";
import { getPrimaryOrganization } from "@/lib/organizations";
import { getProjectBySlug } from "@/lib/projects";
import { ProjectNav } from "./project-nav";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [user, project] = await Promise.all([
    requireUser(),
    getProjectBySlug(slug),
  ]);

  if (!project) notFound();
  const org = await getPrimaryOrganization(user.id);
  if (project.organizationId && project.organizationId !== org?.id) notFound();
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
