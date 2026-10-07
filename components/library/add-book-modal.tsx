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

interface AddBookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookAdded: (book: AddedBookItem) => void;
  existingBookTitles?: Set<string>;
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
}: AddBookModalProps) {
  // Step navigation: 1 = Search & Select, 2 = Configure Shelf & Rating
  const [step, setStep] = React.useState<1 | 2>(1);

  // Search state
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [results, setResults] = React.useState<SearchResultItem[]>([]);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  // Selected book state
  const [selectedBook, setSelectedBook] = React.useState<SearchResultItem | null>(null);

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
    setTargetShelf("to-read");
    setRating(null);
    setDateRead(new Date().toISOString().split("T")[0]);
    setUserReview("");
    setSubmitError(null);
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

            {/* Search Input Bar */}
            <div className="relative shrink-0 mt-1 mb-3">
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
                    const isAlreadyInLibrary = existingBookTitles.has(
                      book.title.toLowerCase().trim()
                    );

                    return (
                      <div
                        key={book.key || `${book.title}-${book.author}`}
                        onClick={() => handleSelectBook(book)}
                        className="group flex items-start gap-3.5 p-3 rounded-xl border border-border/50 bg-card/40 hover:bg-card/90 hover:border-primary/50 transition-all cursor-pointer"
                      >
                        {/* Cover Preview */}
                        <div className="relative w-12 h-16 shrink-0 rounded-md overflow-hidden bg-muted/60 border border-border/40 shadow-xs flex items-center justify-center">
                          {book.cover_url ? (
                            <Image
                              src={book.cover_url}
                              alt={book.title}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-200"
                              sizes="48px"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-1 text-center">
                              <ImageOff className="size-4 text-muted-foreground/60" />
                            </div>
                          )}
                        </div>

                        {/* Book Metadata */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                              {book.title}
                            </h4>
                            {isAlreadyInLibrary && (
                              <Badge
                                variant="secondary"
                                className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 shrink-0"
                              >
                                In Library
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {book.author}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/80">
                            {book.published_year && (
                              <span className="flex items-center gap-0.5">
                                <Calendar className="size-2.5" />
                                <span>{book.published_year}</span>
                              </span>
                            )}
                            {book.page_count && (
                              <span className="flex items-center gap-0.5">
                                <FileText className="size-2.5" />
                                <span>{book.page_count} pages</span>
                              </span>
                            )}
                            {book.genres && book.genres.length > 0 && (
                              <span className="line-clamp-1 text-muted-foreground/60">
                                • {book.genres.slice(0, 2).join(", ")}
                              </span>
                            )}
                          </div>

                          {book.snippet && (
                            <p className="mt-1 text-[10px] text-muted-foreground italic line-clamp-2 leading-relaxed">
                              &ldquo;{book.snippet}&rdquo;
                            </p>
                          )}
                        </div>

                        {/* Select Action Button */}
                        <div className="shrink-0 self-center">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs px-2.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                          >
                            <Plus className="size-3.5 mr-1" />
                            <span>Select</span>
                          </Button>
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
                  className="h-7 px-2 text-xs -ml-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5 mr-1" />
                  <span>Back to Search</span>
                </Button>
              </div>
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                Configure Shelf & Reading Details
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Choose which shelf this book belongs to and record your rating.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[460px]">
              {/* Selected Book Summary Card */}
              {selectedBook && (
                <div className="flex items-center gap-3.5 p-3 rounded-xl border border-border/60 bg-muted/20">
                  <div className="relative w-12 h-16 shrink-0 rounded-md overflow-hidden bg-muted/60 border border-border/40 shadow-xs flex items-center justify-center">
                    {selectedBook.cover_url ? (
                      <Image
                        src={selectedBook.cover_url}
                        alt={selectedBook.title}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <ImageOff className="size-4 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-foreground line-clamp-1">
                      {selectedBook.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {selectedBook.author}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/80">
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
                <label className="text-xs font-bold text-foreground block mb-2">
                  Select Reading Shelf
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetShelf("to-read")}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center ${
                      targetShelf === "to-read"
                        ? "border-blue-500 bg-blue-500/15 text-blue-400 font-bold shadow-xs"
                        : "border-border/60 bg-card/40 text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    <Bookmark className="size-4 mb-1 text-blue-400" />
                    <span className="text-[11px]">Want to Read</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetShelf("currently-reading")}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center ${
                      targetShelf === "currently-reading"
                        ? "border-amber-500 bg-amber-500/15 text-amber-400 font-bold shadow-xs"
                        : "border-border/60 bg-card/40 text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    <BookOpen className="size-4 mb-1 text-amber-400" />
                    <span className="text-[11px]">Reading Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetShelf("read");
                      if (!dateRead) {
                        setDateRead(new Date().toISOString().split("T")[0]);
                      }
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center ${
                      targetShelf === "read"
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-400 font-bold shadow-xs"
                        : "border-border/60 bg-card/40 text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    <CheckCircle2 className="size-4 mb-1 text-emerald-400" />
                    <span className="text-[11px]">Read</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetShelf("did-not-finish")}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center ${
                      targetShelf === "did-not-finish"
                        ? "border-rose-500 bg-rose-500/15 text-rose-400 font-bold shadow-xs"
                        : "border-border/60 bg-card/40 text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    <XCircle className="size-4 mb-1 text-rose-400" />
                    <span className="text-[11px]">Did Not Finish</span>
                  </button>
                </div>
              </div>

              {/* Star Rating Section */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-foreground">
                    Rating (Optional)
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    {hoverRating ? RATING_LABELS[hoverRating] : rating ? RATING_LABELS[rating] : "Unrated"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 bg-card/30 p-2.5 rounded-xl border border-border/50">
                  {[1, 2, 3, 4, 5].map((starValue) => {
                    const isFilled =
                      (hoverRating !== null ? hoverRating >= starValue : false) ||
                      (hoverRating === null && rating !== null && rating >= starValue);

                    return (
                      <button
                        key={starValue}
                        type="button"
                        onClick={() => {
                          // Toggle off if clicking the currently selected rating
                          setRating(rating === starValue ? null : starValue);
                        }}
                        onMouseEnter={() => setHoverRating(starValue)}
                        onMouseLeave={() => setHoverRating(null)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`size-6 transition-colors ${
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
                      className="ml-auto h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Date Read (Only shown/relevant for Read shelf) */}
              {targetShelf === "read" && (
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">
                    Date Finished
                  </label>
                  <Input
                    type="date"
                    value={dateRead}
                    onChange={(e) => setDateRead(e.target.value)}
                    className="h-9 text-xs bg-background/80"
                  />
                </div>
              )}

              {/* User Review / Personal Notes */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  Personal Thoughts or Review Notes (Optional)
                </label>
                <textarea
                  value={userReview}
                  onChange={(e) => setUserReview(e.target.value)}
                  placeholder="Record your takeaways, memorable quotes, or reading notes..."
                  rows={3}
                  className="w-full rounded-xl border border-border/60 bg-background/80 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              {/* Error Notification */}
              {submitError && (
                <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs">
                  {submitError}
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="shrink-0 pt-4 mt-2 border-t border-border/50 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs font-semibold gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Saving Book...</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5" />
                    <span>Add to Library</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
