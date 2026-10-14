import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { calculateReadingGoalPacing } from "@/lib/goals";

export const dynamic = "force-dynamic";

const UpdateGoalSchema = z.object({
  goal: z.number().int().min(1, "Goal must be at least 1 book").max(1000, "Goal cannot exceed 1000 books"),
  year: z.number().int().optional(),
});

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
    const rateLimit = checkRateLimit(`goals-get:${ip}`, { maxRequests: 60, windowMs: 60_000 });
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
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    const admin = getAdminClient();

    // Fetch user profile and read books
    const [profileRes, booksRes] = await Promise.all([
      admin
        .from("profiles")
        .select("reading_goal")
        .eq("id", user.id)
        .maybeSingle(),
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
            published_year
          )
        `)
        .eq("user_id", user.id)
        .eq("shelf", "read"),
    ]);

    const goal = profileRes.data?.reading_goal || 12;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allRead = (booksRes.data || []) as any[];

    // Filter books read within the specified calendar year
    const booksThisYear = allRead.filter((ub) => {
      const dateStr = ub.date_read || ub.created_at;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && d.getFullYear() === year;
    });

    const pacing = calculateReadingGoalPacing(booksThisYear.length, goal, year);

    const formattedBooks = booksThisYear.map((ub) => {
      const b = Array.isArray(ub.books) ? ub.books[0] : ub.books;
      return {
        id: ub.id,
        book_id: ub.book_id || b?.id,
        title: b?.title || "Untitled",
        author: b?.author || "Unknown",
        cover_url: b?.cover_url || null,
        rating: ub.rating,
        date_read: ub.date_read || ub.created_at,
        page_count: b?.page_count || null,
      };
    });

    return NextResponse.json({
      success: true,
      pacing,
      books: formattedBooks,
    });
  } catch (error: any) {
    console.error("Goals API GET error:", error);
    return NextResponse.json({ error: "Failed to fetch reading goal" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`goals-patch:${ip}`, { maxRequests: 20, windowMs: 60_000 });
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

    const body = await req.json().catch(() => ({}));
    const parseResult = UpdateGoalSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid goal parameter" },
        { status: 400 }
      );
    }

    const { goal, year = new Date().getFullYear() } = parseResult.data;
    const admin = getAdminClient();

    // 1. Update user profile reading_goal
    const { error: updateError } = await admin
      .from("profiles")
      .update({ reading_goal: goal, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to update profile reading goal:", updateError);
      return NextResponse.json({ error: "Failed to update reading goal" }, { status: 500 });
    }

    // 2. Query read books for target year to recompute pacing
    const { data: booksData } = await admin
      .from("user_books")
      .select("date_read, created_at")
      .eq("user_id", user.id)
      .eq("shelf", "read");

    const booksThisYear = (booksData || []).filter((ub) => {
      const dateStr = ub.date_read || ub.created_at;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && d.getFullYear() === year;
    });

    const pacing = calculateReadingGoalPacing(booksThisYear.length, goal, year);

    return NextResponse.json({
      success: true,
      goal,
      pacing,
    });
  } catch (error: any) {
    console.error("Goals API PATCH error:", error);
    return NextResponse.json({ error: "Failed to update reading goal" }, { status: 500 });
  }
}
