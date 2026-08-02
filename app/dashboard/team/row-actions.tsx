"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateUserRole, setUserActive, deleteUser } from "./actions";

export function RoleSelect({
  userId,
  role,
  canGrantAdmin,
}: {
  userId: string;
  role: "admin" | "member";
  canGrantAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={role}
      disabled={pending}
      onValueChange={(value) => {
        startTransition(async () => {
          await updateUserRole(userId, value as string);
        });
      }}
    >
      <SelectTrigger size="sm" className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {canGrantAdmin && <SelectItem value="admin">Admin</SelectItem>}
        <SelectItem value="member">Member</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function ActiveToggle({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setUserActive(userId, !isActive);
        })
      }
    >
      {isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}

export function DeleteUserButton({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [purge, setPurge] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="icon-sm" />}>
        <Trash2 className="size-4" />
        <span className="sr-only">Delete {name}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>
            They&apos;ll be signed out and can no longer log in. Anything
            they created will still show their name, marked as deleted —
            unless you choose to remove it below.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={purge}
            onChange={(e) => setPurge(e.target.checked)}
          />
          Also delete everything they created (work items, comments, chat
          messages, roadmap items) — cannot be undone.
        </label>
        <DialogFooter showCloseButton>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteUser(userId, purge);
                setOpen(false);
              })
            }
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
