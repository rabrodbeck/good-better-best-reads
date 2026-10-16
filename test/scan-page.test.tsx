import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ScanPage from "@/app/scan/page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("isbn=9780441013593"),
}));

vi.mock("@/components/scan/barcode-scanner-view", () => ({
  BarcodeScannerView: () => <div data-testid="mock-scanner">Mock Camera Scanner View</div>,
}));

vi.mock("@/components/library/librarian-verdict-card", () => ({
  LibrarianVerdictCard: () => <div data-testid="mock-verdict">Mock Verdict Card</div>,
}));

describe("ScanPage - Dedicated In-Store Barcode Scout Screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with Suspense wrapper and in-store scout header", () => {
    const html = renderToStaticMarkup(<ScanPage />);
    expect(html).toContain("In-Store Scout");
    expect(html).toContain("My Shelves");
  });
});
