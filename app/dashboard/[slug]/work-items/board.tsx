"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { moveWorkItem } from "./actions";

export type BoardItem = {
  id: string;
  number: number;
  title: string;
  priority: "none" | "low" | "medium" | "high" | "urgent";
  status: "backlog" | "todo" | "in_progress" | "in_review" | "done" | "cancelled";
  assigneeName: string | null;
};

const COLUMNS: { status: BoardItem["status"]; label: string }[] = [
  { status: "backlog", label: "Backlog" },
  { status: "todo", label: "Todo" },
  { status: "in_progress", label: "In Progress" },
  { status: "in_review", label: "In Review" },
  { status: "done", label: "Done" },
  { status: "cancelled", label: "Cancelled" },
];

const PRIORITY_VARIANT: Record<
  BoardItem["priority"],
  "outline" | "secondary" | "default" | "destructive"
> = {
  none: "outline",
  low: "outline",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
};

export function WorkItemsBoard({
  items,
  slug,
}: {
  items: BoardItem[];
  slug: string;
}) {
  const [board, setBoard] = useState(items);
  const [prevItems, setPrevItems] = useState(items);
  const [, startTransition] = useTransition();

  if (items !== prevItems) {
    setPrevItems(items);
    setBoard(items);
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const newStatus = over.id as BoardItem["status"];
    const itemId = active.id as string;

    const current = board.find((i) => i.id === itemId);
    if (!current || current.status === newStatus) return;

    setBoard((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, status: newStatus } : i))
    );
    startTransition(async () => {
      await moveWorkItem(itemId, newStatus, slug);
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-full gap-4 overflow-x-auto px-6 py-4">
        {COLUMNS.map((col) => (
          <Column
            key={col.status}
            status={col.status}
            label={col.label}
            items={board.filter((i) => i.status === col.status)}
          />
        ))}
      </div>
    </DndContext>
  );
}

function Column({
  status,
  label,
  items,
}: {
  status: BoardItem["status"];
  label: string;
  items: BoardItem[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-64 shrink-0 flex-col gap-2 rounded-lg p-2",
        isOver && "bg-muted/50"
      )}
    >
      <div className="flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <span>{items.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <WorkItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function WorkItemCard({ item }: { item: BoardItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: item.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex cursor-grab flex-col gap-2 rounded-lg bg-card p-3 text-sm ring-1 ring-foreground/10 select-none active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <p className="text-xs text-muted-foreground">#{item.number}</p>
      <p className="font-medium">{item.title}</p>
      <div className="flex items-center justify-between">
        {item.priority !== "none" ? (
          <Badge variant={PRIORITY_VARIANT[item.priority]}>
            {item.priority}
          </Badge>
        ) : (
          <span />
        )}
        {item.assigneeName && (
          <Avatar size="sm">
            <AvatarFallback>
              {item.assigneeName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
