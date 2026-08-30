"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { addProjectMemberByEmail } from "./actions";

export function AddMemberByEmail({ projectId, slug }: { projectId: string; slug: string }) {
  const [email, setEmail] = useState("");
  const [state, action, pending] = useActionState<{ error: string } | null, FormData>(
    async () => {
      const result = await addProjectMemberByEmail(projectId, email, slug);
      if (result?.error) return result;
      setEmail("");
      return null;
    },
    null
  );

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="add-email">Add a member by email</Label>
          <Input
            id="add-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
