"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { postMessage } from "./actions";

export function ChatComposer({ projectId, slug }: { projectId: string; slug: string }) {
  const [state, action, pending] = useActionState<{ error: string } | null, FormData>(
    async (_prev, formData) => {
      const result = await postMessage(formData);
      return result?.error ? result : null;
    },
    null
  );

  return (
    <div className="border-t px-6 py-3">
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="slug" value={slug} />
        <Input name="body" placeholder="Message the team…" required />
        <Button type="submit" disabled={pending}>
          Send
        </Button>
      </form>
      {state?.error && (
        <p className="mt-1.5 text-sm text-destructive">{state.error}</p>
      )}
    </div>
  );
}
