"use client";

import * as React from "react";
import Image from "next/image";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  BookmarkCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  groupBooksBySeries,
  LibraryBookForSeries,
  SeriesGroup,
} from "@/lib/series";

interface SeriesTrackerProps<T extends LibraryBookForSeries> {
  books: T[];
  onStartReading?: (book: T) => void;
  onFilterBySeries?: (seriesName: string) => void;
}

export function SeriesTracker<T extends LibraryBookForSeries>({
  books,
  onStartReading,
}: SeriesTrackerProps<T>) {
  const seriesGroups = React.useMemo(() => {
    return groupBooksBySeries(books);
  }, [books]);

  if (seriesGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-14 text-center border border-dashed border-border/70 rounded-2xl bg-card/30 space-y-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Layers className="size-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">No Series Detected Yet</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          Books with series indicators in their titles (e.g., &ldquo;Title (Series Name, #1)&rdquo;) will automatically be tracked and ordered here!
        </p>
      </div>
    );
  }

  const completedCount = seriesGroups.filter((s) => s.isComplete).length;
  const inProgressCount = seriesGroups.filter(
    (s) => s.readCount > 0 && !s.isComplete
  ).length;

  return (
    <div className="space-y-6">
      {/* Series Summary Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border/60 bg-card/50 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Layers className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Series Progression & Reading Order
            </h3>
            <p className="text-xs text-muted-foreground">
              Tracking {seriesGroups.length} series in your personal catalog.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 gap-1 font-semibold">
            <CheckCircle2 className="size-3" />
            <span>{completedCount} Completed</span>
          </Badge>
          <Badge variant="outline" className="text-xs border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 gap-1 font-semibold">
            <Clock className="size-3" />
            <span>{inProgressCount} In Progress</span>
          </Badge>
        </div>
      </div>

      {/* Series Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {seriesGroups.map((group) => {
          return (
            <Card
              key={group.seriesName}
              className="border-border/60 bg-card/70 backdrop-blur-xs hover:border-primary/40 transition-all flex flex-col justify-between overflow-hidden shadow-xs"
            >
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div>
                  {/* Top Bar: Title & Progress Badge */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 px-2 border-primary/30 text-primary font-semibold"
                        >
                          Series
                        </Badge>
                        {group.isComplete && (
                          <Badge className="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-[10px] py-0 px-1.5 font-bold gap-0.5">
                            <Sparkles className="size-2.5" />
                            <span>Complete</span>
                          </Badge>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-foreground leading-snug line-clamp-1">
                        {group.seriesName}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {group.books[0]?.author}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-foreground">
                        {group.readCount}/{group.totalCount}
                      </span>
                      <span className="text-[11px] text-muted-foreground block font-medium">
                        Read ({group.completionPercentage}%)
                      </span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full h-1.5 rounded-full bg-muted/80 overflow-hidden mb-4">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        group.isComplete
                          ? "bg-emerald-500"
                          : group.completionPercentage > 0
                          ? "bg-primary"
                          : "bg-muted-foreground/30"
                      }`}
                      style={{ width: `${Math.max(group.completionPercentage, 3)}%` }}
                    />
                  </div>

                  {/* Volume Strip */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                      Volumes in Your Library
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {group.books.map((b) => {
                        const isRead = b.shelf === "read";
                        const isReading = b.shelf === "currently-reading";
                        return (
                          <div
                            key={b.id}
                            className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs transition-all ${
                              isReading
                                ? "bg-amber-500/10 border-amber-500/40"
                                : isRead
                                ? "bg-emerald-500/5 border-emerald-500/30"
                                : "bg-muted/30 border-border/50"
                            }`}
                          >
                            {/* Tiny Cover */}
                            <div className="relative aspect-[2/3] w-7 rounded-xs overflow-hidden bg-muted shrink-0 border border-border/40">
                              {b.cover_url ? (
                                <Image
                                  src={b.cover_url}
                                  alt={b.title}
                                  fill
                                  sizes="28px"
                                  unoptimized={b.cover_url.includes("/b/isbn/")}
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-muted text-[8px] font-bold">
                                  #{b.seriesInfo.volume || "?"}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] font-bold text-foreground block truncate">
                                #{b.seriesInfo.volume ?? "—"} {b.seriesInfo.cleanTitle}
                              </span>
                              <span
                                className={`text-[9px] font-semibold ${
                                  isReading
                                    ? "text-amber-700 dark:text-amber-400"
                                    : isRead
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {isReading
                                  ? "Reading Now"
                                  : isRead
                                  ? "Finished"
                                  : "Want to Read"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Next Up Recommendation */}
                {group.nextBookToRead && !group.isComplete && (
                  <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <BookmarkCheck className="size-3 text-primary" />
                        <span>Up Next in Series</span>
                      </span>
                      <p className="text-xs font-bold text-foreground truncate">
                        #{group.nextBookToRead.seriesInfo.volume || "?"} {group.nextBookToRead.seriesInfo.cleanTitle}
                      </p>
                    </div>

                    {group.nextBookToRead.shelf !== "currently-reading" && onStartReading && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onStartReading(group.nextBookToRead as unknown as T)}
                        className="text-xs h-7 px-2.5 gap-1 shrink-0 font-semibold"
                      >
                        <BookOpen className="size-3 text-primary" />
                        <span>Read Next</span>
                        <ArrowRight className="size-3" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
