import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import {
  LayoutGrid,
  LogOut,
  ListTodo,
  ListChecks,
  Users,
  ScrollText,
  ShieldCheck,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { requireUser, hasRole, hasPermission } from "@/lib/auth/rbac";
import { getUserOrganizations } from "@/lib/organizations";
import { DEMO_CREATION_LIMIT } from "@/lib/demo";
import { db } from "@/lib/db/client";
import { notifications, workItems, projects, organizationMembers, users } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationsBell, type NotificationItem } from "./notifications-bell";
import { ProChecklist } from "./pro-checklist";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const [userOrgs, notificationRows] = await Promise.all([
    getUserOrganizations(user.id),
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
  ]);
  if (userOrgs.length === 0) redirect("/onboarding");
  const canManageTeam = hasRole(user.role, "admin");
  const isOwner = hasRole(user.role, "owner");
  const isDemo = userOrgs[0]?.isDemo ?? false;
  const canManageRoles = await hasPermission(
    user.id,
    userOrgs[0].id,
    "role.manage"
  );

  let isRenamed = false;
  let hasInvitedTeam = false;
  if (!isDemo) {
    isRenamed = !userOrgs[0].name.endsWith("'s Demo Workspace");
    const otherMembers = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(
        and(
          eq(organizationMembers.organizationId, userOrgs[0].id),
          eq(users.isBot, false)
        )
      );
    hasInvitedTeam = otherMembers.length > 1;
  }

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
          {canManageTeam && (
            <Link
              href="/dashboard/team"
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted"
            >
              <Users className="size-4" />
              Team
            </Link>
          )}
          {canManageRoles && (
            <Link
              href="/dashboard/roles"
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted"
            >
              <ShieldCheck className="size-4" />
              Roles
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
          {isDemo && (
            <Link
              href="/dashboard/request-access"
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-medium text-primary hover:bg-muted"
            >
              <Sparkles className="size-4" />
              Upgrade to Pro
            </Link>
          )}
        </nav>
        {!isDemo && (
          <ProChecklist
            organizationId={userOrgs[0].id}
            orgName={userOrgs[0].name}
            isRenamed={isRenamed}
            hasInvitedTeam={hasInvitedTeam}
          />
        )}
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
      <main className="flex flex-1 flex-col overflow-y-auto">
        {isDemo && (
          <div className="flex items-center justify-between border-b bg-primary/5 px-6 py-2 text-sm">
            <span>
              You&apos;re exploring a demo workspace — up to{" "}
              {DEMO_CREATION_LIMIT} things to try before you need Pro access.
            </span>
            <Link
              href="/dashboard/request-access"
              className="font-medium text-primary hover:underline"
            >
              Request Pro access
            </Link>
          </div>
        )}
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
