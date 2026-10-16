import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  User as UserIcon,
  BookOpen,
  Dna,
  Trophy,
  ArrowRight,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { NotificationSettingsCard } from "@/components/profile/notification-settings-card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profile & Settings | TBRScout",
  description: "Manage your reading profile, goals, and notification preferences.",
};

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createAdminClient(supabaseUrl, supabaseKey);
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const admin = getAdminClient();

  const [profileRes, tasteRes, readCountRes, totalCountRes] = await Promise.all([
    admin.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    admin.from("taste_profiles").select("archetype_name, archetype_summary").eq("user_id", user.id).maybeSingle(),
    admin.from("user_books").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("shelf", "read"),
    admin.from("user_books").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const profile = profileRes.data;
  const taste = tasteRes.data;
  const readCount = readCountRes.count || 0;
  const totalCount = totalCountRes.count || 0;

  const displayName =
    profile?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Reader";
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const initial = displayName.charAt(0).toUpperCase();
  const archetype = taste?.archetype_name || profile?.taste_archetype || "Curious Explorer";
  const readingGoal = profile?.reading_goal || 25;

  return (
    <div className="container mx-auto flex max-w-4xl flex-col px-4 sm:px-6 py-6 sm:py-10 pb-28 sm:pb-16 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 sm:size-20 border-2 border-primary/30 shadow-md">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="bg-primary/10 text-primary font-black text-xl">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {displayName}
              </h1>
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px] uppercase font-bold">
                {archetype}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono truncate max-w-sm">
              {user.email}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Link href="/dna">
            <Button size="sm" variant="outline" className="text-xs font-semibold gap-1.5">
              <Dna className="size-3.5 text-emerald-500" />
              <span>Reading DNA</span>
              <ArrowRight className="size-3 text-muted-foreground" />
            </Button>
          </Link>
          <Link href="/library">
            <Button size="sm" variant="outline" className="text-xs font-semibold gap-1.5">
              <BookOpen className="size-3.5 text-amber-500" />
              <span>My Shelves</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="border-border/50 bg-card/50 backdrop-blur-xs p-4 text-center">
          <span className="text-2xl sm:text-3xl font-black text-foreground block">
            {readCount}
          </span>
          <span className="text-[11px] text-muted-foreground font-medium">Books Finished</span>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur-xs p-4 text-center">
          <span className="text-2xl sm:text-3xl font-black text-primary block">
            {readingGoal}
          </span>
          <span className="text-[11px] text-muted-foreground font-medium">2026 Target Goal</span>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur-xs p-4 text-center">
          <span className="text-2xl sm:text-3xl font-black text-blue-500 block">
            {totalCount}
          </span>
          <span className="text-[11px] text-muted-foreground font-medium">Catalog Total</span>
        </Card>
      </div>

      {/* Push Notifications & Reader Alerts Section */}
      <NotificationSettingsCard />

      {/* Account Info Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground p-4 rounded-xl border border-border/30 bg-muted/10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-500" />
          <span>Account authenticated with Google OAuth</span>
        </div>
        <span className="font-mono text-[11px]">User ID: {user.id.slice(0, 8)}...</span>
      </div>
    </div>
  );
}
