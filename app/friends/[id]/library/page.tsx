"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  ImageOff,
  Search,
  Star,
  Sparkles,
  ArrowUpDown,
  BookMarked,
  ArrowLeft,
  Lock,
  Layers,
  ChevronDown,
  Send,
  Heart,
  Zap,
  BookmarkCheck,
  Share2,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  RecommendBookModal,
  BookToRecommend,
} from "@/components/friends/recommend-book-modal";
import { parseSeriesInfo } from "@/lib/series";
import { shareBook } from "@/lib/share";

interface BookItem {
  id: string;
  book_id: string;
  title: string;
  author: string;
  isbn: string | null;
  isbn13: string | null;
  cover_url: string | null;
  page_count: number | null;
  published_year: number | null;
  shelf: "read" | "currently-reading" | "to-read" | "did-not-finish";
  rating: number | null;
  date_read: string | null;
  user_review: string | null;
  user_shelves: string[];
}

interface OwnerProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  taste_archetype: string | null;
}

interface LibraryStats {
  total: number;
  read: number;
  currentlyReading: number;
  toRead: number;
  dnf: number;
  fiveStarCount: number;
  fourStarCount: number;
  avgRating: string | null;
}

type ShelfFilter =
  | "all"
  | "read"
  | "to-read"
  | "currently-reading"
  | "did-not-finish"
  | "both-loved"
  | "on-my-want-to-read"
  | "contrasts";

type SortOption = "rating-desc" | "title-asc" | "author-asc" | "date-read-desc";

