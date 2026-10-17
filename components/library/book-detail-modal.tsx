"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  Calendar,
  FileText,
  Star,
  Sparkles,
  Layers,
  Share2,
  Trash2,
  Send,
  X,
  Check,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseSeriesInfo } from "@/lib/series";
import { shareBook } from "@/lib/share";

export interface BookDetailItem {
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
  description?: string | null;
}

interface BookDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: BookDetailItem | null;
  onShelfChange?: (book: BookDetailItem, newShelf: BookDetailItem["shelf"]) => void;
  onRatingChange?: (book: BookDetailItem, newRating: number | null) => void;
  onBookDeleted?: (book: BookDetailItem) => void;
  onRecommend?: (book: BookDetailItem) => void;
}

export function BookDetailModal({
  open,
  onOpenChange,
  book,
  onShelfChange,
  onRatingChange,
  onBookDeleted,
  onRecommend,
}: BookDetailModalProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setShowDeleteConfirm(false);
    setDeleteError(null);
    setImgError(false);
  }, [book, open]);

  const optimizedCoverUrl = React.useMemo(() => {
    if (!book?.cover_url) return null;
    return book.cover_url.replace(/-M\.jpg(\?.*)?$/, "-L.jpg$1");
  }, [book?.cover_url]);

  if (!book) return null;

  const seriesInfo = parseSeriesInfo(book.title);
  const cleanTitle = seriesInfo ? seriesInfo.cleanTitle : book.title;

  const isSpeculativeIsbn = optimizedCoverUrl?.includes("/b/isbn/") ?? false;

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: book.id, book_id: book.book_id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove book");
      }

      onBookDeleted?.(book);
      onOpenChange(false);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete book");
    } finally {
      setIsDeleting(false);
    }
  };

  const shelves: Array<{ key: BookDetailItem["shelf"]; label: string; activeClass: string }> = [
    { key: "to-read", label: "Want to Read", activeClass: "bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400 font-bold" },
    { key: "currently-reading", label: "Reading Now", activeClass: "bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold" },
    { key: "read", label: "Read", activeClass: "bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 font-bold" },
    { key: "did-not-finish", label: "DNF", activeClass: "bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400 font-bold" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl bg-card border-border/60 shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{book.title}</DialogTitle>
        </DialogHeader>

        {/* Modal Header Cover & Metadata */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-b from-muted/50 via-card/80 to-card border-b border-border/40">
          <div className="flex gap-4 sm:gap-5 items-start">
            {/* Large Cover Art */}
            <div className="relative w-28 sm:w-32 aspect-2/3 shrink-0 rounded-xl overflow-hidden border border-border/60 shadow-md bg-muted/40">
              {optimizedCoverUrl && !imgError ? (
                <Image
                  src={optimizedCoverUrl}
                  alt={book.title}
                  fill
                  sizes="128px"
                  unoptimized={isSpeculativeIsbn}
                  className="object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-muted-foreground bg-muted">
                  {book.title}
                </div>
              )}
            </div>

            {/* Title, Author, Series & Metadata */}
            <div className="flex-1 min-w-0 space-y-2">
              {seriesInfo && (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-md px-2 py-0.5 w-fit">
                  <Layers className="size-3" />
                  <span className="truncate">{seriesInfo.displaySeries}</span>
                </div>
              )}

              <h3 className="text-base sm:text-lg font-black text-foreground leading-snug">
                {cleanTitle}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                by <span className="text-foreground font-semibold">{book.author}</span>
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {book.published_year && (
                  <Badge variant="secondary" className="text-[10px] gap-1 font-mono py-0">
                    <Calendar className="size-2.5" />
                    <span>{book.published_year}</span>
                  </Badge>
                )}
                {book.page_count && (
                  <Badge variant="secondary" className="text-[10px] gap-1 font-mono py-0">
                    <FileText className="size-2.5" />
                    <span>{book.page_count} pages</span>
                  </Badge>
                )}
                {(book.isbn13 || book.isbn) && (
                  <Badge variant="outline" className="text-[10px] font-mono py-0 text-muted-foreground">
                    ISBN: {book.isbn13 || book.isbn}
                  </Badge>
                )}
                {book.shelf === "read" && (
                  book.date_read ? (
                    <Badge variant="outline" className="text-[10px] gap-1 font-mono py-0 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                      <Check className="size-2.5" />
                      <span>Read {new Date(book.date_read).getFullYear()}</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-1 font-semibold text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 py-0">
                      <Sparkles className="size-2.5" />
                      <span>Lifetime Read</span>
                    </Badge>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Controls: Shelf Switcher & Rating */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Shelf Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              Shelf Status
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {shelves.map((s) => {
                const isActive = book.shelf === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => onShelfChange?.(book, s.key)}
                    className={`py-2 px-2.5 rounded-xl border text-xs text-center transition-all ${
                      isActive
                        ? s.activeClass
                        : "border-border/60 hover:border-foreground/30 text-muted-foreground hover:text-foreground bg-card/40"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5-Star Rating Control */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              Your Rating
            </label>
            <div className="flex items-center gap-1.5 p-3 rounded-xl border border-border/50 bg-muted/20 w-fit">
              {[1, 2, 3, 4, 5].map((starVal) => {
                const isFilled = book.rating !== null && book.rating >= starVal;
                return (
                  <button
                    key={starVal}
                    type="button"
                    onClick={() => onRatingChange?.(book, book.rating === starVal ? null : starVal)}
                    title={book.rating === starVal ? "Clear rating" : `Rate ${starVal} star${starVal > 1 ? "s" : ""}`}
                    className="p-1.5 rounded-md hover:scale-125 transition-transform"
                  >
                    <Star
                      className={`size-6 transition-colors ${
                        isFilled
                          ? "fill-amber-500 text-amber-500"
                          : "text-muted-foreground/30 hover:text-amber-500/50"
                      }`}
                    />
                  </button>
                );
              })}
              <span className="text-xs font-mono font-bold text-foreground ml-2 min-w-[32px]">
                {book.rating ? `${book.rating}★` : <span className="text-muted-foreground/60 italic font-normal">None</span>}
              </span>
            </div>
          </div>

          {/* Book Synopsis / User Review if present */}
          {book.user_review && (
            <div className="p-3.5 rounded-xl border border-border/50 bg-muted/30 space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                Your Review / Notes
              </span>
              <p className="text-xs text-foreground/90 leading-relaxed italic">
                &ldquo;{book.user_review}&rdquo;
              </p>
            </div>
          )}

          {/* Utility Action Buttons */}
          <div className="pt-2 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link
              href={`/chat?q=${encodeURIComponent(`What makes "${cleanTitle}" by ${book.author} unique? Recommend 3 books that match its pacing and tropes.`)}`}
              onClick={() => onOpenChange(false)}
            >
              <Button size="sm" variant="outline" className="w-full text-xs font-semibold gap-1.5 justify-center">
                <Sparkles className="size-3.5 text-primary" />
                <span>Ask Librarian About This</span>
              </Button>
            </Link>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onRecommend?.(book);
                onOpenChange(false);
              }}
              className="w-full text-xs font-semibold gap-1.5 justify-center"
            >
              <Send className="size-3.5 text-blue-400" />
              <span>Recommend to Friend</span>
            </Button>
          </div>

          {/* Delete Book Danger Zone */}
          <div className="pt-2 border-t border-border/40">
            {showDeleteConfirm ? (
              <div className="p-3.5 rounded-xl border border-destructive/40 bg-destructive/10 space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-xs font-bold text-destructive">
                  <AlertTriangle className="size-4" />
                  <span>Remove this book from your library?</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  This will remove your rating and shelf record from TBRScout.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="h-8 text-xs font-bold gap-1.5"
                  >
                    {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    <span>Confirm Remove</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
                {deleteError && (
                  <p className="text-[11px] text-rose-500 font-medium">{deleteError}</p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-destructive transition-colors py-1"
              >
                <Trash2 className="size-3.5" />
                <span>Remove book from library</span>
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
