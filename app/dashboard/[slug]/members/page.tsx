import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, projectMembers, organizationMembers } from "@/lib/db/schema";
import { requireUser, hasRole, hasPermission } from "@/lib/auth/rbac";
import { getProjectBySlug } from "@/lib/projects";
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
import { AddMemberByEmail } from "./add-member-by-email";

export default async function ProjectMembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [user, project] = await Promise.all([requireUser(), getProjectBySlug(slug)]);
  if (!project) notFound();

  const canManage = project.organizationId
    ? await hasPermission(user.id, project.organizationId, "role.manage")
    : hasRole(user.role, "admin");
  if (!canManage) redirect("/dashboard");

  const orgScopedUsers = project.organizationId
    ? db
        .select({
          id: users.id,
          name: users.name,
          role: users.role,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(organizationMembers.userId, users.id))
        .where(
          and(
            eq(organizationMembers.organizationId, project.organizationId),
            isNull(users.deletedAt),
            eq(users.isBot, false)
          )
        )
        .orderBy(users.name)
    : db
        .select({ id: users.id, name: users.name, role: users.role })
        .from(users)
        .where(and(isNull(users.deletedAt), eq(users.isBot, false)))
        .orderBy(users.name);

  const [allUsers, members] = await Promise.all([
    orgScopedUsers,
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

      <AddMemberByEmail projectId={project.id} slug={slug} />

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
