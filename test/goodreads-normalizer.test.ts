import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseGoodreadsCsv } from "@/services/parser/goodreads-normalizer";

describe("Goodreads Normalizer", () => {
  const fixturePath = path.resolve(__dirname, "fixtures/goodreads_library_export_ryan.csv");
  const csvContent = fs.readFileSync(fixturePath, "utf-8");

  it("successfully parses the real Ryan export fixture", () => {
    const result = parseGoodreadsCsv(csvContent);

    expect(result.errors).toHaveLength(0);
    expect(result.books.length).toBe(52);
    expect(result.stats.totalParsed).toBe(52);
  });

  it("accurately strips Goodreads Excel formula escaping on ISBNs", () => {
    const { books } = parseGoodreadsCsv(csvContent);
    const credence = books.find((b) => b.title === "Credence");

    expect(credence).toBeDefined();
    expect(credence?.isbn).toBe("1660089050");
    expect(credence?.isbn13).toBe("9781660089055");
  });

  it("handles empty ISBN formulas like ='\"\"' by returning null", () => {
    const { books } = parseGoodreadsCsv(csvContent);
    const clusterfuck = books.find((b) => b.title === "Clusterf*ck");

    expect(clusterfuck).toBeDefined();
    expect(clusterfuck?.isbn).toBeNull();
    expect(clusterfuck?.isbn13).toBeNull();
  });

  it("normalizes irregular whitespace in author and title names", () => {
    const { books } = parseGoodreadsCsv(csvContent);
    const clusterfuck = books.find((b) => b.cleanTitle === "Clusterf*ck");

    expect(clusterfuck).toBeDefined();
    expect(clusterfuck?.author).toBe("Brian O'Sullivan");
  });

  it("cleanly extracts series tags from book titles", () => {
    const { books } = parseGoodreadsCsv(csvContent);
    const guiltyBook = books.find((b) => b.cleanTitle === "We Are All Guilty Here");

    expect(guiltyBook).toBeDefined();
    expect(guiltyBook?.series).toBe("North Falls, #1");

    const faePrinces = books.find((b) => b.cleanTitle === "The Fae Princes");
    expect(faePrinces).toBeDefined();
    expect(faePrinces?.series).toBe("Vicious Lost Boys, #4");
  });

  it("accurately categorizes exclusive shelves", () => {
    const { stats, books } = parseGoodreadsCsv(csvContent);

    expect(stats.currentlyReadingCount).toBeGreaterThan(0);
    expect(stats.readCount).toBeGreaterThan(0);
    expect(stats.toReadCount).toBeGreaterThan(0);

    const currentlyReading = books.find((b) => b.shelf === "currently-reading");
    expect(currentlyReading?.title).toBe("The Kings of Kearny");
  });

  it("handles edge case of empty or invalid CSV", () => {
    const emptyResult = parseGoodreadsCsv("");
    expect(emptyResult.books).toHaveLength(0);
    expect(emptyResult.stats.totalParsed).toBe(0);

    const headerOnly = parseGoodreadsCsv("Book Id,Title,Author\n");
    expect(headerOnly.books).toHaveLength(0);
  });
});
