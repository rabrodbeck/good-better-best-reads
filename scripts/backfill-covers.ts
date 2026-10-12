import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { resolveBookCover, isBadCoverUrl, cleanTitleForCoverSearch } from "../services/books/cover-service";
import { parseGoodreadsCsv } from "../services/parser/goodreads-normalizer";

// Load .env.local if present
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length > 0) {
        const val = rest.join("=").replace(/^["']|["']$/g, "").trim();
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = val;
        }
      }
    }
  }
} catch {
  // Ignore
}

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

  // 1. Build a Goodreads ID lookup map from any available CSV exports
  const goodreadsMap = new Map<string, string>(); // "title|author" -> goodreadsId

  const candidateCsvs = [
    path.resolve(process.cwd(), "test/fixtures/goodreads_library_export_ryan.csv"),
    ...(process.argv[2] ? [path.resolve(process.argv[2])] : []),
  ];

  for (const csvPath of candidateCsvs) {
    if (fs.existsSync(csvPath)) {
      console.log(`📖 Loading Goodreads export: ${csvPath}`);
      const content = fs.readFileSync(csvPath, "utf8");
      const { books } = parseGoodreadsCsv(content);
      for (const b of books) {
        if (b.goodreadsId) {
          const key = `${b.cleanTitle.toLowerCase().trim()}|${b.author.toLowerCase().trim()}`;
          goodreadsMap.set(key, b.goodreadsId);
          if (b.isbn13) goodreadsMap.set(`isbn13:${b.isbn13}`, b.goodreadsId);
          if (b.isbn) goodreadsMap.set(`isbn:${b.isbn}`, b.goodreadsId);
        }
      }
    }
  }

  console.log(`Mapped ${goodreadsMap.size} Goodreads identifier entries.`);

  // 2. Fetch all books from Supabase catalog
  console.log("Fetching books from Supabase catalog...");
  const { data: books, error } = await supabase
    .from("books")
    .select("id, title, author, isbn, isbn13, cover_url")
    .order("created_at", { ascending: false });

  if (error || !books) {
    console.error("Failed to fetch books:", error);
    process.exit(1);
  }

  console.log(`Found ${books.length} total books in catalog.`);

  let updatedCount = 0;

  for (const book of books) {
    const isMissingCover = !book.cover_url;
    const isCorruptCover = isBadCoverUrl(book.cover_url);
    const isOpenLibraryCover = Boolean(book.cover_url?.includes("openlibrary.org"));

    if (isMissingCover || isCorruptCover || isOpenLibraryCover) {
      console.log(`\n🔍 Evaluating cover for: "${book.title}" by ${book.author}...`);
      if (isCorruptCover) {
        console.log(`  ⚠️  Flagged existing cover as low-quality/corrupt: ${book.cover_url}`);
      } else if (isOpenLibraryCover) {
        console.log(`  ℹ️  Upgrading legacy Open Library cover: ${book.cover_url}`);
      }

      // Check for known Goodreads ID
      const titleKey = `${book.title.toLowerCase().trim()}|${book.author.toLowerCase().trim()}`;
      const cleanTitleKey = `${cleanTitleForCoverSearch(book.title).toLowerCase().trim()}|${book.author.toLowerCase().trim()}`;
      const goodreadsId =
        goodreadsMap.get(titleKey) ||
        goodreadsMap.get(cleanTitleKey) ||
        (book.isbn13 ? goodreadsMap.get(`isbn13:${book.isbn13}`) : null) ||
        (book.isbn ? goodreadsMap.get(`isbn:${book.isbn}`) : null) ||
        null;

      try {
        const { coverUrl, source } = await resolveBookCover({
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          isbn13: book.isbn13,
          goodreadsId,
        });

        if (coverUrl && !isBadCoverUrl(coverUrl) && coverUrl !== book.cover_url) {
          console.log(`  📸 Resolved cover via [${source}]: ${coverUrl}`);
          const { error: updateErr } = await supabase
            .from("books")
            .update({ cover_url: coverUrl })
            .eq("id", book.id);

          if (updateErr) {
            console.error(`  ❌ Failed to update book ${book.id}:`, updateErr);
          } else {
            console.log(`  ✅ Successfully updated DB for "${book.title}"!`);
            updatedCount++;
          }
        } else if (coverUrl === book.cover_url) {
          console.log(`  ℹ️  Cover already matches: ${book.cover_url}`);
        } else {
          if (isCorruptCover) {
            console.log(
              `  🧹 Clearing dead/corrupt cover to null for "${book.title}" so UI shows fallback spine.`
            );
            await supabase.from("books").update({ cover_url: null }).eq("id", book.id);
            updatedCount++;
          } else {
            console.log(
              `  ⚠️  No cover found via 3-tier cascade for "${book.title}".`
            );
          }
        }
      } catch (err) {
        console.error(`  ❌ Error processing "${book.title}":`, err);
      }
    }
  }

  console.log(`\n🎉 Cover repair complete! Updated ${updatedCount} books.`);
}

main().catch(console.error);
