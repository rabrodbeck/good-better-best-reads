import { NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const ConciergeRecommendationSchema = z.object({
  bookId: z.string().describe("The exact book ID from the provided catalog"),
  matchHeadline: z.string().describe("Short, evocative headline explaining why this fits (e.g. 'Unrelenting Breakneck Momentum')"),
  pitch: z.string().describe("2-3 sentences explaining why the reader will love this based on their taste DNA and mood"),
  vibeTags: z.array(z.string()).max(4).describe("2-3 quick vibe tags (e.g. ['High Stakes', 'Fast-Paced', 'Twist Ending'])"),
});

const ConciergeResponseSchema = z.object({
  conciergeSummary: z.string().describe("A warm, literary 1-2 sentence introduction from the Personal Librarian tailored to their mood"),
  picks: z.array(ConciergeRecommendationSchema).min(1).max(3),
});

export async function POST(req: Request) {
  try {
    // 1. Rate limiting (15 requests per minute)
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`concierge:${ip}`, { maxRequests: 15, windowMs: 60_000 });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many concierge requests. Please wait a moment before asking again." },
        { status: 429 }
      );
    }

    // 2. Authenticate user
    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const mood: string = body.mood || "Surprise Me";
    const customPrompt: string = body.customPrompt?.trim() || "";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const admin = createAdminClient(supabaseUrl, supabaseKey);

    // 3. Fetch user's to-read books and taste profile concurrently
    const [toReadRes, tasteRes] = await Promise.all([
      admin
        .from("user_books")
        .select(`
          id,
          book_id,
          shelf,
          books (
            id,
            title,
            author,
            cover_url,
            page_count,
            published_year,
            genres,
            description
          )
        `)
        .eq("user_id", user.id)
        .eq("shelf", "to-read")
        .limit(60),
      admin
        .from("taste_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (toReadRes.error) {
      console.error("To-read fetch error:", toReadRes.error);
      return NextResponse.json({ error: "Failed to load to-read catalog" }, { status: 500 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawList = (toReadRes.data || []) as any[];
    if (rawList.length === 0) {
      return NextResponse.json(
        {
          error: "Your 'Want to Read' shelf is empty! Add a few books you're eager to read first.",
          recommendations: [],
        },
        { status: 400 }
      );
    }

    // Format books for LLM context
    const candidateBooks = rawList.map((ub) => {
      const b = Array.isArray(ub.books) ? ub.books[0] : ub.books;
      return {
        userBookId: ub.id,
        bookId: ub.book_id || b?.id || "",
        title: b?.title || "Untitled",
        author: b?.author || "Unknown",
        pageCount: b?.page_count || null,
        coverUrl: b?.cover_url || null,
        genres: b?.genres || [],
        description: b?.description ? b.description.slice(0, 200) : null,
      };
    }).filter((b) => Boolean(b.bookId));

    const candidateMap = new Map(candidateBooks.map((b) => [b.bookId, b]));

    const profile = tasteRes.data || {
      archetype_name: "The Inquisitive Explorer",
      preferred_pacing: "Propulsive & Engaging",
      emotional_tone: "Dynamic & Engaging",
      top_tropes: ["Deep Worldbuilding", "Compelling Mysteries"],
      dealbreakers: ["Slow Exposition", "Predictable Endings"],
    };

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    // If Gemini API is available, generate intelligent picks
    if (apiKey) {
      try {
        const google = createGoogleGenerativeAI({ apiKey });

        const prompt = `
You are the elite "Personal Shelf Concierge" on GoodBetterBestReads.
The reader has choice paralysis and is looking at their "Want to Read" shelf. Your goal is to select the TOP 3 absolute best matches from their own list.

### READER'S TASTE DNA:
- **Archetype**: ${profile.archetype_name}
- **Pacing Preference**: ${profile.preferred_pacing || "Balanced"}
- **Emotional Tone**: ${profile.emotional_tone || "Immersive"}
- **Favorite Tropes**: ${(profile.top_tropes || []).join(", ")}
- **Dealbreakers to Avoid**: ${(profile.dealbreakers || []).join(", ")}

### CURRENT READER MOOD & REQUEST:
- **Selected Mood**: "${mood}"
${customPrompt ? `- **Custom Request**: "${customPrompt}"` : ""}

### CANDIDATE BOOKS ON READER'S WANT-TO-READ SHELF:
${candidateBooks
  .map(
    (b) =>
      `- ID: "${b.bookId}" | Title: "${b.title}" by ${b.author}${
        b.pageCount ? ` (${b.pageCount} pages)` : ""
      }${b.genres?.length ? ` [Genres: ${b.genres.join(", ")}]` : ""}${
        b.description ? ` | Note: ${b.description}` : ""
      }`
  )
  .join("\n")}

### INSTRUCTIONS:
1. Select 1 to 3 books strictly from the list above that best honor their requested mood and match their Taste DNA.
2. Ensure you return the exact \`bookId\` for each chosen title.
3. Write punchy, insightful pitches that specifically mention why the pacing, theme, or character dynamics match what they are craving right now.
4. Provide a warm, concise intro summary greeting them as their personal librarian.
`.trim();

        const { output } = await generateText({
          model: google("gemini-2.5-flash"),
          output: Output.object({ schema: ConciergeResponseSchema }),
          prompt,
          temperature: 0.3,
        });

        const enrichedPicks = output.picks
          .map((pick) => {
            const original = candidateMap.get(pick.bookId);
            if (!original) return null;
            return {
              userBookId: original.userBookId,
              bookId: original.bookId,
              title: original.title,
              author: original.author,
              coverUrl: original.coverUrl,
              pageCount: original.pageCount,
              matchHeadline: pick.matchHeadline,
              pitch: pick.pitch,
              vibeTags: pick.vibeTags,
            };
          })
          .filter(Boolean);

        if (enrichedPicks.length > 0) {
          return NextResponse.json({
            summary: output.conciergeSummary,
            mood,
            picks: enrichedPicks,
          });
        }
      } catch (aiError) {
        console.warn("Gemini concierge generation fallback:", aiError);
      }
    }

    // Heuristic Fallback (Zero-failure design if LLM unavailable or offline)
    const fallbackPicks = candidateBooks.slice(0, 3).map((b, idx) => ({
      userBookId: b.userBookId,
      bookId: b.bookId,
      title: b.title,
      author: b.author,
      coverUrl: b.coverUrl,
      pageCount: b.pageCount,
      matchHeadline: idx === 0 ? "Top Pick for Your Queue" : "Highly Recommended Next Read",
      pitch: `A standout title from your Want to Read shelf that aligns with your ${profile.archetype_name} reading archetype.`,
      vibeTags: ["Queued", "Reader Favorite"],
    }));

    return NextResponse.json({
      summary: `Here are 3 handpicked books from your Want to Read shelf to kickstart your next reading session!`,
      mood,
      picks: fallbackPicks,
    });
  } catch (error: any) {
    console.error("Concierge API error:", error);
    return NextResponse.json({ error: "Failed to generate shelf recommendations" }, { status: 500 });
  }
}
