import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { analyzeQuizTaste, QuizAnswers } from "@/services/taste/quiz-analyzer";
import { generateTasteVector } from "@/services/taste/embedding-generator";

export const maxDuration = 60; // Allow enough time for LLM synthesis and vector embedding

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const answers: QuizAnswers = body.answers;
    const saveToProfile: boolean = Boolean(body.saveToProfile);

    if (!answers || !answers.genres || answers.genres.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one preferred genre." },
        { status: 400 }
      );
    }

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
  } catch (error) {
    console.error("Quiz API Error:", error);
    return NextResponse.json(
      { error: "Failed to analyze quiz responses. Please try again." },
      { status: 500 }
    );
  }
}
