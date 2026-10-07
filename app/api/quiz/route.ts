import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { analyzeQuizTaste } from "@/services/taste/quiz-analyzer";
import { generateTasteVector } from "@/services/taste/embedding-generator";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { QuizRequestSchema } from "@/lib/api-schemas";

export const maxDuration = 60; // Allow enough time for LLM synthesis and vector embedding

export async function POST(req: Request) {
  try {
    // 1. IP-based rate limiting (10 requests per minute)
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`quiz:${ip}`, { maxRequests: 10, windowMs: 60_000 });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many quiz submissions. Please wait a moment before trying again." },
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

    const parseResult = QuizRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid quiz answers payload",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { answers, saveToProfile } = parseResult.data;

    // 1. Synthesize Taste Profile with Gemini 2.5 Flash
    const tasteProfile = await analyzeQuizTaste(answers);

    // 2. Generate 768-dimensional Vector Embedding
    const tasteVector = await generateTasteVector(tasteProfile);

    // 3. Find preview recommendations from catalog
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const adminSupabase = createAdminClient(supabaseUrl, supabaseKey);

    let sampleMatches = [];
    try {
      const { data: matchedBooks } = await adminSupabase.rpc("match_books", {
        query_embedding: tasteVector,
        match_threshold: 0.35,
        match_count: 4,
      });
      sampleMatches = matchedBooks || [];
    } catch {
      // Non-fatal if vector matching encounters threshold edge case
    }

    // 4. Save to profile ONLY if user explicitly requested and is authenticated
    let saved = false;
    let userId: string | null = null;

    if (saveToProfile) {
      try {
        const serverClient = await createServerClient();
        const {
          data: { user },
        } = await serverClient.auth.getUser();

        if (user) {
          userId = user.id;

          // Upsert into taste_profiles
          await adminSupabase.from("taste_profiles").upsert(
            {
              user_id: user.id,
              archetype_name: tasteProfile.archetype_name,
              archetype_summary: tasteProfile.archetype_summary,
              preferred_pacing: tasteProfile.preferred_pacing,
              emotional_tone: tasteProfile.emotional_tone,
              top_tropes: tasteProfile.top_tropes,
              dealbreakers: tasteProfile.dealbreakers,
              taste_vector: tasteVector,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );

          // Update user's profile taste_archetype title
          await adminSupabase
            .from("profiles")
            .update({
              taste_archetype: tasteProfile.archetype_name,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);

          saved = true;
        }
      } catch (saveErr) {
        console.error("Failed to save quiz profile to DB:", saveErr);
      }
    }

    return NextResponse.json({
      success: true,
      tasteProfile,
      sampleMatches,
      saved,
      isPreview: !saved,
      userId,
    });
  } catch (error: any) {
    console.error("Quiz API Error:", error);
    const isHighDemand =
      error?.message?.includes("high demand") ||
      error?.message?.includes("503") ||
      error?.statusCode === 503 ||
      error?.lastError?.statusCode === 503;

    const errorMessage = isHighDemand
      ? "The AI model is currently experiencing temporary high demand from Google. Please try submitting again in a moment."
      : (error?.message || "Failed to analyze quiz responses. Please try again.");

    return NextResponse.json(
      { error: errorMessage },
      { status: isHighDemand ? 503 : 500 }
    );
  }
}
