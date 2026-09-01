"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { markNotificationsRead, markNotificationRead } from "./notifications-actions";

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
  const [pending, startTransition] = useTransition();

  return (
    <Popover>
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
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-xs font-medium text-muted-foreground">Notifications</span>
          {unreadCount > 0 && (
            <Button
              size="xs"
              variant="ghost"
              disabled={pending}
              onClick={() => startTransition(async () => { await markNotificationsRead(); })}
            >
              Mark all read
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="p-1 text-sm text-muted-foreground">
            No notifications yet.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {notifications.map((n) => {
              const content = (
                <div
                  className={`group flex items-start gap-2 rounded-md p-1.5 text-sm ${
                    n.isRead ? "" : "bg-accent"
                  }`}
                >
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span>{n.body}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                  {!n.isRead && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      title="Mark read"
                      className="shrink-0 opacity-0 group-hover:opacity-100"
                      disabled={pending}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startTransition(async () => { await markNotificationRead(n.id); });
                      }}
                    >
                      <Check className="size-3.5" />
                    </Button>
                  )}
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
