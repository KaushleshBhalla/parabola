"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { markNotificationsRead } from "./notifications-actions";

export type NotificationItem = {
  id: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
  href: string | null;
};

export function NotificationsBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const [, startTransition] = useTransition();

  return (
    <Popover
      onOpenChange={(open) => {
        if (open && unreadCount > 0) {
          startTransition(async () => {
            await markNotificationsRead();
          });
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="relative" />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[9px] text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="p-1 text-sm text-muted-foreground">
            No notifications yet.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {notifications.map((n) => {
              const content = (
                <div
                  className={`flex flex-col gap-0.5 rounded-md p-1.5 text-sm ${
                    n.isRead ? "" : "bg-accent"
                  }`}
                >
                  <span>{n.body}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                  </span>
                </div>
              );
              return n.href ? (
                <Link key={n.id} href={n.href}>
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
