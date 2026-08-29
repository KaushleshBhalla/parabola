import { desc, eq } from "drizzle-orm";
import { format } from "date-fns";
import { db } from "@/lib/db/client";
import { users, organizationMembers, organizations } from "@/lib/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/rbac";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActiveToggle, PlatformAdminToggle } from "./row-actions";

export default async function AdminUsersPage() {
  const actor = await requirePlatformAdmin();

  const [allUsers, memberships] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)),
    db
      .select({
        userId: organizationMembers.userId,
        orgName: organizations.name,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id)),
  ]);

  const orgsByUser = new Map<string, string[]>();
  for (const m of memberships) {
    const list = orgsByUser.get(m.userId) ?? [];
    list.push(m.orgName);
    orgsByUser.set(m.userId, list);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {allUsers.length} user{allUsers.length === 1 ? "" : "s"} across every
        organization on the platform.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Organizations</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {allUsers.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">
                {u.name}
                {u.isBot && (
                  <Badge variant="secondary" className="ml-2">
                    Bot
                  </Badge>
                )}
                {u.isPlatformAdmin && (
                  <Badge className="ml-2">Platform admin</Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{u.email}</TableCell>
              <TableCell className="text-muted-foreground">
                {(orgsByUser.get(u.id) ?? []).join(", ") || "—"}
              </TableCell>
              <TableCell>
                <Badge variant={u.isActive ? "default" : "outline"}>
                  {u.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(u.createdAt, "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                {u.id !== actor.id && !u.isBot && (
                  <div className="flex items-center gap-2">
                    <ActiveToggle userId={u.id} isActive={u.isActive} />
                    <PlatformAdminToggle
                      userId={u.id}
                      isPlatformAdmin={u.isPlatformAdmin}
                    />
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
