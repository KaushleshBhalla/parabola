"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { assignWorkItem } from "./actions";

type ActionState = { error: string } | null;

export function AssignWorkItemDialog({
  workItemId,
  slug,
  currentAssigneeId,
  currentAssigneeName,
  currentDueDate,
  assignees,
  children,
}: {
  workItemId: string;
  slug: string;
  currentAssigneeId: string | null;
  currentAssigneeName: string | null;
  currentDueDate: string | null;
  assignees: { id: string; name: string }[];
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState(currentAssigneeId ?? "");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => {
      const nextAssigneeId = String(formData.get("assigneeId") ?? "") || null;
      const dueDate = String(formData.get("dueDate") ?? "").trim() || null;
      const result = await assignWorkItem(
        workItemId,
        slug,
        nextAssigneeId,
        dueDate
      );
      if (result?.error) return result;
      setOpen(false);
      return null;
    },
    null
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setAssigneeId(currentAssigneeId ?? "");
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
            {currentAssigneeName ?? "Assign"}
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <form action={action} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Assign work item</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-assigneeId">Assignee</Label>
            <Select
              name="assigneeId"
              value={assigneeId}
              onValueChange={(value) => setAssigneeId(value ?? "")}
            >
              <SelectTrigger id="assign-assigneeId" className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {assigneeId && (
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
