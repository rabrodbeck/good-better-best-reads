import type { Metadata } from "next";
import { Suspense } from "react";
import { ReadingDnaClient } from "./reading-dna-client";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Dna } from "lucide-react";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const rawUser = resolvedSearchParams.user || resolvedSearchParams.userId;
  const userParam = typeof rawUser === "string" ? rawUser : Array.isArray(rawUser) ? rawUser[0] : undefined;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://goodbetterbestreads.vercel.app");

  let archetype = "Reading DNA Card";
  let summary =
    "Explore your verified literary archetype, dominant emotional tone, and preferred narrative pacing on GoodBetterBestReads.";

  if (userParam) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createAdminClient(supabaseUrl, supabaseKey);
        const { data: dbTaste } = await supabase
          .from("taste_profiles")
          .select("archetype_name, archetype_summary")
          .eq("user_id", userParam)
          .maybeSingle();

        if (dbTaste?.archetype_name) {
          archetype = dbTaste.archetype_name;
          if (dbTaste.archetype_summary) {
            summary = dbTaste.archetype_summary;
          }
        }
      } catch (err) {
        console.error("Failed to fetch user metadata for DNA card:", err);
      }
    }
  }

  const ogPath = userParam
    ? `/api/og/reading-dna?userId=${encodeURIComponent(userParam)}`
    : "/api/og/reading-dna";
  const absoluteOgUrl = new URL(ogPath, appUrl).toString();
  const pageUrl = userParam
    ? new URL(`/dna?user=${encodeURIComponent(userParam)}`, appUrl).toString()
    : new URL("/dna", appUrl).toString();

  const title =
    archetype === "Reading DNA Card"
      ? "Reading DNA Card | GoodBetterBestReads"
      : `${archetype} | Reading DNA`;

  return {
    metadataBase: new URL(appUrl),
    title,
    description: summary,
    openGraph: {
      type: "website",
      title,
      description: summary,
      url: pageUrl,
      images: [
        {
          url: absoluteOgUrl,
          width: 1200,
          height: 630,
          alt: `${archetype} — Reading DNA Card`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: summary,
      images: [absoluteOgUrl],
    },
  };
}

export default function ReadingDnaPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto flex min-h-[60vh] max-w-4xl flex-col items-center justify-center p-6">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary animate-pulse">
            <Dna className="size-6 animate-spin" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Loading Reading DNA...</p>
        </div>
      }
    >
      <ReadingDnaClient />
    </Suspense>
  );
}
