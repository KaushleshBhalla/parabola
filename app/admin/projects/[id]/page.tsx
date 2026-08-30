import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { format } from "date-fns";
import { db } from "@/lib/db/client";
import { projects, projectMembers, users, workItems } from "@/lib/db/schema";
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

export default async function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project) notFound();

  const [memberRows, [workItemCount]] = await Promise.all([
    db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        isBot: users.isBot,
        isAdmin: projectMembers.isAdmin,
        addedAt: projectMembers.addedAt,
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, id)),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(workItems)
      .where(eq(workItems.projectId, id)),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-lg font-semibold">{project.name}</h2>
            <Badge variant={project.isDemo ? "secondary" : "default"}>
              {project.isDemo ? "Demo" : "Real"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {project.slug} · created {format(project.createdAt, "MMM d, yyyy")} ·{" "}
            {workItemCount?.count ?? 0} work items
            {project.isDemo && ` · ${project.demoCreationsUsed}/${DEMO_CREATION_LIMIT} demo actions used`}
          </p>
        </div>
        <ProToggleButton projectId={project.id} isDemo={project.isDemo} />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          Members ({memberRows.length})
        </h3>
        {memberRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberRows.map((m) => (
                <TableRow key={m.userId}>
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
                    {m.isAdmin ? "Admin" : "Member"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(m.addedAt, "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Link href="/admin/projects" className="text-sm text-muted-foreground hover:underline">
        ← Back to projects
      </Link>
    </div>
  );
}
