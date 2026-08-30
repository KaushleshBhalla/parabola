"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setProjectDemoStatus } from "../actions";

export function ProToggleButton({
  projectId,
  isDemo,
}: {
  projectId: string;
  isDemo: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant={isDemo ? "default" : "outline"}
      disabled={pending}
      onClick={() => startTransition(() => setProjectDemoStatus(projectId, !isDemo))}
    >
      {isDemo ? "Mark as real project" : "Mark as demo"}
    </Button>
  );
}
