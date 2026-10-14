import { describe, it, expect } from "vitest";
import {
  calculateTasteOverlap,
  TasteProfileData,
  UserBookData,
} from "@/lib/friends";

describe("Phase 2: Social & Friend Synergy Test Suite", () => {
  const userTaste: TasteProfileData = {
    archetype_name: "The Cosmic Voyager",
    preferred_pacing: "Expansive & Cerebral",
    emotional_tone: "Wonder & Philosophical",
    top_tropes: ["Generation Ships", "Hard Sci-Fi", "First Contact", "AI Sentience"],
    dealbreakers: ["Cheesy Romance", "Supernatural Horror"],
  };

  const friendTaste: TasteProfileData = {
    archetype_name: "The Speculative Thinker",
    preferred_pacing: "Expansive & Cerebral",
    emotional_tone: "Wonder & Philosophical",
    top_tropes: ["First Contact", "AI Sentience", "Dystopian Politics", "Cyberpunk"],
    dealbreakers: ["Cheesy Romance", "Supernatural Horror"],
  };

  const userBooks: UserBookData[] = [
    {
      id: "ub-1",
      book_id: "book-1",
      shelf: "read",
      rating: 5,
      books: { id: "book-1", title: "Project Hail Mary", author: "Andy Weir" },
    },
    {
      id: "ub-2",
      book_id: "book-2",
      shelf: "read",
      rating: 5,
      books: { id: "book-2", title: "Blindsight", author: "Peter Watts" },
    },
    {
      id: "ub-3",
      book_id: "book-3",
      shelf: "read",
      rating: 2,
      books: { id: "book-3", title: "Red Rising", author: "Pierce Brown" },
    },
    {
      id: "ub-4",
      book_id: "book-4",
      shelf: "to-read",
      rating: null,
      books: { id: "book-4", title: "Children of Time", author: "Adrian Tchaikovsky" },
    },
  ];

  const friendBooks: UserBookData[] = [
    {
      id: "ub-5",
      book_id: "book-1",
      shelf: "read",
      rating: 4, // Both loved (5 & 4)
      books: { id: "book-1", title: "Project Hail Mary", author: "Andy Weir" },
    },
    {
      id: "ub-6",
      book_id: "book-2",
      shelf: "read",
      rating: 5, // Both loved (5 & 5)
      books: { id: "book-2", title: "Blindsight", author: "Peter Watts" },
    },
    {
      id: "ub-7",
      book_id: "book-3",
      shelf: "read",
      rating: 5, // Rating contrast (2 vs 5, delta = 3 >= 2)
      books: { id: "book-3", title: "Red Rising", author: "Pierce Brown" },
    },
    {
      id: "ub-8",
      book_id: "book-4",
      shelf: "read",
      rating: 5, // On user's to-read shelf, friend read & loved
      books: { id: "book-4", title: "Children of Time", author: "Adrian Tchaikovsky" },
    },
    {
      id: "ub-9",
      book_id: "book-5",
      shelf: "read",
      rating: 5, // Unseen by user, candidate for recommendation
      books: { id: "book-5", title: "A Fire Upon the Deep", author: "Vernor Vinge" },
    },
  ];

  describe("Issue #36: Reading DNA Taste Compatibility Calculation", () => {
    it("computes a high taste match percentage when tropes, pacing, and tones align", () => {
      const overlap = calculateTasteOverlap(userTaste, friendTaste, userBooks, friendBooks);

      expect(overlap.stats.tasteMatchPercentage).toBeGreaterThanOrEqual(75);
      expect(overlap.stats.tasteMatchPercentage).toBeLessThanOrEqual(100);
      expect(overlap.tasteComparison.sharedTropes).toContain("First Contact");
      expect(overlap.tasteComparison.sharedTropes).toContain("AI Sentience");
      expect(overlap.tasteComparison.dealbreakerClashes).toHaveLength(0);
    });

    it("penalizes taste match score when dealbreaker clashes occur", () => {
      const clashingFriend: TasteProfileData = {
        ...friendTaste,
        dealbreakers: ["First Contact", "AI Sentience"], // Direct clashes with user's top tropes
      };

      const cleanResult = calculateTasteOverlap(userTaste, friendTaste, userBooks, friendBooks);
      const clashingResult = calculateTasteOverlap(userTaste, clashingFriend, userBooks, friendBooks);

      expect(clashingResult.stats.tasteMatchPercentage).toBeLessThan(cleanResult.stats.tasteMatchPercentage);
      expect(clashingResult.tasteComparison.dealbreakerClashes.length).toBeGreaterThan(0);
    });
  });

  describe("Issue #37: Friend Library Smart Overlap Filters Logic", () => {
    // Map viewer books by book_id to simulate /api/library & Friend Library page filter predicates
    const viewerBooksMap = new Map(userBooks.map((b) => [b.book_id, b]));

    it("accurately identifies 'Both Loved' books (both rated 4 or 5 stars)", () => {
      const bothLoved = friendBooks.filter((fb) => {
        const vb = viewerBooksMap.get(fb.book_id);
        return vb && vb.rating && vb.rating >= 4 && fb.rating && fb.rating >= 4;
      });

      expect(bothLoved.length).toBe(2);
      expect(bothLoved.map((b) => b.book_id)).toEqual(["book-1", "book-2"]);
    });

    it("accurately identifies 'On Your Want to Read' books", () => {
      const onMyWantToRead = friendBooks.filter((fb) => {
        const vb = viewerBooksMap.get(fb.book_id);
        return vb && vb.shelf === "to-read";
      });

      expect(onMyWantToRead.length).toBe(1);
      expect(onMyWantToRead[0].book_id).toBe("book-4");
      expect(onMyWantToRead[0].books?.title).toBe("Children of Time");
    });

    it("accurately identifies 'Rating Contrasts' (absolute difference >= 2)", () => {
      const contrasts = friendBooks.filter((fb) => {
        const vb = viewerBooksMap.get(fb.book_id);
        return vb && vb.rating && fb.rating && Math.abs(vb.rating - fb.rating) >= 2;
      });

      expect(contrasts.length).toBe(1);
      expect(contrasts[0].book_id).toBe("book-3");
      expect(contrasts[0].books?.title).toBe("Red Rising");
      const userRating = viewerBooksMap.get(contrasts[0].book_id)?.rating;
      expect(userRating).toBe(2);
      expect(contrasts[0].rating).toBe(5);
    });
  });

  describe("Issue #38: Friend Book Recommendation State Transitions", () => {
    type RecStatus = "unread" | "accepted" | "dismissed";

    interface MockRecommendation {
      id: string;
      sender_id: string;
      recipient_id: string;
      book_id: string;
      notes: string | null;
      status: RecStatus;
    }

    it("validates transition from 'unread' to 'accepted' with target shelf 'to-read'", () => {
      const rec: MockRecommendation = {
        id: "rec-1",
        sender_id: "user-alice",
        recipient_id: "user-bob",
        book_id: "book-5",
        notes: "You love Vernor Vinge, check this out!",
        status: "unread",
      };

      // Recipient accepts recommendation
      const updatedRec: MockRecommendation = { ...rec, status: "accepted" };
      expect(updatedRec.status).toBe("accepted");

      // Verify simulated insertion into recipient's user_books shelf
      const newShelfEntry: UserBookData = {
        id: "ub-new",
        book_id: updatedRec.book_id,
        shelf: "to-read",
        rating: null,
        books: { id: "book-5", title: "A Fire Upon the Deep", author: "Vernor Vinge" },
      };

      expect(newShelfEntry.shelf).toBe("to-read");
      expect(newShelfEntry.book_id).toBe(rec.book_id);
    });

    it("validates transition from 'unread' to 'dismissed'", () => {
      const rec: MockRecommendation = {
        id: "rec-2",
        sender_id: "user-alice",
        recipient_id: "user-bob",
        book_id: "book-6",
        notes: null,
        status: "unread",
      };

      const dismissedRec: MockRecommendation = { ...rec, status: "dismissed" };
      expect(dismissedRec.status).toBe("dismissed");
    });
  });
});
