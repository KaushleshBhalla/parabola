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
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-lg">Request Pro access</CardTitle>
        <CardDescription>
          Tell us a bit about your team and we&apos;ll reach out to get you
          set up. Only name and email are required — everything else helps
          us prioritize but is optional.
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <Label htmlFor="company">Company (optional)</Label>
              <Input id="company" name="company" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="jobTitle">Role / title (optional)</Label>
              <Input id="jobTitle" name="jobTitle" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" name="phone" type="tel" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="teamSize">Team size (optional)</Label>
              <Input id="teamSize" name="teamSize" placeholder="e.g. 5-10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="website">Company website (optional)</Label>
              <Input id="website" name="website" placeholder="https://" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="howHeard">How did you hear about us? (optional)</Label>
              <Input id="howHeard" name="howHeard" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="message">What are you hoping to use Parabola for? (optional)</Label>
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
