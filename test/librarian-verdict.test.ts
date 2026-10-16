import { describe, it, expect, beforeEach } from "vitest";
import {
  LibrarianVerdictInputSchema,
  LibrarianVerdictOutputSchema,
  getVerdictBadgeColor,
  deriveVerdictCategory,
} from "@/types/librarian-verdict";
import {
  generateLibrarianVerdict,
  getCachedVerdict,
  setCachedVerdict,
  clearVerdictCache,
  clearUserTasteCache,
} from "@/lib/librarian-verdict";

describe("Stage 1 & 2: Librarian Taste Verdict Engine (Issues #51 & #52)", () => {
  beforeEach(() => {
    clearVerdictCache();
    clearUserTasteCache();
  });

  describe("Schema Validation & Contract Integrity", () => {
    it("validates valid book inputs successfully", () => {
      const valid = LibrarianVerdictInputSchema.safeParse({
        title: "The Never Queen",
        author: "Nikki St. Crowe",
        isbn: "9781638935995",
        publishedYear: 2026,
        genres: ["Dark Fantasy", "Romance"],
      });
      expect(valid.success).toBe(true);
    });

    it("rejects input missing title or author", () => {
      const missingTitle = LibrarianVerdictInputSchema.safeParse({
        author: "Nikki St. Crowe",
      });
      expect(missingTitle.success).toBe(false);

      const missingAuthor = LibrarianVerdictInputSchema.safeParse({
        title: "The Never Queen",
      });
      expect(missingAuthor.success).toBe(false);
    });

    it("validates complete structured verdict outputs", () => {
      const validOutput = LibrarianVerdictOutputSchema.safeParse({
        matchScore: 92,
        verdict: "strong_match",
        badgeLabel: "92% Strong Match",
        rationale:
          "Fits your love for propulsive dark fantasy retellings. Character dynamics and high-stakes tension align directly with your favorite tropes.",
        seriesInfo: {
          isSeries: true,
          seriesName: "Vicious Lost Boys",
          volumeNumber: 3,
          firstBookTitle: "The Never King",
          userAlreadyReadPriorBook: false,
        },
        dealbreakersDetected: [],
      });
      expect(validOutput.success).toBe(true);
    });

    it("enforces matchScore bounds between 0 and 100", () => {
      const tooHigh = LibrarianVerdictOutputSchema.safeParse({
        matchScore: 110,
        verdict: "strong_match",
        badgeLabel: "Over 100",
        rationale: "Great book for you.",
      });
      expect(tooHigh.success).toBe(false);

      const tooLow = LibrarianVerdictOutputSchema.safeParse({
        matchScore: -5,
        verdict: "wildcard",
        badgeLabel: "Negative",
        rationale: "Bad book for you.",
      });
      expect(tooLow.success).toBe(false);
    });
  });

  describe("Badge Color & Verdict Category Derivation", () => {
    it("maps verdict categories to designated badge colors", () => {
      expect(getVerdictBadgeColor("strong_match")).toBe("green");
      expect(getVerdictBadgeColor("caution")).toBe("yellow");
      expect(getVerdictBadgeColor("wildcard")).toBe("gray");
    });

    it("correctly derives verdict category based on threshold scores", () => {
      expect(deriveVerdictCategory(95)).toBe("strong_match");
      expect(deriveVerdictCategory(80)).toBe("strong_match");
      expect(deriveVerdictCategory(79)).toBe("caution");
      expect(deriveVerdictCategory(50)).toBe("caution");
      expect(deriveVerdictCategory(49)).toBe("wildcard");
      expect(deriveVerdictCategory(10)).toBe("wildcard");
    });

    it("overrides high scores to caution when dealbreakers are present", () => {
      expect(deriveVerdictCategory(95, true)).toBe("caution");
      expect(deriveVerdictCategory(85, true)).toBe("caution");
    });
  });

  describe("In-Memory Caching", () => {
    it("caches verdicts and retrieves them by key", () => {
      const mockVerdict = {
        matchScore: 88,
        verdict: "strong_match" as const,
        badgeLabel: "88% Strong Match",
        rationale: "Engaging and fast-paced.",
        dealbreakersDetected: [],
      };

      setCachedVerdict("user1:9781638935995", mockVerdict);
      const retrieved = getCachedVerdict("user1:9781638935995");
      expect(retrieved).toEqual(mockVerdict);

      clearVerdictCache();
      expect(getCachedVerdict("user1:9781638935995")).toBeNull();
    });
  });

  describe("Librarian Verdict Generation Engine (Mocked Supabase)", () => {
    it("evaluates a standalone book using fallback heuristic when no LLM key is configured", async () => {
      const mockSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
              maybeSingle: async () => ({
                data: {
                  archetype_name: "The Speculative Sleuth",
                  preferred_pacing: "Fast-Paced & Punchy",
                  emotional_tone: "Tense & Thrilling",
                  top_tropes: ["Twist Endings"],
                  dealbreakers: ["Slow Exposition"],
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      const result = await generateLibrarianVerdict(
        "test-user-123",
        {
          title: "Project Hail Mary",
          author: "Andy Weir",
          isbn: "9780593135204",
          genres: ["Sci-Fi", "Thriller"],
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockSupabase as any
      );

      expect(result.matchScore).toBeGreaterThanOrEqual(80);
      expect(result.verdict).toBe("strong_match");
      expect(result.badgeLabel).toContain("Strong Match");
      expect(result.rationale).toContain("Andy Weir");
    });

    it("detects series sequel parentheticals and flags caution with volume number", async () => {
      const mockSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
              maybeSingle: async () => ({
                data: {
                  archetype_name: "The Romantic Adventurer",
                  preferred_pacing: "Propulsive",
                  emotional_tone: "Passionate",
                  top_tropes: ["Enemies to Lovers"],
                  dealbreakers: [],
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      const result = await generateLibrarianVerdict(
        "test-user-456",
        {
          title: "Queen of Myth and Monsters (Adrian X Isolde, #2)",
          author: "Scarlett St. Clair",
          isbn: "9781728259772",
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockSupabase as any
      );

      expect(result.verdict).toBe("caution");
      expect(result.seriesInfo).toBeDefined();
      expect(result.seriesInfo?.isSeries).toBe(true);
      expect(result.seriesInfo?.seriesName).toBe("Adrian X Isolde");
      expect(result.seriesInfo?.volumeNumber).toBe(2);
      expect(result.rationale).toContain("Volume #2");
    });
  });
});
