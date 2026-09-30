import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, convertToModelMessages, createUIMessageStreamResponse, toUIMessageStream } from "ai";
import { buildLibrarianSystemPrompt } from "@/services/librarian/prompt";
import { lookupBookCoverTool } from "@/services/librarian/tools";
import { TasteProfile } from "@/services/taste/schemas";

export const maxDuration = 30; // Max streaming duration

export async function POST(req: Request) {
  try {
    const { messages, tasteProfile, readBooks } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return new Response("Missing Gemini API key", { status: 500 });
    }

    // Fallback profile if user hasn't imported a CSV yet
    const fallbackProfile: TasteProfile = {
      archetype_name: "The Inquisitive Explorer",
      preferred_pacing: "Propulsive & Engaging",
      emotional_tone: "Thoughtful & Dynamic",
      archetype_summary:
        "You appreciate narratives with high stakes, complex protagonists, and immersive settings that reward curious readers.",
      top_tropes: ["Complex Characters", "Intriguing Mysteries", "High Stakes"],
      dealbreakers: ["Predictable Twists", "Shallow Characterization"],
    };

    const activeProfile: TasteProfile = tasteProfile || fallbackProfile;
    const system = buildLibrarianSystemPrompt(activeProfile, readBooks || []);

    const google = createGoogleGenerativeAI({ apiKey });

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system,
      messages: await convertToModelMessages(messages),
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