import { Sparkles, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { startDemo, requestProAccess } from "./actions";

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
              <form action={startDemo}>
                <Button type="submit" className="w-full">
                  Try the demo
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card className="flex flex-col">
            <CardHeader>
              <Sparkles className="size-5 text-muted-foreground" />
              <CardTitle className="text-base">Go Pro</CardTitle>
              <CardDescription>
                Tell us about your team and we&apos;ll set you up with a real
                workspace. You&apos;ll still get the demo sandbox to explore
                in the meantime.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <form action={requestProAccess}>
                <Button type="submit" variant="outline" className="w-full">
                  Request Pro access
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
