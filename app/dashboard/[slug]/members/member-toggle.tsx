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
import { removeProjectMember, changeMemberRole } from "./actions";

export function MemberToggle({
  projectId,
  userId,
  slug,
  isAdmin,
}: {
  projectId: string;
  userId: string;
  slug: string;
  isAdmin: boolean;
}) {
  const [rolePending, startRoleTransition] = useTransition();
  const [removePending, startRemoveTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Select
        value={isAdmin ? "admin" : "member"}
        onValueChange={(v) => startRoleTransition(async () => { await changeMemberRole(projectId, userId, slug, v === "admin"); })}
      >
        <SelectTrigger className="h-8 w-28 text-xs" disabled={rolePending}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="member">Member</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        disabled={removePending}
        onClick={() => startRemoveTransition(() => removeProjectMember(projectId, userId, slug))}
      >
        Remove access
      </Button>
    </div>
  );
}
