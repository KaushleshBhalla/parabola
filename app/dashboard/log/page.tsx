import { desc, eq, ilike } from "drizzle-orm";
import { format } from "date-fns";
import { db } from "@/lib/db/client";
import { activityLog, users, projects } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRole("owner");
  const { q } = await searchParams;

  const rows = await db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      entityType: activityLog.entityType,
      searchText: activityLog.searchText,
      createdAt: activityLog.createdAt,
      actorName: users.name,
      projectName: projects.name,
    })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.actorId, users.id))
    .leftJoin(projects, eq(activityLog.projectId, projects.id))
    .where(q ? ilike(activityLog.searchText, `%${q}%`) : undefined)
    .orderBy(desc(activityLog.createdAt))
    .limit(300);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Activity log</h1>
        <p className="text-sm text-muted-foreground">
          Every action taken across the organization, most recent first.
        </p>
      </div>

      <form className="flex gap-2">
        <Input name="q" placeholder="Search…" defaultValue={q ?? ""} />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {format(r.createdAt, "MMM d, yyyy h:mm a")}
              </TableCell>
              <TableCell className="font-medium">
                {r.actorName ?? "System"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {r.projectName ?? "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="shrink-0">
                    {r.action}
                  </Badge>
                  <span>{r.searchText}</span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      )}
    </div>
  );
}
