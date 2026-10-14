import { z } from "zod";

/**
 * Stage 1: Zod Schemas & Data Contracts for Librarian In-Store Taste Analysis (Issue #51)
 */

export const LibrarianVerdictInputSchema = z.object({
  title: z.string().min(1, "Book title is required"),
  author: z.string().min(1, "Author name is required"),
  isbn: z.string().optional().nullable(),
  publishedYear: z.number().optional().nullable(),
  description: z.string().optional().nullable(),
  genres: z.array(z.string()).optional(),
});

export type LibrarianVerdictInput = z.infer<typeof LibrarianVerdictInputSchema>;

export const LibrarianSeriesInfoSchema = z.object({
  isSeries: z.boolean().describe("Whether this book belongs to an established book series"),
  seriesName: z.string().optional().describe("Canonical series title (e.g. 'Vicious Lost Boys')"),
  volumeNumber: z.number().optional().describe("Volume order in series (e.g. 3 for Book 3)"),
  firstBookTitle: z.string().optional().describe("Title of Book 1 in this series (e.g. 'The Never King')"),
  userAlreadyReadPriorBook: z.boolean().default(false).describe("True if user's library shows they already read Book 1 or prior volumes"),
});

export type LibrarianSeriesInfo = z.infer<typeof LibrarianSeriesInfoSchema>;

export const LibrarianVerdictOutputSchema = z.object({
  matchScore: z
    .number()
    .min(0)
    .max(100)
    .describe("Estimated taste match score from 0 to 100 based on reader's Reading DNA"),
  verdict: z
    .enum(["strong_match", "caution", "wildcard"])
    .describe("Primary verdict category: strong_match (>=80), caution (50-79 or content warning), wildcard (<50)"),
  badgeLabel: z
    .string()
    .describe("Display label for the badge, e.g. '90% Strong Match', '65% Proceed with Caution', 'Wildcard / Branching Out'"),
  rationale: z
    .string()
    .describe("Brutally honest, conversational explanation (strictly 2 sentences max) comparing the book against reader's preferred pacing, tone, and tropes"),
  seriesInfo: LibrarianSeriesInfoSchema.optional().describe("Series context and sequel warnings if book is part of a series"),
  dealbreakersDetected: z
    .array(z.string())
    .default([])
    .describe("Specific dealbreakers or friction points identified from user taste profile"),
});

export type LibrarianVerdictOutput = z.infer<typeof LibrarianVerdictOutputSchema>;

/**
 * Maps verdict category to UI badge color variant
 */
export function getVerdictBadgeColor(
  verdict: "strong_match" | "caution" | "wildcard"
): "green" | "yellow" | "gray" {
  switch (verdict) {
    case "strong_match":
      return "green";
    case "caution":
      return "yellow";
    case "wildcard":
    default:
      return "gray";
  }
}

/**
 * Derives the verdict category from raw score and friction signals
 */
export function deriveVerdictCategory(
  score: number,
  hasDealbreakers: boolean = false
): "strong_match" | "caution" | "wildcard" {
  if (hasDealbreakers) return "caution";
  if (score >= 80) return "strong_match";
  if (score >= 50) return "caution";
  return "wildcard";
}
