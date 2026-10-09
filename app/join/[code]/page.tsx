"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Users,
  Sparkles,
  BookOpen,
  ArrowRight,
  Check,
  AlertCircle,
  Loader2,
  Dna,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

interface InviterData {
  displayName: string;
  avatarUrl: string | null;
  tasteArchetype: string | null;
}

export default function JoinInvitePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const inviteCode = params?.code;

  const [loading, setLoading] = React.useState(true);
  const [inviter, setInviter] = React.useState<InviterData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<{ id: string; email?: string } | null>(null);
  const [claiming, setClaiming] = React.useState(false);
  const [claimSuccess, setClaimSuccess] = React.useState(false);

  // Check auth session
  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
    });
  }, []);

  // Fetch invite preview
  React.useEffect(() => {
    if (!inviteCode) return;

    fetch(`/api/friends/join?code=${inviteCode}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.valid) {
          throw new Error(data.error || "Invite link not found or expired.");
        }
        return data;
      })
      .then((data) => {
        setInviter(data.inviter);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Invalid invite link");
      })
      .finally(() => setLoading(false));
  }, [inviteCode]);

  const handleClaimInvite = async () => {
    if (!inviteCode) return;
    setClaiming(true);

    try {
      const res = await fetch("/api/friends/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invite");
      }

      setClaimSuccess(true);
      setTimeout(() => {
        router.push("/friends");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim invite");
      setClaiming(false);
    }
  };

  const handleSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/join/${inviteCode}`,
      },
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto flex flex-col items-center justify-center py-28 text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary mb-3" />
        <span className="text-xs">Verifying invitation...</span>
      </div>
    );
  }

  if (error || !inviter) {
    return (
      <div className="container mx-auto max-w-md px-4 py-20 text-center">
        <Card className="border-border/60 bg-card/60 backdrop-blur-md p-8">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mx-auto mb-4">
            <AlertCircle className="size-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Invite Unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {error || "This invite link is invalid or has expired."}
          </p>
          <div className="mt-6 flex justify-center">
            <Button onClick={() => router.push("/")} variant="outline" size="sm">
              Go to GoodBetterBestReads
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-lg px-4 py-16 sm:py-24 text-center">
      <Card className="border-border/60 bg-card/70 backdrop-blur-md shadow-xl overflow-hidden p-6 sm:p-8">
        {/* Inviter Avatar & Header */}
        <div className="flex flex-col items-center">
          <div className="relative size-20 rounded-full overflow-hidden bg-primary/10 text-primary font-bold flex items-center justify-center text-2xl border-4 border-card shadow-md mb-4 shrink-0">
            {inviter.avatarUrl ? (
              <Image src={inviter.avatarUrl} alt={inviter.displayName} fill className="object-cover" />
            ) : (
              <span>{inviter.displayName.charAt(0).toUpperCase()}</span>
            )}
          </div>

          <Badge variant="secondary" className="gap-1 text-xs py-0.5 px-2.5 mb-2">
            <Sparkles className="size-3 text-amber-400" />
            <span>Reading Buddy Invitation</span>
          </Badge>

          <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
            {inviter.displayName} invited you to connect!
          </h1>

          {inviter.tasteArchetype && (
            <p className="text-xs text-muted-foreground mt-1">
              Their Reading Archetype: <span className="text-emerald-400 font-semibold">{inviter.tasteArchetype}</span>
            </p>
          )}
        </div>

        {/* Feature Highlights */}
        <div className="my-6 space-y-2.5 text-left border-y border-border/50 py-5">
          <div className="flex items-start gap-3">
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
              <Dna className="size-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">Compare Your Reading DNA</h4>
              <p className="text-[11px] text-muted-foreground">Discover shared tropes, rating agreement, and taste compatibility.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
              <BookOpen className="size-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">Explore Each Other&apos;s Shelves</h4>
              <p className="text-[11px] text-muted-foreground">See what your buddy is reading right now and discover peer recommendations.</p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        {claimSuccess ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-center gap-2 text-emerald-400 text-sm font-semibold">
            <Check className="size-4" />
            <span>Connected! Redirecting to Reading Buddies...</span>
          </div>
        ) : user ? (
          <Button
            onClick={handleClaimInvite}
            disabled={claiming}
            size="lg"
            className="w-full gap-2 font-bold shadow-md"
          >
            {claiming ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Users className="size-4" />
                <span>Accept & Connect with {inviter.displayName}</span>
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-3">
            <Button
              onClick={handleSignIn}
              size="lg"
              className="w-full gap-2 font-bold shadow-md"
            >
              <span>Sign in with Google to Connect</span>
              <ArrowRight className="size-4" />
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Sign in or create a free account to automatically become reading buddies.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
