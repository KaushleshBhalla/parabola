"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createOwnProject } from "../create-own-project-actions";

export function CreateProjectPrompt() {
  const [name, setName] = useState("");
  const [state, action, pending] = useActionState<{ error: string } | null, FormData>(
    async () => {
      const result = await createOwnProject(name);
      return result?.error ? result : null;
    },
    null
  );

  return (
    <div className="flex items-center gap-2 border-b bg-primary/5 px-6 py-2 text-sm">
      <span className="font-medium">Your request was approved 🎉</span>
      <form action={action} className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project name"
          className="h-7 w-48 text-xs"
          required
        />
        <Button type="submit" size="xs" disabled={pending}>
          {pending ? "Creating…" : "Create project"}
        </Button>
      </form>
      {state?.error && <span className="text-destructive">{state.error}</span>}
    </div>
  );
}
