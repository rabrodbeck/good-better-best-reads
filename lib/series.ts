/**
 * Series Parsing & Progression Engine (Issue #40)
 * Pure helper functions to extract series names, volume orders,
 * and track series reading progression across a reader's library.
 */

export interface SeriesInfo {
  cleanTitle: string;
  seriesName: string;
  volume: number | null;
  displaySeries: string; // e.g. "Adrian X Isolde #2"
}

export interface LibraryBookForSeries {
  id: string;
  book_id: string;
  title: string;
  author: string;
  cover_url?: string | null;
  shelf: string;
  rating?: number | null;
  page_count?: number | null;
}

export interface SeriesGroup<T extends LibraryBookForSeries = LibraryBookForSeries> {
  seriesName: string;
  books: (T & { seriesInfo: SeriesInfo })[];
  totalCount: number;
  readCount: number;
  toReadCount: number;
  currentlyReadingCount: number;
  completionPercentage: number;
  isComplete: boolean;
  nextBookToRead: (T & { seriesInfo: SeriesInfo }) | null;
}

const NON_SERIES_PARENTHETICALS = new Set([
  "a novel",
  "novel",
  "memoir",
  "illustrated",
  "illustrated edition",
  "special edition",
  "deluxe edition",
  "graphic novel",
  "short story",
  "kindle single",
  "hardcover",
  "paperback",
  "audiobook",
  "annotated",
  "expanded edition",
]);

/**
 * Parses series name, volume number, and cleans the book title.
 * Examples:
 * - "Queen of Myth and Monsters (Adrian X Isolde, #2)" -> { cleanTitle: "Queen of Myth and Monsters", seriesName: "Adrian X Isolde", volume: 2 }
 * - "The Fae Princes (Vicious Lost Boys, #4)" -> { cleanTitle: "The Fae Princes", seriesName: "Vicious Lost Boys", volume: 4 }
 * - "Dune (Dune Chronicles, Book 1)" -> { cleanTitle: "Dune", seriesName: "Dune Chronicles", volume: 1 }
 * - "Catching Fire (The Hunger Games #2)" -> { cleanTitle: "Catching Fire", seriesName: "The Hunger Games", volume: 2 }
 */
export function parseSeriesInfo(rawTitle: string): SeriesInfo | null {
  if (!rawTitle) return null;
  const normalized = rawTitle.replace(/\s+/g, " ").trim();

  // Look for trailing parenthetical: Title (Series Info)
  const parenMatch = normalized.match(/^(.*?)\s*\(([^()]+)\)$/);
  if (!parenMatch) return null;

  const baseTitle = parenMatch[1].trim();
  const insideParen = parenMatch[2].trim();

  // If it's a known non-series tag like (A Novel), ignore
  if (NON_SERIES_PARENTHETICALS.has(insideParen.toLowerCase())) {
    return null;
  }

  // Common series patterns:
  // 1. "Adrian X Isolde, #2" or "North Falls, #1"
  // 2. "The Hunger Games #2" or "Dune Chronicles Book 1"
  // 3. "ACOTAR, Vol. 3" or "Harry Potter, Book 4"
  // 4. "Vicious Lost Boys, 4"
  const volumeMatch = insideParen.match(
    /^(.*?)(?:,\s*|\s+)(?:#|book\s*|vol(?:ume)?\.?\s*|part\s*)?(\d+(?:\.\d+)?)$/i
  );

  if (volumeMatch) {
    const seriesName = volumeMatch[1].replace(/,\s*$/, "").trim();
    const volume = parseFloat(volumeMatch[2]);

    // Don't treat random years or single words with numbers as series if seriesName is empty
    if (!seriesName) return null;

    return {
      cleanTitle: baseTitle,
      seriesName,
      volume: isNaN(volume) ? null : volume,
      displaySeries: isNaN(volume) ? seriesName : `${seriesName} #${volume}`,
    };
  }

  // If inside paren contains explicit series indicator without direct volume regex (e.g. "Series Name Series")
  if (insideParen.toLowerCase().includes("series") || insideParen.toLowerCase().includes("chronicles") || insideParen.toLowerCase().includes("trilogy")) {
    return {
      cleanTitle: baseTitle,
      seriesName: insideParen,
      volume: null,
      displaySeries: insideParen,
    };
  }

  return null;
}

/**
 * Groups a collection of books by series, orders volumes chronologically,
 * and calculates completion progress and the next unread book in the sequence.
 */
export function groupBooksBySeries<T extends LibraryBookForSeries>(
  books: T[]
): SeriesGroup<T>[] {
  const map = new Map<string, (T & { seriesInfo: SeriesInfo })[]>();

  for (const book of books) {
    const seriesInfo = parseSeriesInfo(book.title);
    if (!seriesInfo) continue;

    const list = map.get(seriesInfo.seriesName) || [];
    list.push({ ...book, seriesInfo });
    map.set(seriesInfo.seriesName, list);
  }

  const result: SeriesGroup<T>[] = [];

  for (const [seriesName, seriesBooks] of map.entries()) {
    // Only group if at least 1 book with explicit series metadata or 2+ books
    if (seriesBooks.length < 1) continue;

    // Sort books by volume number ascending, then title
    seriesBooks.sort((a, b) => {
      const volA = a.seriesInfo.volume ?? 9999;
      const volB = b.seriesInfo.volume ?? 9999;
      if (volA !== volB) return volA - volB;
      return a.title.localeCompare(b.title);
    });

    const readBooks = seriesBooks.filter((b) => b.shelf === "read");
    const toReadBooks = seriesBooks.filter((b) => b.shelf === "to-read");
    const currentlyReadingBooks = seriesBooks.filter((b) => b.shelf === "currently-reading");

    const totalCount = seriesBooks.length;
    const readCount = readBooks.length;
    const completionPercentage = Math.round((readCount / totalCount) * 100);

    // Identify next book to read:
    // First check if already reading one in the series; otherwise first unread in order
    const readingNow = currentlyReadingBooks[0];
    const firstUnread = seriesBooks.find((b) => b.shelf !== "read");
    const nextBookToRead = readingNow || firstUnread || null;

    result.push({
      seriesName,
      books: seriesBooks,
      totalCount,
      readCount,
      toReadCount: toReadBooks.length,
      currentlyReadingCount: currentlyReadingBooks.length,
      completionPercentage,
      isComplete: readCount === totalCount && totalCount > 1,
      nextBookToRead,
    });
  }

  // Sort groups: in-progress series first, then by total books descending
  return result.sort((a, b) => {
    const aInProgress = a.currentlyReadingCount > 0 || (a.readCount > 0 && !a.isComplete);
    const bInProgress = b.currentlyReadingCount > 0 || (b.readCount > 0 && !b.isComplete);
    if (aInProgress && !bInProgress) return -1;
    if (!aInProgress && bInProgress) return 1;
    return b.totalCount - a.totalCount;
  });
}
