import Papa from "papaparse";
import { NormalizedBook, ParseResult, ReadingShelf } from "./types";

interface RawGoodreadsRow {
  "Book Id"?: string;
  Title?: string;
  Author?: string;
  "Author l-f"?: string;
  "Additional Authors"?: string;
  ISBN?: string;
  ISBN13?: string;
  "My Rating"?: string;
  "Average Rating"?: string;
  Publisher?: string;
  Binding?: string;
  "Number of Pages"?: string;
  "Year Published"?: string;
  "Original Publication Year"?: string;
  "Date Read"?: string;
  "Date Added"?: string;
  Bookshelves?: string;
  "Bookshelves with positions"?: string;
  "Exclusive Shelf"?: string;
  "My Review"?: string;
  Spoiler?: string;
  "Private Notes"?: string;
  "Read Count"?: string;
  "Owned Copies"?: string;
}

/**
 * Strips Goodreads Excel formula escaping like `="0345391802"` into `0345391802`
 */
function cleanIsbn(raw?: string): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/^="|"$/g, "").replace(/"/g, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Normalizes irregular whitespace (e.g., "Brian     O'Sullivan" -> "Brian O'Sullivan")
 */
function cleanWhitespace(text?: string): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Extracts clean title and separate series info (e.g. "We Are All Guilty Here (North Falls, #1)")
 */
function extractTitleAndSeries(rawTitle: string): { cleanTitle: string; series: string | null } {
  const normalized = cleanWhitespace(rawTitle);
  const seriesMatch = normalized.match(/^(.*?)\s*\((.*?)\)$/);
  
  if (seriesMatch) {
    return {
      cleanTitle: seriesMatch[1].trim(),
      series: seriesMatch[2].trim(),
    };
  }

  return { cleanTitle: normalized, series: null };
}

/**
 * Resolves the primary reading shelf, accurately catching custom DNF tags
 */
function resolveShelf(exclusiveShelf?: string, bookshelves?: string): ReadingShelf {
  const exclusive = (exclusiveShelf || "").toLowerCase().trim();
  const customShelves = (bookshelves || "").toLowerCase();

  // Catch Did-Not-Finish tags in custom bookshelves
  if (
    exclusive === "did-not-finish" ||
    customShelves.includes("dnf") ||
    customShelves.includes("did-not-finish") ||
    customShelves.includes("abandoned")
  ) {
    return "did-not-finish";
  }

  if (exclusive === "read") return "read";
  if (exclusive === "currently-reading") return "currently-reading";
  return "to-read";
}

/**
 * Converts Goodreads date strings ("YYYY/MM/DD") to ISO format
 */
function parseDate(dateStr?: string): string | null {
  if (!dateStr || !dateStr.trim()) return null;
  const cleaned = dateStr.trim();
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Pure TypeScript parser for Goodreads CSV exports
 */
export function parseGoodreadsCsv(csvContent: string): ParseResult {
  const parseErrors: string[] = [];
  
  const parsed = Papa.parse<RawGoodreadsRow>(csvContent, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    parsed.errors.forEach((err) => {
      parseErrors.push(`Row ${err.row}: ${err.message}`);
    });
  }

  const books: NormalizedBook[] = [];

  for (const row of parsed.data) {
    const rawTitle = row.Title || "";
    const rawAuthor = row.Author || "";

    // Skip empty or invalid rows
    if (!rawTitle.trim() && !rawAuthor.trim()) continue;

    const { cleanTitle, series } = extractTitleAndSeries(rawTitle);
    const shelf = resolveShelf(row["Exclusive Shelf"], row.Bookshelves);
    const myRating = parseInt(row["My Rating"] || "0", 10) || 0;

    const additionalAuthors = (row["Additional Authors"] || "")
      .split(",")
      .map((a) => cleanWhitespace(a))
      .filter((a) => a.length > 0);

    const userShelves = (row.Bookshelves || "")
      .split(",")
      .map((s) => cleanWhitespace(s))
      .filter((s) => s.length > 0);

    books.push({
      goodreadsId: row["Book Id"]?.trim() || "",
      title: cleanWhitespace(rawTitle),
      cleanTitle,
      series,
      author: cleanWhitespace(rawAuthor),
      additionalAuthors,
      isbn: cleanIsbn(row.ISBN),
      isbn13: cleanIsbn(row.ISBN13),
      myRating,
      averageRating: parseFloat(row["Average Rating"] || "0") || 0,
      publisher: row.Publisher?.trim() || null,
      binding: row.Binding?.trim() || null,
      pageCount: parseInt(row["Number of Pages"] || "0", 10) || null,
      yearPublished: parseInt(row["Year Published"] || "0", 10) || null,
      originalPublicationYear: parseInt(row["Original Publication Year"] || "0", 10) || null,
      dateRead: parseDate(row["Date Read"]),
      dateAdded: parseDate(row["Date Added"]),
      shelf,
      userShelves,
      userReview: row["My Review"]?.trim() || null,
      readCount: parseInt(row["Read Count"] || "0", 10) || 0,
    });
  }

  // Calculate high-signal statistics
  const stats = {
    totalParsed: books.length,
    readCount: books.filter((b) => b.shelf === "read").length,
    currentlyReadingCount: books.filter((b) => b.shelf === "currently-reading").length,
    toReadCount: books.filter((b) => b.shelf === "to-read").length,
    dnfCount: books.filter((b) => b.shelf === "did-not-finish").length,
    fiveStarCount: books.filter((b) => b.myRating === 5).length,
    oneStarCount: books.filter((b) => b.myRating === 1).length,
    unratedCount: books.filter((b) => b.myRating === 0).length,
  };

  return {
    books,
    stats,
    errors: parseErrors,
  };
}