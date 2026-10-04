import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { TasteProfile, TasteProfileSchema } from "./schemas";

export interface QuizAnswers {
  genres: string[];
  pacing: string;
  tone: string[];
  tropes: string[];
  dealbreakers: string[];
  anchorFavorites?: string;
}

/**
 * Analyzes reader survey answers using Gemini 2.5 Flash to synthesize
 * a structured Taste Archetype without requiring a Goodreads CSV.
 */
export async function analyzeQuizTaste(answers: QuizAnswers): Promise<TasteProfile> {
  const apiKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Neither GEMINI_API_KEY nor GOOGLE_GENERATIVE_AI_API_KEY is set in .env.local"
    );
  }

  const google = createGoogleGenerativeAI({ apiKey });

  const prompt = `
You are an elite literary curator, taste analyst, and personal librarian.
Analyze the following reader's taste quiz responses to extract their deep psychological and aesthetic reading profile.

### Reader's Stated Preferences:
- Preferred Genres / Worlds: ${answers.genres.length > 0 ? answers.genres.join(", ") : "Varied fiction"}
- Desired Pacing & Tempo: ${answers.pacing || "Engaging & Dynamic"}
- Dominant Emotional Tone & Atmosphere: ${answers.tone.length > 0 ? answers.tone.join(", ") : "Thoughtful & Atmospheric"}
- Favorite Narrative Tropes & Devices: ${answers.tropes.length > 0 ? answers.tropes.join(", ") : "Character-driven narratives"}
- Reading Dealbreakers & Annoyances: ${answers.dealbreakers.length > 0 ? answers.dealbreakers.join(", ") : "Predictable plots"}
- Anchor Favorites (Books / Authors): ${answers.anchorFavorites?.trim() || "None provided"}

### Instructions:
1. Synthesize these preferences into a distinct, evocative Reader Archetype name (2-4 words, e.g. "The Speculative Survivalist", "The Atmospheric Noir Strategist").
2. Write a compelling, highly personalized ~120-180 word taste summary capturing their reading DNA, what drives their engagement, and why this specific combination of pacing and tropes resonates with them.
3. Formulate their top tropes (3-6) and clear dealbreakers (2-5).
4. Be perceptive, literary, and evocative—avoid generic praise like "You like good books".
`.trim();

  const { output } = await generateText({
    model: google("gemini-2.5-flash"),
    output: Output.object({ schema: TasteProfileSchema }),
    prompt,
    temperature: 0.3,
  });

  return output;
}