function FriendBookCover({
  coverUrl,
  title,
  author,
  priority,
}: {
  coverUrl?: string | null;
  title: string;
  author: string;
  priority?: boolean;
}) {
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [coverUrl]);

  // If coverUrl is an Open Library medium image, upgrade to large for retina display
  const optimizedCoverUrl = React.useMemo(() => {
    if (!coverUrl) return null;
    return coverUrl.replace(/-M\.jpg(\?.*)?$/, "-L.jpg$1");
  }, [coverUrl]);

  // Speculative ISBN fallbacks bypass Next.js image proxy to prevent 404 upstream error logs
  const isSpeculativeIsbn = optimizedCoverUrl?.includes("/b/isbn/") ?? false;

  if (optimizedCoverUrl && !imgError) {
    return (
      <Image
        src={optimizedCoverUrl}
        alt={`Cover of ${title}`}
        fill
        priority={priority}
        className="object-cover transition-transform group-hover:scale-105 duration-200"
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
        unoptimized={isSpeculativeIsbn}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className="relative p-3 text-center flex flex-col items-center justify-between h-full w-full bg-gradient-to-br from-card via-muted/50 to-card/90 select-none overflow-hidden border border-border/30">
      {/* Subtle book spine indicator */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-r from-border/80 via-primary/30 to-transparent pointer-events-none" />

      {/* Top Header */}
      <div className="w-full flex items-center justify-center pt-1.5">
        <span className="text-[9px] font-mono tracking-widest text-muted-foreground/60 uppercase">
          GoodBetterBest
        </span>
      </div>

      {/* Book Title & Author in Center */}
      <div className="my-auto px-1">
        <span className="text-xs font-bold text-foreground line-clamp-3 leading-snug tracking-tight">
          {title}
        </span>
        <div className="w-6 h-px bg-primary/40 mx-auto my-2" />
        <span className="text-[10px] text-muted-foreground line-clamp-1 font-medium">
          {author}
        </span>
      </div>

      {/* Bottom Footer Accent */}
      <div className="w-full pb-1 flex items-center justify-center">
        <ImageOff className="size-3 text-muted-foreground/40" />
      </div>
    </div>
  );
}

export default function FriendLibraryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const friendId = params?.id;

  const [books, setBooks] = React.useState<BookItem[]>([]);
  const [stats, setStats] = React.useState<LibraryStats | null>(null);
  const [owner, setOwner] = React.useState<OwnerProfile | null>(null);
  const [viewerBooksMap, setViewerBooksMap] = React.useState<Record<string, { shelf: string; rating: number | null }> | null>(null);
  const [tasteMatchPercentage, setTasteMatchPercentage] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Recommendations modal state
  const [recommendBook, setRecommendBook] = React.useState<BookToRecommend | null>(null);
  const [isRecommendModalOpen, setIsRecommendModalOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Filters
  const [search, setSearch] = React.useState("");
  const [activeShelf, setActiveShelf] = React.useState<ShelfFilter>("all");
  const [sortBy, setSortBy] = React.useState<SortOption>("rating-desc");

  React.useEffect(() => {
    if (!friendId) return;

    fetch(`/api/library?user=${friendId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load friend library");
        }
        return data;
      })
      .then((data) => {
        setBooks(data.books || []);
        setStats(data.stats || null);
        setOwner(data.owner || null);
        setViewerBooksMap(data.viewerBooksMap || null);
        setTasteMatchPercentage(data.tasteMatchPercentage ?? null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Access restricted");
      })
      .finally(() => setLoading(false));
  }, [friendId]);

  // Compute counts for smart overlap filter tabs
  const overlapCounts = React.useMemo(() => {
    if (!viewerBooksMap) return { bothLoved: 0, onMyWantToRead: 0, contrasts: 0 };
    let bothLoved = 0;
    let onMyWantToRead = 0;
    let contrasts = 0;

    for (const b of books) {
      const vb = viewerBooksMap[b.book_id];
      if (!vb) continue;

      if (
        typeof b.rating === "number" &&
        b.rating >= 4 &&
        typeof vb.rating === "number" &&
        vb.rating >= 4
      ) {
        bothLoved++;
      }
      if (vb.shelf === "to-read") {
        onMyWantToRead++;
      }
      if (
        typeof b.rating === "number" &&
        typeof vb.rating === "number" &&
        Math.abs(b.rating - vb.rating) >= 2
      ) {
        contrasts++;
      }
    }
    return { bothLoved, onMyWantToRead, contrasts };
  }, [books, viewerBooksMap]);

  const filteredBooks = React.useMemo(() => {
    return books
      .filter((b) => {
        if (activeShelf === "both-loved") {
          const vb = viewerBooksMap?.[b.book_id];
          return Boolean(
            typeof b.rating === "number" &&
            b.rating >= 4 &&
            typeof vb?.rating === "number" &&
            vb.rating >= 4
          );
        }
        if (activeShelf === "on-my-want-to-read") {
          const vb = viewerBooksMap?.[b.book_id];
          return vb?.shelf === "to-read";
        }
        if (activeShelf === "contrasts") {
          const vb = viewerBooksMap?.[b.book_id];
          return Boolean(
            typeof b.rating === "number" &&
            typeof vb?.rating === "number" &&
            Math.abs(b.rating - vb.rating) >= 2
          );
        }
        if (activeShelf !== "all" && b.shelf !== activeShelf) return false;
        if (search) {
          const q = search.toLowerCase();
          return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "rating-desc":
            return (b.rating || 0) - (a.rating || 0);
          case "title-asc":
            return a.title.localeCompare(b.title);
          case "author-asc":
            return a.author.localeCompare(b.author);
          case "date-read-desc":
            return new Date(b.date_read || 0).getTime() - new Date(a.date_read || 0).getTime();
          default:
            return 0;
        }
      });
  }, [books, activeShelf, search, sortBy, viewerBooksMap]);

  if (loading) {
    return (
      <div className="container mx-auto flex flex-col items-center justify-center py-28 text-muted-foreground">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
        <span className="text-xs">Loading friend&apos;s shelves...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-20 text-center">
        <Card className="border-border/60 bg-card/60 backdrop-blur-md p-8">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mx-auto mb-4">
            <Lock className="size-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Private Shelves</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {error}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => router.push("/friends")} variant="outline" className="gap-2 text-xs">
              <ArrowLeft className="size-3.5" />
              <span>Back to Friends</span>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const friendName = owner?.display_name || "Friend";

  return (
    <div className="container mx-auto max-w-7xl px-3.5 sm:px-6 py-5 sm:py-12 pb-28 sm:pb-12">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <Link
            href="/friends"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Reading Buddies</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="relative size-12 rounded-full overflow-hidden bg-primary/10 text-primary font-bold flex items-center justify-center text-base border border-border/60 shrink-0">
              {owner?.avatar_url ? (
                <Image src={owner.avatar_url} alt={friendName} fill sizes="48px" className="object-cover" />
              ) : (
                <span>{friendName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                  {friendName}&apos;s Shelves
                </h1>
                {tasteMatchPercentage !== null && (
                  <Badge className="bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 gap-1 font-bold text-[11px] py-0.5 px-2">
                    <Sparkles className="size-3 text-amber-600 dark:text-amber-400" />
                    <span>{tasteMatchPercentage}% Taste Match</span>
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/30 bg-blue-50/60 dark:bg-transparent">
                  Friends-Only
                </Badge>
              </div>
              {owner?.taste_archetype && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reading Archetype: <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{owner.taste_archetype}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <Link href={`/friends/${friendId}/compare`}>
          <Button className="gap-2 font-semibold shadow-sm shrink-0">
            <Sparkles className="size-4 text-amber-300" />
            <span>Compare Tastes with {friendName}</span>
          </Button>
        </Link>
      </div>

      {/* Stats Quick Ribbon */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <Card className="border-border/60 bg-card/60 p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Total Books
            </span>
            <span className="text-2xl font-black text-foreground">{stats.total}</span>
          </Card>
          <Card className="border-border/60 bg-card/60 p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Completed
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.read}</span>
          </Card>
          <Card className="border-border/60 bg-card/60 p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Currently Reading
            </span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.currentlyReading}</span>
          </Card>
          <Card className="border-border/60 bg-card/60 p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Avg Rating
            </span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {stats.avgRating ? `${stats.avgRating}★` : "—"}
            </span>
          </Card>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Shelf & Overlap Filter Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Core Shelves */}
          {[
            { id: "all", label: "All Books" },
            { id: "read", label: "Read" },
            { id: "currently-reading", label: "Reading Now" },
            { id: "to-read", label: "Want to Read" },
            { id: "did-not-finish", label: "DNF" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveShelf(tab.id as ShelfFilter)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors border ${
                activeShelf === tab.id
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-background text-muted-foreground border-border/70 hover:text-foreground hover:bg-muted/60"
              }`}
            >
              {tab.label}
            </button>
          ))}

          {/* Smart Overlap Filters (Issue #37) */}
          <div className="hidden sm:block w-px h-5 bg-border/60 mx-1" />

          <button
            onClick={() => setActiveShelf("both-loved")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors border ${
              activeShelf === "both-loved"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30 dark:hover:bg-emerald-900/50"
            }`}
          >
            <Heart className="size-3" />
            <span>Both Loved</span>
            {overlapCounts.bothLoved > 0 && (
              <span className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeShelf === "both-loved"
                  ? "bg-emerald-700 text-white"
                  : "bg-emerald-200/90 text-emerald-900 dark:bg-emerald-500/30 dark:text-emerald-200"
              }`}>
                {overlapCounts.bothLoved}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveShelf("on-my-want-to-read")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors border ${
              activeShelf === "on-my-want-to-read"
                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                : "bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500/30 dark:hover:bg-blue-900/50"
            }`}
          >
            <BookmarkCheck className="size-3" />
            <span>On Your Want to Read</span>
            {overlapCounts.onMyWantToRead > 0 && (
              <span className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeShelf === "on-my-want-to-read"
                  ? "bg-blue-700 text-white"
                  : "bg-blue-200/90 text-blue-900 dark:bg-blue-500/30 dark:text-blue-200"
              }`}>
                {overlapCounts.onMyWantToRead}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveShelf("contrasts")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors border ${
              activeShelf === "contrasts"
                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/30 dark:hover:bg-amber-900/50"
            }`}
          >
            <Zap className="size-3" />
            <span>Rating Contrasts</span>
            {overlapCounts.contrasts > 0 && (
              <span className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                activeShelf === "contrasts"
                  ? "bg-amber-700 text-white"
                  : "bg-amber-200/90 text-amber-900 dark:bg-amber-500/30 dark:text-amber-200"
              }`}>
                {overlapCounts.contrasts}
              </span>
            )}
          </button>
        </div>

        {/* Search & Sort */}
        <div className="flex items-center justify-between sm:justify-end gap-2 pt-1">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or author..."
              className="h-8 text-xs pl-8"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-8 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground focus:outline-none shrink-0"
          >
            <option value="rating-desc">Rating: High to Low</option>
            <option value="title-asc">Title: A to Z</option>
            <option value="author-asc">Author: A to Z</option>
            <option value="date-read-desc">Recently Read</option>
          </select>
        </div>
      </div>

      {/* Book Grid */}
      {filteredBooks.length === 0 ? (
        <Card className="border-dashed border-border/80 bg-card/40 py-16 text-center">
          <p className="text-xs text-muted-foreground italic max-w-md mx-auto">
            {activeShelf === "contrasts"
              ? `No rating contrasts found. You and ${friendName} haven't rated any of the same books with a 2+ star difference yet!`
              : activeShelf === "both-loved"
              ? `No shared favorites found. Books that both you and ${friendName} rate 4★ or 5★ will show here!`
              : activeShelf === "on-my-want-to-read"
              ? `None of the books on ${friendName}'s shelves are currently on your Want to Read list.`
              : `No books found matching this filter in ${friendName}'s library.`}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredBooks.map((book, index) => {
            const vb = viewerBooksMap?.[book.book_id];
            const isBothLoved = Boolean(
              typeof book.rating === "number" &&
              book.rating >= 4 &&
              typeof vb?.rating === "number" &&
              vb.rating >= 4
            );
            const isOnMyWantToRead = vb?.shelf === "to-read";
            const isContrasting = Boolean(
              typeof book.rating === "number" &&
              typeof vb?.rating === "number" &&
              Math.abs(book.rating - vb.rating) >= 2
            );

            const shelfBadge = (() => {
              switch (book.shelf) {
                case "read":
                  return <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-transparent">Read</Badge>;
                case "currently-reading":
                  return <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-50/60 dark:bg-transparent">Reading</Badge>;
                case "to-read":
                  return <Badge variant="outline" className="text-[9px] border-blue-500/40 text-blue-700 dark:text-blue-400 bg-blue-50/60 dark:bg-transparent">Want to Read</Badge>;
                case "did-not-finish":
                  return <Badge variant="outline" className="text-[9px] border-rose-500/40 text-rose-700 dark:text-rose-400 bg-rose-50/60 dark:bg-transparent">DNF</Badge>;
                default:
                  return null;
              }
            })();

            const seriesInfo = parseSeriesInfo(book.title);
            const cleanTitle = seriesInfo ? seriesInfo.cleanTitle : book.title;

            return (
              <Card
                key={book.id}
                className="group overflow-hidden border-border/60 bg-card/60 backdrop-blur-xs hover:border-primary/50 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Cover */}
                  <div className="relative aspect-2/3 w-full overflow-hidden bg-muted/40">
                    <FriendBookCover
                      coverUrl={book.cover_url}
                      title={cleanTitle}
                      author={book.author}
                      priority={index < 6}
                    />

                    {/* Overlap Badges (Issue #37) */}
                    <div className="absolute top-1.5 left-1.5 right-1.5 flex flex-col gap-1 items-start">
                      {isBothLoved && (
                        <span className="rounded-xs bg-emerald-950/90 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 backdrop-blur-xs">
                          ✨ Both Loved
                        </span>
                      )}
                      {isOnMyWantToRead && (
                        <span className="rounded-xs bg-blue-950/90 border border-blue-500/40 px-1.5 py-0.5 text-[9px] font-bold text-blue-300 backdrop-blur-xs">
                          📌 In Your Queue
                        </span>
                      )}
                      {isContrasting && (
                        <span className="rounded-xs bg-amber-950/90 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 backdrop-blur-xs">
                          ⚡ Differing Take
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      {shelfBadge}
                      {book.rating && (
                        <div className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 text-xs font-bold">
                          <Star className="size-3 fill-amber-500 dark:fill-amber-400" />
                          <span>{book.rating}</span>
                        </div>
                      )}
                    </div>

                    {/* Series Badge if Applicable */}
                    {seriesInfo && (
                      <div
                        className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-xs px-1.5 py-0.5 w-fit max-w-full truncate"
                        title={seriesInfo.displaySeries}
                      >
                        <Layers className="size-2.5 shrink-0" />
                        <span className="truncate">{seriesInfo.displaySeries}</span>
                      </div>
                    )}

                    <h4
                      className="text-sm sm:text-xs font-semibold sm:font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors"
                      title={book.title}
                    >
                      {cleanTitle}
                    </h4>
                    <p className="text-xs sm:text-[11px] text-muted-foreground line-clamp-1">
                      {book.author}
                    </p>

                    {/* Viewer rating comparison snippet */}
                    {vb?.rating !== undefined && vb?.rating !== null && (
                      <p className="text-[10px] text-muted-foreground/80 font-mono">
                        Your rating: <span className="text-foreground font-bold">{vb.rating}★</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="px-3 pb-3 pt-0 space-y-1.5">
                  {book.user_review && (
                    <p className="text-[10px] text-muted-foreground/90 line-clamp-2 italic border-t border-border/40 pt-1.5">
                      &ldquo;{book.user_review}&rdquo;
                    </p>
                  )}

                  {/* Action buttons: Share & Recommend */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const res = await shareBook(book);
                        if (res.message && res.method !== "none") {
                          setToastMessage(res.message);
                          setTimeout(() => setToastMessage(null), 3000);
                        }
                      }}
                      className="flex-1 h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground border border-border/40 hover:bg-muted/40 transition-colors"
                      title="Share book via native share or link"
                    >
                      <Share2 className="size-3" />
                      <span>Share</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRecommendBook({
                          id: book.book_id,
                          title: book.title,
                          author: book.author,
                          cover_url: book.cover_url,
                        });
                        setIsRecommendModalOpen(true);
                      }}
                      className="flex-1 h-7 text-[11px] gap-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Send className="size-3" />
                      <span>Recommend</span>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recommend Book Modal */}
      <RecommendBookModal
        open={isRecommendModalOpen}
        onOpenChange={setIsRecommendModalOpen}
        book={recommendBook}
      />

      {/* Toast Alert Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-card/95 backdrop-blur-md px-4 py-3 text-sm text-foreground shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="size-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
