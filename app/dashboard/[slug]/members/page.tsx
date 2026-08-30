import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, projectMembers } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import { isProjectAdmin } from "@/lib/project-access";
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

  const canManage = await isProjectAdmin(user.id, project.id);
  if (!canManage) redirect("/dashboard");

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      isAdmin: projectMembers.isAdmin,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, project.id))
    .orderBy(users.name);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">
          Add anyone by email — they need an existing Parabola account.
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
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.name}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">
                  {m.isAdmin ? "Admin" : "Member"}
                </Badge>
              </TableCell>
              <TableCell>
                {m.id === project.createdBy ? (
                  <span className="text-sm text-muted-foreground">Owner</span>
                ) : (
                  <MemberToggle projectId={project.id} userId={m.id} slug={slug} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
