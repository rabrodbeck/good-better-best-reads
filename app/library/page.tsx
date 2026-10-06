"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  ImageOff,
  Search,
  Star,
  Calendar,
  FileText,
  Sparkles,
  ArrowUpDown,
  BookMarked,
  Layers,
  ArrowRight,
  Plus,
  Check,
  ChevronDown,
  Download,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AddBookModal, AddedBookItem } from "@/components/library/add-book-modal";
import { ExportModal } from "@/components/library/export-modal";

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

type ShelfFilter = "all" | "read" | "to-read" | "currently-reading";
type SortOption = "rating-desc" | "title-asc" | "author-asc" | "date-read-desc";

function LibraryBookCover({
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

  if (coverUrl && !imgError) {
    return (
      <Image
        src={coverUrl}
        alt={`Cover of ${title}`}
        fill
        priority={priority}
        className="object-cover transition-transform group-hover:scale-105 duration-200"
        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
        unoptimized
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className="p-2.5 text-center flex flex-col items-center justify-center h-full w-full bg-gradient-to-b from-card/90 via-muted/40 to-card/90">
      <ImageOff className="size-5 text-muted-foreground/60 mb-1.5" />
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">
        Cover Unavailable
      </span>
      <span className="text-[11px] font-bold text-foreground line-clamp-2 leading-tight">
        {title}
      </span>
      <span className="text-[9px] text-muted-foreground mt-1 line-clamp-1">
        {author}
      </span>
    </div>
  );
}

function ShelfSelector({
  shelf,
  onShelfChange,
}: {
  shelf: BookItem["shelf"];
  onShelfChange: (newShelf: BookItem["shelf"]) => void;
}) {
  const getBadgeStyle = (s: BookItem["shelf"]) => {
    switch (s) {
      case "read":
        return "border-emerald-500/40 text-emerald-300 bg-emerald-950/85 hover:bg-emerald-900/90";
      case "currently-reading":
        return "border-amber-500/40 text-amber-300 bg-amber-950/85 hover:bg-amber-900/90";
      case "to-read":
        return "border-blue-500/40 text-blue-300 bg-blue-950/85 hover:bg-blue-900/90";
      case "did-not-finish":
        return "border-rose-500/40 text-rose-300 bg-rose-950/85 hover:bg-rose-900/90";
      default:
        return "border-border text-foreground bg-card/85";
    }
  };

  return (
    <div className="relative group/shelf" onClick={(e) => e.stopPropagation()}>
      <select
        value={shelf}
        onChange={(e) => onShelfChange(e.target.value as BookItem["shelf"])}
        className={`appearance-none cursor-pointer rounded-md border px-2 py-0.5 pr-4 text-[10px] font-bold shadow-xs backdrop-blur-md transition-all focus:outline-none focus:ring-1 focus:ring-primary ${getBadgeStyle(
          shelf
        )}`}
        title="Move book to another shelf"
      >
        <option value="to-read" className="bg-popover text-popover-foreground">Want to Read</option>
        <option value="currently-reading" className="bg-popover text-popover-foreground">Reading Now</option>
        <option value="read" className="bg-popover text-popover-foreground">Read</option>
        <option value="did-not-finish" className="bg-popover text-popover-foreground">Did Not Finish</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 size-2.5 opacity-70" />
    </div>
  );
}

function InteractiveStarRating({
  rating,
  onRate,
}: {
  rating: number | null;
  onRate: (newRating: number | null) => void;
}) {
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);

  return (
    <div
      className="flex items-center gap-0.5 mb-1.5"
      onMouseLeave={() => setHoverRating(null)}
      onClick={(e) => e.stopPropagation()}
    >
      {[1, 2, 3, 4, 5].map((starValue) => {
        const isFilled =
          (hoverRating !== null ? hoverRating >= starValue : false) ||
          (hoverRating === null && rating !== null && rating >= starValue);

        return (
          <button
            key={starValue}
            type="button"
            title={rating === starValue ? "Click to clear rating" : `Rate ${starValue} star${starValue > 1 ? "s" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onRate(rating === starValue ? null : starValue);
            }}
            onMouseEnter={() => setHoverRating(starValue)}
            className="p-0.5 -m-0.5 rounded-xs hover:scale-125 transition-transform cursor-pointer focus:outline-none"
          >
            <Star
              className={`size-3 transition-colors ${
                isFilled
                  ? "fill-amber-500 text-amber-500"
                  : "text-muted-foreground/30 hover:text-amber-500/50"
              }`}
            />
          </button>
        );
      })}
      <span className="text-[10px] text-muted-foreground ml-1 font-mono select-none">
        {hoverRating !== null ? (
          `${hoverRating}★`
        ) : rating ? (
          `${rating}★`
        ) : (
          <span className="text-[9px] italic text-muted-foreground/60">Rate</span>
        )}
      </span>
    </div>
  );
}

export default function LibraryPage() {
  const [books, setBooks] = React.useState<BookItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Manual Add Modal, Export Modal & Notification State
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = React.useState("");
  const [activeShelf, setActiveShelf] = React.useState<ShelfFilter>("all");
  const [minRating, setMinRating] = React.useState<number | null>(null);
  const [sortBy, setSortBy] = React.useState<SortOption>("rating-desc");

  React.useEffect(() => {
    fetch("/api/library")
      .then((res) => res.json())
      .then((data) => {
        if (data?.books) {
          setBooks(data.books);
        }
      })
      .catch((err) => console.error("Could not fetch library:", err))
      .finally(() => setLoading(false));
  }, []);

  // Real-time reactive stats derived directly from books state
  const stats = React.useMemo<LibraryStats | null>(() => {
    if (loading && books.length === 0) return null;

    const ratedBooks = books.filter((b) => b.rating && b.rating > 0);
    const avgRating =
      ratedBooks.length > 0
        ? (ratedBooks.reduce((acc, b) => acc + (b.rating || 0), 0) / ratedBooks.length).toFixed(1)
        : null;

    return {
      total: books.length,
      read: books.filter((b) => b.shelf === "read").length,
      currentlyReading: books.filter((b) => b.shelf === "currently-reading").length,
      toRead: books.filter((b) => b.shelf === "to-read").length,
      dnf: books.filter((b) => b.shelf === "did-not-finish").length,
      fiveStarCount: books.filter((b) => b.rating === 5).length,
      fourStarCount: books.filter((b) => b.rating === 4).length,
      avgRating,
    };
  }, [books, loading]);

  const existingBookTitles = React.useMemo(() => {
    return new Set(books.map((b) => b.title.toLowerCase().trim()));
  }, [books]);

  // Real-time optimistic shelf change
  const handleShelfChange = async (book: BookItem, newShelf: BookItem["shelf"]) => {
    if (book.shelf === newShelf) return;

    const prevBooks = [...books];
    const shelfLabels: Record<BookItem["shelf"], string> = {
      "to-read": "Want to Read",
      "currently-reading": "Reading Now",
      read: "Read",
      "did-not-finish": "Did Not Finish",
    };

    // Optimistic UI update
    setBooks((prev) =>
      prev.map((b) =>
        b.id === book.id
          ? {
              ...b,
              shelf: newShelf,
              date_read: newShelf === "read" && !b.date_read ? new Date().toISOString() : b.date_read,
            }
          : b
      )
    );

    setToastMessage(`Moved "${book.title}" to ${shelfLabels[newShelf]}!`);
    setTimeout(() => setToastMessage(null), 3000);

    try {
      const res = await fetch("/api/library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: book.id,
          book_id: book.book_id,
          shelf: newShelf,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update shelf");
      }
    } catch (err) {
      console.error("Shelf update error:", err);
      setBooks(prevBooks); // Rollback
      setToastMessage(`Could not move "${book.title}". Reverted changes.`);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Real-time optimistic rating change
  const handleRatingChange = async (book: BookItem, newRating: number | null) => {
    if (book.rating === newRating) return;

    const prevBooks = [...books];
    const willMoveToRead = newRating !== null && book.shelf === "to-read";

    // Optimistic UI update
    setBooks((prev) =>
      prev.map((b) =>
        b.id === book.id
          ? {
              ...b,
              rating: newRating,
              shelf: willMoveToRead ? "read" : b.shelf,
              date_read: willMoveToRead && !b.date_read ? new Date().toISOString() : b.date_read,
            }
          : b
      )
    );

    if (newRating !== null) {
      setToastMessage(
        willMoveToRead
          ? `Rated "${book.title}" ${newRating} ${newRating === 1 ? "star" : "stars"} & moved to Read!`
          : `Rated "${book.title}" ${newRating} ${newRating === 1 ? "star" : "stars"}!`
      );
    } else {
      setToastMessage(`Cleared rating for "${book.title}".`);
    }
    setTimeout(() => setToastMessage(null), 3000);

    try {
      const res = await fetch("/api/library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: book.id,
          book_id: book.book_id,
          rating: newRating,
          ...(willMoveToRead ? { shelf: "read" } : {}),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update rating");
      }
    } catch (err) {
      console.error("Rating update error:", err);
      setBooks(prevBooks); // Rollback
      setToastMessage(`Could not save rating for "${book.title}". Reverted changes.`);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleBookAdded = (newBook: AddedBookItem) => {
    setBooks((prev) => {
      const existingIndex = prev.findIndex(
        (b) => b.book_id === newBook.book_id || b.id === newBook.id
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newBook;
        return updated;
      }
      return [newBook, ...prev];
    });

    const shelfLabel =
      newBook.shelf === "read"
        ? "Read"
        : newBook.shelf === "currently-reading"
        ? "Reading Now"
        : newBook.shelf === "did-not-finish"
        ? "Did Not Finish"
        : "Want to Read";

    setToastMessage(`Added "${newBook.title}" to ${shelfLabel}!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filter & Sort Logic
  const filteredBooks = React.useMemo(() => {
    return books
      .filter((book) => {
        // Shelf Filter
        if (activeShelf !== "all" && book.shelf !== activeShelf) {
          return false;
        }

        // Rating Filter
        if (minRating !== null && (!book.rating || book.rating < minRating)) {
          return false;
        }

        // Search Filter (Title or Author)
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const matchTitle = book.title.toLowerCase().includes(q);
          const matchAuthor = book.author.toLowerCase().includes(q);
          if (!matchTitle && !matchAuthor) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "rating-desc") {
          return (b.rating || 0) - (a.rating || 0);
        }
        if (sortBy === "title-asc") {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === "author-asc") {
          return a.author.localeCompare(b.author);
        }
        if (sortBy === "date-read-desc") {
          return (b.date_read || "").localeCompare(a.date_read || "");
        }
        return 0;
      });
  }, [books, activeShelf, minRating, search, sortBy]);

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[60vh] max-w-6xl flex-col items-center justify-center p-6">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-pulse">
          <BookOpen className="size-6 animate-spin" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Loading your personal library...</p>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="container mx-auto flex min-h-[65vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
          <Layers className="size-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Your Library is Empty</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
          Search and add books manually or import your Goodreads / StoryGraph export to catalog your reading history and empower your Personal Librarian.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button
            size="lg"
            onClick={() => setIsAddModalOpen(true)}
            className="gap-2 font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" />
            <span>Add Book Manually</span>
          </Button>
          <Link href="/import">
            <Button size="lg" variant="outline" className="gap-2 font-semibold">
              <BookOpen className="size-4" />
              <span>Import Reading History</span>
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>

        <AddBookModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          onBookAdded={handleBookAdded}
          existingBookTitles={existingBookTitles}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto flex max-w-6xl flex-col px-4 py-8 sm:py-10">
      {/* Title & Stats Ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="border-primary/30 text-primary text-xs gap-1">
              <BookMarked className="size-3" />
              Cataloged Collection
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {books.length} Total Titles
            </Badge>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            My Reading Shelves
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="gap-1.5 font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" />
            <span>Add Book</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsExportModalOpen(true)}
            className="gap-1.5 font-semibold"
          >
            <Download className="size-4" />
            <span>Export</span>
          </Button>

          <Link href="/chat">
            <Button size="sm" variant="outline" className="gap-1.5 font-semibold">
              <Sparkles className="size-4" />
              <span>Ask Personal Librarian</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <Card className="border-border/50 bg-card/40 backdrop-blur-xs">
            <CardContent className="p-4 text-center">
              <span className="text-2xl font-extrabold text-foreground block">
                {stats.total}
              </span>
              <span className="text-xs text-muted-foreground">Total Books</span>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/40 backdrop-blur-xs">
            <CardContent className="p-4 text-center">
              <span className="text-2xl font-extrabold text-emerald-500 block">
                {stats.read}
              </span>
              <span className="text-xs text-muted-foreground">Read & Rated</span>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/40 backdrop-blur-xs">
            <CardContent className="p-4 text-center">
              <span className="text-2xl font-extrabold text-blue-500 block">
                {stats.toRead}
              </span>
              <span className="text-xs text-muted-foreground">Want to Read</span>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/40 backdrop-blur-xs">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <span className="text-2xl font-extrabold text-amber-500">
                  {stats.avgRating || "N/A"}
                </span>
                {stats.avgRating && <Star className="size-4 fill-amber-500 text-amber-500" />}
              </div>
              <span className="text-xs text-muted-foreground">Average Rating</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search, Filter & Sort Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6 bg-card/30 p-3 rounded-2xl border border-border/50">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or author..."
            className="pl-9 bg-background/60 h-9 text-xs"
          />
        </div>

        {/* Shelf Tabs Filter */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <Button
            variant={activeShelf === "all" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveShelf("all")}
            className="h-8 text-xs px-2.5"
          >
            All ({books.length})
          </Button>
          <Button
            variant={activeShelf === "read" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveShelf("read")}
            className="h-8 text-xs px-2.5"
          >
            Read ({stats?.read || 0})
          </Button>
          <Button
            variant={activeShelf === "to-read" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveShelf("to-read")}
            className="h-8 text-xs px-2.5"
          >
            Want to Read ({stats?.toRead || 0})
          </Button>
          {stats?.currentlyReading ? (
            <Button
              variant={activeShelf === "currently-reading" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveShelf("currently-reading")}
              className="h-8 text-xs px-2.5"
            >
              Reading ({stats.currentlyReading})
            </Button>
          ) : null}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="size-3.5 text-muted-foreground hidden sm:inline" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-8 rounded-lg border border-border/60 bg-background/60 px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="rating-desc">Highest Rated</option>
            <option value="title-asc">Title (A-Z)</option>
            <option value="author-asc">Author (A-Z)</option>
            <option value="date-read-desc">Recently Read</option>
          </select>
        </div>
      </div>

      {/* Rating Filter Pills */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto text-xs text-muted-foreground">
        <span className="font-semibold text-foreground/80 shrink-0">Filter by Rating:</span>
        <button
          onClick={() => setMinRating(null)}
          className={`px-2.5 py-1 rounded-full border transition-all ${
            minRating === null
              ? "bg-primary/10 border-primary text-primary font-bold"
              : "border-border/60 hover:border-foreground/40"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setMinRating(5)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full border transition-all ${
            minRating === 5
              ? "bg-amber-500/15 border-amber-500 text-amber-500 font-bold"
              : "border-border/60 hover:border-foreground/40"
          }`}
        >
          <Star className="size-3 fill-amber-500 text-amber-500" />
          <span>5 Stars ({stats?.fiveStarCount || 0})</span>
        </button>
        <button
          onClick={() => setMinRating(4)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full border transition-all ${
            minRating === 4
              ? "bg-amber-500/15 border-amber-500 text-amber-500 font-bold"
              : "border-border/60 hover:border-foreground/40"
          }`}
        >
          <Star className="size-3 fill-amber-500 text-amber-500" />
          <span>4+ Stars ({(stats?.fiveStarCount || 0) + (stats?.fourStarCount || 0)})</span>
        </button>
      </div>

      {/* Book Grid */}
      {filteredBooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border/60 rounded-2xl bg-card/20">
          <Search className="size-8 text-muted-foreground mb-3 opacity-40" />
          <h3 className="text-base font-semibold">No books match your filters</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Try adjusting your search query or reset your shelf and rating filters.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setActiveShelf("all");
              setMinRating(null);
            }}
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredBooks.map((book, index) => (
            <Card
              key={book.id}
              className="group overflow-hidden border-border/60 bg-card/60 backdrop-blur-xs hover:border-primary/50 transition-all flex flex-col justify-between"
            >
              <CardContent className="p-3 flex flex-col h-full justify-between">
                <div>
                  {/* Book Cover Image / Styled Fallback */}
                  <div className="relative aspect-[2/3] w-full rounded-md overflow-hidden bg-muted/60 border border-border/40 shadow-xs mb-2.5 flex items-center justify-center">
                    <LibraryBookCover
                      coverUrl={book.cover_url}
                      title={book.title}
                      author={book.author}
                      priority={index < 6}
                    />

                    {/* Interactive Shelf Selector Badge */}
                    <div className="absolute top-1.5 left-1.5 z-10">
                      <ShelfSelector
                        shelf={book.shelf}
                        onShelfChange={(newShelf) => handleShelfChange(book, newShelf)}
                      />
                    </div>
                  </div>

                  {/* Interactive 1-5 Star Rating Controls */}
                  <InteractiveStarRating
                    rating={book.rating}
                    onRate={(newRating) => handleRatingChange(book, newRating)}
                  />

                  {/* Title & Author */}
                  <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {book.title}
                  </h4>
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                    {book.author}
                  </p>
                </div>

                {/* Metadata Row */}
                <div className="pt-2.5 mt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                  {book.published_year ? (
                    <span className="flex items-center gap-0.5">
                      <Calendar className="size-2.5" />
                      <span>{book.published_year}</span>
                    </span>
                  ) : (
                    <span />
                  )}

                  {book.page_count ? (
                    <span className="flex items-center gap-0.5">
                      <FileText className="size-2.5" />
                      <span>{book.page_count}p</span>
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Manual Book Addition Modal */}
      <AddBookModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onBookAdded={handleBookAdded}
        existingBookTitles={existingBookTitles}
      />

      {/* Library Export Modal */}
      <ExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        totalBooks={books.length}
        onExportSuccess={(fmt) => {
          setToastMessage(`Exported library as .${fmt}!`);
          setTimeout(() => setToastMessage(null), 3000);
        }}
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

