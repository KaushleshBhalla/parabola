"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setOrgProStatus } from "../actions";

export function ProToggleButton({
  organizationId,
  isDemo,
}: {
  organizationId: string;
  isDemo: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant={isDemo ? "default" : "outline"}
      disabled={pending}
      onClick={() => startTransition(() => setOrgProStatus(organizationId, !isDemo))}
    >
      {isDemo ? "Grant Pro" : "Revoke Pro"}
    </Button>
  );
}
