import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Papa from "papaparse";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createAdminClient(supabaseUrl, supabaseKey);

    const format = request.nextUrl.searchParams.get("format")?.toLowerCase() || "csv";

    // 1. Authenticate user session
    let userId: string | undefined;
    try {
      const serverClient = await createServerClient();
      const {
        data: { user },
      } = await serverClient.auth.getUser();
      if (user) {
        userId = user.id;
      }
    } catch {
      // Unauthenticated session
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to export your library." },
        { status: 401 }
      );
    }

    // 2. Fetch user's books joined with global catalog
    const { data: rawUserBooks, error: ubError } = await supabase
      .from("user_books")
      .select(`
        id,
        shelf,
        rating,
        date_read,
        user_review,
        user_shelves,
        created_at,
        book_id,
        books (
          id,
          title,
          author,
          cover_url,
          published_year,
          page_count,
          isbn,
          isbn13,
          genres,
          description
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (ubError) {
      console.error("Export fetch error:", ubError);
      return NextResponse.json({ error: ubError.message }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const books: any[] = rawUserBooks || [];
    const dateStr = new Date().toISOString().split("T")[0];

    // CSV Export: Formatted for 100% compatibility with Goodreads and StoryGraph
    if (format === "csv") {
      const csvRows = books.map((ub) => {
        const book = ub.books;

        let formattedDateRead = "";
        if (ub.date_read) {
          const d = new Date(ub.date_read);
          if (!isNaN(d.getTime())) {
            formattedDateRead = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
              d.getDate()
            ).padStart(2, "0")}`;
          }
        }

        let formattedDateAdded = "";
        if (ub.created_at) {
          const d = new Date(ub.created_at);
          if (!isNaN(d.getTime())) {
            formattedDateAdded = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
              d.getDate()
            ).padStart(2, "0")}`;
          }
        }

        const isbn = book?.isbn ? `="${book.isbn}"` : `=""`;
        const isbn13 = book?.isbn13 ? `="${book.isbn13}"` : `=""`;

        return {
          "Book Id": ub.book_id || ub.id,
          Title: book?.title || "Untitled",
          Author: book?.author || "Unknown Author",
          "Author l-f": book?.author || "",
          "Additional Authors": "",
          ISBN: isbn,
          ISBN13: isbn13,
          "My Rating": ub.rating ? Number(ub.rating) : 0,
          "Average Rating": "",
          Publisher: "",
          Binding: "",
          "Number of Pages": book?.page_count || "",
          "Year Published": book?.published_year || "",
          "Original Publication Year": book?.published_year || "",
          "Date Read": formattedDateRead,
          "Date Added": formattedDateAdded,
          Bookshelves: ub.shelf || "",
          "Bookshelves with positions": ub.shelf || "",
          "Exclusive Shelf": ub.shelf || "to-read",
          "My Review": ub.user_review || "",
          Spoiler: "",
          "Private Notes": "",
          "Read Count": ub.shelf === "read" ? 1 : 0,
          "Owned Copies": 0,
        };
      });

      const csvString = Papa.unparse(csvRows, {
        header: true,
        quotes: true,
      });

      return new NextResponse(csvString, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="goodbetterbestreads-library-${dateStr}.csv"`,
        },
      });
    }

    // JSON Export: Complete Backup with Taste Profile, Stats, and rich metadata
    if (format === "json") {
      const [{ data: profile }, { data: tasteProfile }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("taste_profiles").select("*").eq("user_id", userId).maybeSingle(),
      ]);

      const ratedBooks = books.filter((b) => b.rating && Number(b.rating) > 0);
      const avgRating =
        ratedBooks.length > 0
          ? (
              ratedBooks.reduce((acc: number, b) => acc + Number(b.rating || 0), 0) /
              ratedBooks.length
            ).toFixed(1)
          : null;

      const stats = {
        total_books: books.length,
        read: books.filter((b) => b.shelf === "read").length,
        currently_reading: books.filter((b) => b.shelf === "currently-reading").length,
        want_to_read: books.filter((b) => b.shelf === "to-read").length,
        did_not_finish: books.filter((b) => b.shelf === "did-not-finish").length,
        average_rating: avgRating,
        five_star_count: books.filter((b) => Number(b.rating) === 5).length,
        four_star_count: books.filter((b) => Number(b.rating) === 4).length,
      };

      const formattedBooks = books.map((ub) => {
        const book = ub.books;
        return {
          id: ub.id,
          book_id: ub.book_id,
          title: book?.title || "Untitled",
          author: book?.author || "Unknown Author",
          shelf: ub.shelf,
          rating: ub.rating ? Number(ub.rating) : null,
          date_read: ub.date_read || null,
          user_review: ub.user_review || null,
          user_shelves: ub.user_shelves || [],
          published_year: book?.published_year || null,
          page_count: book?.page_count || null,
          isbn: book?.isbn || null,
          isbn13: book?.isbn13 || null,
          cover_url: book?.cover_url || null,
          genres: book?.genres || [],
          description: book?.description || null,
          cataloged_at: ub.created_at || null,
        };
      });

      const jsonPayload = {
        app: "GoodBetterBestReads",
        exported_at: new Date().toISOString(),
        user: {
          id: userId,
          email: profile?.email || null,
          display_name: profile?.display_name || null,
          reading_goal: profile?.reading_goal || 12,
          current_streak: profile?.current_streak || 0,
        },
        taste_profile: tasteProfile
          ? {
              archetype_name: tasteProfile.archetype_name,
              archetype_summary: tasteProfile.archetype_summary,
              preferred_pacing: tasteProfile.preferred_pacing || null,
              emotional_tone: tasteProfile.emotional_tone || null,
              top_tropes: tasteProfile.top_tropes || [],
              dealbreakers: tasteProfile.dealbreakers || [],
              updated_at: tasteProfile.updated_at || null,
            }
          : null,
        stats,
        books: formattedBooks,
      };

      return new NextResponse(JSON.stringify(jsonPayload, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="goodbetterbestreads-library-${dateStr}.json"`,
        },
      });
    }

    return NextResponse.json({ error: "Unsupported format. Use 'csv' or 'json'." }, { status: 400 });
  } catch (error: any) {
    console.error("Export API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to export library" },
      { status: 500 }
    );
  }
}
