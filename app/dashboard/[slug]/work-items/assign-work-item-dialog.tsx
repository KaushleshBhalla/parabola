"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AssigneeMultiSelect } from "./assignee-multi-select";
import { assignWorkItem } from "./actions";

type ActionState = { error: string } | null;

export function AssignWorkItemDialog({
  workItemId,
  slug,
  currentAssignees,
  currentDueDate,
  assignees,
  children,
}: {
  workItemId: string;
  slug: string;
  currentAssignees: { id: string; name: string }[];
  currentDueDate: string | null;
  assignees: { id: string; name: string }[];
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    currentAssignees.map((a) => a.id)
  );
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => {
      const nextAssigneeIds = formData.getAll("assigneeIds").map(String);
      const dueDate = String(formData.get("dueDate") ?? "").trim() || null;
      const result = await assignWorkItem(workItemId, slug, nextAssigneeIds, dueDate);
      if (result?.error) return result;
      setOpen(false);
      return null;
    },
    null
  );

  const label =
    currentAssignees.length === 0
      ? "Assign"
      : currentAssignees.map((a) => a.name).join(", ");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setAssigneeIds(currentAssignees.map((a) => a.id));
      }}
    >
      <DialogTrigger
        render={
          children ? (
            <button type="button" />
          ) : (
            <Button variant="ghost" size="sm" />
          )
        }
      >
        {children ?? (
          <>
            <UserPlus />
            {label}
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <form action={action} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Assign work item</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>Assignees</Label>
            <AssigneeMultiSelect
              name="assigneeIds"
              assignees={assignees}
              selected={assigneeIds}
              onChange={setAssigneeIds}
            />
          </div>
          {assigneeIds.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assign-dueDate">Deadline</Label>
              <Input
                id="assign-dueDate"
                name="dueDate"
                type="date"
                defaultValue={currentDueDate ?? ""}
                required
              />
            </div>
          )}
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
