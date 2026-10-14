"use client";

import * as React from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Compass,
  AlertCircle,
  Search,
  BookOpen,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LibrarianVerdictOutput } from "@/types/librarian-verdict";

export interface LibrarianVerdictCardProps {
  book: {
    title: string;
    author: string;
    isbn?: string | null;
    published_year?: number | null;
    genres?: string[];
    snippet?: string | null;
  };
  onFindBook1?: (book1Title: string) => void;
  className?: string;
}

export function LibrarianVerdictCard({
  book,
  onFindBook1,
  className = "",
}: LibrarianVerdictCardProps) {
  const [verdict, setVerdict] = React.useState<LibrarianVerdictOutput | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset state if the book title changes
  React.useEffect(() => {
    setVerdict(null);
    setError(null);
    setIsLoading(false);
  }, [book.title, book.author, book.isbn]);

  const handleFetchVerdict = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the book card when clicking the verdict trigger
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/books/librarian-verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: book.title,
          author: book.author,
          isbn: book.isbn || null,
          publishedYear: book.published_year || null,
          description: book.snippet || null,
          genres: book.genres || [],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to analyze book taste match");
      }

      const data: LibrarianVerdictOutput = await res.json();
      setVerdict(data);
    } catch (err: unknown) {
      console.error("Librarian verdict error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not consult the Librarian right now."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Initial on-demand trigger state
  if (!verdict && !isLoading && !error) {
    return (
      <div className={`mt-3 ${className}`}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleFetchVerdict}
          className="h-8 sm:h-9 text-xs sm:text-sm font-medium border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/40 transition-all gap-2 shadow-none px-3 sm:px-4"
        >
          <Sparkles className="size-3.5 sm:size-4 text-primary animate-pulse" />
          <span>Ask Librarian: Will I like this?</span>
        </Button>
      </div>
    );
  }

  // 2. Loading shimmer state
  if (isLoading) {
    return (
      <div
        className={`mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3.5 animate-pulse text-left ${className}`}
      >
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary shrink-0">
          <Loader2 className="size-4 animate-spin" />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-foreground">
            Consulting your Reading DNA...
          </p>
          <p className="text-xs text-muted-foreground">
            Evaluating pacing, tone, and series order against your shelves
          </p>
        </div>
      </div>
    );
  }

  // 3. Error state with retry
  if (error) {
    return (
      <div
        className={`mt-3 rounded-xl border border-destructive/25 bg-destructive/5 p-3.5 flex items-center justify-between gap-3 text-left ${className}`}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4.5 text-destructive shrink-0" />
          <p className="text-xs sm:text-sm text-destructive">{error}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleFetchVerdict}
          className="h-7 text-xs px-2.5 text-destructive hover:bg-destructive/10"
        >
          <RefreshCw className="size-3.5 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (!verdict) return null;

  // 4. Loaded Verdict Card with Dual Badges
  const isStrongMatch = verdict.verdict === "strong_match";
  const isCaution = verdict.verdict === "caution";

  const cardStyle = isStrongMatch
    ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10"
    : isCaution
    ? "border-amber-500/35 bg-amber-500/5 dark:bg-amber-500/10"
    : "border-border/60 bg-muted/40";

  const isSequel =
    verdict.seriesInfo?.isSeries &&
    verdict.seriesInfo?.volumeNumber &&
    verdict.seriesInfo.volumeNumber > 1;

  const showFindBook1 =
    isSequel &&
    verdict.seriesInfo?.firstBookTitle &&
    !verdict.seriesInfo.userAlreadyReadPriorBook &&
    Boolean(onFindBook1);

  return (
    <div
      className={`mt-3 rounded-xl border p-4 sm:p-5 transition-all text-left shadow-xs ${cardStyle} ${className}`}
    >
      {/* Header Row: Dual Badges */}
      <div className="flex flex-wrap items-center gap-2.5 justify-between">
        <div className="flex items-center gap-2">
          {isStrongMatch ? (
            <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/20 text-xs sm:text-sm font-semibold gap-1.5 px-3 py-1">
              <CheckCircle2 className="size-3.5 sm:size-4" />
              <span>{verdict.badgeLabel}</span>
            </Badge>
          ) : isCaution ? (
            <Badge className="bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-600/20 text-xs sm:text-sm font-semibold gap-1.5 px-3 py-1">
              <AlertTriangle className="size-3.5 sm:size-4" />
              <span>{verdict.badgeLabel}</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground border-border text-xs sm:text-sm font-semibold gap-1.5 px-3 py-1">
              <Compass className="size-3.5 sm:size-4" />
              <span>{verdict.badgeLabel}</span>
            </Badge>
          )}
        </div>

        {/* Series Context Tag */}
        {isSequel && (
          <div>
            {verdict.seriesInfo?.userAlreadyReadPriorBook ? (
              <Badge
                variant="outline"
                className="text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-400 gap-1.5 px-2.5 py-0.5"
              >
                <BookOpen className="size-3" />
                <span>Book #{verdict.seriesInfo.volumeNumber} (Prior volume read ✓)</span>
              </Badge>
            ) : (
              <Badge
                className="text-xs bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300 gap-1.5 px-2.5 py-0.5"
              >
                <AlertCircle className="size-3" />
                <span>Book #{verdict.seriesInfo?.volumeNumber} in Series</span>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Rationale: Clear, readable text */}
      <p className="text-sm sm:text-[15px] text-foreground leading-relaxed mt-3.5 font-normal">
        {verdict.rationale}
      </p>

      {/* Dealbreakers Tagging if any detected */}
      {verdict.dealbreakersDetected && verdict.dealbreakersDetected.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            Friction flags:
          </span>
          {verdict.dealbreakersDetected.map((db, idx) => (
            <span
              key={idx}
              className="text-xs px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/25 text-amber-800 dark:text-amber-300 font-medium"
            >
              {db}
            </span>
          ))}
        </div>
      )}

      {/* Actionable Sequel Helper */}
      {showFindBook1 && (
        <div className="mt-3.5 pt-3 border-t border-border/40 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Don&apos;t start mid-series:
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              onFindBook1?.(verdict.seriesInfo!.firstBookTitle!);
            }}
            className="h-7 text-xs px-3 bg-background border border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10 gap-1.5 shadow-none"
          >
            <Search className="size-3.5" />
            <span>Find Book 1: {verdict.seriesInfo!.firstBookTitle}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
