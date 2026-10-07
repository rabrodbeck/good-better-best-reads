"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Zap,
  BookOpen,
  RotateCcw,
  Check,
  Save,
  MessageSquare,
  Flame,
  ShieldAlert,
  Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const GENRE_OPTIONS = [
  { id: "Psychological Thriller", label: "Psychological Thriller", desc: "Twists, unreliable narrators, paranoia" },
  { id: "Sci-Fi & Speculative", label: "Sci-Fi & Speculative", desc: "High concept, space, AI, existential questions" },
  { id: "Dark Romance", label: "Dark Romance", desc: "High stakes, morally gray, intense chemistry" },
  { id: "Horror & Gothic", label: "Horror & Gothic", desc: "Atmospheric dread, haunted minds, visceral chills" },
  { id: "Mystery & Detective", label: "Mystery & Detective", desc: "Clever clues, procedural investigations, whodunits" },
  { id: "Dystopian & Survival", label: "Dystopian & Survival", desc: "Grim societies, desperate stakes, escape" },
  { id: "Fantasy & Magic", label: "Fantasy & Magic", desc: "Intricate worldbuilding, folklore, power dynamics" },
  { id: "Literary Fiction", label: "Literary Fiction", desc: "Prose craftsmanship, deep character interiority" },
];

const PACING_OPTIONS = [
  {
    id: "Breakneck & Kinetic",
    label: "Breakneck & Kinetic",
    desc: "Immediate hook on page one, short chapters, relentless momentum, zero fluff.",
  },
  {
    id: "Fast & Propulsive",
    label: "Fast & Propulsive",
    desc: "A gripping page-turner with escalating tension and well-timed revelations.",
  },
  {
    id: "Balanced & Immersive",
    label: "Balanced & Immersive",
    desc: "Room for atmospheric worldbuilding and character relationships without dragging.",
  },
  {
    id: "Atmospheric Slow-Burn",
    label: "Atmospheric Slow-Burn",
    desc: "Deliberate buildup, simmering tension, psychological depth, and big patient payoffs.",
  },
];

const TONE_OPTIONS = [
  { id: "Dark & Gritty", label: "Dark & Gritty", desc: "Morally gray, harsh consequences, realistic friction" },
  { id: "Tense & Claustrophobic", label: "Tense & Claustrophobic", desc: "High paranoia, ticking clocks, nowhere to run" },
  { id: "Mind-Bending & Philosophical", label: "Mind-Bending & Philosophical", desc: "Puzzles reality, raises big questions" },
  { id: "Heartfelt & Cathartic", label: "Heartfelt & Cathartic", desc: "Emotional depth, powerful character bonds" },
  { id: "Sharp, Witty & Irreverent", label: "Sharp, Witty & Irreverent", desc: "Dry humor, sardonic voice, sharp banter" },
  { id: "Eerie & Dreamlike", label: "Eerie & Dreamlike", desc: "Surreal, uncanny, lingering sensory moods" },
];

const TROPE_OPTIONS = [
  "Unreliable Narrator",
  "Isolated / Claustrophobic Setting",
  "Enemies to Lovers",
  "Dual Timelines or Multi-POV",
  "High-Stakes Survival Game",
  "Small Town with Dark Secrets",
  "Morally Gray Antihero",
  "Twist that Reframes Everything",
  "Found Family Against All Odds",
  "Locked-Room Mystery",
];

const DEALBREAKER_OPTIONS = [
  "Predictable / Telegraphed Twists",
  "Excessive Info-Dumping & Slow Starts",
  "Insta-Love / Unearned Chemistry",
  "Overly Wholesome / Zero Real Stakes",
  "Annoying Protagonist with No Agency",
  "Abrupt Cliffhangers with Zero Payoff",
];

interface QuizResult {
  archetype_name: string;
  archetype_summary: string;
  preferred_pacing: string;
  emotional_tone: string;
  top_tropes: string[];
  dealbreakers: string[];
}

interface SampleBook {
  id: string;
  title: string;
  author: string;
  cover_url?: string | null;
  similarity?: number;
}

