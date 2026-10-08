import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { parseGoodreadsCsv } from "@/services/parser/goodreads-normalizer";
import { NormalizedBook } from "@/services/parser/types";
import { analyzeTasteProfile } from "@/services/taste/taste-analyzer";
import { generateTasteVector } from "@/services/taste/embedding-generator";
import { enrichBookDetails } from "@/services/books/enrichment-service";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const maxDuration = 60; // Allow sufficient time for AI taste extraction

interface CatalogBookSummary {
    id: string;
    title: string;
    author: string;
    isbn: string | null;
    isbn13: string | null;
}

/**
 * Queries the books table using targeted .in() batch filters for only the ISBNs
 * and clean titles present in the uploaded batch, avoiding an unbounded full table scan.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchBatchMatchingBooks(
    supabase: any,
    batch: NormalizedBook[]
): Promise<CatalogBookSummary[]> {
    const isbn13List = Array.from(new Set(batch.map((b) => b.isbn13).filter((i): i is string => Boolean(i))));
    const isbnList = Array.from(new Set(batch.map((b) => b.isbn).filter((i): i is string => Boolean(i))));
    const titleList = Array.from(new Set(batch.map((b) => b.cleanTitle).filter((t): t is string => Boolean(t))));

    const matchedBooksMap = new Map<string, CatalogBookSummary>();
    const QUERY_CHUNK = 100;

    // 1. Targeted query by ISBN13
    for (let i = 0; i < isbn13List.length; i += QUERY_CHUNK) {
        const chunk = isbn13List.slice(i, i + QUERY_CHUNK);
        const { data } = await supabase
            .from("books")
            .select("id, title, author, isbn, isbn13")
            .in("isbn13", chunk);
        for (const b of data || []) matchedBooksMap.set(b.id, b);
    }

    // 2. Targeted query by ISBN10
    for (let i = 0; i < isbnList.length; i += QUERY_CHUNK) {
        const chunk = isbnList.slice(i, i + QUERY_CHUNK);
        const { data } = await supabase
            .from("books")
            .select("id, title, author, isbn, isbn13")
            .in("isbn", chunk);
        for (const b of data || []) matchedBooksMap.set(b.id, b);
    }

    // 3. Targeted query by Clean Title
    for (let i = 0; i < titleList.length; i += QUERY_CHUNK) {
        const chunk = titleList.slice(i, i + QUERY_CHUNK);
        const { data } = await supabase
            .from("books")
            .select("id, title, author, isbn, isbn13")
            .in("title", chunk);
        for (const b of data || []) matchedBooksMap.set(b.id, b);
    }

    return Array.from(matchedBooksMap.values());
}

export async function POST(req: Request) {
    try {
        // 1. Sliding-window IP rate limiting (5 requests per minute)
        const ip = getClientIp(req);
        const rateLimit = checkRateLimit(`import:${ip}`, { maxRequests: 5, windowMs: 60_000 });
        if (!rateLimit.success) {
            return NextResponse.json(
                { error: "Too many import requests. Please wait a moment before trying again." },
                {
                    status: 429,
                    headers: {
                        "Retry-After": Math.max(1, rateLimit.reset - Math.floor(Date.now() / 1000)).toString(),
                        "X-RateLimit-Limit": rateLimit.limit.toString(),
                        "X-RateLimit-Remaining": rateLimit.remaining.toString(),
                        "X-RateLimit-Reset": rateLimit.reset.toString(),
                    },
                }
            );
        }

        // 2. Strict Session Authentication before processing or external API calls
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
            // Not authenticated
        }

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized. Please sign in to import your library." },
                { status: 401 }
            );
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No CSV file provided" }, { status: 400 });
        }

        // 3. Enforce 5MB file upload cap to prevent memory exhaustion and DoS (SEC / Issue #25)
        const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
        if (file.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json(
                { error: "File exceeds 5MB limit. Please upload a smaller CSV export." },
                { status: 413 }
            );
        }

        const csvContent = await file.text();
        const { books, stats, errors } = parseGoodreadsCsv(csvContent);

        if (books.length === 0) {
            return NextResponse.json(
                { error: "Could not parse any books from this CSV. Check the file format." },
                { status: 400 }
            );
        }

        // Initialize Supabase admin/server client
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Analyze Taste Profile using Gemini 2.5 Flash
        const tasteProfile = await analyzeTasteProfile(books);

        // 2. Generate 768-dim Vector Embedding
        const tasteVector = await generateTasteVector(tasteProfile);

        // 3. Upsert books into the global 'books' catalog with robust multi-field deduplication
        // Targeted query fetching only matching books by batch ISBNs or Titles
        const existingBooks = await fetchBatchMatchingBooks(supabase, books);

        const existingByIsbn13 = new Map<string, string>();
        const existingByIsbn = new Map<string, string>();
        const existingByTitleAuthor = new Map<string, string>();

        for (const b of existingBooks) {
            if (b.isbn13) existingByIsbn13.set(b.isbn13, b.id);
            if (b.isbn) existingByIsbn.set(b.isbn, b.id);
            existingByTitleAuthor.set(
                `${b.title.toLowerCase().trim()}|${b.author.toLowerCase().trim()}`,
                b.id
            );
        }

        // Filter only genuinely new books to insert
        const newBooksToInsert = [];
        const seenInBatch = new Set<string>();

        for (const b of books) {
            const key = `${b.cleanTitle.toLowerCase().trim()}|${b.author.toLowerCase().trim()}`;
            const exists =
                (b.isbn13 && existingByIsbn13.has(b.isbn13)) ||
                (b.isbn && existingByIsbn.has(b.isbn)) ||
                existingByTitleAuthor.has(key) ||
                seenInBatch.has(key);

            if (!exists) {
                seenInBatch.add(key);

                let coverUrl: string | null = null;
                if (b.isbn13) {
                    coverUrl = `https://covers.openlibrary.org/b/isbn/${b.isbn13}-L.jpg?default=false`;
                } else if (b.isbn) {
                    coverUrl = `https://covers.openlibrary.org/b/isbn/${b.isbn}-L.jpg?default=false`;
                }

                newBooksToInsert.push({
                    title: b.cleanTitle,
                    author: b.author,
                    isbn: b.isbn,
                    isbn13: b.isbn13,
                    cover_url: coverUrl,
                    page_count: b.pageCount,
                    published_year: b.yearPublished,
                    description: null,
                    genres: [],
                });
            }
        }

        // For books without an ISBN, perform English-first title+author search
        for (const book of newBooksToInsert) {
            if (!book.cover_url) {
                try {
                    const enriched = await enrichBookDetails(book.title, book.author);
                    if (enriched?.coverUrl) {
                        book.cover_url = enriched.coverUrl;
                    }
                } catch {
                    // Non-fatal if single search times out
                }
            }
        }

        const newlyInsertedBooks: CatalogBookSummary[] = [];
        const CHUNK_SIZE = 50;
        if (newBooksToInsert.length > 0) {
            for (let i = 0; i < newBooksToInsert.length; i += CHUNK_SIZE) {
                const chunk = newBooksToInsert.slice(i, i + CHUNK_SIZE);
                const { data: inserted, error: insertError } = await supabase
                    .from("books")
                    .insert(chunk)
                    .select("id, title, author, isbn, isbn13");

                if (insertError) {
                    console.error("Batch books insert error:", insertError);
                } else if (inserted) {
                    newlyInsertedBooks.push(...inserted);
                }
            }
        }

        // 4. Update user profile to link shelves and taste
        await supabase
            .from("profiles")
            .update({
                taste_archetype: tasteProfile.archetype_name,
                updated_at: new Date().toISOString(),
            })
            .eq("id", userId);

        // 5. Upsert Taste Profile & 768-dim Holistic Vector
        await supabase
            .from("taste_profiles")
            .upsert(
                {
                    user_id: userId,
                    archetype_name: tasteProfile.archetype_name,
                    archetype_summary: tasteProfile.archetype_summary,
                    preferred_pacing: tasteProfile.preferred_pacing,
                    emotional_tone: tasteProfile.emotional_tone,
                    taste_vector: tasteVector,
                    top_tropes: tasteProfile.top_tropes,
                    dealbreakers: tasteProfile.dealbreakers,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id" }
            );

        // 6. Map and upsert user shelves into 'user_books'
        // Combine pre-matched existing books and newly inserted books (avoids redundant full table scan)
        const allBatchCatalogBooks = [...existingBooks, ...newlyInsertedBooks];

        if (allBatchCatalogBooks.length > 0) {
            const byIsbn13 = new Map<string, string>();
            const byIsbn = new Map<string, string>();
            const byTitleAuthor = new Map<string, string>();

            for (const b of allBatchCatalogBooks) {
                if (b.isbn13) byIsbn13.set(b.isbn13, b.id);
                if (b.isbn) byIsbn.set(b.isbn, b.id);
                byTitleAuthor.set(`${b.title.toLowerCase().trim()}|${b.author.toLowerCase().trim()}`, b.id);
            }

            const userBooksToUpsert = [];
            for (const b of books) {
                const bookId =
                    (b.isbn13 && byIsbn13.get(b.isbn13)) ||
                    (b.isbn && byIsbn.get(b.isbn)) ||
                    byTitleAuthor.get(`${b.cleanTitle.toLowerCase().trim()}|${b.author.toLowerCase().trim()}`);

                if (bookId) {
                    userBooksToUpsert.push({
                        user_id: userId,
                        book_id: bookId,
                        shelf: b.shelf,
                        rating: b.myRating > 0 ? b.myRating : null,
                        date_read: b.dateRead,
                        user_review: b.userReview,
                        user_shelves: b.userShelves,
                    });
                }
            }

            for (let i = 0; i < userBooksToUpsert.length; i += CHUNK_SIZE) {
                const chunk = userBooksToUpsert.slice(i, i + CHUNK_SIZE);
                await supabase
                    .from("user_books")
                    .upsert(chunk, { onConflict: "user_id,book_id" });
            }
        }

        return NextResponse.json({
            success: true,
            stats,
            tasteProfile,
            tasteVectorDimensions: tasteVector.length,
            warnings: errors,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to import library";
        console.error("Import API Error:", err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}