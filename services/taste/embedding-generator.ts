import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed } from "ai";
import { TasteProfile } from "./schemas";

/**
 * Synthesizes the taste profile into a dense, high-signal text block
 * optimized for semantic vector embedding.
 */
export function buildEmbeddingInput(profile: TasteProfile): string {
    return [
        `Reader Archetype: ${profile.archetype_name}`,
        `Pacing Preference: ${profile.preferred_pacing}`,
        `Emotional Tone: ${profile.emotional_tone}`,
        `Taste Summary: ${profile.archetype_summary}`,
        `Loved Tropes: ${profile.top_tropes.join(", ")}`,
        `Dislike Themes & Dealbreakers: ${profile.dealbreakers.join(", ")}`,
    ].join("\n");
}

/**
 * Generates a 768-dimensional vector embedding using Google's text-embedding-004 model.
 */
export async function generateTasteVector(profile: TasteProfile): Promise<number[]> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        throw new Error("Neither GEMINI_API_KEY nor GOOGLE_GENERATIVE_AI_API_KEY is set in .env.local");
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const textToEmbed = buildEmbeddingInput(profile);

    // Uses gemini-embedding-001 with Matryoshka compression down to 768 dimensions
    const { embedding } = await embed({
        model: google.embedding("gemini-embedding-001"),
        value: textToEmbed,
        providerOptions: {
            google: {
                outputDimensionality: 768,
            },
        },
    });

    return embedding;
}