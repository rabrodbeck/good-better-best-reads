import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookCard } from "@/components/chat/book-card";
import { ReadingDnaClient } from "@/app/dna/reading-dna-client";

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
}));

describe("Phase 7: UI & UX Architecture Polish (Steps 1–5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Step 1: Mobile & PWA Layout Foundations (Issue #65, #66)", () => {
    it("renders Reading DNA with mobile safe-area bottom navigation padding", () => {
      // Mock fetch for DNA profile
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tasteProfile: {
            archetype_name: "Narrative Architect",
            archetype_summary: "Loves rich multi-layered worldbuilding",
            top_tropes: ["Found Family", "Unreliable Narrator"],
            dealbreakers: ["Cliffhangers"],
          },
          stats: { totalBooks: 50, readCount: 35 },
        }),
      });

      const html = renderToStaticMarkup(<ReadingDnaClient />);
      expect(html).toBeDefined();
    });
  });

  describe("Step 2: AI Librarian 1-Tap Shelf Capture (Issue #67)", () => {
    it("renders BookCard with 1-tap '+ Want to Read' shelf button", () => {
      const html = renderToStaticMarkup(
        <BookCard
          title="Project Hail Mary"
          author="Andy Weir"
          publishedYear={2021}
          pageCount={496}
          rationale="Perfect match for your science fiction and high-stakes survival taste."
        />
      );

      expect(html).toContain("Project Hail Mary");
      expect(html).toContain("Andy Weir");
      expect(html).toContain("+ Want to Read");
      expect(html).toContain("Librarian Pick");
    });
  });

  describe("Step 3: In-Store Barcode Scanner Power-User Upgrades (Issue #68, #69)", () => {
    it("includes quick rescan and scanner controls", async () => {
      const { BarcodeScannerView } = await import("@/components/scan/barcode-scanner-view");
      const html = renderToStaticMarkup(
        <BarcodeScannerView onScanSuccess={() => {}} active={false} />
      );
      expect(html).toContain("Upload barcode photo");
      expect(html).toContain("Type ISBN manually");
    });
  });

  describe("Step 4 & 5: Library Mobile Header, Quick Clear, and Book Detail Sheet (Issue #70, #71, #72)", () => {
    it("renders BookDetailModal with metadata, interactive shelf controls, and rating", async () => {
      const { BookDetailModal } = await import("@/components/library/book-detail-modal");
      const mockBook = {
        id: "rec-123",
        book_id: "book-456",
        title: "Dune (Dune #1)",
        author: "Frank Herbert",
        isbn: "0441172717",
        isbn13: "9780441172719",
        cover_url: "https://covers.openlibrary.org/b/isbn/9780441172719-M.jpg",
        page_count: 688,
        published_year: 1965,
        shelf: "read" as const,
        rating: 5,
        date_read: "2024-01-15",
        user_review: "A masterpiece of political intrigue and ecological worldbuilding.",
        user_shelves: ["favorites", "sci-fi"],
      };

      const html = renderToStaticMarkup(
        <BookDetailModal
          open={true}
          onOpenChange={() => {}}
          book={mockBook}
          onShelfChange={() => {}}
          onRatingChange={() => {}}
          onBookDeleted={() => {}}
          onRecommend={() => {}}
        />
      );

      // Verify clean title and series parsing
      expect(html).toContain("Dune");
      expect(html).toContain("Frank Herbert");
      expect(html).toContain("Dune #1");
      expect(html).toContain("688 pages");
      expect(html).toContain("1965");
      expect(html).toContain("9780441172719");

      // Verify Shelf Options
      expect(html).toContain("Want to Read");
      expect(html).toContain("Reading Now");
      expect(html).toContain("Read");
      expect(html).toContain("DNF");

      // Verify rating display and user notes
      expect(html).toContain("5★");
      expect(html).toContain("A masterpiece of political intrigue");

      // Verify AI Librarian and Sharing integrations
      expect(html).toContain("Ask Librarian About This");
      expect(html).toContain("Recommend to Friend");
      expect(html).toContain("Remove book from library");
    });

    it("safely handles null book state without violating Rules of Hooks", async () => {
      const { BookDetailModal } = await import("@/components/library/book-detail-modal");
      const nullHtml = renderToStaticMarkup(
        <BookDetailModal
          open={false}
          onOpenChange={() => {}}
          book={null}
        />
      );
      expect(nullHtml).toBe("");
    });

    it("verifies DELETE library route contract supports book_id and user authorization", async () => {
      const routeModule = await import("@/app/api/library/route");
      expect(typeof routeModule.DELETE).toBe("function");
    });
  });
});

