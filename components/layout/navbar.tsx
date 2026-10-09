"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, Sparkles, Dna, UploadCloud, Users } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { AuthButton } from "./auth-button";
import { Button } from "@/components/ui/button";

export function Navbar() {
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
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            <BookOpen className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold tracking-tight text-foreground leading-none">
              Good<span className="text-primary font-black">Better</span>Best
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Reads
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link
            href="/chat"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Sparkles className="size-4 text-primary" />
            Librarian
          </Link>
          <Link
            href="/dna"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Dna className="size-4 text-emerald-500" />
            Reading DNA
          </Link>
          <Link
            href="/library"
            className="transition-colors hover:text-foreground"
          >
            My Shelves
          </Link>
          <Link
            href="/friends"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Users className="size-4 text-blue-400" />
            <span>Friends</span>
            {pendingCount > 0 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {pendingCount}
              </span>
            )}
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Link href="/import" className="hidden sm:inline-flex">
            <Button size="sm" className="gap-1.5">
              <UploadCloud className="size-4" />
              <span>Import CSV</span>
            </Button>
          </Link>
          <AuthButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
