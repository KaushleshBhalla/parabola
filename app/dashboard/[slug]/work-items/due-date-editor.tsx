"use client";

import { useTransition } from "react";
import { commitDueDate } from "./actions";

export function DueDateEditor({
  workItemId,
  dueDate,
  slug,
  canEdit,
}: {
  workItemId: string;
  dueDate: string | null;
  slug?: string;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (!canEdit) {
    return (
      <span className="text-xs text-muted-foreground">
        {dueDate ?? "No date committed"}
      </span>
    );
  }

  return (
    <input
      type="date"
      defaultValue={dueDate ?? ""}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          await commitDueDate(workItemId, e.target.value, slug);
        })
      }
      className="rounded-md border border-input bg-transparent px-1.5 py-0.5 text-xs outline-none focus-visible:border-ring"
    />
  );
}
