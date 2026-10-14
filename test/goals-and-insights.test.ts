import { describe, it, expect } from "vitest";
import {
  calculateReadingGoalPacing,
  isLeapYear,
} from "@/lib/goals";
import {
  computeReadingInsights,
  calculateLiteraryMilestone,
  InsightBookItem,
} from "@/lib/insights";

describe("Phase 4: Gamification & Reading Insights", () => {
  describe("Reading Goal Pacing Engine (Issue #41)", () => {
    it("identifies leap years accurately", () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2026)).toBe(false);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(1900)).toBe(false);
    });

    it("calculates progress when user is ahead of pace", () => {
      // Mid-year in 2026 (July 2 = Day 183 of 365, ~50% of year)
      // Goal: 20 books -> expected by now: ~10 books
      // Read: 16 books -> ahead by 6 books
      const midYearDate = new Date("2026-07-02T12:00:00Z");
      const pacing = calculateReadingGoalPacing(16, 20, 2026, midYearDate);

      expect(pacing.goal).toBe(20);
      expect(pacing.readCount).toBe(16);
      expect(pacing.percentage).toBe(80);
      expect(pacing.status).toBe("ahead");
      expect(pacing.diffBooks).toBe(6);
      expect(pacing.isCompleted).toBe(false);
      expect(pacing.remainingBooks).toBe(4);
      expect(pacing.paceMessage).toContain("ahead of schedule");
    });

    it("calculates progress when user is behind pace", () => {
      // Mid-year in 2026 (July 2 = ~10 books expected)
      // Read: 4 books -> behind by 6 books
      const midYearDate = new Date("2026-07-02T12:00:00Z");
      const pacing = calculateReadingGoalPacing(4, 20, 2026, midYearDate);

      expect(pacing.status).toBe("behind");
      expect(pacing.diffBooks).toBe(6);
      expect(pacing.percentage).toBe(20);
      expect(pacing.remainingBooks).toBe(16);
      expect(pacing.paceMessage).toContain("behind pace");
    });

    it("identifies when user is on track (within tolerance)", () => {
      // Day 183 of 365 with goal of 20 books -> expected: 10.02
      // Read: 10 books -> on track
      const midYearDate = new Date("2026-07-02T12:00:00Z");
      const pacing = calculateReadingGoalPacing(10, 20, 2026, midYearDate);

      expect(pacing.status).toBe("on-track");
      expect(pacing.paceMessage).toContain("Right on track");
    });

    it("handles goal completion and exceeding targets", () => {
      const now = new Date("2026-10-14T12:00:00Z");
      const completedPacing = calculateReadingGoalPacing(20, 20, 2026, now);

      expect(completedPacing.isCompleted).toBe(true);
      expect(completedPacing.percentage).toBe(100);
      expect(completedPacing.remainingBooks).toBe(0);
      expect(completedPacing.status).toBe("completed");

      const exceededPacing = calculateReadingGoalPacing(25, 20, 2026, now);
      expect(exceededPacing.isCompleted).toBe(true);
      expect(exceededPacing.percentage).toBe(100);
      expect(exceededPacing.rawPercentage).toBe(125);
      expect(exceededPacing.paceMessage).toContain("5 books past your target");
    });

    it("handles edge cases: zero read, safe default goals", () => {
      const now = new Date("2026-01-15T12:00:00Z");
      const pacing = calculateReadingGoalPacing(0, 0, 2026, now);

      // Falls back to safe minimum goal (12)
      expect(pacing.goal).toBe(12);
      expect(pacing.readCount).toBe(0);
      expect(pacing.percentage).toBe(0);
      expect(pacing.remainingBooks).toBe(12);
    });
  });

  describe("Reading Insights Analytics Engine (Issue #42)", () => {
    const mockBooks: InsightBookItem[] = [
      {
        id: "b1",
        book_id: "book-1",
        title: "Project Hail Mary",
        author: "Andy Weir",
        page_count: 496,
        rating: 5,
        genres: ["Sci-Fi", "Space", "Hard Sci-Fi"],
        date_read: "2026-02-14T10:00:00Z",
      },
      {
        id: "b2",
        book_id: "book-2",
        title: "The Martian",
        author: "Andy Weir",
        page_count: 384,
        rating: 4,
        genres: ["Sci-Fi", "Survival"],
        date_read: "2026-03-20T10:00:00Z",
      },
      {
        id: "b3",
        book_id: "book-3",
        title: "Dune",
        author: "Frank Herbert",
        page_count: 896,
        rating: 5,
        genres: ["Sci-Fi", "Classic", "Space"],
        date_read: "2026-05-10T10:00:00Z",
      },
      {
        id: "b4",
        book_id: "book-4",
        title: "Animal Farm",
        author: "George Orwell",
        page_count: 140,
        rating: 3,
        genres: ["Classics", "Dystopian"],
        date_read: "2026-05-25T10:00:00Z",
      },
      {
        id: "b5",
        book_id: "book-5",
        title: "1984",
        author: "George Orwell",
        page_count: 328,
        rating: 4,
        genres: ["Classics", "Dystopian"],
        date_read: "2025-11-12T10:00:00Z", // Previous year
      },
    ];

    it("filters books by target calendar year", () => {
      const insights2026 = computeReadingInsights(mockBooks, 2026);
      expect(insights2026.totalBooks).toBe(4);

      const insights2025 = computeReadingInsights(mockBooks, 2025);
      expect(insights2025.totalBooks).toBe(1);

      const insightsAll = computeReadingInsights(mockBooks, "all");
      expect(insightsAll.totalBooks).toBe(5);
    });

    it("calculates total pages, averages, and shortest/longest books", () => {
      const insights = computeReadingInsights(mockBooks, 2026);

      // 496 + 384 + 896 + 140 = 1916 pages
      expect(insights.totalPages).toBe(1916);
      expect(insights.avgPagesPerBook).toBe(Math.round(1916 / 4)); // 479

      expect(insights.shortestBook?.title).toBe("Animal Farm");
      expect(insights.shortestBook?.pages).toBe(140);

      expect(insights.longestBook?.title).toBe("Dune");
      expect(insights.longestBook?.pages).toBe(896);
    });

    it("groups monthly reading velocity accurately", () => {
      const insights = computeReadingInsights(mockBooks, 2026);
      const monthly = insights.monthlyVelocity;

      // Feb: 1 book (Project Hail Mary)
      expect(monthly[1].month).toBe("Feb");
      expect(monthly[1].count).toBe(1);
      expect(monthly[1].pages).toBe(496);

      // Mar: 1 book (The Martian)
      expect(monthly[2].month).toBe("Mar");
      expect(monthly[2].count).toBe(1);

      // May: 2 books (Dune + Animal Farm)
      expect(monthly[4].month).toBe("May");
      expect(monthly[4].count).toBe(2);
      expect(monthly[4].pages).toBe(896 + 140);

      // Jan: 0 books
      expect(monthly[0].count).toBe(0);
    });

    it("computes rating distribution and generosity rate", () => {
      const insights = computeReadingInsights(mockBooks, 2026);
      const ratings = insights.ratings;

      // 5★: 2 (Project Hail Mary, Dune)
      // 4★: 1 (The Martian)
      // 3★: 1 (Animal Farm)
      expect(ratings.stars5).toBe(2);
      expect(ratings.stars4).toBe(1);
      expect(ratings.stars3).toBe(1);
      expect(ratings.stars2).toBe(0);
      expect(ratings.stars1).toBe(0);
      expect(ratings.totalRated).toBe(4);

      // Average: (5 + 4 + 5 + 3) / 4 = 17 / 4 = 4.25 -> 4.3
      expect(ratings.averageRating).toBe(4.3);

      // Generosity: 3 of 4 are 4★ or 5★ = 75%
      expect(ratings.generosityRate).toBe(75);
    });

    it("aggregates top authors with read counts and average ratings", () => {
      const insights = computeReadingInsights(mockBooks, 2026);
      const topAuthors = insights.topAuthors;

      expect(topAuthors[0].author).toBe("Andy Weir");
      expect(topAuthors[0].count).toBe(2);
      expect(topAuthors[0].avgRating).toBe(4.5); // (5 + 4) / 2
    });

    it("ranks top genres with percentage of total books", () => {
      const insights = computeReadingInsights(mockBooks, 2026);
      const topGenres = insights.topGenres;

      const sciFi = topGenres.find((g) => g.genre === "Sci-Fi");
      expect(sciFi).toBeDefined();
      expect(sciFi?.count).toBe(3); // 3 of 4 books
      expect(sciFi?.percentage).toBe(75);
    });

    it("calculates fun literary milestone comparisons", () => {
      expect(calculateLiteraryMilestone(0).comparisonText).toContain("Ready for your first reading adventure");
      expect(calculateLiteraryMilestone(800).comparisonText).toContain("George Orwell's '1984'");
      expect(calculateLiteraryMilestone(2500).comparisonText).toContain("The Lord of the Rings");
      expect(calculateLiteraryMilestone(5000).comparisonText).toContain("Harry Potter");
      expect(calculateLiteraryMilestone(10000).comparisonText).toContain("War and Peace");
      expect(calculateLiteraryMilestone(20000).comparisonText).toContain("towering literary fortress");
    });
  });
});
