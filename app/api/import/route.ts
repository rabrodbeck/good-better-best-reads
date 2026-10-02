import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseGoodreadsCsv } from "@/services/parser/goodreads-normalizer";
import { analyzeTasteProfile } from "@/services/taste/taste-analyzer";
import { generateTasteVector } from "@/services/taste/embedding-generator";

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

        // 3. Upsert books into the global 'books' catalog in chunks of 50
        const catalogBooks = books.map((b) => ({
            title: b.cleanTitle,
            author: b.author,
            isbn: b.isbn,
            isbn13: b.isbn13,
            page_count: b.pageCount,
            published_year: b.yearPublished,
            description: null,
            genres: [],
        }));

        const CHUNK_SIZE = 50;
        for (let i = 0; i < catalogBooks.length; i += CHUNK_SIZE) {
            const chunk = catalogBooks.slice(i, i + CHUNK_SIZE);
            await supabase
                .from("books")
                .upsert(chunk, { onConflict: "isbn13", ignoreDuplicates: true });
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