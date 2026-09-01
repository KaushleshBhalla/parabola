"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setArchived } from "./[slug]/actions";

export function UnarchiveShortcut({ projectId, slug }: { projectId: string; slug: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="xs"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(async () => { await setArchived(projectId, slug, false); })}
    >
      {pending ? "Unarchiving…" : "Unarchive"}
    </Button>
  );
}
