import { describe, it, expect } from "vitest";
import { sanitizeCsvCell } from "@/lib/csv-security";

describe("CSV Export Formula Sanitization (SEC / Issue #24)", () => {
  it("prepends single quote to cells beginning with formula trigger characters", () => {
    expect(sanitizeCsvCell("=1+1")).toBe("'=1+1");
    expect(sanitizeCsvCell("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
    expect(sanitizeCsvCell("+12345")).toBe("'+12345");
    expect(sanitizeCsvCell("-50")).toBe("'-50");
    expect(sanitizeCsvCell("@SUM(A1:B2)")).toBe("'@SUM(A1:B2)");
    expect(sanitizeCsvCell("\tmalicious")).toBe("'\tmalicious");
    expect(sanitizeCsvCell("\rmalicious")).toBe("'\rmalicious");
  });

  it("neutralizes formula triggers preceded by leading whitespace", () => {
    expect(sanitizeCsvCell("   =HYPERLINK(\"http://evil.com\")")).toBe("'   =HYPERLINK(\"http://evil.com\")");
    expect(sanitizeCsvCell("\t=cmd")).toBe("'\t=cmd");
  });

  it("leaves standard benign text unaltered", () => {
    expect(sanitizeCsvCell("Dune")).toBe("Dune");
    expect(sanitizeCsvCell("Frank Herbert")).toBe("Frank Herbert");
    expect(sanitizeCsvCell("A captivating, 5-star thriller.")).toBe("A captivating, 5-star thriller.");
    expect(sanitizeCsvCell("read")).toBe("read");
    expect(sanitizeCsvCell("favorites, sci-fi")).toBe("favorites, sci-fi");
  });

  it("handles null, undefined, empty, and numeric values safely", () => {
    expect(sanitizeCsvCell(null)).toBe("");
    expect(sanitizeCsvCell(undefined)).toBe("");
    expect(sanitizeCsvCell("")).toBe("");
    expect(sanitizeCsvCell(0)).toBe("0");
    expect(sanitizeCsvCell(42)).toBe("42");
  });
});
