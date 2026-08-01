"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUserRole, setUserActive } from "./actions";

export function RoleSelect({
  userId,
  role,
  canGrantAdmin,
}: {
  userId: string;
  role: "admin" | "member" | "viewer";
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
        <SelectItem value="viewer">Viewer</SelectItem>
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
