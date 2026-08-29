import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { format } from "date-fns";
import { db } from "@/lib/db/client";
import { organizations, organizationMembers } from "@/lib/db/schema";
import { DEMO_CREATION_LIMIT } from "@/lib/demo";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminOrganizationsPage() {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      isDemo: organizations.isDemo,
      demoCreationsUsed: organizations.demoCreationsUsed,
      createdAt: organizations.createdAt,
      memberCount: sql<number>`count(${organizationMembers.id})`.mapWith(Number),
    })
    .from(organizations)
    .leftJoin(
      organizationMembers,
      eq(organizationMembers.organizationId, organizations.id)
    )
    .groupBy(organizations.id)
    .orderBy(desc(organizations.createdAt));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {rows.length} organization{rows.length === 1 ? "" : "s"}.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Demo usage</TableHead>
            <TableHead>Members</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="font-medium">
                <Link href={`/admin/organizations/${o.id}`} className="hover:underline">
                  {o.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{o.slug}</TableCell>
              <TableCell>
                <Badge variant={o.isDemo ? "secondary" : "default"}>
                  {o.isDemo ? "Demo" : "Pro"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {o.isDemo ? `${o.demoCreationsUsed}/${DEMO_CREATION_LIMIT}` : "—"}
              </TableCell>
              <TableCell>{o.memberCount}</TableCell>
              <TableCell className="text-muted-foreground">
                {format(o.createdAt, "MMM d, yyyy")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
