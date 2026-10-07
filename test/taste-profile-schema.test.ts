import { describe, it, expect } from "vitest";
import { TasteProfileSchema } from "@/services/taste/schemas";
import { ChatRequestSchema, QuizRequestSchema } from "@/lib/api-schemas";

describe("Taste Profile & API Request Schemas", () => {
  describe("TasteProfileSchema", () => {
    it("validates a compliant Taste Profile object", () => {
      const validProfile = {
        archetype_name: "The Dark Suspense Enthusiast",
        archetype_summary:
          "You love narratives with high psychological tension, unreliable narrators, and relentless pacing that leaves you guessing.",
        preferred_pacing: "Breakneck & Kinetic",
        emotional_tone: "Gritty & Cynical",
        top_tropes: ["Unreliable Narrator", "Twisty Plot", "Isolated Setting"],
        dealbreakers: ["Predictable Ending", "Info-dumping"],
      };

      const result = TasteProfileSchema.safeParse(validProfile);
      expect(result.success).toBe(true);
    });

    it("fails validation if top_tropes has fewer than 3 elements", () => {
      const invalidProfile = {
        archetype_name: "The Minimalist",
        archetype_summary: "A brief summary of preferences.",
        preferred_pacing: "Moderate",
        emotional_tone: "Reflective",
        top_tropes: ["Only One Trope"], // Min is 3
        dealbreakers: ["Cliches", "Slow Start"],
      };

      const result = TasteProfileSchema.safeParse(invalidProfile);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.top_tropes).toBeDefined();
      }
    });

    it("fails validation if dealbreakers has fewer than 2 elements", () => {
      const invalidProfile = {
        archetype_name: "The Flexible Reader",
        archetype_summary: "Summary of reading taste.",
        preferred_pacing: "Fast",
        emotional_tone: "Tense",
        top_tropes: ["Trope One", "Trope Two", "Trope Three"],
        dealbreakers: ["Only One Dealbreaker"], // Min is 2
      };

      const result = TasteProfileSchema.safeParse(invalidProfile);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.dealbreakers).toBeDefined();
      }
    });
  });

  describe("API Request Schemas", () => {
    it("validates a valid ChatRequest payload", () => {
      const validChat = {
        messages: [{ role: "user", content: "Suggest a thriller." }],
        readBooks: ["Behind Her Eyes"],
      };

      const result = ChatRequestSchema.safeParse(validChat);
      expect(result.success).toBe(true);
    });

    it("rejects ChatRequest without messages", () => {
      const result = ChatRequestSchema.safeParse({ messages: [] });
      expect(result.success).toBe(false);
    });

    it("validates a valid QuizRequest payload", () => {
      const validQuiz = {
        answers: {
          genres: ["Psychological Thriller", "Sci-Fi"],
          pacing: "Fast",
          tone: ["Dark"],
          tropes: ["Twist"],
          dealbreakers: ["Cliches"],
        },
        saveToProfile: true,
      };

      const result = QuizRequestSchema.safeParse(validQuiz);
      expect(result.success).toBe(true);
    });

    it("rejects QuizRequest when genres array is empty", () => {
      const invalidQuiz = {
        answers: {
          genres: [],
        },
      };

      const result = QuizRequestSchema.safeParse(invalidQuiz);
      expect(result.success).toBe(false);
    });
  });
});
