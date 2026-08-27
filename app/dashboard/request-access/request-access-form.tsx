"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { submitAccessRequest, type RequestAccessState } from "./actions";

export function RequestAccessForm({
  defaultName,
  defaultEmail,
}: {
  defaultName: string;
  defaultEmail: string;
}) {
  const [state, action, pending] = useActionState<RequestAccessState, FormData>(
    submitAccessRequest,
    null
  );

  if (state && "success" in state) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Thanks!</CardTitle>
          <CardDescription>
            We&apos;ve got your request and will be in touch soon about Pro
            access.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg">Request Pro access</CardTitle>
        <CardDescription>
          Tell us a bit about your team and we&apos;ll reach out to get you
          set up.
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={defaultName} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={defaultEmail}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="message">What are you hoping to use Parabola for?</Label>
            <Textarea id="message" name="message" rows={4} />
          </div>
          {state && "error" in state && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Sending…" : "Request access"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
