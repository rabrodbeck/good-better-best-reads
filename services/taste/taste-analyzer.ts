import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { NormalizedBook } from "../parser/types";
import { TasteProfile, TasteProfileSchema } from "./schemas";

/**
 * Filters the user's library down to the highest-signal books to keep
 * context clean and within optimal token efficiency.
 */
function extractHighSignalBooks(books: NormalizedBook[]) {
  const fiveStars = books.filter((b) => b.myRating === 5);
  const fourStars = books.filter((b) => b.myRating === 4);
  const lowRatingsOrDnf = books.filter(
    (b) => (b.myRating > 0 && b.myRating <= 2) || b.shelf === "did-not-finish"
  );
  const otherRead = books.filter((b) => b.shelf === "read" && b.myRating === 0);

  return {
    favorites: [...fiveStars, ...fourStars].slice(0, 15),
    dislikes: lowRatingsOrDnf.slice(0, 10),
    generalRead: otherRead.slice(0, 10),
  };
}

/**
 * Analyzes reading history using Gemini 2.5 Flash to generate a structured Taste Archetype.
 */
export async function analyzeTasteProfile(books: NormalizedBook[]): Promise<TasteProfile> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Neither GEMINI_API_KEY nor GOOGLE_GENERATIVE_AI_API_KEY is set in .env.local");
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const { favorites, dislikes, generalRead } = extractHighSignalBooks(books);

  const formatBookList = (list: NormalizedBook[]) =>
    list
      .map(
        (b) =>
          `- "${b.cleanTitle}" by ${b.author}${b.myRating ? ` (${b.myRating}★)` : ""}${
            b.userShelves.length > 0 ? ` [Shelves: ${b.userShelves.join(", ")}]` : ""
          }${b.userReview ? ` [User Note: "${b.userReview.slice(0, 150)}..."]` : ""}`
      )
      .join("\n");

  const prompt = `
You are an elite literary curator, taste analyst, and personal librarian.
Analyze the following reader's library to extract their deep psychological and aesthetic reading profile.

### Highest-Rated Favorites (Loved):
${favorites.length > 0 ? formatBookList(favorites) : "None explicitly marked as 5-star; analyze read list."}

### Low-Rated or Abandoned (Disliked / Dealbreakers):
${dislikes.length > 0 ? formatBookList(dislikes) : "No 1-star or DNF books recorded; extrapolate dealbreakers from general reading tone."}

### Additional Read History:
${generalRead.length > 0 ? formatBookList(generalRead) : "None"}

### Instructions:
1. Identify the underlying connective tissue: What specific qualities (prose style, narrative structure, psychological depth, pacing, stakes) unite their favorite titles?
2. Synthesize this into a distinct Reader Archetype name and a rich, personalized ~150-200 word taste summary.
3. Explicitly identify their top tropes and their probable dealbreakers (clichés or pacing styles that would bore or repel them).
4. Be perceptive, nuanced, and evocative—avoid generic praise like "You enjoy compelling stories".
`.trim();

  // Modern Vercel AI SDK v7 structured output API
  const { output } = await generateText({
    model: google("gemini-2.5-flash"),
    output: Output.object({ schema: TasteProfileSchema }),
    prompt,
    temperature: 0.3, // Low temperature for focused, coherent analysis
  });

  return output;
}