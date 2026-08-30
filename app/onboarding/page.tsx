import { Sparkles, Rocket } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { startDemo, requestProAccess } from "./actions";
import { OnboardingForm } from "./onboarding-form";

export default function OnboardingPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="text-center">
          <h1 className="font-heading text-xl font-semibold">Welcome to Parabola</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose how you&apos;d like to get started.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="flex flex-col">
            <CardHeader>
              <Rocket className="size-5 text-muted-foreground" />
              <CardTitle className="text-base">Explore the demo</CardTitle>
              <CardDescription>
                You&apos;ll be exploring demo mode: a private sandbox pre-loaded
                with mock projects. Try every feature freely — no payment
                needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <OnboardingForm
                action={startDemo}
                label="Try the demo"
                pendingLabel="Setting up…"
              />
            </CardContent>
          </Card>
          <Card className="flex flex-col">
            <CardHeader>
              <Sparkles className="size-5 text-muted-foreground" />
              <CardTitle className="text-base">Create an organization</CardTitle>
              <CardDescription>
                New organizations aren&apos;t self-serve yet — tell us about
                your team and we&apos;ll set one up for you. You&apos;ll
                still get the demo sandbox to explore in the meantime.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <OnboardingForm
                action={requestProAccess}
                label="Request organization access"
                pendingLabel="Setting up…"
                variant="outline"
              />
            </CardContent>
          </Card>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Trying to join a team that&apos;s already on Parabola? Ask your
          project owner to add you — they can do it directly with your email
          from their project&apos;s Members page.
        </p>
      </div>
    </div>
  );
}
