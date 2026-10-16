"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Camera,
  ArrowLeft,
  Sparkles,
  BookMarked,
  Check,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  Plus,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BarcodeScannerView } from "@/components/scan/barcode-scanner-view";
import { LibrarianVerdictCard } from "@/components/library/librarian-verdict-card";

interface ScannedBook {
  id?: string;
  title: string;
  author: string;
  isbn?: string | null;
  cover_url?: string | null;
  page_count?: number | null;
  published_year?: number | null;
  genres?: string[];
  description?: string | null;
}

function ScanPageContent() {
  const searchParams = useSearchParams();
  const isbnParam = searchParams.get("isbn") || searchParams.get("q");

  const [activeIsbn, setActiveIsbn] = React.useState<string | null>(isbnParam || null);
  const [loadingBook, setLoadingBook] = React.useState(false);
  const [book, setBook] = React.useState<ScannedBook | null>(null);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  // Shelf assignment state
  const [addingShelf, setAddingShelf] = React.useState<string | null>(null);
  const [addedShelf, setAddedShelf] = React.useState<string | null>(null);
  const [existingShelf, setExistingShelf] = React.useState<string | null>(null);

  // Lookup book by ISBN
  const lookupIsbn = React.useCallback(async (isbnToFetch: string) => {
    const cleanIsbn = isbnToFetch.replace(/[-\s]/g, "").trim();
    setActiveIsbn(cleanIsbn || isbnToFetch);
    setLoadingBook(true);
    setFetchError(null);
    setAddedShelf(null);
    setExistingShelf(null);

    try {
      // Parallelize book search and user library shelf check
      const searchPromise = fetch(`/api/books/search?q=${encodeURIComponent(cleanIsbn)}`);
      const libraryPromise = fetch("/api/library").catch(() => null);

      const [searchRes, libRes] = await Promise.all([searchPromise, libraryPromise]);
      const searchData = await searchRes.json();
      const items = searchData.results || searchData.books || [];

      if (!searchRes.ok || items.length === 0) {
        throw new Error("Could not find book details for this barcode. Try searching by title.");
      }

      const match = items[0];
      const bookData: ScannedBook = {
        title: match.title,
        author: match.author,
        isbn: match.isbn13 || match.isbn || cleanIsbn,
        cover_url: match.cover_url || null,
        page_count: match.page_count || null,
        published_year: match.published_year || null,
        genres: match.genres || [],
        description: match.description || match.snippet || null,
      };

      setBook(bookData);

      // 2. Check if user already has this book in their library
      if (libRes && libRes.ok) {
        try {
          const libData = await libRes.json();
          const libraryBooks = libData.books || libData.library || [];
          const existing = libraryBooks.find(
            (b: any) =>
              (b.isbn && b.isbn === cleanIsbn) ||
              (b.title?.toLowerCase() === match.title?.toLowerCase() &&
                b.author?.toLowerCase() === match.author?.toLowerCase())
          );
          if (existing) {
            setExistingShelf(existing.shelf);
          }
        } catch {}
      }
    } catch (err: any) {
      console.error("Scan lookup error:", err);
      setFetchError(err.message || "Failed to find book details.");
    } finally {
      setLoadingBook(false);
    }
  }, []);

  // Handle URL param pre-load
  React.useEffect(() => {
    if (isbnParam && !book) {
      lookupIsbn(isbnParam);
    }
  }, [isbnParam, book, lookupIsbn]);

  // Add book to library shelf
  const handleAddToShelf = async (shelf: "to-read" | "currently-reading") => {
    if (!book) return;
    setAddingShelf(shelf);

    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          cover_url: book.cover_url,
          page_count: book.page_count,
          published_year: book.published_year,
          genres: book.genres,
          description: book.description,
          shelf,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add to shelf");
      }

      setAddedShelf(shelf);
      setExistingShelf(shelf);
    } catch (err: any) {
      console.error("Error adding scanned book:", err);
    } finally {
      setAddingShelf(null);
    }
  };

  const handleResetScanner = () => {
    setBook(null);
    setActiveIsbn(null);
    setFetchError(null);
    setAddedShelf(null);
    setExistingShelf(null);
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-4 sm:py-8 pb-28 sm:pb-16 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <Link href="/library">
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            <span>My Shelves</span>
          </Button>
        </Link>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="border-primary/40 text-primary text-[10px] uppercase font-bold gap-1">
            <Sparkles className="size-3" />
            <span>In-Store Scout</span>
          </Badge>
        </div>
      </div>

      {/* Main View: Camera Viewfinder or Scanned Verdict */}
      {!book && !loadingBook && (
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center justify-center gap-2">
              <Camera className="size-6 text-primary" />
              <span>Scan Book Barcode</span>
            </h1>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Point your phone at the ISBN barcode on the back cover of any physical book in a bookstore or library.
            </p>
          </div>

          <BarcodeScannerView onScanSuccess={lookupIsbn} active={true} />

          {fetchError && (
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400 text-center animate-in fade-in">
              {fetchError}
            </div>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {loadingBook && (
        <div className="py-16 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in">
          <div className="relative">
            <div className="size-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Sparkles className="size-6 text-primary absolute inset-0 m-auto" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Scouting Book Details...</h3>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              ISBN: {activeIsbn}
            </p>
          </div>
        </div>
      )}

      {/* Scanned Book & Librarian Verdict Card */}
      {book && !loadingBook && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Book Header Card */}
          <Card className="border-border/60 bg-card/60 backdrop-blur-xs overflow-hidden shadow-lg">
            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start text-center sm:text-left">
              {/* Cover Art */}
              <div className="relative w-28 sm:w-32 aspect-2/3 shrink-0 rounded-lg overflow-hidden border border-border/50 shadow-md bg-muted/40">
                {book.cover_url ? (
                  <Image
                    src={book.cover_url}
                    alt={book.title}
                    fill
                    sizes="128px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground p-2">
                    {book.title}
                  </div>
                )}
              </div>

              {/* Details & Actions */}
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-foreground leading-snug">
                    {book.title}
                  </h2>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">
                    by <span className="text-foreground font-semibold">{book.author}</span>
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-2">
                    {book.published_year && (
                      <Badge variant="secondary" className="text-[10px] py-0 px-2 font-mono">
                        {book.published_year}
                      </Badge>
                    )}
                    {book.page_count && (
                      <Badge variant="secondary" className="text-[10px] py-0 px-2 font-mono">
                        {book.page_count} pages
                      </Badge>
                    )}
                    {existingShelf && (
                      <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400 py-0 px-2 font-bold capitalize">
                        ✓ On your {existingShelf.replace("-", " ")} shelf
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Quick Shelf Action Buttons */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => handleAddToShelf("to-read")}
                    disabled={addingShelf === "to-read" || existingShelf === "to-read"}
                    className="text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-xs"
                  >
                    {addingShelf === "to-read" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : existingShelf === "to-read" || addedShelf === "to-read" ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                    <span>
                      {existingShelf === "to-read" || addedShelf === "to-read"
                        ? "In Want to Read"
                        : "+ Want to Read"}
                    </span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddToShelf("currently-reading")}
                    disabled={addingShelf === "currently-reading" || existingShelf === "currently-reading"}
                    className="text-xs font-semibold gap-1.5"
                  >
                    {addingShelf === "currently-reading" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : existingShelf === "currently-reading" || addedShelf === "currently-reading" ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <BookOpen className="size-3.5 text-primary" />
                    )}
                    <span>
                      {existingShelf === "currently-reading" || addedShelf === "currently-reading"
                        ? "Currently Reading"
                        : "Start Reading Now"}
                    </span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Librarian In-Store Verdict Card */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              Librarian In-Store Verdict
            </h3>
            <LibrarianVerdictCard
              book={{
                title: book.title,
                author: book.author,
                isbn: book.isbn,
                published_year: book.published_year,
                genres: book.genres,
                snippet: book.description,
              }}
              autoFetch={true}
            />
          </div>

          {/* Scan Next Action Button */}
          <div className="pt-2 text-center">
            <Button
              size="lg"
              variant="outline"
              onClick={handleResetScanner}
              className="gap-2 text-xs font-bold border-primary/40 hover:bg-primary/10 shadow-sm w-full sm:w-auto"
            >
              <RotateCcw className="size-4 text-primary" />
              <span>Scan Another Book</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScanPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-24 text-center">
          <Loader2 className="size-8 animate-spin text-primary mx-auto" />
        </div>
      }
    >
      <ScanPageContent />
    </React.Suspense>
  );
}
