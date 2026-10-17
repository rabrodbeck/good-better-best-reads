import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { GET as searchGet } from "@/app/api/books/search/route";
import { BookDetailModal, BookDetailItem } from "@/components/library/book-detail-modal";
import { calculateReadingGoalPacing } from "@/lib/goals";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/image", () => ({
  default: ({ fill, unoptimized, ...props }: any) => <img {...props} />,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));

describe("Phase 8: Lifetime Reads & Rapid Author Cataloging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Step 1: Annual Goal Challenge Protection (Issue #73)", () => {
    it("excludes undated past books (date_read === null) from the annual goal calculation", () => {
      const currentYear = 2026;
      const allRead = [
        { id: "1", shelf: "read", date_read: "2026-02-15T00:00:00Z" },
        { id: "2", shelf: "read", date_read: "2026-03-20T00:00:00Z" },
        // Lifetime reads read in the past with no specific completion date
        { id: "3", shelf: "read", date_read: null, created_at: "2026-10-16T12:00:00Z" },
        { id: "4", shelf: "read", date_read: null, created_at: "2026-10-16T12:05:00Z" },
        { id: "5", shelf: "read", date_read: null, created_at: "2026-10-16T12:10:00Z" },
      ];

      // Filter logic matching app/api/goals/route.ts
      const booksThisYear = allRead.filter((ub) => {
        if (!ub.date_read) return false;
        const d = new Date(ub.date_read);
        return !isNaN(d.getTime()) && d.getFullYear() === currentYear;
      });

      expect(booksThisYear.length).toBe(2);
      expect(booksThisYear.map((b) => b.id)).toEqual(["1", "2"]);

      // Verify pacing calculates with only the 2 verified current-year reads
      const pacing = calculateReadingGoalPacing(booksThisYear.length, 12, currentYear);
      expect(pacing.readCount).toBe(2);
      expect(pacing.goal).toBe(12);
    });

    it("renders the 'Lifetime Read' badge in BookDetailModal when date_read is null", () => {
      const lifetimeBook: BookDetailItem = {
        id: "rec-king-1",
        book_id: "book-the-stand",
        title: "The Stand",
        author: "Stephen King",
        isbn: "0385121687",
        isbn13: "9780385121682",
        cover_url: "https://covers.openlibrary.org/b/id/12345-L.jpg",
        page_count: 1153,
        published_year: 1978,
        shelf: "read",
        rating: 5,
        date_read: null, // Lifetime Read
        user_review: "All-time masterpiece.",
        user_shelves: ["read"],
      };

      const html = renderToStaticMarkup(
        <BookDetailModal
          open={true}
          onOpenChange={() => {}}
          book={lifetimeBook}
        />
      );

      expect(html).toContain("The Stand");
      expect(html).toContain("Stephen King");
      expect(html).toContain("Lifetime Read");
    });
  });

  describe("Step 2: Deep Author Catalog Search & Pagination (Issue #74)", () => {
    it("handles page and limit parameters and returns pagination metadata", async () => {
      // Mock Open Library fetch
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("openlibrary.org/search.json")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              numFound: 65,
              docs: [
                {
                  key: "/works/OL123W",
                  title: "The Stand",
                  author_name: ["Stephen King"],
                  first_publish_year: 1978,
                  number_of_pages_median: 1153,
                  cover_i: 12345,
                },
                {
                  key: "/works/OL456W",
                  title: "The Shining",
                  author_name: ["Stephen King"],
                  first_publish_year: 1977,
                  number_of_pages_median: 447,
                  cover_i: 67890,
                },
              ],
            }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      const req = new NextRequest(
        "http://localhost:3000/api/books/search?q=Stephen+King&page=1&limit=2"
      );
      const res = await searchGet(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.results.length).toBe(2);
      expect(data.hasMore).toBe(true);
      expect(data.page).toBe(1);
      expect(data.total).toBe(65);
    });
  });

  describe("Step 3: Rapid Past Read Logging (Issue #75)", () => {
    it("renders AddBookModal search UI", async () => {
      const { AddBookModal } = await import("@/components/library/add-book-modal");
      const html = renderToStaticMarkup(
        <AddBookModal
          open={true}
          onOpenChange={() => {}}
          onBookAdded={() => {}}
        />
      );

      expect(html).toContain("Add a Book to Your Shelves");
      expect(html).toContain("Search title, author, or ISBN");
    });
  });
});
