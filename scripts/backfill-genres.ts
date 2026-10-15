import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Blacklist of generic library indexing tags that are not meaningful literary genres
const JUNK_SUBJECT_REGEX = /^(accessible book|protected daisy|in library|lending library|overdrive|large type books|open library|paperback|hardcover|first edition|ny: |audiobook|translations into|reading level)/i;

function cleanGenres(subjects: string[]): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const s of subjects) {
    if (!s) continue;
    const trimmed = s.trim();
    if (trimmed.length < 3 || trimmed.length > 35) continue;
    if (JUNK_SUBJECT_REGEX.test(trimmed)) continue;

    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      // Capitalize nicely
      const formatted = trimmed
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      results.push(formatted);
    }

    if (results.length >= 5) break;
  }

  return results;
}

async function fetchOpenLibrarySubjects(title: string, author: string): Promise<string[]> {
  try {
    const q = encodeURIComponent(`${title} ${author}`);
    const url = `https://openlibrary.org/search.json?q=${q}&fields=title,author_name,subject&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": "TBRScout/1.0" } });
    if (!res.ok) return [];

    const data = await res.json();
    const subjects = data?.docs?.[0]?.subject;
    if (Array.isArray(subjects) && subjects.length > 0) {
      return cleanGenres(subjects);
    }
  } catch {
    // Non-fatal
  }
  return [];
}

async function main() {
  console.log("🔍 Scanning catalog for books missing genre metadata...");

  const { data: books, error } = await supabase
    .from("books")
    .select("id, title, author, genres")
    .or("genres.is.null,genres.eq.{}");

  if (error) {
    console.error("Error fetching books:", error);
    process.exit(1);
  }

  const booksNeedingGenres = (books || []).filter(
    (b) => !b.genres || b.genres.length === 0
  );

  console.log(`Found ${booksNeedingGenres.length} books needing genre enrichment.`);

  let updatedCount = 0;
  for (let i = 0; i < booksNeedingGenres.length; i++) {
    const book = booksNeedingGenres[i];
    process.stdout.write(`[${i + 1}/${booksNeedingGenres.length}] "${book.title}" by ${book.author}... `);

    const genres = await fetchOpenLibrarySubjects(book.title, book.author);
    if (genres.length > 0) {
      const { error: updateError } = await supabase
        .from("books")
        .update({ genres })
        .eq("id", book.id);

      if (!updateError) {
        console.log(`✅ [${genres.join(", ")}]`);
        updatedCount++;
      } else {
        console.log(`❌ Update failed: ${updateError.message}`);
      }
    } else {
      console.log("⚠️ No subjects found");
    }

    // Rate limiting delay (200ms) to respect Open Library API
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n🎉 Backfill complete! Enriched ${updatedCount} of ${booksNeedingGenres.length} books.`);
}

main().catch(console.error);
