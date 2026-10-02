import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseGoodreadsCsv } from "@/services/parser/goodreads-normalizer";
import { analyzeTasteProfile } from "@/services/taste/taste-analyzer";
import { generateTasteVector } from "@/services/taste/embedding-generator";
import { enrichBookDetails } from "@/services/books/enrichment-service";

export const maxDuration = 60; // Allow sufficient time for AI taste extraction

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No CSV file provided" }, { status: 400 });
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
        // Fetch existing books to match by ISBN13, ISBN, or clean Title + Author
        const { data: existingBooks } = await supabase
            .from("books")
            .select("id, title, author, isbn, isbn13");

        const existingByIsbn13 = new Map<string, string>();
        const existingByIsbn = new Map<string, string>();
        const existingByTitleAuthor = new Map<string, string>();

        for (const b of existingBooks || []) {
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
                    coverUrl = `https://covers.openlibrary.org/b/isbn/${b.isbn13}-M.jpg?default=false`;
                } else if (b.isbn) {
                    coverUrl = `https://covers.openlibrary.org/b/isbn/${b.isbn}-M.jpg?default=false`;
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

        const CHUNK_SIZE = 50;
        if (newBooksToInsert.length > 0) {
            for (let i = 0; i < newBooksToInsert.length; i += CHUNK_SIZE) {
                const chunk = newBooksToInsert.slice(i, i + CHUNK_SIZE);
                await supabase.from("books").insert(chunk);
            }
        }

        // 4. Ensure a user profile exists to link shelves and taste
        let userId: string;
        const { data: existingProfiles } = await supabase.from("profiles").select("id").limit(1);

        if (existingProfiles && existingProfiles.length > 0) {
            userId = existingProfiles[0].id;
        } else {
            const { data: usersData } = await supabase.auth.admin.listUsers();
            if (usersData?.users && usersData.users.length > 0) {
                userId = usersData.users[0].id;
            } else {
                const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
                    email: "ryan@goodbetterbestreads.local",
                    password: "dev-password-12345",
                    email_confirm: true,
                    user_metadata: { display_name: "Ryan" },
                });
                if (createErr || !newUser.user) {
                    throw new Error(createErr?.message || "Failed to create user");
                }
                userId = newUser.user.id;
            }

            await supabase.from("profiles").upsert({
                id: userId,
                email: "ryan@goodbetterbestreads.local",
                display_name: "Ryan",
            });
        }

        // Update profile archetype title
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
        const { data: dbBooks } = await supabase
            .from("books")
            .select("id, title, author, isbn, isbn13");

        if (dbBooks && dbBooks.length > 0) {
            const byIsbn13 = new Map<string, string>();
            const byIsbn = new Map<string, string>();
            const byTitleAuthor = new Map<string, string>();

            for (const b of dbBooks) {
                if (b.isbn13) byIsbn13.set(b.isbn13, b.id);
                if (b.isbn) existingByIsbn.set(b.isbn, b.id);
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