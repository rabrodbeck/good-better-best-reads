"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Trash2,
  Users,
  Trophy,
  BarChart3,
  Coffee,
  Info,
  Check,
  X,
  BellOff,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationType } from "@/types/database";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any> | null;
  read: boolean;
  created_at: string;
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "friend_recommendation":
      return <Users className="size-4 text-blue-500" />;
    case "goal_milestone":
      return <Trophy className="size-4 text-amber-500" />;
    case "monthly_recap":
      return <BarChart3 className="size-4 text-purple-500" />;
    case "weekend_nudge":
      return <Coffee className="size-4 text-rose-500" />;
    default:
      return <Info className="size-4 text-primary" />;
  }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Non-fatal if offline or unauthenticated
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();

    // Periodic polling every 45s
    const interval = setInterval(fetchNotifications, 45_000);

    // Refresh when tab gains focus
    const handleFocus = () => fetchNotifications();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchNotifications]);

  // Click outside listener to close popover
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
    } catch (err) {
      console.error("Failed to mark all notifications read:", err);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notif.id }),
      }).catch(() => {});
    }

    setIsOpen(false);

    if (notif.data?.url) {
      router.push(notif.data.url);
    }
  };

  const handleDismiss = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const target = notifications.find((n) => n.id === id);
    if (target && !target.read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
      await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const handleClearAll = async () => {
    setNotifications([]);
    setUnreadCount(0);
    try {
      await fetch("/api/notifications?clearAll=true", {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to clear all notifications:", err);
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Bell Trigger Button */}
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative size-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        aria-label="View notifications"
        aria-expanded={isOpen}
      >
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 h-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white shadow-xs animate-in zoom-in-75">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Notification Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-border/60 bg-card/95 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-md bg-primary/15 text-primary text-[11px] font-bold px-1.5 py-0.5">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                  className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <CheckCheck className="size-3.5 text-primary" />
                  <span className="hidden sm:inline">Mark read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  title="Clear all notifications"
                  className="p-1 text-muted-foreground hover:text-rose-500 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/30">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-2">
                  <BellOff className="size-5" />
                </div>
                <p className="text-xs font-semibold text-foreground">You&apos;re all caught up!</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  No new reading alerts or friend recommendations.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`group relative flex items-start gap-3 p-3.5 text-left transition-colors cursor-pointer ${
                    item.read
                      ? "hover:bg-muted/40 opacity-80"
                      : "bg-primary/5 hover:bg-primary/10"
                  }`}
                >
                  {/* Icon */}
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted/60 border border-border/40">
                    {getNotificationIcon(item.type)}
                  </div>

                  {/* Body text */}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs font-semibold truncate ${item.read ? "text-foreground" : "text-primary"}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                      {item.body}
                    </p>
                  </div>

                  {/* Actions & Unread Indicator */}
                  <div className="flex items-center gap-1.5 shrink-0 self-center">
                    {!item.read && (
                      <span className="size-2 rounded-full bg-primary shrink-0" />
                    )}
                    <button
                      onClick={(e) => handleDismiss(e, item.id)}
                      title="Dismiss notification"
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-1 transition-opacity"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer linking to notification settings in profile */}
          <div className="border-t border-border/40 bg-muted/10 p-2 text-center">
            <Link
              href="/profile#notifications"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              <span>Notification Settings</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
