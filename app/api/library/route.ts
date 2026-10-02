import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Find the latest active user
    const { data: latestTaste } = await supabase
      .from("taste_profiles")
      .select("user_id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let userId = latestTaste?.user_id;

    if (!userId) {
      const { data: usersData } = await supabase.auth.admin.listUsers();
      if (usersData?.users && usersData.users.length > 0) {
        userId = usersData.users[0].id;
      }
    }

    if (!userId) {
      return NextResponse.json({ books: [], stats: null });
    }

    // 2. Fetch all books from user_books joined with books
    const { data: rawUserBooks, error } = await supabase
      .from("user_books")
      .select(`
        id,
        shelf,
        rating,
        date_read,
        user_review,
        user_shelves,
        created_at,
        books (
          id,
          title,
          author,
          cover_url,
          published_year,
          page_count,
          isbn,
          isbn13
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Library fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Format and attach Open Library cover image URLs where applicable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const books = (rawUserBooks || []).map((ub: any) => {
      const book = ub.books;
      const isbn13 = book?.isbn13;
      const isbn = book?.isbn;

      const coverUrl =
        book?.cover_url ||
        (isbn13 ? `https://covers.openlibrary.org/b/isbn/${isbn13}-M.jpg?default=false` : null) ||
        (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false` : null);

      return {
        id: ub.id,
        book_id: book?.id,
        title: book?.title || "Untitled",
        author: book?.author || "Unknown Author",
        isbn,
        isbn13,
        cover_url: coverUrl,
        page_count: book?.page_count || null,
        published_year: book?.published_year || null,
        shelf: ub.shelf,
        rating: ub.rating ? Number(ub.rating) : null,
        date_read: ub.date_read || null,
        user_review: ub.user_review || null,
        user_shelves: ub.user_shelves || [],
      };
    });

    // 4. Calculate library shelf and rating statistics
    const ratedBooks = books.filter((b) => b.rating && b.rating > 0);
    const avgRating =
      ratedBooks.length > 0
        ? (ratedBooks.reduce((acc, b) => acc + (b.rating || 0), 0) / ratedBooks.length).toFixed(1)
        : null;

    const stats = {
      total: books.length,
      read: books.filter((b) => b.shelf === "read").length,
      currentlyReading: books.filter((b) => b.shelf === "currently-reading").length,
      toRead: books.filter((b) => b.shelf === "to-read").length,
      dnf: books.filter((b) => b.shelf === "did-not-finish").length,
      fiveStarCount: books.filter((b) => b.rating === 5).length,
      fourStarCount: books.filter((b) => b.rating === 4).length,
      avgRating,
    };

    return NextResponse.json({
      books,
      stats,
    });
  } catch (error) {
    console.error("Library API Error:", error);
    return NextResponse.json({ error: "Failed to fetch library" }, { status: 500 });
  }
}
