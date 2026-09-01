"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { Check, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { updateProjectName, setAutoApprove } from "./actions";

type RenameState = { error: string } | null;

export function ProjectSettings({
  projectId,
  slug,
  name,
  inviteCode,
  autoApprove,
}: {
  projectId: string;
  slug: string;
  name: string;
  inviteCode: string;
  autoApprove: boolean;
}) {
  const [renameState, renameAction, renamePending] = useActionState<RenameState, FormData>(
    async (_prev, formData) => {
      const newName = String(formData.get("name") ?? "");
      const result = await updateProjectName(projectId, slug, newName);
      return result?.error ? result : null;
    },
    null
  );
  const [autoApprovePending, startAutoApproveTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Project settings</CardTitle>
        <CardDescription>Name, join code, and how join requests are handled.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form action={renameAction} className="flex flex-col gap-1.5">
          <label htmlFor="project-name" className="text-xs font-medium text-muted-foreground">
            Project name
          </label>
          <div className="flex items-center gap-2">
            <Input id="project-name" name="name" defaultValue={name} required className="max-w-xs" />
            <Button type="submit" size="sm" variant="outline" disabled={renamePending}>
              {renamePending ? "Saving…" : "Save"}
            </Button>
          </div>
          {renameState?.error && <p className="text-sm text-destructive">{renameState.error}</p>}
        </form>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Join code</p>
          <div className="flex items-center gap-2">
            <code className="rounded-md bg-muted px-2.5 py-1.5 text-sm">{inviteCode}</code>
            <Button type="button" size="sm" variant="outline" onClick={copyCode}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Share this with anyone you want to join — they enter it from their dashboard&apos;s Join
            project link, or via <code>/join/{inviteCode}</code>.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Join requests</p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={autoApprove ? "default" : "outline"}
              disabled={autoApprovePending}
              onClick={() =>
                startAutoApproveTransition(async () => {
                  await setAutoApprove(projectId, slug, !autoApprove);
                })
              }
            >
              {autoApprove ? "Auto-approve: on" : "Auto-approve: off"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {autoApprove
                ? "Anyone with the code joins instantly."
                : "Default — someone with the code files a request you approve below."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
