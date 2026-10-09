"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowLeft,
  BookOpen,
  Star,
  Check,
  AlertTriangle,
  Lock,
  Layers,
  Heart,
  Flame,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OverlapResult } from "@/lib/friends";

interface CompareApiResponse {
  friend: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    tasteArchetype: string;
  };
  me: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    tasteArchetype: string;
  };
  overlap: OverlapResult;
}

export default function FriendComparePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const friendId = params?.id;

  const [data, setData] = React.useState<CompareApiResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!friendId) return;

    fetch(`/api/friends/${friendId}/compare`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to compare tastes");
        return json;
      })
      .then((json) => setData(json))
      .catch((err) => setError(err instanceof Error ? err.message : "Access restricted"))
      .finally(() => setLoading(false));
  }, [friendId]);

  if (loading) {
    return (
      <div className="container mx-auto flex flex-col items-center justify-center py-28 text-muted-foreground">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
        <span className="text-xs">Computing 768-dim Taste Overlap...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-20 text-center">
        <Card className="border-border/60 bg-card/60 backdrop-blur-md p-8">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mx-auto mb-4">
            <Lock className="size-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Comparison Restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {error || "Could not load taste comparison."}
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

  const { me, friend, overlap } = data;
  const { tasteComparison, sharedReads, recommendationsForYou, recommendationsForThem, stats } = overlap;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/friends"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Reading Buddies</span>
        </Link>

        <Link href={`/friends/${friend.id}/library`}>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs font-medium">
            <BookOpen className="size-3.5 text-primary" />
            <span>View {friend.displayName}&apos;s Shelves</span>
          </Button>
        </Link>
      </div>

      {/* Hero Match Banner */}
      <Card className="border-border/60 bg-gradient-to-br from-card via-card/80 to-primary/5 p-6 sm:p-8 backdrop-blur-md shadow-lg mb-8 overflow-hidden relative">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* User A */}
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="relative size-14 rounded-full overflow-hidden bg-primary/10 text-primary font-bold flex items-center justify-center text-lg border-2 border-primary/30 shrink-0">
              {me.avatarUrl ? (
                <Image src={me.avatarUrl} alt={me.displayName} fill className="object-cover" />
              ) : (
                <span>{me.displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                You
              </span>
              <h3 className="text-base font-bold text-foreground">{me.displayName}</h3>
              <Badge variant="outline" className="text-[10px] mt-1 border-primary/30 text-primary">
                {me.tasteArchetype}
              </Badge>
            </div>
          </div>

          {/* Center Compatibility Gauge */}
          <div className="flex flex-col items-center justify-center text-center px-4 py-2 rounded-2xl bg-muted/40 border border-border/50">
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-1 mb-1">
              <Sparkles className="size-3 text-amber-400" />
              <span>Taste Blend</span>
            </span>
            <div className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400">
              {stats.tasteMatchPercentage}%
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 font-medium">
              Compatibility Match
            </span>
          </div>

          {/* User B */}
          <div className="flex items-center gap-3 text-center sm:text-right flex-row-reverse sm:flex-row">
            <div className="sm:text-right">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Buddy
              </span>
              <h3 className="text-base font-bold text-foreground">{friend.displayName}</h3>
              <Badge variant="outline" className="text-[10px] mt-1 border-emerald-500/30 text-emerald-400">
                {friend.tasteArchetype}
              </Badge>
            </div>
            <div className="relative size-14 rounded-full overflow-hidden bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center text-lg border-2 border-emerald-500/30 shrink-0">
              {friend.avatarUrl ? (
                <Image src={friend.avatarUrl} alt={friend.displayName} fill className="object-cover" />
              ) : (
                <span>{friend.displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Section 1: Taste DNA Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Pacing & Tone Card */}
        <Card className="border-border/60 bg-card/60 p-5 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Zap className="size-3.5 text-amber-400" />
            <span>Pacing & Emotional Tone</span>
          </h4>

          <div className="space-y-3">
            <div className="rounded-xl border border-border/40 bg-muted/30 p-3">
              <div className="flex justify-between items-baseline text-xs mb-1">
                <span className="font-semibold text-foreground">Preferred Pacing</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">You:</span>
                  <span className="font-medium text-primary">{tasteComparison.myPacing || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">{friend.displayName}:</span>
                  <span className="font-medium text-emerald-400">{tasteComparison.friendPacing || "—"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-muted/30 p-3">
              <div className="flex justify-between items-baseline text-xs mb-1">
                <span className="font-semibold text-foreground">Emotional Tone</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">You:</span>
                  <span className="font-medium text-primary">{tasteComparison.myTone || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">{friend.displayName}:</span>
                  <span className="font-medium text-emerald-400">{tasteComparison.friendTone || "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Trope Overlap Card */}
        <Card className="border-border/60 bg-card/60 p-5 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Heart className="size-3.5 text-rose-400" />
            <span>Trope Overlap Analysis</span>
          </h4>

          <div className="space-y-3">
            {/* Shared Tropes */}
            <div>
              <span className="text-[11px] font-semibold text-emerald-400 block mb-1.5">
                Mutual Loved Tropes ({tasteComparison.sharedTropes.length})
              </span>
              {tasteComparison.sharedTropes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No identical tropes cataloged yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tasteComparison.sharedTropes.map((t) => (
                    <Badge key={t} className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300 text-xs gap-1">
                      <Check className="size-3" />
                      <span>{t}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Unique to each */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold block mb-1">Your Tropes:</span>
                <div className="flex flex-wrap gap-1">
                  {tasteComparison.uniqueToMeTropes.slice(0, 3).map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px] text-primary/90">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground font-semibold block mb-1">{friend.displayName}&apos;s:</span>
                <div className="flex flex-wrap gap-1">
                  {tasteComparison.uniqueToFriendTropes.slice(0, 3).map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px] text-emerald-400/90">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Dealbreaker Clash Warning (if applicable) */}
      {tasteComparison.dealbreakerClashes.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 p-4 mb-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                Dealbreaker Clash Detected
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tasteComparison.dealbreakerClashes.map((c, idx) => (
                  <span key={idx} className="block mt-1">
                    &bull; <strong>{c.trope}</strong> is loved by {c.lovedBy === "me" ? "you" : friend.displayName}, but is a strict dealbreaker for {c.dealbreakerFor === "me" ? "you" : friend.displayName}!
                  </span>
                ))}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Section 2: Shared Reads (Rating Contrast) */}
      <div className="mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Shared Reads ({sharedReads.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Books both of you have cataloged, compared side-by-side.
            </p>
          </div>
          {stats.avgRatingDelta !== null && (
            <span className="text-xs text-muted-foreground font-mono">
              Avg Rating Gap: <strong>{stats.avgRatingDelta}★</strong>
            </span>
          )}
        </div>

        {sharedReads.length === 0 ? (
          <Card className="border-dashed border-border/80 bg-card/40 py-12 text-center">
            <p className="text-xs text-muted-foreground italic">
              You haven&apos;t logged any books in common yet.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {sharedReads.map((book) => (
              <Card key={book.bookId} className="border-border/60 bg-card/60 p-4 flex gap-3">
                {book.coverUrl && (
                  <div className="relative w-12 h-18 rounded-xs overflow-hidden shrink-0 border border-border/40">
                    <Image src={book.coverUrl} alt={book.title} fill className="object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex flex-col justify-between flex-1">
                  <div>
                    <h5 className="text-xs font-bold text-foreground line-clamp-1 leading-tight">
                      {book.title}
                    </h5>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {book.author}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">You:</span>
                      <span className="font-bold text-amber-400">{book.myRating ? `${book.myRating}★` : "—"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{friend.displayName}:</span>
                      <span className="font-bold text-emerald-400">{book.friendRating ? `${book.friendRating}★` : "—"}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Peer Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recommendations for You */}
        <Card className="border-border/60 bg-card/60 p-5">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-4 text-emerald-400" />
              <span>Recommendations from {friend.displayName}</span>
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Highly rated by your buddy that you haven&apos;t read yet.
            </p>
          </div>

          {recommendationsForYou.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-6 text-center">
              No new recommendations found from this shelf.
            </p>
          ) : (
            <div className="space-y-2.5">
              {recommendationsForYou.map((rec) => (
                <div
                  key={rec.bookId}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-border/40 bg-muted/30"
                >
                  {rec.coverUrl && (
                    <div className="relative w-8 h-12 rounded-xs overflow-hidden shrink-0 border border-border/40">
                      <Image src={rec.coverUrl} alt={rec.title} fill className="object-cover" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-bold text-foreground line-clamp-1">{rec.title}</h5>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{rec.author}</p>
                    <span className="text-[10px] text-emerald-400 font-medium">{rec.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recommendations for Them */}
        <Card className="border-border/60 bg-card/60 p-5">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-4 text-primary" />
              <span>Recommendations for {friend.displayName}</span>
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Books you rated highly that your buddy hasn&apos;t read yet.
            </p>
          </div>

          {recommendationsForThem.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-6 text-center">
              No recommendations found from your shelf.
            </p>
          ) : (
            <div className="space-y-2.5">
              {recommendationsForThem.map((rec) => (
                <div
                  key={rec.bookId}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-border/40 bg-muted/30"
                >
                  {rec.coverUrl && (
                    <div className="relative w-8 h-12 rounded-xs overflow-hidden shrink-0 border border-border/40">
                      <Image src={rec.coverUrl} alt={rec.title} fill className="object-cover" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-bold text-foreground line-clamp-1">{rec.title}</h5>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{rec.author}</p>
                    <span className="text-[10px] text-primary font-medium">{rec.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
