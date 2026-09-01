"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectNav({
  slug,
  canManage,
}: {
  slug: string;
  canManage: boolean;
}) {
  const pathname = usePathname();
  const tabs: { label: string; href: string; exact?: boolean }[] = [
    { label: "Overview", href: `/dashboard/${slug}`, exact: true },
    { label: "Work items", href: `/dashboard/${slug}/work-items` },
    { label: "Roadmap", href: `/dashboard/${slug}/roadmap` },
    { label: "Chat", href: `/dashboard/${slug}/chat` },
    ...(canManage
      ? [{ label: "Members", href: `/dashboard/${slug}/members` }]
      : []),
  ];

  return (
    <nav className="flex gap-1 border-b px-6">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 border-transparent px-2 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground",
              active && "border-foreground text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
