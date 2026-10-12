"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookMarked, Users, Sparkles, Dna } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = React.useState(0);

  React.useEffect(() => {
    fetch("/api/friends")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.pendingIncoming?.length) {
          setPendingCount(data.pendingIncoming.length);
        }
      })
      .catch(() => {});
  }, [pathname]);

  const navItems = [
    {
      href: "/library",
      label: "Shelves",
      icon: BookMarked,
      isActive: pathname.startsWith("/library"),
    },
    {
      href: "/friends",
      label: "Friends",
      icon: Users,
      isActive: pathname.startsWith("/friends"),
      badge: pendingCount,
    },
    {
      href: "/chat",
      label: "Librarian",
      icon: Sparkles,
      isActive: pathname.startsWith("/chat"),
    },
    {
      href: "/dna",
      label: "DNA",
      icon: Dna,
      isActive: pathname.startsWith("/dna"),
    },
    {
      href: "/",
      label: "Home",
      icon: Home,
      isActive: pathname === "/",
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-50 block md:hidden border-t border-border/50 bg-background/90 backdrop-blur-xl shadow-lg transition-all supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid h-16 grid-cols-5 items-center px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1.5 transition-colors relative group select-none ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <Icon
                  className={`size-5 transition-transform duration-150 ${
                    active ? "scale-110 stroke-[2.4]" : "stroke-[1.8]"
                  }`}
                />
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="absolute -top-1 -right-2.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-xs animate-in zoom-in-75">
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] tracking-tight mt-1 transition-all leading-none ${
                  active ? "font-bold text-foreground" : "font-medium"
                }`}
              >
                {item.label}
              </span>

              {/* Active pill indicator at top */}
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
