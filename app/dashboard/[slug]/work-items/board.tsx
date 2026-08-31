"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { formatStatusLabel } from "@/lib/work-items";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DeadlineBadge } from "@/components/deadline-badge";
import { moveWorkItem } from "./actions";
import { DueDateEditor } from "./due-date-editor";
import { AssignWorkItemDialog } from "./assign-work-item-dialog";
import { WorkItemDetailDialog } from "./work-item-detail-dialog";
import { MoveWorkItemDialog, type PendingMove } from "./move-work-item-dialog";

// Entering these columns requires a comment explaining the update; entering
// Done is gated separately (assignor-only, requires a comment and a quality
// score, regardless of which of these it's coming from) in handleDragEnd
// below.
const COMMENT_REQUIRED_STATUSES: BoardItem["status"][] = ["in_progress", "in_review", "review"];

export type BoardItem = {
  id: string;
  number: number;
  title: string;
  priority: "none" | "low" | "medium" | "high" | "urgent";
  status: "backlog" | "todo" | "in_progress" | "in_review" | "review" | "done" | "cancelled";
  assignees: { id: string; name: string }[];
  dueDate: string | null;
  position: number;
  qualityScore: number | null;
  createdBy: string;
};

const POSITION_GAP = 1000;

const MAIN_COLUMNS: { status: BoardItem["status"]; label: string }[] = [
  { status: "backlog", label: "Backlog" },
  { status: "todo", label: "Todo" },
  { status: "in_progress", label: formatStatusLabel("in_progress") },
  { status: "in_review", label: formatStatusLabel("in_review") },
  { status: "review", label: formatStatusLabel("review") },
  { status: "done", label: "Done" },
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

function columnDropId(status: string) {
  return `col-${status}`;
}

export function WorkItemsBoard({
  items,
  slug,
  currentUserId,
  canEditAnyDueDate,
  assignees,
}: {
  items: BoardItem[];
  slug: string;
  currentUserId: string;
  canEditAnyDueDate: boolean;
  assignees: { id: string; name: string }[];
}) {
  const [board, setBoard] = useState(items);
  const [prevItems, setPrevItems] = useState(items);
  const [pending, setPending] = useState<
    | (PendingMove & { workItemId: string; status: BoardItem["status"]; position: number })
    | null
  >(null);
  const [submitting, startTransition] = useTransition();

  if (items !== prevItems) {
    setPrevItems(items);
    setBoard(items);
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function commitMove(
    workItemId: string,
    status: BoardItem["status"],
    position: number,
    extra?: { comment?: string; qualityScore?: number }
  ) {
    startTransition(async () => {
      const result = await moveWorkItem(workItemId, status, position, slug, extra);
      if (result?.error) {
        toast.error(result.error);
        setBoard(items);
      }
      setPending(null);
    });
  }

  function resolveStatus(overId: string): BoardItem["status"] | null {
    const overItem = board.find((i) => i.id === overId);
    if (overItem) return overItem.status;
    if (overId.startsWith("col-")) return overId.slice(4) as BoardItem["status"];
    return null;
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activeItem = board.find((i) => i.id === activeId);
    const overStatus = resolveStatus(overId);
    if (!activeItem || !overStatus || activeItem.status === overStatus) return;

    setBoard((prev) => {
      const filtered = prev.filter((i) => i.id !== activeId);
      const moved = { ...activeItem, status: overStatus };
      const overIndex = filtered.findIndex((i) => i.id === overId);
      if (overIndex === -1) return [...filtered, moved];
      return [...filtered.slice(0, overIndex), moved, ...filtered.slice(overIndex)];
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    const activeItem = board.find((i) => i.id === activeId);
    if (!activeItem) return;
    const targetStatus = activeItem.status;

    let nextBoard = board;
    const overItem = board.find((i) => i.id === overId);
    if (overItem && overItem.id !== activeId && overItem.status === targetStatus) {
      const columnIds = board.filter((i) => i.status === targetStatus).map((i) => i.id);
      const oldIndex = columnIds.indexOf(activeId);
      const newIndex = columnIds.indexOf(overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(columnIds, oldIndex, newIndex);
        const others = board.filter((i) => i.status !== targetStatus);
        const columnItems = reordered.map((id) => board.find((i) => i.id === id)!);
        nextBoard = [...others, ...columnItems];
      }
    }

    const columnOrdered = nextBoard.filter((i) => i.status === targetStatus);
    const idx = columnOrdered.findIndex((i) => i.id === activeId);
    const prev = columnOrdered[idx - 1];
    const next = columnOrdered[idx + 1];
    let position: number;
    if (prev && next) position = (prev.position + next.position) / 2;
    else if (prev) position = prev.position + POSITION_GAP;
    else if (next) position = next.position - POSITION_GAP;
    else position = POSITION_GAP;

    setBoard(nextBoard.map((i) => (i.id === activeId ? { ...i, position } : i)));

    // `items` is the last server-confirmed state — use it (not `board`,
    // which handleDragOver may have already moved optimistically) to tell
    // whether this drop is a genuine status change.
    const originalItem = items.find((i) => i.id === activeId);
    const isTransition = !!originalItem && originalItem.status !== targetStatus;

    if (isTransition && targetStatus === "done") {
      if (originalItem!.createdBy !== currentUserId) {
        toast.error("Only the person who created this task can mark it done.");
        setBoard(items);
        return;
      }
      setPending({
        mode: "done",
        itemTitle: activeItem.title,
        targetLabel: "Done",
        workItemId: activeId,
        status: targetStatus,
        position,
      });
      return;
    }

    if (isTransition && COMMENT_REQUIRED_STATUSES.includes(targetStatus)) {
      setPending({
        mode: "comment",
        itemTitle: activeItem.title,
        targetLabel: formatStatusLabel(targetStatus),
        workItemId: activeId,
        status: targetStatus,
        position,
      });
      return;
    }

    commitMove(activeId, targetStatus, position);
  }

  const cancelledCount = board.filter((i) => i.status === "cancelled").length;

  return (
    <DndContext
      id="work-items-board"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-3 px-4 py-3">
        <div className="grid min-w-0 flex-1 grid-cols-6 gap-3">
          {MAIN_COLUMNS.map((col) => (
            <Column
              key={col.status}
              status={col.status}
              label={col.label}
              items={board.filter((i) => i.status === col.status)}
              slug={slug}
              currentUserId={currentUserId}
              canEditAnyDueDate={canEditAnyDueDate}
              assignees={assignees}
            />
          ))}
        </div>
        <Column
          status="cancelled"
          label="Cancelled"
          items={board.filter((i) => i.status === "cancelled")}
          slug={slug}
          currentUserId={currentUserId}
          canEditAnyDueDate={canEditAnyDueDate}
          assignees={assignees}
          compact
          headerCount={cancelledCount}
        />
      </div>
      <MoveWorkItemDialog
        pending={pending}
        submitting={submitting}
        onConfirm={(payload) => {
          if (!pending) return;
          commitMove(pending.workItemId, pending.status, pending.position, payload);
        }}
        onCancel={() => {
          setBoard(items);
          setPending(null);
        }}
      />
    </DndContext>
  );
}

function Column({
  status,
  label,
  items,
  slug,
  currentUserId,
  canEditAnyDueDate,
  assignees,
  compact,
  headerCount,
}: {
  status: BoardItem["status"];
  label: string;
  items: BoardItem[];
  slug: string;
  currentUserId: string;
  canEditAnyDueDate: boolean;
  assignees: { id: string; name: string }[];
  compact?: boolean;
  headerCount?: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(status) });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-lg p-1.5",
        compact ? "w-32 shrink-0" : "min-w-0",
        isOver && "bg-muted/50"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between px-1 text-xs font-medium",
          compact ? "text-destructive" : "text-muted-foreground"
        )}
      >
        <span className="flex items-center gap-1">
          {compact && <span className="size-1.5 rounded-full bg-destructive" />}
          {label}
        </span>
        <span>{headerCount ?? items.length}</span>
      </div>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1.5 overflow-y-auto">
          {items.map((item) => (
            <WorkItemCard
              key={item.id}
              item={item}
              slug={slug}
              canEditDueDate={
                canEditAnyDueDate || item.assignees.some((a) => a.id === currentUserId)
              }
              assignees={assignees}
              compact={compact}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function WorkItemCard({
  item,
  slug,
  canEditDueDate,
  assignees,
  compact,
}: {
  item: BoardItem;
  slug: string;
  canEditDueDate: boolean;
  assignees: { id: string; name: string }[];
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const [detailOpen, setDetailOpen] = useState(false);

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={() => setDetailOpen(true)}
        className={cn(
          "flex cursor-grab flex-col gap-0.5 rounded-md bg-card p-1.5 text-xs ring-1 ring-destructive/20 select-none active:cursor-grabbing",
          isDragging && "opacity-50"
        )}
      >
        <p className="text-muted-foreground">#{item.number}</p>
        <p className="line-clamp-2 font-medium">{item.title}</p>
        <WorkItemDetailDialog
          workItemId={item.id}
          slug={slug}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          assignees={assignees}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => setDetailOpen(true)}
      className={cn(
        "flex cursor-grab flex-col gap-1.5 rounded-lg bg-card p-2 text-sm ring-1 ring-foreground/10 select-none active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">#{item.number}</p>
        {item.status === "done" && item.qualityScore != null && (
          <Badge variant="secondary">{item.qualityScore}/10</Badge>
        )}
      </div>
      <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
      <div className="flex items-center justify-between gap-2">
        {item.priority !== "none" ? (
          <Badge variant={PRIORITY_VARIANT[item.priority]}>{item.priority}</Badge>
        ) : (
          <span />
        )}
        <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <AssignWorkItemDialog
            workItemId={item.id}
            slug={slug}
            currentAssignees={item.assignees}
            currentDueDate={item.dueDate}
            assignees={assignees}
          >
            <div className="flex -space-x-1.5">
              {item.assignees.length === 0 ? (
                <span className="text-xs text-muted-foreground">Unassigned</span>
              ) : (
                item.assignees.slice(0, 3).map((a) => (
                  <Avatar key={a.id} size="sm" className="ring-2 ring-card">
                    <AvatarFallback>{a.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                ))
              )}
            </div>
          </AssignWorkItemDialog>
        </div>
      </div>
      {item.assignees.length > 0 && (
        <div
          className="flex items-center justify-between gap-2"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <DueDateEditor
            workItemId={item.id}
            dueDate={item.dueDate}
            slug={slug}
            canEdit={canEditDueDate}
          />
          <DeadlineBadge dueDate={item.dueDate} status={item.status} />
        </div>
      )}
      <WorkItemDetailDialog
        workItemId={item.id}
        slug={slug}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        assignees={assignees}
      />
    </div>
  );
}
