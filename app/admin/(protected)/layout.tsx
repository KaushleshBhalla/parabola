import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { requirePlatformAdmin } from "@/lib/auth/rbac";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check auth before requirePlatformAdmin() — its underlying requireUser()
  // redirects unauthenticated visitors to the regular /login, but admin
  // routes get their own /admin/login instead.
  const { userId } = await auth();
  if (!userId) redirect("/admin/login");

  await requirePlatformAdmin();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Admin</h1>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/admin" className="hover:underline">
            Access requests
          </Link>
          <Link href="/admin/projects" className="hover:underline">
            Projects
          </Link>
          <Link href="/admin/users" className="hover:underline">
            Users
          </Link>
          <Link href="/dashboard/log" className="hover:underline">
            Activity log
          </Link>
          <Link href="/dashboard" className="text-muted-foreground hover:underline">
            Back to app
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
