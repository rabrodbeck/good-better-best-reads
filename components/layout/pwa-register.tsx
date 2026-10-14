"use client";

import * as React from "react";
import { WifiOff, Wifi } from "lucide-react";

export function PwaRegister() {
  const [isOffline, setIsOffline] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    // 1. Register Service Worker in browser environment
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.warn("Service worker registration skipped:", err);
        });

      // Ensure current page HTML is stored in cache for offline refresh (production only to prevent stale dev caching)
      if ("caches" in window && navigator.onLine && process.env.NODE_ENV === "production") {
        const path = window.location.pathname;
        window.caches.open("gbbr-pwa-v8").then((cache) => {
          fetch(path)
            .then((res) => {
              if (res.ok) cache.put(path, res);
            })
            .catch(() => {});
        });
      }
    }

    // 2. Offline / Online Event Listeners
    const handleOffline = () => {
      setIsOffline(true);
      setStatusMessage("You're offline — viewing cached library.");
    };

    const handleOnline = () => {
      setIsOffline(false);
      setStatusMessage("Back online! Reconnecting to shelves...");
      setTimeout(() => setStatusMessage(null), 3500);
    };

    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      window.addEventListener("offline", handleOffline);
      window.addEventListener("online", handleOnline);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("online", handleOnline);
      }
    };
  }, []);

  if (!statusMessage) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-18 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur-md border animate-in fade-in slide-in-from-top-3 duration-200 ${
        isOffline
          ? "bg-amber-950/90 text-amber-200 border-amber-500/40"
          : "bg-emerald-950/90 text-emerald-200 border-emerald-500/40"
      }`}
    >
      {isOffline ? (
        <WifiOff className="size-3.5 text-amber-400 shrink-0" />
      ) : (
        <Wifi className="size-3.5 text-emerald-400 shrink-0" />
      )}
      <span>{statusMessage}</span>
    </div>
  );
}
