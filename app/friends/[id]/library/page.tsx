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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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

type ShelfFilter = "all" | "read" | "to-read" | "currently-reading" | "did-not-finish";
type SortOption = "rating-desc" | "title-asc" | "author-asc" | "date-read-desc";

export default function FriendLibraryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const friendId = params?.id;

  const [books, setBooks] = React.useState<BookItem[]>([]);
  const [stats, setStats] = React.useState<LibraryStats | null>(null);
  const [owner, setOwner] = React.useState<OwnerProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Access restricted");
      })
      .finally(() => setLoading(false));
  }, [friendId]);

  const filteredBooks = React.useMemo(() => {
    return books
      .filter((b) => {
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
  }, [books, activeShelf, search, sortBy]);

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
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:py-12">
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
                <Image src={owner.avatar_url} alt={friendName} fill className="object-cover" />
              ) : (
                <span>{friendName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                  {friendName}&apos;s Shelves
                </h1>
                <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">
                  Friends-Only View
                </Badge>
              </div>
              {owner?.taste_archetype && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reading Archetype: <span className="text-emerald-400 font-semibold">{owner.taste_archetype}</span>
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
          <Card className="border-border/60 bg-card/40 p-4">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground block mb-1">
              Total Books
            </span>
            <span className="text-2xl font-black text-foreground">{stats.total}</span>
          </Card>
          <Card className="border-border/60 bg-card/40 p-4">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground block mb-1">
              Completed
            </span>
            <span className="text-2xl font-black text-emerald-400">{stats.read}</span>
          </Card>
          <Card className="border-border/60 bg-card/40 p-4">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground block mb-1">
              Currently Reading
            </span>
            <span className="text-2xl font-black text-amber-400">{stats.currentlyReading}</span>
          </Card>
          <Card className="border-border/60 bg-card/40 p-4">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground block mb-1">
              Avg Rating
            </span>
            <span className="text-2xl font-black text-blue-400">
              {stats.avgRating ? `${stats.avgRating}★` : "—"}
            </span>
          </Card>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        {/* Shelf Filter Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
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
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                activeShelf === tab.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Sort */}
        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-60">
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
            className="h-8 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground focus:outline-none"
          >
            <option value="rating-desc">Highest Rated</option>
            <option value="title-asc">Title (A-Z)</option>
            <option value="author-asc">Author (A-Z)</option>
            <option value="date-read-desc">Recently Read</option>
          </select>
        </div>
      </div>

      {/* Book Grid */}
      {filteredBooks.length === 0 ? (
        <Card className="border-dashed border-border/80 bg-card/40 py-16 text-center">
          <p className="text-xs text-muted-foreground italic">
            No books found matching this filter in {friendName}&apos;s library.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredBooks.map((book) => {
            const shelfBadge = (() => {
              switch (book.shelf) {
                case "read":
                  return <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-400">Read</Badge>;
                case "currently-reading":
                  return <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400">Reading</Badge>;
                case "to-read":
                  return <Badge variant="outline" className="text-[9px] border-blue-500/40 text-blue-400">Want to Read</Badge>;
                case "did-not-finish":
                  return <Badge variant="outline" className="text-[9px] border-rose-500/40 text-rose-400">DNF</Badge>;
                default:
                  return null;
              }
            })();

            return (
              <Card
                key={book.id}
                className="group overflow-hidden border-border/60 bg-card/60 backdrop-blur-xs hover:border-primary/50 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Cover */}
                  <div className="relative aspect-2/3 w-full overflow-hidden bg-muted/40">
                    {book.cover_url ? (
                      <Image
                        src={book.cover_url}
                        alt={book.title}
                        fill
                        className="object-cover transition-transform group-hover:scale-105 duration-200"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full p-2 text-center text-muted-foreground/60">
                        <ImageOff className="size-6 mb-1" />
                        <span className="text-[10px] line-clamp-2 font-semibold text-foreground/80">
                          {book.title}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      {shelfBadge}
                      {book.rating && (
                        <div className="flex items-center gap-0.5 text-amber-400 text-xs font-bold">
                          <Star className="size-3 fill-amber-400" />
                          <span>{book.rating}</span>
                        </div>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-foreground line-clamp-1 leading-snug group-hover:text-primary transition-colors">
                      {book.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {book.author}
                    </p>
                  </div>
                </div>

                {book.user_review && (
                  <div className="px-3 pb-3 pt-0">
                    <p className="text-[10px] text-muted-foreground/90 line-clamp-2 italic border-t border-border/40 pt-1.5">
                      &ldquo;{book.user_review}&rdquo;
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
