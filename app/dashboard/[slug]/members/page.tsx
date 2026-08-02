import { notFound } from "next/navigation";
import { eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects, users, projectMembers } from "@/lib/db/schema";
import { requireRole, hasRole } from "@/lib/auth/rbac";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MemberToggle } from "./member-toggle";

export default async function ProjectMembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireRole("admin");
  const { slug } = await params;
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);
  if (!project) notFound();

  const [allUsers, members] = await Promise.all([
    db.select().from(users).where(isNull(users.deletedAt)).orderBy(users.name),
    db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, project.id)),
  ]);
  const memberIds = new Set(members.map((m) => m.userId));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">
          Owner and admin always have access. Grant others access below.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {allUsers.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.name}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">
                  {u.role}
                </Badge>
              </TableCell>
              <TableCell>
                {hasRole(u.role, "admin") ? (
                  <span className="text-sm text-muted-foreground">
                    Full access
                  </span>
                ) : (
                  <MemberToggle
                    projectId={project.id}
                    userId={u.id}
                    slug={slug}
                    hasAccess={memberIds.has(u.id)}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
