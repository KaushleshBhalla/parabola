"use client";

import { useEffect, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatStatusLabel } from "@/lib/work-items";
import {
  getWorkItemDetail,
  addWorkItemComment,
  setWorkItemQualityScore,
} from "./actions";
import { AssignWorkItemDialog } from "./assign-work-item-dialog";

type Detail = NonNullable<Awaited<ReturnType<typeof getWorkItemDetail>>>;

export function WorkItemDetailDialog({
  workItemId,
  slug,
  open,
  onOpenChange,
  assignees,
}: {
  workItemId: string;
  slug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignees: { id: string; name: string }[];
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [dismissedPrompt, setDismissedPrompt] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    getWorkItemDetail(workItemId).then((d) => {
      setDetail(d);
      setDismissedPrompt(false);
    });
  }, [open, workItemId]);

  function refresh() {
    startTransition(async () => {
      const d = await getWorkItemDetail(workItemId);
      setDetail(d);
    });
  }

  async function handleAddComment() {
    const body = commentBody.trim();
    if (!body) return;
    setCommentError(null);
    const result = await addWorkItemComment(workItemId, body, slug);
    if (result?.error) {
      setCommentError(result.error);
      return;
    }
    setCommentBody("");
    refresh();
  }

  async function handleSaveScore() {
    const score = Number(scoreInput);
    setScoreError(null);
    const result = await setWorkItemQualityScore(workItemId, slug, score);
    if (result?.error) {
      setScoreError(result.error);
      return;
    }
    refresh();
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {!detail ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>
                #{detail.item.number} {detail.item.title}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{formatStatusLabel(detail.item.status)}</Badge>
              {detail.item.priority !== "none" && (
                <Badge variant="secondary">{detail.item.priority}</Badge>
              )}
              {detail.item.qualityScore != null && (
                <Badge>{detail.item.qualityScore}/10</Badge>
              )}
            </div>

            {detail.item.description && (
              <p className="text-sm text-muted-foreground">{detail.item.description}</p>
            )}

            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">Assignees</p>
              <div className="flex flex-wrap items-center gap-2">
                {detail.assignees.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                ) : (
                  detail.assignees.map((a) => (
                    <div key={a.id} className="flex items-center gap-1.5 text-sm">
                      <Avatar size="sm">
                        <AvatarFallback>{a.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {a.name}
                    </div>
                  ))
                )}
              </div>
            </div>

            {detail.item.status === "done" &&
              detail.item.qualityScore == null &&
              detail.isCreator &&
              !dismissedPrompt && (
                <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
                  <p className="text-sm font-medium">Rate the quality of this work</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={scoreInput}
                      onChange={(e) => setScoreInput(e.target.value)}
                      placeholder="1-10"
                      className="w-20"
                    />
                    <Button size="sm" onClick={handleSaveScore}>
                      Save score
                    </Button>
                    <AssignWorkItemDialog
                      workItemId={workItemId}
                      slug={slug}
                      currentAssignees={detail.assignees}
                      currentDueDate={detail.item.dueDate}
                      assignees={assignees}
                    >
                      <Button size="sm" variant="outline">
                        Reassign
                      </Button>
                    </AssignWorkItemDialog>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDismissedPrompt(true)}
                    >
                      Mark done
                    </Button>
                  </div>
                  {scoreError && <p className="text-sm text-destructive">{scoreError}</p>}
                </div>
              )}

            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">Comments</p>
              <div className="flex max-h-48 flex-col gap-3 overflow-y-auto">
                {detail.comments.length === 0 && (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                )}
                {detail.comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 text-sm">
                    <Avatar size="sm">
                      <AvatarFallback>{c.authorName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium">{c.authorName}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(c.createdAt, { addSuffix: true })}
                        </span>
                      </div>
                      <p>{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <Textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Add a comment…"
                  rows={2}
                />
                {commentError && <p className="text-sm text-destructive">{commentError}</p>}
                <Button size="sm" className="self-end" onClick={handleAddComment}>
                  Comment
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
