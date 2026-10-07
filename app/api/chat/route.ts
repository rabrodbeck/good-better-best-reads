import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  isStepCount,
} from "ai";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { buildLibrarianSystemPrompt } from "@/services/librarian/prompt";
import { lookupBookCoverTool } from "@/services/librarian/tools";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { ChatRequestSchema } from "@/lib/api-schemas";
import { TasteProfile } from "@/services/taste/schemas";

export const maxDuration = 60; // Allow enough time for multi-step book lookups

export async function POST(req: Request) {
  try {
    // 1. IP / client-based rate limiting (20 requests per minute)
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`chat:${ip}`, { maxRequests: 20, windowMs: 60_000 });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many chat requests. Please wait a moment before sending another message." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.max(1, rateLimit.reset - Math.floor(Date.now() / 1000)).toString(),
            "X-RateLimit-Limit": rateLimit.limit.toString(),
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          },
        }
      );
    }

    // 2. Strict Zod schema validation
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const parseResult = ChatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { messages, tasteProfile, readBooks } = parseResult.data;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing Gemini API key" }, { status: 500 });
    }

    // Default fallback profile if user hasn't imported a CSV yet
    const fallbackProfile: TasteProfile = {
      archetype_name: "The Inquisitive Explorer",
      preferred_pacing: "Propulsive & Engaging",
      emotional_tone: "Thoughtful & Dynamic",
      archetype_summary:
        "You appreciate narratives with high stakes, complex protagonists, and immersive settings that reward curious readers.",
      top_tropes: ["Complex Characters", "Intriguing Mysteries", "High Stakes"],
      dealbreakers: ["Predictable Twists", "Shallow Characterization"],
    };

    let activeProfile: TasteProfile = tasteProfile || fallbackProfile;
    let activeReadBooks: string[] = readBooks || [];

    // If client didn't supply tasteProfile or readBooks, dynamically query Supabase
    if (!tasteProfile || !readBooks) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);

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
          // Unauthenticated
        }

        if (userId) {
          const { data: dbTaste } = await supabase
            .from("taste_profiles")
            .select("user_id, archetype_name, archetype_summary, preferred_pacing, emotional_tone, top_tropes, dealbreakers")
            .eq("user_id", userId)
            .maybeSingle();

          if (dbTaste) {
            activeProfile = {
              archetype_name: dbTaste.archetype_name,
              archetype_summary: dbTaste.archetype_summary,
              preferred_pacing: dbTaste.preferred_pacing || "Engaging & Dynamic",
              emotional_tone: dbTaste.emotional_tone || "Atmospheric & Gripping",
              top_tropes: dbTaste.top_tropes || [],
              dealbreakers: dbTaste.dealbreakers || [],
            };

            const { data: userBooksData } = await supabase
              .from("user_books")
              .select("books(title)")
              .eq("user_id", userId)
              .in("shelf", ["read", "did-not-finish"]);

            if (userBooksData) {
              activeReadBooks = userBooksData
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((ub: any) => ub.books?.title)
                .filter(Boolean);
            }
          }
        }
      }
    }

    const system = buildLibrarianSystemPrompt(activeProfile, activeReadBooks);
    const google = createGoogleGenerativeAI({ apiKey });

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system,
      messages: await convertToModelMessages(messages as any),
      stopWhen: isStepCount(5), // <-- Allows multi-step tool execution for 3+ books
      tools: {
        lookup_book_cover: lookupBookCoverTool,
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (error) {
    console.error("Chat API Error:", error);
    return new Response(JSON.stringify({ error: "Failed to process chat" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}