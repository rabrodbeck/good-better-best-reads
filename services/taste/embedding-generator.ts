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

/**
 * Generates a 768-dimensional vector embedding for an individual book
 * based on its title, author, genres, and synopsis.
 */
export async function generateBookEmbedding(book: {
    title: string;
    author: string;
    description?: string | null;
    genres?: string[];
}): Promise<number[] | null> {
    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) return null;

        const google = createGoogleGenerativeAI({ apiKey });
        const textToEmbed = [
            `Title: ${book.title}`,
            `Author: ${book.author}`,
            book.genres && book.genres.length > 0 ? `Genres: ${book.genres.join(", ")}` : "",
            book.description ? `Description: ${book.description.slice(0, 1000)}` : "",
        ]
            .filter(Boolean)
            .join("\n");

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
    } catch (err) {
        console.warn("Failed to generate book embedding:", err);
        return null;
    }
}