"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createOwnOrganization } from "./create-organization-actions";

export function CreateOrganizationCard() {
  const [name, setName] = useState("");
  const [state, action, pending] = useActionState<{ error: string } | null, FormData>(
    async () => {
      const result = await createOwnOrganization(name);
      return result?.error ? result : null;
    },
    null
  );

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2.5 text-xs">
      <p className="font-medium">Your organization request was approved 🎉</p>
      <form action={action} className="flex flex-col gap-1.5">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Organization name"
          className="h-7 text-xs"
          required
        />
        <Button type="submit" size="xs" disabled={pending}>
          {pending ? "Creating…" : "Create organization"}
        </Button>
        {state?.error && <p className="text-destructive">{state.error}</p>}
      </form>
    </div>
  );
}
