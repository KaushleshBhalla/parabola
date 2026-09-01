import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser, canAccessProject } from "@/lib/auth/rbac";
import { canCreateOwnProject, isProjectAdmin } from "@/lib/project-access";
import { getProjectBySlug } from "@/lib/projects";
import { DEMO_CREATION_LIMIT } from "@/lib/demo";
import { ProjectNav } from "./project-nav";
import { CreateProjectPrompt } from "./create-project-prompt";

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
  if (!(await canAccessProject(user, project.id))) notFound();

  if (project.archivedAt) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <h1 className="font-heading text-lg font-semibold">
          {project.name} needs Pro access to continue
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This project is locked until Pro access is restored. Nothing was
          deleted — request access again and it&apos;ll come right back.
        </p>
        <Link
          href="/dashboard/request-access"
          className="font-medium text-primary hover:underline"
        >
          Request project access
        </Link>
      </div>
    );
  }

  const canCreateOwn = project.isDemo && (await canCreateOwnProject(user.id));

  return (
    <div className="flex h-full flex-col">
      {project.ownerArchivedAt && (
        <div className="flex items-center justify-between border-b bg-muted px-6 py-2 text-sm">
          <span>This project is archived — hidden from your project list, but nothing else changed.</span>
          <Link href={`/dashboard/${slug}`} className="font-medium text-primary hover:underline">
            Unarchive
          </Link>
        </div>
      )}
      {project.isDemo && canCreateOwn && <CreateProjectPrompt />}
      {project.isDemo && !canCreateOwn && (
        <div className="flex items-center justify-between border-b bg-primary/5 px-6 py-2 text-sm">
          <span>
            You&apos;re exploring a demo project — up to {DEMO_CREATION_LIMIT}{" "}
            things to try. To make your own, request project access.
          </span>
          <Link
            href="/dashboard/request-access"
            className="font-medium text-primary hover:underline"
          >
            Request project access
          </Link>
        </div>
      )}
      <div className="px-6 pt-6 pb-4">
        <h1 className="font-heading text-xl font-semibold">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
      </div>
      <ProjectNav slug={slug} canManage={await isProjectAdmin(user.id, project.id)} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
