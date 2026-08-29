"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";

export function OnboardingForm({
  action,
  label,
  pendingLabel,
  variant,
}: {
  action: () => Promise<void>;
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline";
}) {
  const [, formAction, pending] = useActionState(async () => {
    await action();
    return null;
  }, null);

  return (
    <form action={formAction}>
      <Button type="submit" disabled={pending} variant={variant} className="w-full">
        {pending ? pendingLabel : label}
      </Button>
    </form>
  );
}
