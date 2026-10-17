import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { computeReadingInsights, InsightBookItem } from "@/lib/insights";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createAdminClient(supabaseUrl, supabaseKey);
}

export async function GET(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`insights-get:${ip}`, { maxRequests: 60, windowMs: 60_000 });
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const yearParam = url.searchParams.get("year");
    const targetYear: number | "all" =
      yearParam === "all"
        ? "all"
        : yearParam
        ? parseInt(yearParam, 10)
        : new Date().getFullYear();

    const admin = getAdminClient();

    const [userBooksResult, tasteProfileResult] = await Promise.all([
      admin
        .from("user_books")
        .select(`
          id,
          book_id,
          shelf,
          rating,
          date_read,
          created_at,
          books (
            id,
            title,
            author,
            cover_url,
            page_count,
            genres,
            published_year
          )
        `)
        .eq("user_id", user.id)
        .eq("shelf", "read"),
      admin
        .from("taste_profiles")
        .select("top_tropes")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const { data: userBooksData, error } = userBooksResult;
    const fallbackGenres = tasteProfileResult.data?.top_tropes || [];

    if (error) {
      console.error("Insights fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch library data" }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawList = (userBooksData || []) as any[];

    // Extract available years from read books
    const yearSet = new Set<number>();
    const currentYear = new Date().getFullYear();
    yearSet.add(currentYear);

    const formattedBooks: InsightBookItem[] = rawList.map((ub) => {
      const b = Array.isArray(ub.books) ? ub.books[0] : ub.books;
      const dateStr = ub.date_read || null;

      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          yearSet.add(d.getFullYear());
        }
      }

      return {
        id: ub.id,
        book_id: ub.book_id || b?.id,
        title: b?.title || "Untitled",
        author: b?.author || "Unknown",
        cover_url: b?.cover_url || null,
        rating: ub.rating,
        page_count: b?.page_count || null,
        genres: b?.genres || [],
        date_read: dateStr || null,
        published_year: b?.published_year || null,
      };
    });

    const availableYears = Array.from(yearSet).sort((a, b) => b - a);
    const insights = computeReadingInsights(formattedBooks, targetYear, fallbackGenres);

    return NextResponse.json({
      success: true,
      insights,
      availableYears,
    });
  } catch (error: any) {
    console.error("Insights API error:", error);
    return NextResponse.json({ error: "Failed to compute reading insights" }, { status: 500 });
  }
}
