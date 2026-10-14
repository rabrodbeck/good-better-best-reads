"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Calendar,
  Sparkles,
  Star,
  FileText,
  Flame,
  Trophy,
  Crown,
  Feather,
  ArrowRight,
  TrendingUp,
  Award,
  Layers,
  Heart,
  BookMarked,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReadingGoalWidget } from "@/components/goals/reading-goal-widget";
import { ReadingInsightsData } from "@/lib/insights";

export default function InsightsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = React.useState<number | "all">(currentYear);
  const [insights, setInsights] = React.useState<ReadingInsightsData | null>(null);
  const [availableYears, setAvailableYears] = React.useState<number[]>([currentYear]);
  const [loading, setLoading] = React.useState(true);

  const fetchInsights = React.useCallback(async (yr: number | "all") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/insights?year=${yr}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.insights) {
          setInsights(data.insights);
        }
        if (data?.availableYears?.length) {
          setAvailableYears(data.availableYears);
        }
      }
    } catch (err) {
      console.error("Failed to load insights:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchInsights(selectedYear);
  }, [selectedYear, fetchInsights]);

  const maxMonthlyCount = React.useMemo(() => {
    if (!insights?.monthlyVelocity) return 1;
    return Math.max(1, ...insights.monthlyVelocity.map((m) => m.count));
  }, [insights]);

  const maxGenreCount = React.useMemo(() => {
    if (!insights?.topGenres?.length) return 1;
    return Math.max(1, ...insights.topGenres.map((g) => g.count));
  }, [insights]);

  const getMilestoneIcon = (name: string) => {
    switch (name) {
      case "Trophy":
        return <Trophy className="size-5 text-amber-500" />;
      case "Crown":
        return <Crown className="size-5 text-amber-500" />;
      case "Flame":
        return <Flame className="size-5 text-rose-500" />;
      case "Sparkles":
        return <Sparkles className="size-5 text-primary" />;
      default:
        return <Feather className="size-5 text-emerald-500" />;
    }
  };

  return (
    <div className="container mx-auto flex max-w-6xl flex-col px-3.5 sm:px-6 py-6 sm:py-10 pb-28 sm:pb-16 space-y-8">
      {/* Header & Year Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="border-primary/40 text-primary text-xs gap-1">
              <BarChart3 className="size-3" />
              Reading Insights
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {selectedYear === "all" ? "All-Time Analytics" : `${selectedYear} Retrospective`}
            </Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
            Reading Analytics & Velocity
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Explore your reading velocity, volume milestones, rating distributions, and literary habits over time.
          </p>
        </div>

        {/* Year Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 bg-card/40 p-1.5 rounded-xl border border-border/50">
          {availableYears.map((yr) => (
            <button
              key={yr}
              onClick={() => setSelectedYear(yr)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedYear === yr
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              {yr}
            </button>
          ))}
          <button
            onClick={() => setSelectedYear("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedYear === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Annual Challenge Widget (shown if a specific year is selected) */}
      {selectedYear !== "all" && (
        <ReadingGoalWidget
          year={selectedYear}
          onGoalUpdated={() => fetchInsights(selectedYear)}
        />
      )}

      {/* Top 4 KPI Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Books Read */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-xs">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Books Finished</span>
              <BookOpen className="size-4 text-primary" />
            </div>
            <div>
              <span className="text-3xl font-black text-foreground block">
                {insights?.totalBooks ?? 0}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {selectedYear === "all" ? "Across all tracked years" : `Read during ${selectedYear}`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Pages Read */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-xs">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Pages Consumed</span>
              <FileText className="size-4 text-emerald-500" />
            </div>
            <div>
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 block">
                {(insights?.totalPages || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Avg {insights?.avgPagesPerBook ?? 0} pages/book
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Average Rating */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-xs">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Average Rating</span>
              <Star className="size-4 text-amber-500 fill-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-3xl font-black text-amber-600 dark:text-amber-400">
                  {insights?.ratings.averageRating ? `${insights.ratings.averageRating}★` : "N/A"}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {insights?.ratings.generosityRate ?? 0}% rated 4 or 5 stars
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Velocity Pace */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-xs">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-medium">Reading Velocity</span>
              <TrendingUp className="size-4 text-blue-500" />
            </div>
            <div>
              <span className="text-3xl font-black text-blue-600 dark:text-blue-400 block">
                ~{insights?.booksPerMonthAvg ?? 0}
              </span>
              <span className="text-[11px] text-muted-foreground">Books finished / month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Literary Milestone Banner */}
      {insights && insights.totalPages > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/20 text-primary shrink-0 shadow-xs">
              {getMilestoneIcon(insights.milestone.iconName)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Literary Milestone
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  ({insights.totalPages.toLocaleString()} pages)
                </span>
              </div>
              <p className="text-sm sm:text-base font-semibold text-foreground mt-0.5">
                {insights.milestone.comparisonText}
              </p>
            </div>
          </div>
          <Link href="/library" className="shrink-0 self-start sm:self-center">
            <Button size="sm" variant="outline" className="text-xs gap-1.5 font-semibold">
              <BookMarked className="size-3.5" />
              <span>Browse Catalog</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Main Insights Grid: Monthly Velocity & Rating Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Velocity Bar Chart (2 cols) */}
        <Card className="lg:col-span-2 border-border/60 bg-card/60 backdrop-blur-xs flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Calendar className="size-4 text-primary" />
                  <span>Monthly Reading Velocity</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Books finished month by month {selectedYear !== "all" ? `in ${selectedYear}` : "over time"}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                Peak: {maxMonthlyCount} book{maxMonthlyCount > 1 ? "s" : ""}/mo
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 pb-4">
            <div className="grid grid-cols-12 gap-1 sm:gap-2 items-end h-48 sm:h-56 pt-6">
              {(insights?.monthlyVelocity || []).map((m) => {
                const heightPercent = maxMonthlyCount > 0 ? (m.count / maxMonthlyCount) * 100 : 0;
                const hasBooks = m.count > 0;

                return (
                  <div key={m.month} className="flex flex-col items-center h-full justify-end group">
                    {/* Count Pill */}
                    <span
                      className={`text-[10px] font-mono font-bold mb-1.5 transition-opacity ${
                        hasBooks
                          ? "text-foreground opacity-90"
                          : "text-muted-foreground/30 opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {m.count}
                    </span>

                    {/* Bar */}
                    <div className="w-full max-w-[28px] bg-muted/40 rounded-t-md h-full flex items-end overflow-hidden p-0.5">
                      <div
                        className={`w-full rounded-t-sm transition-all duration-300 ${
                          hasBooks
                            ? "bg-gradient-to-t from-primary to-primary/80 group-hover:from-primary/90 group-hover:to-primary"
                            : "bg-transparent"
                        }`}
                        style={{ height: `${Math.max(hasBooks ? 8 : 0, heightPercent)}%` }}
                        title={`${m.month}: ${m.count} books (${m.pages.toLocaleString()} pages)`}
                      />
                    </div>

                    {/* Month Label */}
                    <span className="text-[10px] font-medium text-muted-foreground mt-2">
                      {m.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Rating Distribution (1 col) */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-xs flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Star className="size-4 text-amber-500 fill-amber-500" />
              <span>Rating Breakdown</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              How you score books on your reading journey
            </p>
          </CardHeader>
          <CardContent className="space-y-3 pb-6">
            {[5, 4, 3, 2, 1].map((starVal) => {
              const count =
                starVal === 5
                  ? insights?.ratings.stars5 ?? 0
                  : starVal === 4
                  ? insights?.ratings.stars4 ?? 0
                  : starVal === 3
                  ? insights?.ratings.stars3 ?? 0
                  : starVal === 2
                  ? insights?.ratings.stars2 ?? 0
                  : insights?.ratings.stars1 ?? 0;

              const totalRated = insights?.ratings.totalRated || 1;
              const percent = Math.round((count / totalRated) * 100);

              return (
                <div key={starVal} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <span>{starVal}</span>
                      <Star className="size-3 fill-amber-500 text-amber-500" />
                    </span>
                    <span className="font-mono text-muted-foreground text-[11px]">
                      {count} <span className="text-[10px]">({percent}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Generosity Index Callout */}
            <div className="pt-3 border-t border-border/40 mt-4 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Loved Books (4-5★):</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                {insights?.ratings.generosityRate ?? 0}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Genres & Top Authors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Genres */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Layers className="size-4 text-purple-500" />
              <span>Top Genres & Themes</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">Most frequent categories in your collection</p>
          </CardHeader>
          <CardContent className="space-y-3 pb-6">
            {!insights?.topGenres?.length ? (
              <p className="text-xs text-muted-foreground italic py-4 text-center">
                No genre data available yet.
              </p>
            ) : (
              insights.topGenres.slice(0, 7).map((g) => {
                const widthPercent = (g.count / maxGenreCount) * 100;
                return (
                  <div key={g.genre} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground truncate max-w-[200px]">
                        {g.genre}
                      </span>
                      <span className="font-mono text-muted-foreground text-[11px]">
                        {g.count} book{g.count > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Top Authors */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Award className="size-4 text-amber-500" />
              <span>Most Read Authors</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">Writers you returned to most frequently</p>
          </CardHeader>
          <CardContent className="space-y-2.5 pb-6">
            {!insights?.topAuthors?.length ? (
              <p className="text-xs text-muted-foreground italic py-4 text-center">
                No author data available yet.
              </p>
            ) : (
              insights.topAuthors.slice(0, 6).map((author, idx) => (
                <div
                  key={author.author}
                  className="flex items-center justify-between p-2 rounded-xl bg-card/40 border border-border/40 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-foreground truncate">
                      {author.author}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {author.count} book{author.count > 1 ? "s" : ""}
                    </span>
                    {author.avgRating && (
                      <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-bold text-xs font-mono">
                        <Star className="size-3 fill-amber-500 text-amber-500" />
                        {author.avgRating}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Book Extremes: Shortest & Longest Reads */}
      {(insights?.shortestBook || insights?.longestBook) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {insights?.shortestBook && (
            <Card className="border-border/60 bg-card/60 backdrop-blur-xs p-4 flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Feather className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400">
                  Briskest Read
                </span>
                <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                  {insights.shortestBook.title}
                </h4>
                <p className="text-[11px] text-muted-foreground truncate">
                  {insights.shortestBook.author} • {insights.shortestBook.pages} pages
                </p>
              </div>
            </Card>
          )}

          {insights?.longestBook && (
            <Card className="border-border/60 bg-card/60 backdrop-blur-xs p-4 flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <Crown className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-400">
                  Longest Epic
                </span>
                <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                  {insights.longestBook.title}
                </h4>
                <p className="text-[11px] text-muted-foreground truncate">
                  {insights.longestBook.author} • {insights.longestBook.pages} pages
                </p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
