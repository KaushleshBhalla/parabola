"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { confirmDiscordLink } from "./actions";

export function ConfirmDiscordLinkForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<{ error: string } | null, FormData>(
    async () => {
      const result = await confirmDiscordLink(token);
      return result?.error ? result : null;
    },
    null
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Linking…" : "Link account"}
      </Button>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
