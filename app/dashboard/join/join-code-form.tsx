"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { submitJoinCode, type JoinCodeState } from "./actions";

export function JoinCodeForm() {
  const [state, action, pending] = useActionState<JoinCodeState, FormData>(submitJoinCode, null);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg">Join a project</CardTitle>
        <CardDescription>
          Enter the code your project owner shared with you. Most projects require their approval
          before you get in — that&apos;s the default, not an error.
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">Join code</Label>
            <Input id="code" name="code" placeholder="e.g. aB3xQ9-k" required autoFocus />
          </div>
          {state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}
          {state && "message" in state && (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 text-sm">
              <p>{state.message}</p>
              {state.slug && (
                <Link href={`/dashboard/${state.slug}/work-items`} className="font-medium text-primary hover:underline">
                  Go to project →
                </Link>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Checking…" : "Join"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
