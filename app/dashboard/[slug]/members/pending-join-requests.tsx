"use client";

import { useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { respondToJoinRequest } from "./actions";

export type PendingJoinRequest = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
};

export function PendingJoinRequests({
  projectId,
  slug,
  requests,
}: {
  projectId: string;
  slug: string;
  requests: PendingJoinRequest[];
}) {
  const [pending, startTransition] = useTransition();

  if (requests.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Join requests ({requests.length})</CardTitle>
        <CardDescription>Waiting on your approval to join this project.</CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-2 px-6 pb-6">
        {requests.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3 text-sm"
          >
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await respondToJoinRequest(r.id, projectId, slug, false);
                  })
                }
              >
                Decline
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await respondToJoinRequest(r.id, projectId, slug, true);
                  })
                }
              >
                Approve
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
