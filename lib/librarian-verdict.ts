import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import {
  LibrarianVerdictInput,
  LibrarianVerdictOutput,
  LibrarianVerdictOutputSchema,
  deriveVerdictCategory,
} from "@/types/librarian-verdict";
import { parseSeriesInfo } from "@/lib/series";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * In-memory TTL cache to prevent duplicate LLM calls
 * Key: `${userId}:${isbn || `${title}:${author}`}`
 */
interface CacheEntry {
  verdict: LibrarianVerdictOutput;
  expiresAt: number;
}

const VERDICT_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes

export function clearVerdictCache(): void {
  VERDICT_CACHE.clear();
}

export function getCachedVerdict(key: string): LibrarianVerdictOutput | null {
  const cached = VERDICT_CACHE.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    VERDICT_CACHE.delete(key);
    return null;
  }
  return cached.verdict;
}

export function setCachedVerdict(key: string, verdict: LibrarianVerdictOutput): void {
  VERDICT_CACHE.set(key, {
    verdict,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * In-memory cache for user taste profile & read titles (15 min TTL)
 * Prevents redundant Supabase queries during active bookstore scanning sessions
 */
interface UserTasteCacheEntry {
  profile: any;
  readTitles: Set<string>;
  expiresAt: number;
}

const USER_TASTE_CACHE = new Map<string, UserTasteCacheEntry>();
const USER_TASTE_TTL_MS = 1000 * 60 * 15;

export function clearUserTasteCache(): void {
  USER_TASTE_CACHE.clear();
}

/**
 * Stage 2: Core Intelligence Engine for Librarian Taste Verdict (Issue #52)
 */
export async function generateLibrarianVerdict(
  userId: string,
  book: LibrarianVerdictInput,
  supabase: SupabaseClient
): Promise<LibrarianVerdictOutput> {
  const cacheKey = `${userId}:${book.isbn || `${book.title.toLowerCase().trim()}:${book.author.toLowerCase().trim()}`}`;
  const cached = getCachedVerdict(cacheKey);
  if (cached) {
    return cached;
  }

  // 1. Fetch user Reading DNA & existing read library (using 15min in-memory cache)
  let profile: any;
  let readTitles: Set<string>;

  const cachedUser = USER_TASTE_CACHE.get(userId);
  if (cachedUser && Date.now() < cachedUser.expiresAt) {
    profile = cachedUser.profile;
    readTitles = cachedUser.readTitles;
  } else {
    const [tasteRes, userBooksRes] = await Promise.all([
      supabase
        .from("taste_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("user_books")
        .select(`
          shelf,
          books (
            title,
            author
          )
        `)
        .eq("user_id", userId)
        .eq("shelf", "read")
        .limit(200),
    ]);

    profile = tasteRes.data || {
      archetype_name: "The Inquisitive Explorer",
      preferred_pacing: "Propulsive & Engaging",
      emotional_tone: "Dynamic & Immersive",
      top_tropes: ["Deep Worldbuilding", "Compelling Mysteries"],
      dealbreakers: ["Slow Exposition", "Predictable Endings"],
    };

    readTitles = new Set<string>();
    if (userBooksRes.data) {
      for (const ub of userBooksRes.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const b = Array.isArray(ub.books) ? ub.books[0] : (ub.books as any);
        if (b?.title) {
          readTitles.add(b.title.toLowerCase().trim());
        }
      }
    }

    USER_TASTE_CACHE.set(userId, {
      profile,
      readTitles,
      expiresAt: Date.now() + USER_TASTE_TTL_MS,
    });
  }

  // Pre-parse series info if title contains parenthetical series tags
  const localSeries = parseSeriesInfo(book.title);

  const apiKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (apiKey) {
    try {
      const google = createGoogleGenerativeAI({ apiKey });

      const prompt = `
You are the in-store librarian for TBRScout. Your job is to give readers a fast, honest verdict before they purchase a physical book.
The reader is physically holding or scanning a book right now in a bookstore or library and asking: "Will I like this?"

Your job is to give an instant, accurate verdict comparing this book directly to the reader's Reading DNA.

### READER'S READING DNA:
- **Archetype**: ${profile.archetype_name}
- **Pacing Preference**: ${profile.preferred_pacing || "Engaging"}
- **Emotional Tone**: ${profile.emotional_tone || "Immersive"}
- **Top Tropes Loved**: ${(profile.top_tropes || []).join(", ") || "None listed"}
- **Dealbreakers to Avoid**: ${(profile.dealbreakers || []).join(", ") || "None listed"}

### BOOK BEING EVALUATED:
- **Title**: "${book.title}"
- **Author**: "${book.author}"
${book.publishedYear ? `- **Published Year**: ${book.publishedYear}` : ""}
${book.isbn ? `- **ISBN**: ${book.isbn}` : ""}
${book.genres?.length ? `- **Genres/Tags**: ${book.genres.join(", ")}` : ""}
${book.description ? `- **Synopsis/Description**: "${book.description.slice(0, 500)}"` : "- **Synopsis**: [No synopsis provided in database for this edition]"}
${localSeries ? `- **Detected Series Metadata**: Series: "${localSeries.seriesName}", Volume: #${localSeries.volume || 1}` : ""}

### STRICT INSTRUCTIONS:
1. **Never Hallucinate**: If you do not know the exact plot of this specific title and no description is given, be honest: state that specific plot details are limited, but evaluate based on the author's reputation and genres.
2. **Strict Rationale Length**: Exactly TWO (2) sentences max.
   - Sentence 1: Highlight what specifically connects to their taste DNA (e.g. pacing, tone, or tropes).
   - Sentence 2: Highlight any caveats, potential friction, or series context (e.g. sequel warning, slow start, spice level, or dark themes).
3. **Series Detection**:
   - If this book is a sequel or part of a series (Book 2, 3, etc.), set seriesInfo: isSeries=true, seriesName, volumeNumber, and firstBookTitle.
   - If volumeNumber > 1, firstBookTitle MUST be the title of Book 1 in that series.
4. **Dealbreaker Check**:
   - If the book contains elements listed in the reader's dealbreakers, include them in \`dealbreakersDetected\` and set \`verdict\` to "caution".
5. **Verdict & Score**:
   - matchScore: integer between 0 and 100.
   - verdict: "strong_match" (>=80), "caution" (50-79 or dealbreaker detected), "wildcard" (<50 or unfamiliar genre).
   - badgeLabel: e.g. "90% Strong Match", "65% Proceed with Caution", or "Wildcard / New Territory".
`.trim();

      const { output } = await generateText({
        model: google("gemini-2.5-flash"),
        output: Output.object({ schema: LibrarianVerdictOutputSchema }),
        prompt,
        temperature: 0.2,
        maxOutputTokens: 250,
      });

      // Cross-check if user already read Book 1 or prior volumes
      if (output.seriesInfo && output.seriesInfo.firstBookTitle) {
        const normFirstBook = output.seriesInfo.firstBookTitle.toLowerCase().trim();
        if (readTitles.has(normFirstBook)) {
          output.seriesInfo.userAlreadyReadPriorBook = true;
        }
      }

      setCachedVerdict(cacheKey, output);
      return output;
    } catch (err) {
      console.error("Gemini verdict generation error, falling back to heuristic:", err);
    }
  }

  // Fallback heuristic if Gemini API is unavailable or fails
  const isSequel = localSeries && localSeries.volume && localSeries.volume > 1;
  const matchScore = isSequel ? 75 : 82;
  const verdict = deriveVerdictCategory(matchScore, Boolean(isSequel));

  const fallbackVerdict: LibrarianVerdictOutput = {
    matchScore,
    verdict,
    badgeLabel: isSequel ? "75% Proceed with Caution" : "82% Strong Match",
    rationale: isSequel
      ? `Matches your preferred genres for ${book.author}, but this appears to be Volume #${localSeries?.volume} in the ${localSeries?.seriesName} series. Consider reading Book 1 first to fully appreciate the overarching character arcs.`
      : `Fits nicely into your reading interests with engaging ${profile.preferred_pacing.toLowerCase()} pacing. A solid candidate for your shelves with great storytelling by ${book.author}.`,
    seriesInfo: localSeries
      ? {
          isSeries: true,
          seriesName: localSeries.seriesName,
          volumeNumber: localSeries.volume ?? 1,
          firstBookTitle: localSeries.seriesName,
          userAlreadyReadPriorBook: false,
        }
      : undefined,
    dealbreakersDetected: [],
  };

  setCachedVerdict(cacheKey, fallbackVerdict);
  return fallbackVerdict;
}
