import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BottomNav } from "@/components/layout/bottom-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/library",
}));

describe("BottomNav - Mobile Navigation Component", () => {
  it("renders all 5 core mobile navigation links", () => {
    const html = renderToStaticMarkup(<BottomNav />);

    expect(html).toContain("Shelves");
    expect(html).toContain("Friends");
    expect(html).toContain("Scan");
    expect(html).toContain("Librarian");
    expect(html).toContain("DNA");

    expect(html).toContain('href="/library"');
    expect(html).toContain('href="/friends"');
    expect(html).toContain('href="/scan"');
    expect(html).toContain('href="/chat"');
    expect(html).toContain('href="/dna"');
  });

  it("applies fixed positioning and safe area inset support", () => {
    const html = renderToStaticMarkup(<BottomNav />);

    expect(html).toContain("fixed bottom-0");
    expect(html).toContain("md:hidden");
    expect(html).toContain("pb-[env(safe-area-inset-bottom)]");
  });
});
