"use client";

import * as React from "react";
import Image from "next/image";
import {
  Sparkles,
  Zap,
  Coffee,
  Brain,
  Moon,
  Search,
  Dice5,
  BookOpen,
  ArrowRight,
  Loader2,
  Check,
  RefreshCw,
  Clock,
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

export interface ConciergePick {
  userBookId: string;
  bookId: string;
  title: string;
  author: string;
  coverUrl?: string | null;
  pageCount?: number | null;
  matchHeadline: string;
  pitch: string;
  vibeTags: string[];
}

interface ShelfConciergeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartReading?: (pick: ConciergePick) => void;
  toReadCount?: number;
}

const MOOD_PRESETS = [
  { id: "Fast-Paced & Gripping", label: "Fast & Gripping", icon: Zap, desc: "High momentum, breathless stakes" },
  { id: "Cozy & Uplifting", label: "Cozy & Uplifting", icon: Coffee, desc: "Comfort read, low stress, warm" },
  { id: "Cerebral & Deep", label: "Cerebral & Deep", icon: Brain, desc: "Rich worldbuilding, philosophical" },
  { id: "Dark & Atmospheric", label: "Dark & Atmospheric", icon: Moon, desc: "Moody, gothic, morally grey" },
  { id: "Mystery & Mind Games", label: "Mystery & Twists", icon: Search, desc: "Puzzles, reveals, mind-benders" },
  { id: "Surprise Me", label: "Surprise Me", icon: Dice5, desc: "Best overall match for your Taste DNA" },
];

export function ShelfConciergeModal({
  open,
  onOpenChange,
  onStartReading,
  toReadCount = 0,
}: ShelfConciergeModalProps) {
  const [selectedMood, setSelectedMood] = React.useState<string>("Fast-Paced & Gripping");
  const [customPrompt, setCustomPrompt] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<string | null>(null);
  const [picks, setPicks] = React.useState<ConciergePick[]>([]);
  const [startingBookId, setStartingBookId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      // Keep results so user can re-open, but reset error
      setError(null);
    }
  }, [open]);

  const handleAskConcierge = async (moodToUse = selectedMood) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/librarian/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood: moodToUse,
          customPrompt: customPrompt.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to get shelf recommendations");
      }

      setSummary(data.summary || null);
      setPicks(data.picks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  };

  const handleStartBook = async (pick: ConciergePick) => {
    setStartingBookId(pick.bookId);
    try {
      if (onStartReading) {
        await onStartReading(pick);
      }
      onOpenChange(false);
    } catch (err) {
      console.error("Error starting book:", err);
    } finally {
      setStartingBookId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-6 bg-card border-border/80 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Sparkles className="size-5 text-amber-500" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-foreground">
                What Should I Read Next?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Your AI Librarian scans your {toReadCount > 0 ? `${toReadCount} ` : ""}Want-to-Read books against your Reading DNA.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* State A: Results Mode */}
        {picks.length > 0 && !loading ? (
          <div className="space-y-5 animate-in fade-in duration-200">
            {summary && (
              <div className="rounded-xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 italic leading-relaxed">
                &ldquo;{summary}&rdquo;
              </div>
            )}

            <div className="space-y-3">
              {picks.map((pick) => (
                <div
                  key={pick.bookId}
                  className="group flex flex-col sm:flex-row items-start gap-4 p-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-xs hover:border-primary/50 transition-all shadow-xs"
                >
                  {/* Cover */}
                  <div className="relative aspect-[2/3] w-20 sm:w-24 rounded-md overflow-hidden bg-muted/60 border border-border/40 shrink-0 shadow-2xs">
                    {pick.coverUrl ? (
                      <Image
                        src={pick.coverUrl}
                        alt={pick.title}
                        fill
                        sizes="96px"
                        unoptimized={pick.coverUrl.includes("/b/isbn/")}
                        className="object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground p-2 text-center text-[10px] font-semibold">
                        <BookOpen className="size-5 mb-1 opacity-50" />
                        <span>{pick.title}</span>
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="min-w-0 flex-1 flex flex-col justify-between h-full space-y-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <Badge className="bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 text-[10px] py-0 px-2 font-bold">
                          {pick.matchHeadline}
                        </Badge>
                        {pick.pageCount && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="size-3" />
                            <span>{pick.pageCount}p</span>
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-foreground leading-snug">
                        {pick.title}
                      </h4>
                      <p className="text-xs text-muted-foreground font-medium">
                        {pick.author}
                      </p>

                      <p className="text-xs text-foreground/80 mt-1.5 leading-relaxed">
                        {pick.pitch}
                      </p>

                      {pick.vibeTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {pick.vibeTags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground font-medium border border-border/40"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleStartBook(pick)}
                        disabled={startingBookId === pick.bookId}
                        className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {startingBookId === pick.bookId ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            <span>Moving to Currently Reading...</span>
                          </>
                        ) : (
                          <>
                            <BookOpen className="size-3.5" />
                            <span>Start Reading Now</span>
                            <ArrowRight className="size-3 ml-0.5" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Reset Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPicks([])}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="size-3" />
                <span>Try a Different Mood</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* State B: Mood & Prompt Selector Mode */
          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold text-foreground block mb-2">
                What kind of reading experience do you want right now?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {MOOD_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const isSelected = selectedMood === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedMood(preset.id)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                          : "bg-muted/30 border-border/60 hover:bg-muted/60 hover:border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <Icon className={`size-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        {isSelected && <Check className="size-3 text-primary font-bold" />}
                      </div>
                      <div>
                        <div className={`text-xs font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {preset.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                          {preset.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Request Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Specific Request or Constraints <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. Under 350 pages, a standalone, or something with high stakes"
                className="w-full h-9 rounded-lg border border-border/70 bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
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
                type="button"
                size="sm"
                disabled={loading}
                onClick={() => handleAskConcierge()}
                className="gap-2 text-xs font-semibold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Librarian is evaluating your shelf...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5 text-amber-300" />
                    <span>Pick My Next Book</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
