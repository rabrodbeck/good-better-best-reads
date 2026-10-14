"use client";

import * as React from "react";
import {
  Trophy,
  Target,
  Pencil,
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { GoalPacingResult } from "@/lib/goals";

interface ReadingGoalWidgetProps {
  initialPacing?: GoalPacingResult | null;
  year?: number;
  compact?: boolean;
  onGoalUpdated?: (newGoal: number) => void;
}

export function ReadingGoalWidget({
  initialPacing,
  year = new Date().getFullYear(),
  compact = false,
  onGoalUpdated,
}: ReadingGoalWidgetProps) {
  const [pacing, setPacing] = React.useState<GoalPacingResult | null>(initialPacing || null);
  const [loading, setLoading] = React.useState(!initialPacing);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [goalInput, setGoalInput] = React.useState(initialPacing?.goal?.toString() || "12");
  const [saving, setSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const fetchGoal = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/goals?year=${year}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.pacing) {
          setPacing(data.pacing);
          setGoalInput(data.pacing.goal.toString());
        }
      }
    } catch (err) {
      console.error("Failed to fetch goal:", err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  React.useEffect(() => {
    if (!initialPacing) {
      fetchGoal();
    } else {
      setPacing(initialPacing);
      setGoalInput(initialPacing.goal.toString());
    }
  }, [initialPacing, fetchGoal]);

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const newGoal = parseInt(goalInput, 10);
    if (isNaN(newGoal) || newGoal < 1 || newGoal > 1000) {
      setErrorMsg("Please enter a goal between 1 and 1000 books.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: newGoal, year }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update goal");
      }

      const data = await res.json();
      if (data?.pacing) {
        setPacing(data.pacing);
      }
      setIsEditDialogOpen(false);
      onGoalUpdated?.(newGoal);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save goal");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !pacing) {
    return (
      <div className="w-full rounded-2xl border border-border/50 bg-card/40 p-4 animate-pulse">
        <div className="h-4 w-40 bg-muted/60 rounded mb-3" />
        <div className="h-3 w-full bg-muted/40 rounded-full" />
      </div>
    );
  }

  if (!pacing) return null;

  const getPacingBadge = () => {
    switch (pacing.status) {
      case "completed":
        return (
          <Badge className="bg-emerald-600 dark:bg-emerald-500 text-white font-bold gap-1 text-[11px] shadow-xs">
            <CheckCircle2 className="size-3" />
            <span>Goal Completed!</span>
          </Badge>
        );
      case "ahead":
        return (
          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-500/40 font-semibold gap-1 text-[11px]">
            <TrendingUp className="size-3 text-emerald-700 dark:text-emerald-400" />
            <span>Ahead by {pacing.diffBooks} book{pacing.diffBooks > 1 ? "s" : ""}</span>
          </Badge>
        );
      case "behind":
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-500/40 font-semibold gap-1 text-[11px]">
            <Clock className="size-3 text-amber-700 dark:text-amber-400" />
            <span>{pacing.diffBooks} book{pacing.diffBooks > 1 ? "s" : ""} behind pace</span>
          </Badge>
        );
      case "on-track":
      default:
        return (
          <Badge className="bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-500/40 font-semibold gap-1 text-[11px]">
            <Target className="size-3 text-blue-700 dark:text-blue-400" />
            <span>Right on track</span>
          </Badge>
        );
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all ${
        pacing.isCompleted
          ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent"
          : "border-border/60 bg-card/60 backdrop-blur-xs"
      } ${compact ? "p-3.5 sm:p-4" : "p-4 sm:p-6"}`}
    >
      {/* Confetti Glow for completed goals */}
      {pacing.isCompleted && (
        <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-emerald-500/15 blur-2xl" />
      )}

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex size-8 sm:size-9 items-center justify-center rounded-xl shrink-0 ${
              pacing.isCompleted
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-primary/10 text-primary"
            }`}
          >
            {pacing.isCompleted ? (
              <Trophy className="size-4 sm:size-5" />
            ) : (
              <Target className="size-4 sm:size-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                {pacing.year} Reading Challenge
              </h3>
              {getPacingBadge()}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{pacing.paceMessage}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditDialogOpen(true)}
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground px-2"
          >
            <Pencil className="size-3" />
            <span>Edit Goal</span>
          </Button>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-foreground">
            {pacing.readCount}{" "}
            <span className="font-normal text-muted-foreground">
              of {pacing.goal} book{pacing.goal > 1 ? "s" : ""} read
            </span>
          </span>
          <span className="font-mono font-bold text-primary">{pacing.percentage}%</span>
        </div>

        {/* Visual Track */}
        <div className="relative h-2.5 sm:h-3 w-full overflow-hidden rounded-full bg-muted/60 border border-border/40">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pacing.isCompleted
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                : "bg-gradient-to-r from-primary via-primary/90 to-emerald-500"
            }`}
            style={{ width: `${Math.min(100, pacing.percentage)}%` }}
          />
        </div>

        {/* Footer Subtitle */}
        {!compact && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>
              {pacing.isCompleted
                ? "🎉 You crushed this year's challenge!"
                : `${pacing.remainingBooks} book${pacing.remainingBooks === 1 ? "" : "s"} left to reach your goal`}
            </span>
            <span>{pacing.daysRemaining} days remaining in {pacing.year}</span>
          </div>
        )}
      </div>

      {/* Edit Goal Modal */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="size-5 text-primary" />
              <span>Set Your {pacing.year} Reading Goal</span>
            </DialogTitle>
            <DialogDescription>
              How many books do you want to read in {pacing.year}? You can change this at any time.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveGoal} className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="goal-input" className="text-xs font-semibold text-foreground">
                Target Number of Books
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  onClick={() => {
                    const val = Math.max(1, (parseInt(goalInput, 10) || 12) - 1);
                    setGoalInput(val.toString());
                  }}
                >
                  -
                </Button>
                <Input
                  id="goal-input"
                  type="number"
                  min="1"
                  max="1000"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className="text-center font-bold text-lg h-9"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  onClick={() => {
                    const val = Math.min(1000, (parseInt(goalInput, 10) || 12) + 1);
                    setGoalInput(val.toString());
                  }}
                >
                  +
                </Button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center justify-center gap-1.5 pt-2">
                {[12, 24, 36, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setGoalInput(preset.toString())}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      goalInput === preset.toString()
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border/60 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="size-3.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="font-semibold">
                {saving ? "Saving..." : "Save Goal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
