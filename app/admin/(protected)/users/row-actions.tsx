"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setUserActive, setPlatformAdmin } from "../actions";

export function ActiveToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => setUserActive(userId, !isActive))}
    >
      {isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}

export function PlatformAdminToggle({
  userId,
  isPlatformAdmin,
}: {
  userId: string;
  isPlatformAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={isPlatformAdmin ? "outline" : "secondary"}
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => setPlatformAdmin(userId, !isPlatformAdmin))}
    >
      {isPlatformAdmin ? "Revoke admin" : "Make admin"}
    </Button>
  );
}
