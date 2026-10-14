"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Send,
  Sparkles,
  Users,
  Check,
  AlertCircle,
  Loader2,
  X,
  BookOpen,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface BookToRecommend {
  id: string;
  title: string;
  author: string;
  cover_url?: string | null;
}

export interface FriendOption {
  id: string;
  display_name: string;
  avatar_url: string | null;
  taste_archetype?: string | null;
}

interface RecommendBookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: BookToRecommend | null;
  initialFriendId?: string | null;
  onRecommendationSent?: (rec: any) => void;
}

export function RecommendBookModal({
  open,
  onOpenChange,
  book,
  initialFriendId,
  onRecommendationSent,
}: RecommendBookModalProps) {
  const [friends, setFriends] = React.useState<FriendOption[]>([]);
  const [loadingFriends, setLoadingFriends] = React.useState(true);
  const [selectedFriendId, setSelectedFriendId] = React.useState<string>(initialFriendId || "");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  // Fetch accepted friends when modal opens
  React.useEffect(() => {
    if (!open) {
      setSuccess(false);
      setError(null);
      setNote("");
      return;
    }

    if (initialFriendId) {
      setSelectedFriendId(initialFriendId);
    }

    setLoadingFriends(true);
    fetch("/api/friends")
      .then((res) => res.json())
      .then((data) => {
        const friendList = (data.friends || []).map((f: any) => ({
          id: f.friend.id,
          display_name: f.friend.display_name,
          avatar_url: f.friend.avatar_url,
          taste_archetype: f.friend.taste_archetype,
        }));
        setFriends(friendList);
        if (!initialFriendId && friendList.length > 0 && !selectedFriendId) {
          setSelectedFriendId(friendList[0].id);
        }
      })
      .catch((err) => console.error("Error fetching friends:", err))
      .finally(() => setLoadingFriends(false));
  }, [open, initialFriendId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book || !selectedFriendId) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/friends/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: selectedFriendId,
          bookId: book.id,
          note: note.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to send recommendation");
      }

      setSuccess(true);
      if (onRecommendationSent) {
        onRecommendationSent(json.recommendation);
      }
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
        setNote("");
      }, 1800);
    } catch (err: any) {
      setError(err.message || "Failed to recommend book");
    } finally {
      setSubmitting(false);
    }
  };

  if (!book) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 bg-card border-border/80 shadow-2xl">
        <DialogHeader className="mb-2">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Sparkles className="size-5 text-amber-400" />
            <span>Recommend to a Friend</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Share &ldquo;{book.title}&rdquo; directly with your reading buddy.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-in zoom-in-75">
              <Check className="size-7" />
            </div>
            <h4 className="text-base font-bold text-foreground">Recommendation Sent!</h4>
            <p className="text-xs text-muted-foreground max-w-xs">
              We added &ldquo;{book.title}&rdquo; to your friend&apos;s recommendations queue.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Book Preview Card */}
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/30">
              {book.cover_url ? (
                <div className="relative w-10 h-14 rounded-xs overflow-hidden shrink-0 border border-border/40">
                  <Image
                    src={book.cover_url}
                    alt={book.title}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex w-10 h-14 items-center justify-center rounded-xs bg-muted text-muted-foreground shrink-0 border border-border/40">
                  <BookOpen className="size-4" />
                </div>
              )}
              <div className="min-w-0">
                <h5 className="text-xs font-bold text-foreground truncate">{book.title}</h5>
                <p className="text-[11px] text-muted-foreground truncate">{book.author}</p>
              </div>
            </div>

            {/* Friend Selector */}
            {loadingFriends ? (
              <div className="py-4 flex items-center justify-center text-xs text-muted-foreground gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>Loading friends...</span>
              </div>
            ) : friends.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border/80 text-center space-y-2 bg-muted/20">
                <Users className="size-6 text-muted-foreground mx-auto" />
                <p className="text-xs text-muted-foreground">
                  You haven&apos;t added any reading buddies yet.
                </p>
                <Link href="/friends" onClick={() => onOpenChange(false)}>
                  <Button size="sm" variant="outline" className="text-xs mt-1">
                    Go to Friends Hub
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Choose Friend</label>
                <select
                  value={selectedFriendId}
                  onChange={(e) => setSelectedFriendId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  {friends.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.display_name} {f.taste_archetype ? `(${f.taste_archetype})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Personal Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Personal Pitch / Note <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. I couldn't put this down—the pacing is relentless and right up your alley!"
                maxLength={300}
                rows={3}
                className="w-full rounded-lg border border-border bg-card p-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <div className="flex justify-end">
                <span className="text-[10px] text-muted-foreground">{note.length}/300</span>
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit & Cancel */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || friends.length === 0 || !selectedFriendId}
                className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" />
                    <span>Send Recommendation</span>
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
