"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { Check, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { updateProject, setAutoApprove, setArchived } from "./actions";

type SaveState = { error: string } | null;

export function ProjectSettings({
  projectId,
  slug,
  name,
  description,
  inviteCode,
  autoApprove,
  isArchived,
}: {
  projectId: string;
  slug: string;
  name: string;
  description: string | null;
  inviteCode: string;
  autoApprove: boolean;
  isArchived: boolean;
}) {
  const [detailsState, detailsAction, detailsPending] = useActionState<SaveState, FormData>(
    async (_prev, formData) => {
      const result = await updateProject(projectId, slug, {
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
      });
      return result?.error ? result : null;
    },
    null
  );
  const [autoApprovePending, startAutoApproveTransition] = useTransition();
  const [archivePending, startArchiveTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project settings</CardTitle>
          <CardDescription>Name, description, join code, and how join requests are handled.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <form action={detailsAction} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="project-name" className="text-xs font-medium text-muted-foreground">
                Project name
              </label>
              <Input id="project-name" name="name" defaultValue={name} required className="max-w-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="project-description" className="text-xs font-medium text-muted-foreground">
                Description
              </label>
              <Textarea
                id="project-description"
                name="description"
                defaultValue={description ?? ""}
                rows={2}
                className="max-w-lg"
                placeholder="What this project is for"
              />
            </div>
            {detailsState?.error && <p className="text-sm text-destructive">{detailsState.error}</p>}
            <Button type="submit" size="sm" variant="outline" disabled={detailsPending} className="w-fit">
              {detailsPending ? "Saving…" : "Save changes"}
            </Button>
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
                  : "Default — someone with the code files a request you approve on the Members page."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{isArchived ? "This project is archived" : "Archive this project"}</CardTitle>
          <CardDescription>
            {isArchived
              ? "Hidden from your project list. Nothing else changes — unarchive anytime to bring it back."
              : "Hides it from your project list without deleting or locking anything. You can unarchive it anytime."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            size="sm"
            variant={isArchived ? "default" : "outline"}
            disabled={archivePending}
            onClick={() => startArchiveTransition(async () => { await setArchived(projectId, slug, !isArchived); })}
          >
            {archivePending ? "Saving…" : isArchived ? "Unarchive project" : "Archive project"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
