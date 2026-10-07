import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { generateBookEmbedding } from "@/services/taste/embedding-generator";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createAdminClient(supabaseUrl, supabaseKey);

    // 1. Check if user is authenticated via session cookies
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

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createAdminClient(supabaseUrl, supabaseKey);

    // 1. Authenticate user
    let userId: string | undefined;
    let userEmail: string | undefined;
    try {
      const serverClient = await createServerClient();
      const {
        data: { user },
      } = await serverClient.auth.getUser();
      if (user) {
        userId = user.id;
        userEmail = user.email;
      }
    } catch {
      // Unauthenticated session
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to add books to your library." },
        { status: 401 }
      );
    }

    // Ensure profiles record exists for foreign key constraint
    await supabase.from("profiles").upsert(
      {
        id: userId,
        email: userEmail || "reader@goodbetterbestreads.local",
        display_name: userEmail?.split("@")[0] || "Reader",
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

    // 2. Parse payload
    const body = await request.json();
    const {
      title,
      author,
      isbn,
      isbn13,
      cover_url,
      page_count,
      published_year,
      genres = [],
      description: rawDescription,
      open_library_key,
      shelf = "to-read",
      rating,
      user_review,
      date_read,
    } = body;

    if (!title?.trim() || !author?.trim()) {
      return NextResponse.json({ error: "Title and author are required" }, { status: 400 });
    }

    const validShelves = ["read", "currently-reading", "to-read", "did-not-finish"];
    const targetShelf = validShelves.includes(shelf) ? shelf : "to-read";

    // 3. Fetch description from Open Library if missing
    let description = rawDescription || null;
    if (!description && open_library_key) {
      const cleanWork = open_library_key.startsWith("/works/") ? open_library_key : `/works/${open_library_key}`;
      try {
        const workRes = await fetch(`https://openlibrary.org${cleanWork}.json`, {
          headers: { "User-Agent": "GoodBetterBestReads/1.0" },
          signal: AbortSignal.timeout(4000),
        });
        if (workRes.ok) {
          const workData = await workRes.json();
          if (typeof workData.description === "string") {
            description = workData.description;
          } else if (workData.description && typeof workData.description.value === "string") {
            description = workData.description.value;
          }
        }
      } catch {
        // Non-fatal if description fetch fails
      }
    }

    // 4. Check for existing book in global catalog (by ISBN13, ISBN, or Title+Author)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let existingBook: any = null;

    if (isbn13) {
      const { data } = await supabase
        .from("books")
        .select("*")
        .eq("isbn13", isbn13)
        .maybeSingle();
      if (data) existingBook = data;
    }

    if (!existingBook && isbn) {
      const { data } = await supabase
        .from("books")
        .select("*")
        .eq("isbn", isbn)
        .maybeSingle();
      if (data) existingBook = data;
    }

    if (!existingBook) {
      const { data } = await supabase
        .from("books")
        .select("*")
        .ilike("title", title.trim())
        .ilike("author", author.trim())
        .maybeSingle();
      if (data) existingBook = data;
    }

    let bookId: string;
    let finalCoverUrl = cover_url || null;

    if (existingBook) {
      bookId = existingBook.id;
      // If existing book is missing fields that we now have, update them
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: Record<string, any> = {};
      if (!existingBook.cover_url && cover_url) {
        updates.cover_url = cover_url;
        finalCoverUrl = cover_url;
      } else {
        finalCoverUrl = existingBook.cover_url || cover_url || null;
      }
      if (!existingBook.description && description) updates.description = description;
      if (!existingBook.page_count && page_count) updates.page_count = Number(page_count);
      if (!existingBook.published_year && published_year) updates.published_year = Number(published_year);
      if ((!existingBook.genres || existingBook.genres.length === 0) && genres?.length > 0) updates.genres = genres;
      if (!existingBook.isbn && isbn) updates.isbn = isbn;
      if (!existingBook.isbn13 && isbn13) updates.isbn13 = isbn13;

      if (Object.keys(updates).length > 0) {
        await supabase.from("books").update(updates).eq("id", bookId);
      }
    } else {
      // 5. Generate 768-dim embedding for the new book
      const embedding = await generateBookEmbedding({
        title: title.trim(),
        author: author.trim(),
        description,
        genres: Array.isArray(genres) ? genres : [],
      });

      const { data: insertedBook, error: insertError } = await supabase
        .from("books")
        .insert({
          title: title.trim(),
          author: author.trim(),
          isbn: isbn || null,
          isbn13: isbn13 || null,
          cover_url: cover_url || null,
          description: description || null,
          genres: Array.isArray(genres) ? genres : [],
          page_count: page_count ? Number(page_count) : null,
          published_year: published_year ? Number(published_year) : null,
          embedding: embedding || null,
        })
        .select()
        .single();

      if (insertError) {
        // If race condition hit unique index, re-fetch
        if (insertError.code === "23505") {
          const { data: refetched } = await supabase
            .from("books")
            .select("*")
            .ilike("title", title.trim())
            .ilike("author", author.trim())
            .single();
          if (refetched) {
            bookId = refetched.id;
            finalCoverUrl = refetched.cover_url;
          } else {
            throw insertError;
          }
        } else {
          throw insertError;
        }
      } else {
        bookId = insertedBook.id;
        finalCoverUrl = insertedBook.cover_url;
      }
    }

    // 6. Upsert into user_books
    const parsedRating =
      rating !== undefined && rating !== null && Number(rating) > 0
        ? Math.min(5, Math.max(1, Number(rating)))
        : null;

    let parsedDateRead: string | null = null;
    if (targetShelf === "read") {
      parsedDateRead = date_read ? new Date(date_read).toISOString() : new Date().toISOString();
    } else if (date_read) {
      parsedDateRead = new Date(date_read).toISOString();
    }

    const { data: userBook, error: ubError } = await supabase
      .from("user_books")
      .upsert(
        {
          user_id: userId,
          book_id: bookId,
          shelf: targetShelf,
          rating: parsedRating,
          date_read: parsedDateRead,
          user_review: user_review?.trim() || null,
          user_shelves: [targetShelf],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,book_id" }
      )
      .select()
      .single();

    if (ubError) {
      console.error("user_books upsert error:", ubError);
      return NextResponse.json({ error: ubError.message }, { status: 500 });
    }

    // 7. Format returned book item
    const returnedBook = {
      id: userBook.id,
      book_id: bookId,
      title: title.trim(),
      author: author.trim(),
      isbn: isbn || null,
      isbn13: isbn13 || null,
      cover_url: finalCoverUrl,
      page_count: page_count ? Number(page_count) : null,
      published_year: published_year ? Number(published_year) : null,
      shelf: targetShelf,
      rating: parsedRating,
      date_read: parsedDateRead,
      user_review: user_review?.trim() || null,
      user_shelves: [targetShelf],
    };

    return NextResponse.json({
      success: true,
      book: returnedBook,
    });
  } catch (error: any) {
    console.error("Library Add Book Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to add book to library" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createAdminClient(supabaseUrl, supabaseKey);

    // 1. Authenticate user
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
        { error: "Unauthorized. Please sign in to update your library." },
        { status: 401 }
      );
    }

    // 2. Parse body
    const body = await request.json();
    const { id, book_id, shelf, rating, user_review, date_read } = body;

    if (!id && !book_id) {
      return NextResponse.json(
        { error: "Either id (user_book record id) or book_id is required" },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (shelf !== undefined) {
      const validShelves = ["read", "currently-reading", "to-read", "did-not-finish"];
      if (!validShelves.includes(shelf)) {
        return NextResponse.json({ error: "Invalid shelf" }, { status: 400 });
      }
      updates.shelf = shelf;
      updates.user_shelves = [shelf];

      if (shelf === "read" && date_read === undefined) {
        updates.date_read = new Date().toISOString();
      }
    }

    if (rating !== undefined) {
      if (rating === null || Number(rating) === 0) {
        updates.rating = null;
      } else {
        updates.rating = Math.min(5, Math.max(1, Number(rating)));
      }
    }

    if (user_review !== undefined) {
      updates.user_review = user_review?.trim() || null;
    }

    if (date_read !== undefined) {
      updates.date_read = date_read ? new Date(date_read).toISOString() : null;
    }

    // Apply update to user_books
    let query = supabase.from("user_books").update(updates).eq("user_id", userId);

    if (id) {
      query = query.eq("id", id);
    } else if (book_id) {
      query = query.eq("book_id", book_id);
    }

    const { data: updatedRecord, error: updateError } = await query
      .select(`
        id,
        shelf,
        rating,
        date_read,
        user_review,
        user_shelves,
        book_id,
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
      .single();

    if (updateError || !updatedRecord) {
      console.error("user_books update error:", updateError);
      return NextResponse.json(
        { error: updateError?.message || "Record not found or failed to update" },
        { status: 500 }
      );
    }

    // Format returned book item
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const book: any = updatedRecord.books;
    const isbn13 = book?.isbn13;
    const isbn = book?.isbn;

    const coverUrl =
      book?.cover_url ||
      (isbn13 ? `https://covers.openlibrary.org/b/isbn/${isbn13}-M.jpg?default=false` : null) ||
      (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false` : null);

    const formattedBook = {
      id: updatedRecord.id,
      book_id: updatedRecord.book_id,
      title: book?.title || "Untitled",
      author: book?.author || "Unknown Author",
      isbn,
      isbn13,
      cover_url: coverUrl,
      page_count: book?.page_count || null,
      published_year: book?.published_year || null,
      shelf: updatedRecord.shelf,
      rating: updatedRecord.rating ? Number(updatedRecord.rating) : null,
      date_read: updatedRecord.date_read || null,
      user_review: updatedRecord.user_review || null,
      user_shelves: updatedRecord.user_shelves || [],
    };

    return NextResponse.json({
      success: true,
      book: formattedBook,
    });
  } catch (error: any) {
    console.error("Library Update Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update shelf or rating" },
      { status: 500 }
    );
  }
}
