import { createClient } from "@supabase/supabase-js";
import { enrichBookDetails } from "../services/books/enrichment-service";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key in environment");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Fetching books from Supabase...");
  const { data: books, error } = await supabase
    .from("books")
    .select("id, title, author, isbn, isbn13, cover_url");

  if (error || !books) {
    console.error("Failed to fetch books:", error);
    process.exit(1);
  }

  console.log(`Found ${books.length} total books.`);

  let updatedCount = 0;

  for (const book of books) {
    const isMissingCover = !book.cover_url;
    const isFaePrinces = book.title.toLowerCase().includes("fae prince");

    if (isMissingCover || isFaePrinces) {
      console.log(`\n🔍 Enriching: "${book.title}" by ${book.author}...`);
      try {
        const enriched = await enrichBookDetails(
          book.title,
          book.author,
          book.isbn13 || book.isbn
        );

        if (enriched?.coverUrl && enriched.coverUrl !== book.cover_url) {
          console.log(`  📸 Found cover: ${enriched.coverUrl}`);
          const { error: updateErr } = await supabase
            .from("books")
            .update({ cover_url: enriched.coverUrl })
            .eq("id", book.id);

          if (updateErr) {
            console.error(`  ❌ Failed to update book ${book.id}:`, updateErr);
          } else {
            console.log(`  ✅ Successfully updated DB for "${book.title}"!`);
            updatedCount++;
          }
        } else if (enriched?.coverUrl === book.cover_url) {
          console.log(`  ℹ️  Cover already matches current: ${book.cover_url}`);
        } else {
          console.log(
            `  ⚠️  No cover found anywhere on Open Library for "${book.title}". Will use UI "Cover Unavailable" fallback.`
          );
        }
      } catch (err) {
        console.error(`  ❌ Error processing "${book.title}":`, err);
      }
    }
  }

  console.log(`\n🎉 Backfill complete! Updated ${updatedCount} books.`);
}

main().catch(console.error);
