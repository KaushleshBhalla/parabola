import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import { db } from "@/lib/db/client";
import {
  organizations,
  organizationMembers,
  memberRoles,
  roles,
  users,
  projects,
} from "@/lib/db/schema";
import { DEMO_CREATION_LIMIT } from "@/lib/demo";
import { Badge } from "@/components/ui/badge";
import { ProToggleButton } from "../pro-toggle-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminOrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!org) notFound();

  const [memberRows, roleGrants, projectRows] = await Promise.all([
    db
      .select({
        memberId: organizationMembers.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        isBot: users.isBot,
        joinedAt: organizationMembers.joinedAt,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, id)),
    db
      .select({
        memberId: memberRoles.organizationMemberId,
        roleName: roles.name,
      })
      .from(memberRoles)
      .innerJoin(roles, eq(memberRoles.roleId, roles.id))
      .where(eq(roles.organizationId, id)),
    db.select().from(projects).where(eq(projects.organizationId, id)),
  ]);

  const rolesByMember = new Map<string, string[]>();
  for (const g of roleGrants) {
    const list = rolesByMember.get(g.memberId) ?? [];
    list.push(g.roleName);
    rolesByMember.set(g.memberId, list);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-lg font-semibold">{org.name}</h2>
            <Badge variant={org.isDemo ? "secondary" : "default"}>
              {org.isDemo ? "Demo" : "Pro"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {org.slug} · created {format(org.createdAt, "MMM d, yyyy")}
            {org.isDemo && ` · ${org.demoCreationsUsed}/${DEMO_CREATION_LIMIT} demo actions used`}
          </p>
        </div>
        <ProToggleButton organizationId={org.id} isDemo={org.isDemo} />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          Members ({memberRows.length})
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {memberRows.map((m) => (
              <TableRow key={m.memberId}>
                <TableCell className="font-medium">
                  {m.name}
                  {m.isBot && (
                    <Badge variant="secondary" className="ml-2">
                      Bot
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{m.email}</TableCell>
                <TableCell className="text-muted-foreground">
                  {(rolesByMember.get(m.memberId) ?? []).join(", ") || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(m.joinedAt, "MMM d, yyyy")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          Projects ({projectRows.length})
        </h3>
        {projectRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectRows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.slug}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(p.createdAt, "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Link href="/admin/organizations" className="text-sm text-muted-foreground hover:underline">
        ← Back to organizations
      </Link>
    </div>
  );
}
