"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { setMemberRoles, removeMember } from "./actions";

type ActionState = { error: string } | null;

export function MemberRow({
  member,
  allRoles,
  isCreator,
}: {
  member: {
    id: string;
    name: string;
    email: string;
    roleIds: string[];
  };
  allRoles: { id: string; name: string; isOwnerRole: boolean }[];
  isCreator: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => {
      const roleIds = formData.getAll("roleId").map(String);
      const result = await setMemberRoles(member.id, roleIds);
      return result ?? null;
    },
    null
  );

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-card p-3 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{member.name}</p>
            <p className="text-xs text-muted-foreground">{member.email}</p>
          </div>
        </div>
        {!isCreator && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => removeMember(member.id)}
            title="Remove member"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <form action={action} className="flex flex-wrap items-center gap-3">
        {allRoles.map((role) => (
          <label key={role.id} className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              name="roleId"
              value={role.id}
              defaultChecked={member.roleIds.includes(role.id)}
              disabled={role.isOwnerRole && isCreator}
              className="size-3.5 rounded border-input"
            />
            {role.name}
          </label>
        ))}
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save roles"}
        </Button>
      </form>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  );
}
