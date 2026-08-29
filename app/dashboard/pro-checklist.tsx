"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { renameOrganizationAction, getInviteLink } from "./organization-actions";

export function ProChecklist({
  organizationId,
  orgName,
  isRenamed,
  hasInvitedTeam,
}: {
  organizationId: string;
  orgName: string;
  isRenamed: boolean;
  hasInvitedTeam: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [name, setName] = useState(orgName);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  if (dismissed || (isRenamed && hasInvitedTeam)) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-2.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">Get set up</span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <span>{isRenamed ? "✅" : "⬜"}</span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim();
            if (trimmed && trimmed !== orgName) {
              startTransition(async () => {
                await renameOrganizationAction(organizationId, trimmed);
              });
            }
          }}
          className="h-6 flex-1 text-xs"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span>{hasInvitedTeam ? "✅" : "⬜"}</span>
        <Button
          size="xs"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const link = await getInviteLink(organizationId);
              await navigator.clipboard.writeText(`${window.location.origin}${link}`);
              setCopied(true);
            })
          }
        >
          {copied ? "Link copied!" : "Copy invite link"}
        </Button>
      </div>
    </div>
  );
}
