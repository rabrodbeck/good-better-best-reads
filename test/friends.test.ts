import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  calculateTasteOverlap,
  TasteProfileData,
  UserBookData,
} from "@/lib/friends";

describe("Friends & Taste Overlap Engine (Issues #28, #29)", () => {
  describe("normalizeEmail", () => {
    it("trims whitespace and converts to lowercase", () => {
      expect(normalizeEmail("  Alice@Example.COM  ")).toBe("alice@example.com");
      expect(normalizeEmail("User.Name+Tag@domain.co.uk")).toBe("user.name+tag@domain.co.uk");
    });
  });

  describe("calculateTasteOverlap", () => {
    const myTaste: TasteProfileData = {
      archetype_name: "The High-Stakes Thrill Seeker",
      preferred_pacing: "Breakneck & Kinetic",
      emotional_tone: "Tense & Visceral",
      top_tropes: ["Psychological Twists", "Moral Ambiguity", "High-Stakes Survival", "Unreliable Narrator"],
      dealbreakers: ["Cheesy Romance", "Slow Exposition"],
    };

    const friendTaste: TasteProfileData = {
      archetype_name: "The Gritty Mystery Sleuth",
      preferred_pacing: "Propulsive & Steady",
      emotional_tone: "Dark & Analytical",
      top_tropes: ["Psychological Twists", "Moral Ambiguity", "Noir Detective", "Conspiracy"],
      dealbreakers: ["Deus Ex Machina", "Unreliable Narrator"], // Note: Unreliable Narrator is my trope!
    };

    const myBooks: UserBookData[] = [
      {
        id: "ub-1",
        book_id: "book-100",
        shelf: "read",
        rating: 5,
        books: { id: "book-100", title: "Gone Girl", author: "Gillian Flynn", cover_url: "https://example.com/cover1.jpg" },
      },
      {
        id: "ub-2",
        book_id: "book-200",
        shelf: "read",
        rating: 4,
        books: { id: "book-200", title: "Dark Matter", author: "Blake Crouch", cover_url: "https://example.com/cover2.jpg" },
      },
      {
        id: "ub-3",
        book_id: "book-300",
        shelf: "to-read",
        rating: null,
        books: { id: "book-300", title: "The Silent Patient", author: "Alex Michaelides", cover_url: "https://example.com/cover3.jpg" },
      },
    ];

    const friendBooks: UserBookData[] = [
      {
        id: "ub-4",
        book_id: "book-100",
        shelf: "read",
        rating: 5,
        books: { id: "book-100", title: "Gone Girl", author: "Gillian Flynn", cover_url: "https://example.com/cover1.jpg" },
      },
      {
        id: "ub-5",
        book_id: "book-200",
        shelf: "read",
        rating: 3, // Rating delta of 1 (4 vs 3)
        books: { id: "book-200", title: "Dark Matter", author: "Blake Crouch", cover_url: "https://example.com/cover2.jpg" },
      },
      {
        id: "ub-6",
        book_id: "book-300",
        shelf: "read",
        rating: 5, // Friend loved it, on my to-read!
        books: { id: "book-300", title: "The Silent Patient", author: "Alex Michaelides", cover_url: "https://example.com/cover3.jpg" },
      },
      {
        id: "ub-7",
        book_id: "book-400",
        shelf: "read",
        rating: 5, // Not in my library at all
        books: { id: "book-400", title: "Shutter Island", author: "Dennis Lehane", cover_url: "https://example.com/cover4.jpg" },
      },
    ];

    it("identifies shared reads and computes rating deltas", () => {
      const result = calculateTasteOverlap(myTaste, friendTaste, myBooks, friendBooks);

      expect(result.sharedReads.length).toBe(3);

      const goneGirl = result.sharedReads.find((b) => b.bookId === "book-100");
      expect(goneGirl).toBeDefined();
      expect(goneGirl?.myRating).toBe(5);
      expect(goneGirl?.friendRating).toBe(5);
      expect(goneGirl?.ratingDiff).toBe(0);

      const darkMatter = result.sharedReads.find((b) => b.bookId === "book-200");
      expect(darkMatter).toBeDefined();
      expect(darkMatter?.myRating).toBe(4);
      expect(darkMatter?.friendRating).toBe(3);
      expect(darkMatter?.ratingDiff).toBe(1);
    });

    it("generates peer recommendations from friend's highly-rated reads", () => {
      const result = calculateTasteOverlap(myTaste, friendTaste, myBooks, friendBooks);

      // Silent Patient is on my to-read shelf and friend rated it 5
      const silentPatientRec = result.recommendationsForYou.find((r) => r.bookId === "book-300");
      expect(silentPatientRec).toBeDefined();
      expect(silentPatientRec?.reason).toContain("On your Want to Read shelf");

      // Shutter Island is not in my catalog and friend rated it 5
      const shutterIslandRec = result.recommendationsForYou.find((r) => r.bookId === "book-400");
      expect(shutterIslandRec).toBeDefined();
      expect(shutterIslandRec?.reason).toContain("Rated 5★ by friend");
    });

    it("extracts shared tropes, unique tropes, and detects dealbreaker clashes", () => {
      const result = calculateTasteOverlap(myTaste, friendTaste, myBooks, friendBooks);

      expect(result.tasteComparison.sharedTropes).toEqual([
        "Psychological Twists",
        "Moral Ambiguity",
      ]);

      expect(result.tasteComparison.uniqueToMeTropes).toContain("High-Stakes Survival");
      expect(result.tasteComparison.uniqueToFriendTropes).toContain("Noir Detective");

      // Friend avoids "Unreliable Narrator", which is in my top tropes
      const clash = result.tasteComparison.dealbreakerClashes.find(
        (c) => c.trope === "Unreliable Narrator"
      );
      expect(clash).toBeDefined();
      expect(clash?.lovedBy).toBe("me");
      expect(clash?.dealbreakerFor).toBe("friend");
    });

    it("calculates a taste match percentage between 40% and 98%", () => {
      const result = calculateTasteOverlap(myTaste, friendTaste, myBooks, friendBooks);

      expect(result.stats.tasteMatchPercentage).toBeGreaterThanOrEqual(40);
      expect(result.stats.tasteMatchPercentage).toBeLessThanOrEqual(98);
      expect(result.stats.totalSharedReads).toBe(3);
      expect(result.stats.avgRatingDelta).toBe(0.5); // (0 + 1) / 2 rated comparisons
    });

    it("handles empty catalogs and null taste profiles gracefully", () => {
      const emptyResult = calculateTasteOverlap(null, null, [], []);

      expect(emptyResult.sharedReads).toEqual([]);
      expect(emptyResult.recommendationsForYou).toEqual([]);
      expect(emptyResult.recommendationsForThem).toEqual([]);
      expect(emptyResult.tasteComparison.sharedTropes).toEqual([]);
      expect(emptyResult.stats.totalSharedReads).toBe(0);
      expect(emptyResult.stats.avgRatingDelta).toBeNull();
      expect(emptyResult.stats.tasteMatchPercentage).toBeGreaterThanOrEqual(40);
    });
  });
});
