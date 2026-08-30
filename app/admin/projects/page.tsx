import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { format } from "date-fns";
import { db } from "@/lib/db/client";
import { projects, projectMembers } from "@/lib/db/schema";
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

export default async function AdminProjectsPage() {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      isDemo: projects.isDemo,
      demoCreationsUsed: projects.demoCreationsUsed,
      createdAt: projects.createdAt,
      memberCount: sql<number>`count(${projectMembers.userId})`.mapWith(Number),
    })
    .from(projects)
    .leftJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .groupBy(projects.id)
    .orderBy(desc(projects.createdAt));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {rows.length} project{rows.length === 1 ? "" : "s"}.
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
          {rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">
                <Link href={`/admin/projects/${p.id}`} className="hover:underline">
                  {p.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{p.slug}</TableCell>
              <TableCell>
                <Badge variant={p.isDemo ? "secondary" : "default"}>
                  {p.isDemo ? "Demo" : "Real"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {p.isDemo ? `${p.demoCreationsUsed}/${DEMO_CREATION_LIMIT}` : "—"}
              </TableCell>
              <TableCell>{p.memberCount}</TableCell>
              <TableCell className="text-muted-foreground">
                {format(p.createdAt, "MMM d, yyyy")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
