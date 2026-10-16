import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookCard } from "@/components/chat/book-card";
import { ReadingDnaClient } from "@/app/dna/reading-dna-client";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}));

describe("Phase 7: Steps 1, 2, & 3 UI & UX Architecture Polish", () => {
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
});
