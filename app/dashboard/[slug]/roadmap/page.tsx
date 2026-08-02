import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Rocket } from "lucide-react";
import { db } from "@/lib/db/client";
import { projects, roadmapItems } from "@/lib/db/schema";
import { NewRoadmapItemDialog } from "./new-roadmap-item-dialog";
import { RoadmapItemCard } from "./roadmap-item-card";

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);
  if (!project) notFound();

  const items = await db
    .select()
    .from(roadmapItems)
    .where(eq(roadmapItems.projectId, project.id));

  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.milestone ?? "Unscheduled";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const milestones = [...groups.entries()]
    .map(([milestone, milestoneItems]) => {
      const dated = milestoneItems
        .filter((i) => i.targetDate)
        .sort((a, b) => a.targetDate!.localeCompare(b.targetDate!));
      const done = milestoneItems.filter((i) => i.status === "done").length;
      return {
        milestone,
        items: [...milestoneItems].sort((a, b) => {
          if (!a.targetDate && b.targetDate) return 1;
          if (a.targetDate && !b.targetDate) return -1;
          if (a.targetDate && b.targetDate) {
            return a.targetDate.localeCompare(b.targetDate);
          }
          return 0;
        }),
        done,
        total: milestoneItems.length,
        earliestDate: dated[0]?.targetDate ?? null,
      };
    })
    .sort((a, b) => {
      if (a.milestone === "Unscheduled") return 1;
      if (b.milestone === "Unscheduled") return -1;
      if (!a.earliestDate && b.earliestDate) return 1;
      if (a.earliestDate && !b.earliestDate) return -1;
      if (a.earliestDate && b.earliestDate) {
        return a.earliestDate.localeCompare(b.earliestDate);
      }
      return 0;
    });

  const totalDone = items.filter((i) => i.status === "done").length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {items.length === 0
              ? "No roadmap items yet"
              : `${totalDone} of ${items.length} shipped`}
          </span>
        </div>
        <NewRoadmapItemDialog projectId={project.id} slug={slug} />
      </div>

      {milestones.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing planned yet. Add your first roadmap item to get started.
        </p>
      )}

      <div className="flex flex-col gap-6">
        {milestones.map((group) => {
          const pct =
            group.total === 0 ? 0 : Math.round((group.done / group.total) * 100);
          return (
            <div
              key={group.milestone}
              className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
              <div className="mb-3 flex items-center justify-between gap-4">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-heading text-sm font-semibold">
                    {group.milestone}
                  </h2>
                  {group.earliestDate && (
                    <span className="font-mono text-xs text-muted-foreground">
                      target {group.earliestDate}
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {group.done}/{group.total}
                </span>
              </div>

              <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="flex flex-col divide-y divide-border">
                {group.items.map((item) => (
                  <RoadmapItemCard
                    key={item.id}
                    slug={slug}
                    item={{
                      id: item.id,
                      title: item.title,
                      description: item.description,
                      targetDate: item.targetDate,
                      status: item.status,
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
