import Link from "next/link";
import { LayoutGrid, LogOut, Users } from "lucide-react";
import { requireUser, hasRole } from "@/lib/auth/rbac";
import { logout } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const canManageTeam = hasRole(user.role, "admin");

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
          {canManageTeam && (
            <Link
              href="/dashboard/team"
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted"
            >
              <Users className="size-4" />
              Team
            </Link>
          )}
        </nav>
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
          <form action={logout}>
            <Button variant="ghost" size="icon-sm" type="submit" title="Sign out">
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
