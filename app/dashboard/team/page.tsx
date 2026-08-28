import { and, desc, eq, isNull } from "drizzle-orm";
import { formatDistanceToNow } from "date-fns";
import { db } from "@/lib/db/client";
import { users, projects, projectMembers } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewUserDialog } from "./new-user-dialog";
import { RoleSelect, ActiveToggle, DeleteUserButton } from "./row-actions";
import { ProjectAccessSelect } from "./project-access-select";

export default async function TeamPage() {
  const actor = await requireRole("admin");

  const [allUsers, allProjects, allMemberships] = await Promise.all([
    db
      .select()
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.isBot, false)))
      .orderBy(desc(users.createdAt)),
    db.select({ id: projects.id, name: projects.name }).from(projects),
    db
      .select({
        userId: projectMembers.userId,
        projectId: projectMembers.projectId,
      })
      .from(projectMembers),
  ]);

  const accessByUser = new Map<string, string[]>();
  for (const m of allMemberships) {
    const list = accessByUser.get(m.userId) ?? [];
    list.push(m.projectId);
    accessByUser.set(m.userId, list);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Team</h1>
        <NewUserDialog canGrantAdmin={actor.role === "owner"} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Login ID</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Project access</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last seen</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {allUsers.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.name}</TableCell>
              <TableCell className="text-muted-foreground">{u.email}</TableCell>
              <TableCell>
                {u.role === "owner" ? (
                  <Badge variant="secondary">Owner</Badge>
                ) : (
                  <RoleSelect
                    userId={u.id}
                    role={u.role as "admin" | "member"}
                    canGrantAdmin={actor.role === "owner"}
                  />
                )}
              </TableCell>
              <TableCell>
                {u.role === "owner" || u.role === "admin" ? (
                  <span className="text-sm text-muted-foreground">
                    Full access
                  </span>
                ) : (
                  <ProjectAccessSelect
                    userId={u.id}
                    allProjects={allProjects}
                    initialProjectIds={accessByUser.get(u.id) ?? []}
                  />
                )}
              </TableCell>
              <TableCell>
                <Badge variant={u.isActive ? "default" : "outline"}>
                  {u.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {u.lastSeenAt
                  ? formatDistanceToNow(u.lastSeenAt, { addSuffix: true })
                  : "Never"}
              </TableCell>
              <TableCell>
                {u.role !== "owner" && u.id !== actor.id && (
                  <div className="flex items-center gap-2">
                    <ActiveToggle userId={u.id} isActive={u.isActive} />
                    <DeleteUserButton userId={u.id} name={u.name} />
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
