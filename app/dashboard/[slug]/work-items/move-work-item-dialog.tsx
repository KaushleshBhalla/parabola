"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type PendingMove = {
  mode: "comment" | "done";
  itemTitle: string;
  targetLabel: string;
};

export function MoveWorkItemDialog({
  pending,
  submitting,
  onConfirm,
  onCancel,
}: {
  pending: PendingMove | null;
  submitting: boolean;
  onConfirm: (payload: { comment?: string; qualityScore?: number }) => void;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState("");
  const [score, setScore] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setComment("");
    setScore("");
    setError(null);
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      reset();
      onCancel();
    }
  }

  function handleConfirm() {
    if (!pending) return;
    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      setError(
        pending.mode === "done"
          ? "Add a closing comment before marking it done."
          : `A comment is required to move this to ${pending.targetLabel}.`
      );
      return;
    }
    if (pending.mode === "comment") {
      onConfirm({ comment: trimmedComment });
    } else {
      const parsed = Number(score);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
        setError("Enter a whole number score from 1 to 10.");
        return;
      }
      onConfirm({ qualityScore: parsed, comment: trimmedComment });
    }
    reset();
  }

  return (
    <Dialog open={!!pending} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        {pending && (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>
                {pending.mode === "done" ? "Mark as done" : `Move to ${pending.targetLabel}`}
              </DialogTitle>
              <DialogDescription>
                {pending.mode === "done"
                  ? `Rate the work and leave a closing comment on "${pending.itemTitle}" before closing it out.`
                  : `Add a quick note on what changed for "${pending.itemTitle}".`}
              </DialogDescription>
            </DialogHeader>

            {pending.mode === "done" && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="quality-score" className="text-xs font-medium text-muted-foreground">
                  Quality score (1-10)
                </label>
                <Input
                  id="quality-score"
                  type="number"
                  min={1}
                  max={10}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="1-10"
                  autoFocus
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="move-comment" className="text-xs font-medium text-muted-foreground">
                {pending.mode === "done" ? "Closing comment" : "Comment"}
              </label>
              <Textarea
                id="move-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What's the update?"
                rows={3}
                autoFocus={pending.mode === "comment"}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={submitting}>
                {submitting ? "Saving…" : pending.mode === "done" ? "Mark done" : "Move it"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
