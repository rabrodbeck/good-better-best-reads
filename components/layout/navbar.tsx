"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, Sparkles, Dna, UploadCloud, Users, Plus, Check, BarChart3 } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { AuthButton } from "./auth-button";
import { Button } from "@/components/ui/button";
import { AddBookModal, AddedBookItem } from "@/components/library/add-book-modal";

export function Navbar() {
  const [pendingCount, setPendingCount] = React.useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const handleBookAdded = (book: AddedBookItem) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("book-added", { detail: book }));
    }
    const shelfLabels: Record<string, string> = {
      "to-read": "Want to Read",
      "currently-reading": "Currently Reading",
      read: "Read",
      "did-not-finish": "Did Not Finish",
    };
    setToastMessage(`Added "${book.title}" to ${shelfLabels[book.shelf] || "your library"}!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

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
            href="/insights"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <BarChart3 className="size-4 text-purple-500" />
            Insights
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
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="gap-1.5 hidden sm:inline-flex bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
          >
            <Plus className="size-4" />
            <span>Add Book</span>
          </Button>

          <Button
            size="icon"
            variant="outline"
            onClick={() => setIsAddModalOpen(true)}
            className="size-9 rounded-xl sm:hidden border-primary/40 text-primary hover:bg-primary/10"
            aria-label="Add book"
          >
            <Plus className="size-5" />
          </Button>

          <Link href="/import" className="hidden lg:inline-flex">
            <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground hover:text-foreground">
              <UploadCloud className="size-4" />
              <span>Import</span>
            </Button>
          </Link>

          <AuthButton />
          <ThemeToggle />
        </div>
      </div>

      {/* Global Add Book Modal */}
      <AddBookModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onBookAdded={handleBookAdded}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2.5 rounded-xl border border-primary/30 bg-card/95 px-4 py-3 text-xs font-semibold text-foreground shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          <div className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Check className="size-3" />
          </div>
          <span>{toastMessage}</span>
          <Link
            href="/library"
            className="ml-2 underline text-primary hover:text-primary/80 font-bold"
          >
            View Shelves
          </Link>
        </div>
      )}
    </header>
  );
}
