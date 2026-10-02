import Link from "next/link";
import {
  Sparkles,
  UploadCloud,
  Dna,
  ArrowRight,
  BookMarked,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Background Subtle Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-125 w-200 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute top-96 -right-40 -z-10 h-100 w-150 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Hero Section */}
      <section className="container mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 lg:pt-24 lg:pb-28">
        <div className="flex flex-col items-center text-center">
          {/* Top Badge */}
          <Badge
            variant="secondary"
            className="mb-6 px-3 py-1 text-xs sm:text-sm font-medium gap-1.5 shadow-xs"
          >
            <Sparkles className="size-3.5 text-primary" />
            <span>AI-Powered Book Discovery & Taste Profiling</span>
          </Badge>

          {/* Main Title */}
          <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Good, better, best. <br />
            <span className="bg-linear-to-r from-primary via-primary/80 to-emerald-500 bg-clip-text text-transparent">
              Never let your reading list rest.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            Transform years of latent reading history into an active Personal
            Librarian. Discover titles that match your exact tropes, pacing, and
            emotional tone—moving far beyond whole-star ratings and generic
            bestseller lists.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/import">
              <Button size="lg" className="gap-2 shadow-sm font-semibold">
                <UploadCloud className="size-5" />
                <span>Import Goodreads / StoryGraph</span>
              </Button>
            </Link>

            <Link href="/chat">
              <Button variant="outline" size="lg" className="gap-2">
                <Sparkles className="size-5 text-primary" />
                <span>Ask the Librarian</span>
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>

          {/* Rapid Mobile Quiz Callout */}
          <p className="mt-4 text-xs text-muted-foreground">
            No CSV on hand?{" "}
            <Link
              href="/quiz"
              className="text-primary hover:underline font-medium inline-flex items-center gap-1"
            >
              <Zap className="size-3 text-amber-500 inline" /> Take our 60-second
              taste quiz
            </Link>
          </p>

          {/* Bears Motto Banner */}
          <div className="mt-14 w-full max-w-2xl rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5 backdrop-blur-sm">
            <blockquote className="text-xs sm:text-sm italic text-muted-foreground">
              &ldquo;Good, better, best. Never let it rest. &apos;Til your good gets
              better and your better gets best!&rdquo;
            </blockquote>
            <div className="mt-2 text-[11px] font-semibold tracking-wider uppercase text-primary">
              — Chicago Bears team motto & product philosophy
            </div>
          </div>
        </div>
      </section>

      {/* Feature Value Props */}
      <section className="container mx-auto max-w-6xl px-4 py-16 sm:px-6 border-t border-border/40">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            How GoodBetterBestReads Works
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A 100% free-tier architecture designed for readers, by voracious
            readers.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1 */}
          <Card className="relative overflow-hidden border-border/50 bg-card/50 transition-all hover:border-primary/50">
            <CardHeader>
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <BookMarked className="size-5" />
              </div>
              <CardTitle>Zero Cold-Start Import</CardTitle>
              <CardDescription>
                Client-side Web Worker ingestion
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm leading-relaxed">
              Drag-and-drop your Goodreads or StoryGraph CSV export. Ingest 500+
              books in seconds without server timeouts or rate limits.
            </CardContent>
          </Card>

          {/* Card 2 */}
          <Card className="relative overflow-hidden border-border/50 bg-card/50 transition-all hover:border-primary/50">
            <CardHeader>
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 mb-3">
                <Sparkles className="size-5" />
              </div>
              <CardTitle>The Personal Librarian</CardTitle>
              <CardDescription>
                Conversational vector discovery
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm leading-relaxed">
              Ask for nuanced reads like &ldquo;A fast-paced sci-fi thriller with
              found family, but without high fantasy tropes.&rdquo; Get explainable
              recommendations.
            </CardContent>
          </Card>

          {/* Card 3 */}
          <Card className="relative overflow-hidden border-border/50 bg-card/50 transition-all hover:border-primary/50">
            <CardHeader>
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <Dna className="size-5 text-purple-400" />
              </div>
              <CardTitle>Shareable Reading DNA</CardTitle>
              <CardDescription>
                Spotify Wrapped for your bookshelf
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm leading-relaxed">
              Generate a server-rendered visual archetype card summarizing your
              pacing, tropes, and standout books to share with friends and book
              clubs.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Taste Archetype Preview Showcase */}
      <section className="container mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-primary/20 bg-linear-to-b from-card/80 to-card/40 p-6 sm:p-10 backdrop-blur-md shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-md">
              <Badge variant="outline" className="mb-3 text-emerald-500 border-emerald-500/30">
                Live Archetype Preview
              </Badge>
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                The Atmospheric Speculative Explorer
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                You gravitate towards richly textured worlds, slow-burn mysteries,
                and philosophically complex characters. You value prose quality
                and subtle foreshadowing over predictable action beats.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-mono text-muted-foreground">
                  #CyberpunkNoir
                </span>
                <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-mono text-muted-foreground">
                  #SlowBurn
                </span>
                <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-mono text-muted-foreground">
                  #PhilosophicalSciFi
                </span>
              </div>
            </div>

            <div className="w-full max-w-xs rounded-2xl border border-border/80 bg-background/80 p-5 shadow-inner">
              <div className="flex items-center justify-between text-xs text-muted-foreground pb-3 border-b border-border/50">
                <span>Reading Compatibility</span>
                <span className="text-emerald-500 font-bold">96% Semantic Match</span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="text-xs font-semibold text-foreground">
                  Top Recommended Tropes:
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  Unreliable Narrators
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  Decaying Megastructures
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  Introspective Pacing
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
