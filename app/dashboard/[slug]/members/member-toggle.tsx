"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { removeProjectMember } from "./actions";

export function MemberToggle({
  projectId,
  userId,
  slug,
}: {
  projectId: string;
  userId: string;
  slug: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => removeProjectMember(projectId, userId, slug))}
    >
      Remove access
    </Button>
  );
}
