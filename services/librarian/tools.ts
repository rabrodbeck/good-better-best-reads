import { tool } from "ai";
import { z } from "zod";
import { enrichBookDetails } from "../books/enrichment-service";

/**
 * AI Tool: Looks up verified book metadata and high-res cover art
 */
export const lookupBookCoverTool = tool({
  description:
    "Looks up live high-res cover art, published year, and page count for a recommended book from Open Library.",
  inputSchema: z.object({
    title: z.string().describe("The clean book title"),
    author: z.string().describe("The primary author's name"),
    isbn: z.string().optional().describe("Optional ISBN if known"),
  }),
  execute: async ({ title, author, isbn }) => {
    const details = await enrichBookDetails(title, author, isbn);
    if (!details) {
      return { found: false, message: "No live cover found on Open Library." };
    }
    return {
      found: true,
      title: details.title,
      author: details.author,
      coverUrl: details.coverUrl,
      publishedYear: details.publishedYear,
      pageCount: details.pageCount,
    };
  },
});