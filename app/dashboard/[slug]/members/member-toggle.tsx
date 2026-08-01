"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addProjectMember, removeProjectMember } from "./actions";

export function MemberToggle({
  projectId,
  userId,
  slug,
  hasAccess,
}: {
  projectId: string;
  userId: string;
  slug: string;
  hasAccess: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={hasAccess ? "outline" : "default"}
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if (hasAccess) {
            await removeProjectMember(projectId, userId, slug);
          } else {
            await addProjectMember(projectId, userId, slug);
          }
        })
      }
    >
      {hasAccess ? "Remove access" : "Grant access"}
    </Button>
  );
}
