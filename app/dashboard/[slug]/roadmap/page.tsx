import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import { db } from "@/lib/db/client";
import { projects, roadmapItems } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { NewRoadmapItemDialog } from "./new-roadmap-item-dialog";

const COLUMNS = [
  { status: "planned" as const, label: "Planned" },
  { status: "in_progress" as const, label: "In Progress" },
  { status: "done" as const, label: "Done" },
];

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end px-6 pt-4">
        <NewRoadmapItemDialog projectId={project.id} slug={slug} />
      </div>
      <div className="flex h-full gap-4 overflow-x-auto px-6 py-4">
        {COLUMNS.map((col) => (
          <div key={col.status} className="flex w-72 shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
              <span>{col.label}</span>
              <span>
                {items.filter((i) => i.status === col.status).length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {items
                .filter((i) => i.status === col.status)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-lg bg-card p-3 text-sm ring-1 ring-foreground/10"
                  >
                    <p className="font-medium">{item.title}</p>
                    {item.description && (
                      <p className="text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      {item.milestone && (
                        <Badge variant="outline">{item.milestone}</Badge>
                      )}
                      {item.targetDate && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.targetDate), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
