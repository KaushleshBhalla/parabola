import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
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
import { RoleSelect, ActiveToggle } from "./row-actions";

export default async function TeamPage() {
  const actor = await requireRole("admin");
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
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
            <TableHead>Status</TableHead>
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
                    role={u.role}
                    canGrantAdmin={actor.role === "owner"}
                  />
                )}
              </TableCell>
              <TableCell>
                <Badge variant={u.isActive ? "default" : "outline"}>
                  {u.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                {u.role !== "owner" && u.id !== actor.id && (
                  <ActiveToggle userId={u.id} isActive={u.isActive} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
