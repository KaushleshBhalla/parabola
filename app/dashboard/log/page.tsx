import Link from "next/link";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
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
  searchParams: Promise<{ q?: string; actor?: string; action?: string }>;
}) {
  await requireRole("owner");
  const { q, actor, action } = await searchParams;

  const [allActors, allActions] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, deletedAt: users.deletedAt })
      .from(users)
      .orderBy(asc(users.name)),
    db
      .selectDistinct({ action: activityLog.action })
      .from(activityLog)
      .orderBy(asc(activityLog.action)),
  ]);

  const conditions = [
    q ? ilike(activityLog.searchText, `%${q}%`) : undefined,
    actor ? eq(activityLog.actorId, actor) : undefined,
    action ? eq(activityLog.action, action) : undefined,
  ].filter((c) => c !== undefined);

  const rows = await db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      entityType: activityLog.entityType,
      searchText: activityLog.searchText,
      createdAt: activityLog.createdAt,
      actorName: users.name,
      actorDeletedAt: users.deletedAt,
      projectName: projects.name,
    })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.actorId, users.id))
    .leftJoin(projects, eq(activityLog.projectId, projects.id))
    .where(conditions.length ? and(...conditions) : sql`true`)
    .orderBy(desc(activityLog.createdAt))
    .limit(300);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Activity log</h1>
        <p className="text-sm text-muted-foreground">
          Every action taken across every project, most recent first.
        </p>
      </div>

      <form className="flex flex-wrap gap-2">
        <Input
          name="q"
          placeholder="Search…"
          defaultValue={q ?? ""}
          className="max-w-64"
        />
        <select
          name="actor"
          defaultValue={actor ?? ""}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="">All users</option>
          {allActors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.deletedAt ? " (deleted)" : ""}
            </option>
          ))}
        </select>
        <select
          name="action"
          defaultValue={action ?? ""}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="">All actions</option>
          {allActions.map((a) => (
            <option key={a.action} value={a.action}>
              {a.action}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {(q || actor || action) && (
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/dashboard/log" />}
          >
            Clear
          </Button>
        )}
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
                {r.actorDeletedAt && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    (deleted)
                  </span>
                )}
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
        <p className="text-sm text-muted-foreground">No activity matches.</p>
      )}
    </div>
  );
}
