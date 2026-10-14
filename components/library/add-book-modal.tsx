"use client";

import * as React from "react";
import Image from "next/image";
import {
  Search,
  BookOpen,
  ImageOff,
  Sparkles,
  Calendar,
  FileText,
  Star,
  CheckCircle2,
  Bookmark,
  XCircle,
  ArrowLeft,
  Loader2,
  X,
  Plus,
  Camera,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarcodeScannerModal } from "@/components/library/barcode-scanner-modal";
import { LibrarianVerdictCard } from "@/components/library/librarian-verdict-card";

export interface SearchResultItem {
  key: string;
  title: string;
  author: string;
  cover_url: string | null;
  published_year: number | null;
  page_count: number | null;
  isbn: string | null;
  isbn13: string | null;
  genres: string[];
  snippet: string | null;
}

export interface AddedBookItem {
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

export interface ExistingBookShelfInfo {
  id: string;
  book_id: string;
  title: string;
  author: string;
  shelf: ShelfType;
  rating?: number | null;
  user_review?: string | null;
  date_read?: string | null;
  isbn?: string | null;
  isbn13?: string | null;
}

// Module-level library cache so the modal recognizes shelves instantly across renders
let globalLibraryCache: ExistingBookShelfInfo[] | null = null;

interface AddBookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookAdded: (book: AddedBookItem) => void;
  existingBookTitles?: Set<string>;
  existingBooks?: ExistingBookShelfInfo[];
}

type ShelfType = "to-read" | "currently-reading" | "read" | "did-not-finish";

const SUGGESTED_SEARCHES = [
  "Dune",
  "Project Hail Mary",
  "The Way of Kings",
  "Tomorrow, and Tomorrow, and Tomorrow",
  "Piranesi",
];

const RATING_LABELS: Record<number, string> = {
  1: "1 Star - Did not like it",
  2: "2 Stars - It was OK",
  3: "3 Stars - Liked it",
  4: "4 Stars - Really liked it",
  5: "5 Stars - It was amazing!",
};

