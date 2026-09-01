import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import {
  LayoutGrid,
  LogOut,
  ListTodo,
  ListChecks,
  Users,
  ScrollText,
  LayoutDashboard,
  Crown,
  KeyRound,
} from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { requireUser, hasRole } from "@/lib/auth/rbac";
import { hasActiveRealProject } from "@/lib/project-access";
import { db } from "@/lib/db/client";
import { notifications, workItems, projects, projectMembers } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationsBell, type NotificationItem } from "./notifications-bell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const [myProjects, notificationRows, isPro] = await Promise.all([
    db
      .select({ id: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, user.id))
      .limit(1),
    db
      .select({
        id: notifications.id,
        body: notifications.body,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
        projectSlug: projects.slug,
      })
      .from(notifications)
      .leftJoin(workItems, eq(notifications.workItemId, workItems.id))
      .leftJoin(projects, eq(workItems.projectId, projects.id))
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(15),
    hasActiveRealProject(user.id),
  ]);
  if (myProjects.length === 0) redirect("/onboarding");

  const canManageTeam = hasRole(user.role, "admin");
  const isOwner = hasRole(user.role, "owner");

  const notificationItems: NotificationItem[] = notificationRows.map((n) => ({
    id: n.id,
    body: n.body,
    isRead: n.isRead,
    createdAt: n.createdAt,
    href: n.projectSlug ? `/dashboard/${n.projectSlug}/work-items` : null,
  }));
  const unreadCount = notificationItems.filter((n) => !n.isRead).length;

  return (
    <div className="flex min-h-full flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/30 p-4">
        <Link
          href="/dashboard"
          className="mb-6 font-heading text-lg font-semibold"
        >
          Parabola
        </Link>
        <nav className="flex flex-1 flex-col gap-1 text-sm">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted"
          >
            <LayoutGrid className="size-4" />
            Projects
          </Link>
          <Link
            href="/dashboard/my-tasks"
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted"
          >
            <ListTodo className="size-4" />
            My tasks
          </Link>
          <Link
            href="/dashboard/team-tasks"
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted"
          >
            <ListChecks className="size-4" />
            Team tasks
          </Link>
          <Link
            href="/dashboard/join"
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted"
          >
            <KeyRound className="size-4" />
            Join project
          </Link>
          {canManageTeam && (
            <Link
              href="/dashboard/team"
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted"
            >
              <Users className="size-4" />
              Team
            </Link>
          )}
          {isOwner && (
            <Link
              href="/dashboard/log"
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted"
            >
              <ScrollText className="size-4" />
              Activity log
            </Link>
          )}
          {user.isPlatformAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted"
            >
              <LayoutDashboard className="size-4" />
              Admin
            </Link>
          )}
        </nav>
        <div className="border-t pt-3 pb-1">
          {isPro ? (
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-primary">
              <Crown className="size-4" />
              You have Pro
            </div>
          ) : (
            <Link
              href="/dashboard/request-access"
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-muted"
            >
              <Crown className="size-4" />
              Request Pro access
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 border-t pt-3">
          <Avatar size="sm">
            <AvatarFallback>
              {user.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground capitalize">
              {user.role}
            </p>
          </div>
          <NotificationsBell
            notifications={notificationItems}
            unreadCount={unreadCount}
          />
          <SignOutButton redirectUrl="/login">
            <Button variant="ghost" size="icon-sm" title="Sign out">
              <LogOut className="size-4" />
            </Button>
          </SignOutButton>
        </div>
      </aside>
      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}
