"use client";

import { useTransition } from "react";
import { format, isPast } from "date-fns";
import { Circle, CircleDot, CircleCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateRoadmapItemStatus, deleteRoadmapItem } from "./actions";

export type RoadmapItem = {
  id: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: "planned" | "in_progress" | "done";
};

const STATUS_ICON = {
  planned: Circle,
  in_progress: CircleDot,
  done: CircleCheck,
};

export function RoadmapItemCard({
  item,
  slug,
}: {
  item: RoadmapItem;
  slug: string;
}) {
  const [pending, startTransition] = useTransition();
  const Icon = STATUS_ICON[item.status];
  const overdue =
    item.status !== "done" &&
    item.targetDate &&
    isPast(new Date(item.targetDate));

  return (
    <div className="group flex items-start gap-3 rounded-lg p-2 hover:bg-muted/50">
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          item.status === "planned" ? "text-muted-foreground" : "text-foreground"
        )}
      />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium",
            item.status === "done" && "text-muted-foreground line-through"
          )}
        >
          {item.title}
        </p>
        {item.description && (
          <p className="text-xs text-muted-foreground">{item.description}</p>
        )}
        {item.targetDate && (
          <p
            className={cn(
              "mt-0.5 font-mono text-xs text-muted-foreground",
              overdue && "text-destructive"
            )}
          >
            {format(new Date(item.targetDate), "MMM d, yyyy")}
            {overdue && " · overdue"}
          </p>
        )}
      </div>
      <Select
        value={item.status}
        disabled={pending}
        onValueChange={(value) =>
          startTransition(async () => {
            await updateRoadmapItemStatus(item.id, value as string, slug);
          })
        }
      >
        <SelectTrigger
          size="sm"
          className="w-32 opacity-0 group-hover:opacity-100 data-open:opacity-100"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="planned">Planned</SelectItem>
          <SelectItem value="in_progress">In progress</SelectItem>
          <SelectItem value="done">Done</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        className="shrink-0 opacity-0 group-hover:opacity-100"
        onClick={() =>
          startTransition(async () => {
            await deleteRoadmapItem(item.id, slug);
          })
        }
      >
        <Trash2 className="size-3.5" />
        <span className="sr-only">Delete</span>
      </Button>
    </div>
  );
}
