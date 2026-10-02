"use client";

import * as React from "react";
import Link from "next/link";
import {
  Dna,
  Sparkles,
  Zap,
  Activity,
  ShieldAlert,
  Bookmark,
  Download,
  Share2,
  Check,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProfileData {
  archetype_name: string;
  archetype_summary: string;
  preferred_pacing?: string;
  emotional_tone?: string;
  top_tropes: string[];
  dealbreakers: string[];
}

interface StatsData {
  totalBooks: number;
  readCount: number;
}

export default function ReadingDnaPage() {
  const [profile, setProfile] = React.useState<ProfileData | null>(null);
  const [stats, setStats] = React.useState<StatsData>({ totalBooks: 0, readCount: 0 });
  const [loading, setLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data?.tasteProfile) {
          setProfile(data.tasteProfile);
          if (data?.stats) {
            setStats(data.stats);
          }
        }
      })
      .catch((err) => console.error("Could not load DNA profile:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleCopyLink = async () => {
    if (typeof window === "undefined") return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile?.archetype_name} — My Reading DNA`,
          text: `Check out my verified Reading DNA on GoodBetterBestReads: ${profile?.archetype_name}`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // User cancelled share
    }
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = "/api/og/reading-dna";
    link.download = `reading-dna-${profile?.archetype_name.toLowerCase().replace(/\s+/g, "-") || "card"}.png`;
    link.click();
  };

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[60vh] max-w-4xl flex-col items-center justify-center p-6">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-pulse">
          <Dna className="size-6 animate-spin" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Decoding your Reading DNA...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto flex min-h-[65vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
          <Dna className="size-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">No Reading DNA Found Yet</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
          Import your Goodreads or StoryGraph library export to extract your unique reader archetype, narrative tropes, and pacing profile.
        </p>
        <Link href="/import">
          <Button size="lg" className="gap-2 font-semibold">
            <BookOpen className="size-4" />
            <span>Import Reading History</span>
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex max-w-5xl flex-col px-4 py-8 sm:py-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 gap-1 text-xs">
              <Dna className="size-3" />
              Verified Reading DNA
            </Badge>
            <Badge variant="secondary" className="text-[10px] text-muted-foreground">
              Gemini 768-Dim Vector
            </Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Your Reading Identity
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Synthesized from your ratings, preferred pacing, and high-signal literary tropes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleCopyLink} variant="outline" size="sm" className="gap-1.5">
            {copied ? <Check className="size-4 text-emerald-500" /> : <Share2 className="size-4" />}
            <span>{copied ? "Copied Link!" : "Share DNA"}</span>
          </Button>
          <Button onClick={handleDownload} variant="outline" size="sm" className="gap-1.5">
            <Download className="size-4" />
            <span>Download PNG</span>
          </Button>
          <Link href="/chat">
            <Button size="sm" className="gap-1.5 font-semibold">
              <Sparkles className="size-4" />
              <span>Ask Librarian</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Grid: Interactive DNA Card + Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        {/* Left 2 Cols: The Hero Archetype Card */}
        <Card className="lg:col-span-2 border-border/60 bg-gradient-to-br from-card/80 via-card/50 to-emerald-950/20 backdrop-blur-xs relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Dna className="size-48 text-emerald-500" />
          </div>

          <CardContent className="p-6 sm:p-8 flex flex-col justify-between h-full space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-2 block">
                Reader Archetype
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
                {profile.archetype_name}
              </h2>

              {/* Tempo & Tone Badges */}
              <div className="flex flex-wrap gap-2 mt-4">
                {profile.preferred_pacing && (
                  <Badge variant="secondary" className="gap-1.5 py-1 px-3 bg-secondary/60 text-xs">
                    <Zap className="size-3.5 text-amber-500" />
                    <span className="font-semibold text-muted-foreground">Pacing:</span>{" "}
                    <span>{profile.preferred_pacing}</span>
                  </Badge>
                )}
                {profile.emotional_tone && (
                  <Badge variant="secondary" className="gap-1.5 py-1 px-3 bg-secondary/60 text-xs">
                    <Activity className="size-3.5 text-blue-500" />
                    <span className="font-semibold text-muted-foreground">Tone:</span>{" "}
                    <span>{profile.emotional_tone}</span>
                  </Badge>
                )}
              </div>

              {/* Narrative Summary */}
              <div className="mt-6 pt-6 border-t border-border/40">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                  Taste Narrative
                </span>
                <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">
                  {profile.archetype_summary}
                </p>
              </div>
            </div>

            {/* Tropes & Dealbreakers Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/40">
              <div>
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-500 mb-2">
                  <Bookmark className="size-3.5" />
                  <span>Loved Tropes</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {profile.top_tropes.map((trope, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-medium"
                    >
                      {trope}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-destructive mb-2">
                  <ShieldAlert className="size-3.5" />
                  <span>Strict Dealbreakers</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {profile.dealbreakers.map((dealbreaker, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="border-destructive/30 bg-destructive/5 text-destructive text-xs font-medium"
                    >
                      {dealbreaker}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Col: Shelf Stats & Card Preview */}
        <div className="space-y-6">
          {/* Library Numbers */}
          <Card className="border-border/60 bg-card/60 backdrop-blur-xs shadow-sm">
            <CardContent className="p-6 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Reading Foundation
              </span>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/50 bg-background/50 p-4 text-center">
                  <span className="text-2xl font-black text-foreground block">
                    {stats.totalBooks}
                  </span>
                  <span className="text-xs text-muted-foreground">Cataloged Books</span>
                </div>
                <div className="rounded-xl border border-border/50 bg-background/50 p-4 text-center">
                  <span className="text-2xl font-black text-emerald-500 block">
                    {stats.readCount}
                  </span>
                  <span className="text-xs text-muted-foreground">Completed Reads</span>
                </div>
              </div>

              <div className="pt-2 text-xs text-muted-foreground leading-relaxed flex items-center gap-2">
                <div className="size-2 rounded-full bg-emerald-500 shrink-0" />
                <span>Excludes these {stats.readCount} books automatically during Librarian recommendations.</span>
              </div>
            </CardContent>
          </Card>

          {/* Social Card Preview Thumbnail */}
          <Card className="border-border/60 bg-card/60 backdrop-blur-xs overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border/40 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Social Card Preview (1200×630)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-7 text-xs gap-1 px-2 text-primary"
              >
                <Download className="size-3" />
                PNG
              </Button>
            </div>
            <div className="p-3 bg-muted/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/api/og/reading-dna"
                alt="Reading DNA Social Card"
                className="rounded-lg border border-border/60 shadow-md w-full aspect-[1200/630] object-cover"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