export function AddBookModal({
  open,
  onOpenChange,
  onBookAdded,
  existingBookTitles = new Set(),
  existingBooks = [],
}: AddBookModalProps) {
  // Step navigation: 1 = Search & Select, 2 = Configure Shelf & Rating
  const [step, setStep] = React.useState<1 | 2>(1);

  // Search state
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [results, setResults] = React.useState<SearchResultItem[]>([]);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = React.useState(false);

  // Selected book state
  const [selectedBook, setSelectedBook] = React.useState<SearchResultItem | null>(null);

  // User's current library books for shelf recognition (initialize from prop or global cache)
  const [libraryBooks, setLibraryBooks] = React.useState<ExistingBookShelfInfo[]>(() => {
    if (existingBooks && existingBooks.length > 0) {
      globalLibraryCache = existingBooks;
      return existingBooks;
    }
    return globalLibraryCache || [];
  });

  // Sync libraryBooks when existingBooks prop updates
  React.useEffect(() => {
    if (existingBooks && existingBooks.length > 0) {
      setLibraryBooks(existingBooks);
      globalLibraryCache = existingBooks;
    }
  }, [existingBooks]);

  // Self-hydrate user's library books when modal opens
  React.useEffect(() => {
    if (!open) return;
    let isCancelled = false;
    fetch("/api/library")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isCancelled && data?.books && Array.isArray(data.books)) {
          setLibraryBooks(data.books);
          globalLibraryCache = data.books;
        }
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [open]);

  // Robust book-on-shelf matching helper
  const matchExistingBook = React.useCallback(
    (candidate: {
      title: string;
      author?: string;
      isbn?: string | null;
      isbn13?: string | null;
    }): ExistingBookShelfInfo | null => {
      // 1. Check exact ISBN13 / ISBN match first
      const candIsbn13 = candidate.isbn13?.replace(/[^0-9X]/gi, "");
      const candIsbn = candidate.isbn?.replace(/[^0-9X]/gi, "");

      if (candIsbn13 || candIsbn) {
        const isbnMatch = libraryBooks.find((b) => {
          const bIsbn13 = b.isbn13?.replace(/[^0-9X]/gi, "");
          const bIsbn = b.isbn?.replace(/[^0-9X]/gi, "");
          if (candIsbn13 && (candIsbn13 === bIsbn13 || candIsbn13 === bIsbn)) return true;
          if (candIsbn && (candIsbn === bIsbn || candIsbn === bIsbn13)) return true;
          return false;
        });
        if (isbnMatch) return isbnMatch;
      }

      // 2. Clean and normalize titles
      const clean = (str: string) =>
        str
          .toLowerCase()
          .replace(/\s*\([^)]*\)/g, "") // remove (A Novel), (Series, #2), etc.
          .replace(/[:\-–—].*$/, "") // remove subtitle after colon
          .replace(/['’"“”.,!?-]/g, "")
          .replace(/\s+/g, " ")
          .trim();

      const candNorm = clean(candidate.title);

      const titleMatch = libraryBooks.find((b) => {
        const bNorm = clean(b.title);
        if (candNorm === bNorm) return true;
        if (candNorm.length > 5 && bNorm.length > 5) {
          if (candNorm.startsWith(bNorm) || bNorm.startsWith(candNorm)) return true;
        }
        return false;
      });

      if (titleMatch) return titleMatch;

      // 3. Fallback to existingBookTitles prop if libraryBooks hasn't loaded
      if (existingBookTitles.has(candidate.title.toLowerCase().trim())) {
        return {
          id: "",
          book_id: "",
          title: candidate.title,
          author: candidate.author || "",
          shelf: "read",
        };
      }

      return null;
    },
    [libraryBooks, existingBookTitles]
  );

  // Shelf & rating form state
  const [targetShelf, setTargetShelf] = React.useState<ShelfType>("to-read");
  const [rating, setRating] = React.useState<number | null>(null);
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);
  const [dateRead, setDateRead] = React.useState<string>("");
  const [userReview, setUserReview] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Reset when modal opens/closes
  React.useEffect(() => {
    if (!open) {
      setStep(1);
      setQuery("");
      setDebouncedQuery("");
      setResults([]);
      setSelectedBook(null);
      setTargetShelf("to-read");
      setRating(null);
      setDateRead("");
      setUserReview("");
      setSearchError(null);
      setSubmitError(null);
    }
  }, [open]);

  // Debounce search query (350ms)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch search results
  React.useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let isCancelled = false;
    setIsSearching(true);
    setSearchError(null);

    fetch(`/api/books/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Search service encountered an error");
        return res.json();
      })
      .then((data) => {
        if (!isCancelled) {
          setResults(data.results || []);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Search error:", err);
          setSearchError("Failed to fetch book results. Please try again.");
        }
      })
      .finally(() => {
        if (!isCancelled) setIsSearching(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [debouncedQuery]);

  const handleSelectBook = (book: SearchResultItem) => {
    setSelectedBook(book);
    setStep(2);
    setSubmitError(null);

    const existing = matchExistingBook(book);
    if (existing) {
      setTargetShelf(existing.shelf || "to-read");
      setRating(existing.rating !== undefined ? existing.rating : null);
      setDateRead(
        existing.date_read
          ? existing.date_read.split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      setUserReview(existing.user_review || "");
    } else {
      setTargetShelf("to-read");
      setRating(null);
      setDateRead(new Date().toISOString().split("T")[0]);
      setUserReview("");
    }
  };

  const handleBackToSearch = () => {
    setStep(1);
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedBook.title,
          author: selectedBook.author,
          isbn: selectedBook.isbn,
          isbn13: selectedBook.isbn13,
          cover_url: selectedBook.cover_url,
          page_count: selectedBook.page_count,
          published_year: selectedBook.published_year,
          genres: selectedBook.genres,
          open_library_key: selectedBook.key,
          shelf: targetShelf,
          rating: rating,
          user_review: userReview.trim() || null,
          date_read: targetShelf === "read" ? dateRead : null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add book to library");
      }

      onBookAdded(data.book);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error adding book:", err);
      setSubmitError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[88vh] flex flex-col p-6 overflow-hidden">
        {step === 1 ? (
          <>
            <DialogHeader className="shrink-0 pb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-primary/40 text-primary text-[11px] gap-1">
                  <Sparkles className="size-3" />
                  Manual Cataloging
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                Add a Book to Your Shelves
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Search Open Library by title, author, or ISBN to add to your collection.
              </DialogDescription>
            </DialogHeader>

            {/* Search Input Bar + Barcode Scanner Action */}
            <div className="flex items-center gap-2 shrink-0 mt-1 mb-3">
              <div className="relative flex-1">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title, author, or ISBN (e.g. Dune, 9780441013593)..."
                  className="pl-9 pr-9 h-10 text-xs bg-background/80"
                  autoFocus
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsScannerOpen(true)}
                className="h-10 px-3 shrink-0 gap-1.5 text-xs font-semibold hover:border-primary/50"
                title="Scan physical book barcode with camera"
              >
                <Camera className="size-4 text-primary" />
                <span className="hidden sm:inline">Scan Barcode</span>
              </Button>
            </div>

            {/* Results or Helper View */}
            <div className="flex-1 overflow-y-auto pr-1 min-h-[300px] max-h-[460px] space-y-2">
              {isSearching ? (
                <div className="flex flex-col items-center justify-center h-56 text-muted-foreground gap-2">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <p className="text-xs">Searching Open Library catalog...</p>
                </div>
              ) : searchError ? (
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs text-center">
                  {searchError}
                </div>
              ) : debouncedQuery.length >= 2 && results.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-56 text-center p-6 border border-dashed border-border/60 rounded-xl bg-card/20">
                  <BookOpen className="size-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-semibold text-foreground">No books found</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    We couldn't find matches for &ldquo;{debouncedQuery}&rdquo;. Try checking the spelling or searching by exact ISBN.
                  </p>
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-2">
                  {results.map((book) => {
                    const existing = matchExistingBook(book);

                    return (
                      <div
                        key={book.key || `${book.title}-${book.author}`}
                        className="group flex flex-col p-3 rounded-xl border border-border/50 bg-card/40 hover:bg-card/90 hover:border-primary/50 transition-all"
                      >
                        <div
                          onClick={() => handleSelectBook(book)}
                          className="flex items-start gap-3.5 cursor-pointer"
                        >
                          {/* Cover Preview */}
                          <div className="relative w-14 h-20 shrink-0 rounded-md overflow-hidden bg-muted/60 border border-border/40 shadow-xs flex items-center justify-center">
                            {book.cover_url ? (
                              <Image
                                src={book.cover_url}
                                alt={book.title}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-200"
                                sizes="56px"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center p-1 text-center">
                                <ImageOff className="size-5 text-muted-foreground/60" />
                              </div>
                            )}
                          </div>

                          {/* Book Metadata */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm sm:text-base font-bold text-foreground leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                                {book.title}
                              </h4>
                              {existing && (
                                <Badge
                                  className={`text-xs font-semibold gap-1.5 px-2.5 py-0.5 shrink-0 ${
                                    existing.shelf === "read"
                                      ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                      : existing.shelf === "currently-reading"
                                      ? "bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                      : existing.shelf === "did-not-finish"
                                      ? "bg-rose-600/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                                      : "bg-blue-600/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
                                  }`}
                                >
                                  {existing.shelf === "read" ? (
                                    <CheckCircle2 className="size-3.5" />
                                  ) : existing.shelf === "currently-reading" ? (
                                    <BookOpen className="size-3.5" />
                                  ) : existing.shelf === "did-not-finish" ? (
                                    <XCircle className="size-3.5" />
                                  ) : (
                                    <Bookmark className="size-3.5" />
                                  )}
                                  <span>
                                    {existing.shelf === "read"
                                      ? "On Shelf: Read"
                                      : existing.shelf === "currently-reading"
                                      ? "On Shelf: Reading Now"
                                      : existing.shelf === "did-not-finish"
                                      ? "On Shelf: DNF"
                                      : "On Shelf: Want to Read"}
                                    {existing.rating ? ` (★ ${existing.rating})` : ""}
                                  </span>
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground font-medium line-clamp-1 mt-0.5">
                              {book.author}
                            </p>

                            <div className="flex flex-wrap items-center gap-2.5 mt-1.5 text-xs text-muted-foreground">
                              {book.published_year && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="size-3 text-muted-foreground/80" />
                                  <span>{book.published_year}</span>
                                </span>
                              )}
                              {book.page_count && (
                                <span className="flex items-center gap-1">
                                  <FileText className="size-3 text-muted-foreground/80" />
                                  <span>{book.page_count} pages</span>
                                </span>
                              )}
                              {book.genres && book.genres.length > 0 && (
                                <span className="line-clamp-1 text-muted-foreground/80">
                                  • {book.genres.slice(0, 3).join(", ")}
                                </span>
                              )}
                            </div>

                            {book.snippet && (
                              <p className="mt-1.5 text-xs text-muted-foreground italic line-clamp-2 leading-relaxed">
                                &ldquo;{book.snippet}&rdquo;
                              </p>
                            )}
                          </div>

                          {/* Select / Edit Shelf Action Button */}
                          <div className="shrink-0 self-center">
                            <Button
                              size="sm"
                              variant={existing ? "outline" : "secondary"}
                              className={`h-8 sm:h-9 text-xs sm:text-sm px-3.5 transition-colors font-medium shadow-xs ${
                                existing
                                  ? "border-emerald-500/35 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                                  : "group-hover:bg-primary group-hover:text-primary-foreground"
                              }`}
                            >
                              {existing ? (
                                <>
                                  <Check className="size-4 mr-1 text-emerald-600 dark:text-emerald-400" />
                                  <span>Edit Shelf</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="size-4 mr-1" />
                                  <span>Select</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Librarian In-Store Taste Verdict */}
                        <div className="pl-0 sm:pl-[70px]">
                          <LibrarianVerdictCard
                            book={book}
                            onFindBook1={(firstBookTitle) => {
                              setQuery(firstBookTitle);
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Default empty state with suggestions */
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                    <Search className="size-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Discover & Catalog Any Book
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
                    Type a title, author name, or 10/13-digit ISBN into the search bar above to fetch verified details and covers.
                  </p>

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5 max-w-md">
                    <span className="text-[11px] font-semibold text-muted-foreground/80 mr-1">
                      Quick searches:
                    </span>
                    {SUGGESTED_SEARCHES.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setQuery(term)}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-card/60 border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Step 2: Configure Shelf, Rating, and Review */
          <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
            <DialogHeader className="shrink-0 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToSearch}
                  className="h-8 px-2.5 text-xs sm:text-sm -ml-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4 mr-1.5" />
                  <span>Back to Search</span>
                </Button>
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Configure Shelf & Reading Details
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                Choose which shelf this book belongs to and record your rating.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[460px]">
              {/* Existing Book Shelf Notification Banner */}
              {(() => {
                const selectedExisting = selectedBook ? matchExistingBook(selectedBook) : null;
                if (!selectedExisting) return null;

                const shelfName =
                  selectedExisting.shelf === "to-read"
                    ? "Want to Read"
                    : selectedExisting.shelf === "currently-reading"
                    ? "Reading Now"
                    : selectedExisting.shelf === "did-not-finish"
                    ? "Did Not Finish"
                    : "Read";

                return (
                  <div className="p-3.5 sm:p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          Currently on your{" "}
                          <span className="capitalize underline font-bold text-emerald-700 dark:text-emerald-300">
                            {shelfName}
                          </span>{" "}
                          shelf{selectedExisting.rating ? ` • Rated ${selectedExisting.rating} ★` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Select a different shelf below to move this book, or update your rating & review notes.
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-600 text-white border-none text-xs px-2.5 py-1 shrink-0 font-medium hidden sm:inline-flex">
                      Shelf: {shelfName}
                    </Badge>
                  </div>
                );
              })()}

              {/* Selected Book Summary Card */}
              {selectedBook && (
                <div className="flex items-center gap-3.5 p-3 sm:p-3.5 rounded-xl border border-border/60 bg-muted/20">
                  <div className="relative w-14 h-20 shrink-0 rounded-md overflow-hidden bg-muted/60 border border-border/40 shadow-xs flex items-center justify-center">
                    {selectedBook.cover_url ? (
                      <Image
                        src={selectedBook.cover_url}
                        alt={selectedBook.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : (
                      <ImageOff className="size-5 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-foreground line-clamp-1">
                      {selectedBook.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium line-clamp-1 mt-0.5">
                      {selectedBook.author}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground/80">
                      {selectedBook.published_year && <span>{selectedBook.published_year}</span>}
                      {selectedBook.page_count && <span>• {selectedBook.page_count} pages</span>}
                      {selectedBook.genres?.length > 0 && (
                        <span>• {selectedBook.genres[0]}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Shelf Selection Tabs */}
              <div>
                <label className="text-sm font-bold text-foreground block mb-2.5">
                  Select Reading Shelf
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTargetShelf("to-read")}
                    className={`flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-xl border transition-all text-center ${
                      targetShelf === "to-read"
                        ? "border-blue-500 bg-blue-500/15 text-blue-400 font-bold shadow-xs ring-1 ring-blue-500/50"
                        : "border-border/60 bg-card/40 text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    <Bookmark className="size-5 mb-1.5 text-blue-400" />
                    <span className="text-xs sm:text-sm font-medium">Want to Read</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetShelf("currently-reading")}
                    className={`flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-xl border transition-all text-center ${
                      targetShelf === "currently-reading"
                        ? "border-amber-500 bg-amber-500/15 text-amber-400 font-bold shadow-xs ring-1 ring-amber-500/50"
                        : "border-border/60 bg-card/40 text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    <BookOpen className="size-5 mb-1.5 text-amber-400" />
                    <span className="text-xs sm:text-sm font-medium">Reading Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetShelf("read");
                      if (!dateRead) {
                        setDateRead(new Date().toISOString().split("T")[0]);
                      }
                    }}
                    className={`flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-xl border transition-all text-center ${
                      targetShelf === "read"
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-400 font-bold shadow-xs ring-1 ring-emerald-500/50"
                        : "border-border/60 bg-card/40 text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    <CheckCircle2 className="size-5 mb-1.5 text-emerald-400" />
                    <span className="text-xs sm:text-sm font-medium">Read</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetShelf("did-not-finish")}
                    className={`flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-xl border transition-all text-center ${
                      targetShelf === "did-not-finish"
                        ? "border-rose-500 bg-rose-500/15 text-rose-400 font-bold shadow-xs ring-1 ring-rose-500/50"
                        : "border-border/60 bg-card/40 text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    <XCircle className="size-5 mb-1.5 text-rose-400" />
                    <span className="text-xs sm:text-sm font-medium">Did Not Finish</span>
                  </button>
                </div>
              </div>

              {/* Star Rating Section */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-foreground">
                    Rating (Optional)
                  </label>
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                    {hoverRating ? RATING_LABELS[hoverRating] : rating ? RATING_LABELS[rating] : "Unrated"}
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-card/30 p-3 rounded-xl border border-border/50">
                  {[1, 2, 3, 4, 5].map((starValue) => {
                    const isFilled =
                      (hoverRating !== null ? hoverRating >= starValue : false) ||
                      (hoverRating === null && rating !== null && rating >= starValue);

                    return (
                      <button
                        key={starValue}
                        type="button"
                        onClick={() => {
                          setRating(rating === starValue ? null : starValue);
                        }}
                        onMouseEnter={() => setHoverRating(starValue)}
                        onMouseLeave={() => setHoverRating(null)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`size-7 transition-colors ${
                            isFilled
                              ? "fill-amber-500 text-amber-500"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      </button>
                    );
                  })}
                  {rating !== null && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRating(null)}
                      className="ml-auto h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Date Read (Only shown/relevant for Read shelf) */}
              {targetShelf === "read" && (
                <div>
                  <label className="text-sm font-bold text-foreground block mb-1.5">
                    Date Finished
                  </label>
                  <Input
                    type="date"
                    value={dateRead}
                    onChange={(e) => setDateRead(e.target.value)}
                    className="h-10 text-sm bg-background/80"
                  />
                </div>
              )}

              {/* User Review / Personal Notes */}
              <div>
                <label className="text-sm font-bold text-foreground block mb-1.5">
                  Personal Thoughts or Review Notes (Optional)
                </label>
                <textarea
                  value={userReview}
                  onChange={(e) => setUserReview(e.target.value)}
                  placeholder="Record your takeaways, memorable quotes, or reading notes..."
                  rows={3}
                  className="w-full rounded-xl border border-border/60 bg-background/80 p-3.5 text-sm text-foreground placeholder:text-muted-foreground/75 focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
                />
              </div>

              {/* Error Notification */}
              {submitError && (
                <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs sm:text-sm">
                  {submitError}
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="shrink-0 pt-4 mt-2 border-t border-border/50 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="h-10 text-sm px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-10 text-sm font-semibold gap-2 px-5 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Saving Book...</span>
                  </>
                ) : (() => {
                  const selectedExisting = selectedBook ? matchExistingBook(selectedBook) : null;
                  return selectedExisting ? (
                    <>
                      <Check className="size-4" />
                      <span>Update Shelf & Rating</span>
                    </>
                  ) : (
                    <>
                      <Plus className="size-4" />
                      <span>Add to Library</span>
                    </>
                  );
                })()}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>

    <BarcodeScannerModal
      open={isScannerOpen}
      onOpenChange={setIsScannerOpen}
      onScanSuccess={(isbn) => {
        setQuery(isbn);
      }}
    />
    </>
  );
}
