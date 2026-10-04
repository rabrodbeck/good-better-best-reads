"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LogOut,
  User as UserIcon,
  BookOpen,
  Sparkles,
  Dna,
  UploadCloud,
  ChevronDown,
} from "lucide-react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AuthButton() {
  const router = useRouter();
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const supabase = React.useMemo(() => createClient(), []);

  React.useEffect(() => {
    // 1. Fetch initial user session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // 2. Subscribe to auth changes (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Click outside listener for the dropdown menu
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const handleSignIn = async () => {
    try {
      const origin = window.location.origin;
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(
        window.location.pathname
      )}`;

      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });
    } catch (err) {
      console.error("Sign in failed:", err);
    }
  };

  const handleSignOut = async () => {
    try {
      setMenuOpen(false);
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="size-8 rounded-full bg-muted/60 animate-pulse border border-border/40" />
    );
  }

  if (!user) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleSignIn}
        className="gap-2 font-medium hover:border-primary/50 text-xs"
      >
        <GoogleIcon className="size-3.5" />
        <span>Sign in</span>
      </Button>
    );
  }

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Reader";
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-1.5 p-1 rounded-full hover:ring-2 hover:ring-primary/30 transition-all focus:outline-hidden"
        aria-label="User menu"
      >
        <Avatar className="size-8 border border-border/60 shadow-2xs">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
            {initial}
          </AvatarFallback>
        </Avatar>
        <ChevronDown className="size-3 text-muted-foreground hidden sm:inline" />
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border/60 bg-card/95 p-1.5 shadow-lg backdrop-blur-md z-50 animate-in fade-in-0 zoom-in-95 duration-100">
          {/* User Info Header */}
          <div className="px-3 py-2 border-b border-border/40 mb-1">
            <p className="text-xs font-semibold text-foreground truncate">
              {displayName}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {user.email}
            </p>
          </div>

          {/* Navigation Links */}
          <div className="space-y-0.5">
            <Link
              href="/library"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-muted/80 transition-colors"
            >
              <BookOpen className="size-4 text-primary" />
              <span>My Shelves</span>
            </Link>

            <Link
              href="/dna"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-muted/80 transition-colors"
            >
              <Dna className="size-4 text-emerald-500" />
              <span>Reading DNA</span>
            </Link>

            <Link
              href="/chat"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-muted/80 transition-colors"
            >
              <Sparkles className="size-4 text-amber-500" />
              <span>Personal Librarian</span>
            </Link>

            <Link
              href="/import"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-muted/80 transition-colors"
            >
              <UploadCloud className="size-4 text-blue-500" />
              <span>Import Books</span>
            </Link>
          </div>

          <div className="my-1 border-t border-border/40" />

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="size-4" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
