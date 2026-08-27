"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { createOrganizationAction, type CreateOrgState } from "./actions";

export default function OnboardingPage() {
  const [state, action, pending] = useActionState<CreateOrgState, FormData>(
    createOrganizationAction,
    null
  );

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Create your organization</CardTitle>
          <CardDescription>
            You&apos;ll be the owner, with full control over roles and
            members.
          </CardDescription>
        </CardHeader>
        <form action={action}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Organization name</Label>
              <Input id="name" name="name" required autoFocus />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">One-time setup fee</span>
              <span className="font-medium">$49.00</span>
            </div>
            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Creating…" : "Create organization"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
