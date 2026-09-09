"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  if (requests.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Join requests ({requests.length})</CardTitle>
        <CardDescription>Waiting on your approval to join this project — pick their role before approving.</CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-2 px-6 pb-6">
        {requests.map((r) => (
          <PendingRequestRow key={r.id} request={r} projectId={projectId} slug={slug} />
        ))}
      </div>
    </Card>
  );
}

function PendingRequestRow({
  request,
  projectId,
  slug,
}: {
  request: PendingJoinRequest;
  projectId: string;
  slug: string;
}) {
  const [role, setRole] = useState<"member" | "admin">("member");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3 text-sm">
      <div>
        <p className="font-medium">{request.name}</p>
        <p className="text-xs text-muted-foreground">{request.email}</p>
      </div>
      <div className="flex items-center gap-2">
        <Select value={role} onValueChange={(v) => setRole(v as "member" | "admin")}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await respondToJoinRequest(request.id, projectId, slug, false);
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
              await respondToJoinRequest(request.id, projectId, slug, true, role === "admin");
            })
          }
        >
          Approve
        </Button>
      </div>
    </div>
  );
}
