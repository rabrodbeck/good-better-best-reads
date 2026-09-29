"use client";

import Link from "next/link";
import { BookOpen, Sparkles, Dna, UploadCloud } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function Navbar() {
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
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <Link href="/import">
            <Button size="sm" className="gap-1.5">
              <UploadCloud className="size-4" />
              <span>Import CSV</span>
            </Button>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