export default function QuizPage() {
  const router = useRouter();

  // Wizard State: 1 to 6, 7 = Analyzing, 8 = Results
  const [step, setStep] = React.useState(1);

  // Form selections
  const [genres, setGenres] = React.useState<string[]>([]);
  const [pacing, setPacing] = React.useState<string>("");
  const [tone, setTone] = React.useState<string[]>([]);
  const [tropes, setTropes] = React.useState<string[]>([]);
  const [dealbreakers, setDealbreakers] = React.useState<string[]>([]);
  const [anchorFavorites, setAnchorFavorites] = React.useState("");

  // Result & loading states
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [quizResult, setQuizResult] = React.useState<QuizResult | null>(null);
  const [sampleMatches, setSampleMatches] = React.useState<SampleBook[]>([]);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const toggleMulti = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    item: string,
    max?: number
  ) => {
    if (list.includes(item)) {
      setList(list.filter((x) => x !== item));
    } else {
      if (max && list.length >= max) return;
      setList([...list, item]);
    }
  };

  const handleNext = () => {
    setError(null);
    if (step === 1 && genres.length === 0) {
      setError("Please select at least 1 genre to continue.");
      return;
    }
    if (step === 2 && !pacing) {
      setError("Please select your preferred pacing tempo.");
      return;
    }
    if (step === 3 && tone.length === 0) {
      setError("Please pick at least 1 emotional tone.");
      return;
    }
    if (step === 4 && tropes.length === 0) {
      setError("Please select at least 1 favorite trope.");
      return;
    }
    if (step === 5 && dealbreakers.length === 0) {
      setError("Please select at least 1 dealbreaker.");
      return;
    }

    if (step < 6) {
      setStep(step + 1);
    } else {
      handleSubmit(false);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async (saveToProfile: boolean) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: {
            genres,
            pacing,
            tone,
            tropes,
            dealbreakers,
            anchorFavorites,
          },
          saveToProfile,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to analyze reading taste.");
      }

      setQuizResult(data.tasteProfile);
      setSampleMatches(data.sampleMatches || []);
      setStep(7); // Show Results
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToProfile = async () => {
    if (!quizResult) return;
    setSaving(true);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: {
            genres,
            pacing,
            tone,
            tropes,
            dealbreakers,
            anchorFavorites,
          },
          saveToProfile: true,
        }),
      });
      const data = await res.json();
      if (data.saved) {
        setSaveSuccess(true);
      }
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRetake = () => {
    setStep(1);
    setGenres([]);
    setPacing("");
    setTone([]);
    setTropes([]);
    setDealbreakers([]);
    setAnchorFavorites("");
    setQuizResult(null);
    setSaveSuccess(false);
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <Badge
          variant="outline"
          className="mb-3 gap-1.5 border-primary/30 text-primary bg-primary/5 py-1 px-3 text-xs"
        >
          <Zap className="size-3.5 fill-amber-500 text-amber-500" />
          <span>60-Second Reading Taste Quiz</span>
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Discover Your Reading DNA
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
          No Goodreads or StoryGraph export? Answer 5 quick questions to synthesize your literary archetype and personal taste vector.
        </p>
      </div>

      {/* Progress Bar (Visible during questions 1-6) */}
      {step <= 6 && (
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 font-medium">
            <span>Question {step} of 6</span>
            <span>{Math.round(((step - 1) / 5) * 100)}% Complete</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${((step - 1) / 5) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2">
          <ShieldAlert className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="border-primary/20 bg-card/60 backdrop-blur-md p-10 text-center flex flex-col items-center justify-center my-8">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 animate-pulse">
            <Sparkles className="size-7 animate-spin" />
          </div>
          <h3 className="text-lg font-bold">Synthesizing Your Reading Archetype...</h3>
          <p className="text-xs text-muted-foreground max-w-md mt-2 leading-relaxed">
            Gemini 2.5 Flash is analyzing your pacing, loved tropes, and narrative preferences into a 768-dimensional vector embedding.
          </p>
        </Card>
      )}

      {/* STEP 1: Genres */}
      {!loading && step === 1 && (
        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardHeader>
            <CardTitle className="text-xl">What genres or worlds pull you in most?</CardTitle>
            <CardDescription>Select up to 4 that match your reading cravings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GENRE_OPTIONS.map((g) => {
                const active = genres.includes(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleMulti(genres, setGenres, g.id, 4)}
                    className={`p-3.5 text-left rounded-xl border transition-all flex flex-col justify-between ${
                      active
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border/60 hover:border-foreground/30 bg-card/40"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-semibold text-sm text-foreground">{g.label}</span>
                      {active && <CheckCircle2 className="size-4 text-primary shrink-0" />}
                    </div>
                    <span className="text-xs text-muted-foreground leading-snug">{g.desc}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleNext} className="gap-2">
                <span>Next Question</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Pacing */}
      {!loading && step === 2 && (
        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardHeader>
            <CardTitle className="text-xl">What is your ideal narrative tempo?</CardTitle>
            <CardDescription>Pick the pacing style that keeps your attention glued to the page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {PACING_OPTIONS.map((p) => {
                const active = pacing === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPacing(p.id)}
                    className={`w-full p-4 text-left rounded-xl border transition-all flex items-start gap-3.5 ${
                      active
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border/60 hover:border-foreground/30 bg-card/40"
                    }`}
                  >
                    <div className="mt-0.5">
                      <div
                        className={`size-4 rounded-full border flex items-center justify-center ${
                          active ? "border-primary bg-primary" : "border-muted-foreground/40"
                        }`}
                      >
                        {active && <div className="size-1.5 rounded-full bg-primary-foreground" />}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-foreground">{p.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {p.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button variant="ghost" onClick={handleBack} className="gap-2">
                <ArrowLeft className="size-4" />
                <span>Back</span>
              </Button>
              <Button onClick={handleNext} className="gap-2">
                <span>Next Question</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Emotional Tone */}
      {!loading && step === 3 && (
        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardHeader>
            <CardTitle className="text-xl">What emotional tone hits hardest for you?</CardTitle>
            <CardDescription>Select 1 or 2 moods that resonate with your favorite books.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TONE_OPTIONS.map((t) => {
                const active = tone.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleMulti(tone, setTone, t.id, 2)}
                    className={`p-3.5 text-left rounded-xl border transition-all flex flex-col justify-between ${
                      active
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border/60 hover:border-foreground/30 bg-card/40"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-semibold text-sm text-foreground">{t.label}</span>
                      {active && <CheckCircle2 className="size-4 text-primary shrink-0" />}
                    </div>
                    <span className="text-xs text-muted-foreground leading-snug">{t.desc}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button variant="ghost" onClick={handleBack} className="gap-2">
                <ArrowLeft className="size-4" />
                <span>Back</span>
              </Button>
              <Button onClick={handleNext} className="gap-2">
                <span>Next Question</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Loved Tropes */}
      {!loading && step === 4 && (
        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardHeader>
            <CardTitle className="text-xl">Which narrative tropes do you love seeing executed well?</CardTitle>
            <CardDescription>Choose 2 to 4 tropes that immediately make a synopsis intriguing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2.5">
              {TROPE_OPTIONS.map((trope) => {
                const active = tropes.includes(trope);
                return (
                  <button
                    key={trope}
                    onClick={() => toggleMulti(tropes, setTropes, trope, 4)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "border-border/70 hover:border-foreground/40 bg-card/40 text-foreground"
                    }`}
                  >
                    {active && <Check className="size-3.5 shrink-0" />}
                    <span>{trope}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-6">
              <Button variant="ghost" onClick={handleBack} className="gap-2">
                <ArrowLeft className="size-4" />
                <span>Back</span>
              </Button>
              <Button onClick={handleNext} className="gap-2">
                <span>Next Question</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 5: Dealbreakers */}
      {!loading && step === 5 && (
        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardHeader>
            <CardTitle className="text-xl">What makes you put a book down (DNF)?</CardTitle>
            <CardDescription>Select 1 to 3 literary dealbreakers that ruin an otherwise decent premise.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2.5">
              {DEALBREAKER_OPTIONS.map((item) => {
                const active = dealbreakers.includes(item);
                return (
                  <button
                    key={item}
                    onClick={() => toggleMulti(dealbreakers, setDealbreakers, item, 3)}
                    className={`w-full p-3 text-left rounded-xl border transition-all flex items-center justify-between text-xs font-medium ${
                      active
                        ? "border-rose-500/60 bg-rose-500/10 text-rose-500 shadow-xs"
                        : "border-border/60 hover:border-foreground/30 bg-card/40 text-foreground"
                    }`}
                  >
                    <span>{item}</span>
                    {active && <ShieldAlert className="size-4 text-rose-500 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button variant="ghost" onClick={handleBack} className="gap-2">
                <ArrowLeft className="size-4" />
                <span>Back</span>
              </Button>
              <Button onClick={handleNext} className="gap-2">
                <span>Final Step</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 6: Optional Anchor Titles & Submit */}
      {!loading && step === 6 && (
        <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
          <CardHeader>
            <CardTitle className="text-xl">Any all-time favorites or authors? (Optional)</CardTitle>
            <CardDescription>
              Give the librarian 1 or 2 titles you loved to sharpen your vector embedding.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Input
                placeholder="e.g. Project Hail Mary, Gillian Flynn, Stephen King"
                value={anchorFavorites}
                onChange={(e) => setAnchorFavorites(e.target.value)}
                className="h-11"
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Leave blank if you prefer the AI to extrapolate purely from your trope and pacing preferences.
              </p>
            </div>

            {/* Sandbox Notice */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
              <Compass className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">Safe Sandbox Mode: </span>
                Taking this quiz generates your archetype in preview mode and will{" "}
                <span className="font-semibold text-foreground">not overwrite</span> your existing library or active profile unless you explicitly click save on the results screen.
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button variant="ghost" onClick={handleBack} className="gap-2">
                <ArrowLeft className="size-4" />
                <span>Back</span>
              </Button>
              <Button onClick={() => handleSubmit(false)} className="gap-2 font-semibold">
                <Sparkles className="size-4" />
                <span>Synthesize My Archetype</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RESULTS SCREEN (Step 7) */}
      {!loading && step === 7 && quizResult && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {/* Archetype Hero Card */}
          <Card className="relative overflow-hidden border-primary/40 bg-gradient-to-b from-primary/10 via-card/80 to-card p-6 sm:p-8 backdrop-blur-md">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 py-1 text-xs gap-1.5">
                <Sparkles className="size-3.5" />
                <span>Quiz Archetype Generated</span>
              </Badge>
              <span className="text-xs text-muted-foreground font-medium">Safe Preview Mode</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mb-3">
              {quizResult.archetype_name}
            </h2>

            <p className="text-sm text-foreground/90 leading-relaxed max-w-2xl mb-6">
              {quizResult.archetype_summary}
            </p>

            {/* Trait Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-foreground">Pacing:</span>
                <span className="text-muted-foreground">{quizResult.preferred_pacing}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-foreground">Tone:</span>
                <span className="text-muted-foreground">{quizResult.emotional_tone}</span>
              </div>
            </div>

            {/* Tropes */}
            <div className="mt-4 pt-3 border-t border-border/40">
              <span className="text-xs font-bold text-foreground block mb-2">Core Tropes:</span>
              <div className="flex flex-wrap gap-1.5">
                {quizResult.top_tropes.map((trope, i) => (
                  <Badge key={i} variant="secondary" className="text-[11px] py-0.5">
                    {trope}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>

          {/* Sample Catalog Matches */}
          {sampleMatches.length > 0 && (
            <div>
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                <span>Instant Vector Matches from Your Catalog</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {sampleMatches.map((book) => (
                  <Card key={book.id} className="overflow-hidden border-border/60 bg-card/60 p-2.5 flex flex-col justify-between">
                    <div className="relative aspect-[2/3] w-full rounded-md overflow-hidden bg-muted/60 mb-2 border border-border/40 flex items-center justify-center">
                      {book.cover_url ? (
                        <Image
                          src={book.cover_url}
                          alt={book.title}
                          fill
                          className="object-cover"
                          sizes="150px"
                        />
                      ) : (
                        <div className="p-2 text-center text-[10px] text-muted-foreground">
                          {book.title}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-xs line-clamp-1">{book.title}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1">{book.author}</div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/40">
            <Button variant="outline" size="sm" onClick={handleRetake} className="gap-1.5 w-full sm:w-auto">
              <RotateCcw className="size-3.5" />
              <span>Retake Quiz</span>
            </Button>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Link href="/chat" className="w-full sm:w-auto">
                <Button variant="default" className="gap-2 w-full sm:w-auto font-semibold">
                  <MessageSquare className="size-4" />
                  <span>Ask Personal Librarian</span>
                </Button>
              </Link>

              <Button
                variant={saveSuccess ? "secondary" : "outline"}
                onClick={handleSaveToProfile}
                disabled={saving || saveSuccess}
                className="gap-2 w-full sm:w-auto text-xs"
              >
                {saveSuccess ? (
                  <>
                    <Check className="size-3.5 text-emerald-500" />
                    <span>Saved to Profile!</span>
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" />
                    <span>{saving ? "Saving..." : "Apply to My Profile"}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
