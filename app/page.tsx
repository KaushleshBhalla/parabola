import Link from "next/link";
import { ArrowRight, ListTodo, Map, MessagesSquare, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: ListTodo,
    title: "Work items",
    description:
      "Track issues from backlog to done with statuses, priorities, labels, and assignees.",
  },
  {
    icon: Map,
    title: "Roadmap",
    description:
      "Plan milestones and see what's planned, in progress, and shipped at a glance.",
  },
  {
    icon: MessagesSquare,
    title: "Team chat",
    description:
      "Discuss work in project-level threads without leaving your workflow.",
  },
  {
    icon: Users,
    title: "Built for teams",
    description:
      "Roles, activity history, and permissions so everyone stays in sync.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-heading text-lg font-semibold tracking-tight">
          Parabola
        </span>
        <Button variant="ghost" size="sm" render={<Link href="/login" />}>
          Sign in
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6">
        <section className="flex flex-col items-center gap-6 py-24 text-center sm:py-32">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Plan, track, and ship work in one place
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground text-balance">
            Parabola brings work items, roadmaps, and team chat together so
            your team always knows what&apos;s next.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" render={<Link href="/login" />}>
              Sign in
              <ArrowRight />
            </Button>
          </div>
        </section>

        <section className="grid w-full grid-cols-1 gap-4 pb-24 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardHeader>
                <Icon className="size-5 text-muted-foreground" />
                <CardTitle className="mt-2">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Parabola
      </footer>
    </div>
  );
}
