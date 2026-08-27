"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { updateRolePermissions, deleteRole } from "./actions";
import { PermissionCheckboxes } from "./permission-checkboxes";

type ActionState = { error: string } | null;

export function RoleCard({
  role,
}: {
  role: {
    id: string;
    name: string;
    isOwnerRole: boolean;
    isDefault: boolean;
    permissions: string[];
  };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => {
      const keys = formData.getAll("permission").map(String);
      const result = await updateRolePermissions(role.id, keys);
      return result ?? null;
    },
    null
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{role.name}</CardTitle>
        {!role.isOwnerRole && !role.isDefault && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => deleteRole(role.id)}
            title="Delete role"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </CardHeader>
      <form action={action}>
        <CardContent>
          {role.isOwnerRole ? (
            <p className="text-sm text-muted-foreground">
              The Owner role always has every permission.
            </p>
          ) : (
            <PermissionCheckboxes
              name="permission"
              defaultChecked={role.permissions}
            />
          )}
          {state?.error && (
            <p className="mt-2 text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        {!role.isOwnerRole && (
          <CardFooter>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save permissions"}
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
