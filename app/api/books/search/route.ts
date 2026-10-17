import { NextRequest, NextResponse } from "next/server";
import {
  isBadCoverUrl,
  isStudyGuideOrJunk,
  isbn13To10,
} from "@/services/books/cover-service";

export const dynamic = "force-dynamic";

export interface SearchResultItem {
  key: string;
  title: string;
  author: string;
  cover_url: string | null;
  published_year: number | null;
  page_count: number | null;
  isbn: string | null;
  isbn13: string | null;
  genres: string[];
  snippet: string | null;
}

/**
 * Normalizes title string for deduplication comparison
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Searches Google Books Volumes API as a robust secondary provider
 */
export async function searchGoogleBooks(query: string): Promise<SearchResultItem[]> {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
      query
    )}&maxResults=10&printType=books`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];

    const results: SearchResultItem[] = [];

    for (const item of items) {
      const vi = item.volumeInfo || {};
      const title = vi.title?.trim() || "Untitled";
      const author = Array.isArray(vi.authors)
        ? vi.authors[0]
        : (vi.authors || "Unknown Author");

      // Filter out study guides, sparknotes, and box sets
      if (isStudyGuideOrJunk(title, author)) {
        continue;
      }

      const industryIds = Array.isArray(vi.industryIdentifiers)
        ? vi.industryIdentifiers
        : [];
      const isbn13Obj = industryIds.find((id: any) => id.type === "ISBN_13");
      const isbn10Obj = industryIds.find((id: any) => id.type === "ISBN_10");
      const isbn13 = isbn13Obj?.identifier || null;
      const isbn10 = isbn10Obj?.identifier || null;

      // Extract cover image
      let coverUrl: string | null = null;
      if (
        vi.imageLinks?.extraLarge ||
        vi.imageLinks?.large ||
        vi.imageLinks?.medium ||
        vi.imageLinks?.thumbnail
      ) {
        const raw =
          vi.imageLinks.extraLarge ||
          vi.imageLinks.large ||
          vi.imageLinks.medium ||
          vi.imageLinks.thumbnail;
        coverUrl = raw.replace(/^http:\/\//i, "https://");
      }

      // If Google image is missing, attempt Amazon CDN ISBN-10
      if (!coverUrl) {
        const resolvedIsbn10 = isbn10 || (isbn13 ? isbn13To10(isbn13) : null);
        if (resolvedIsbn10 && resolvedIsbn10.length === 10) {
          coverUrl = `https://images-na.ssl-images-amazon.com/images/P/${resolvedIsbn10}.01.LZZZZZZZ.jpg`;
        }
      }

      if (isBadCoverUrl(coverUrl)) {
        coverUrl = null;
      }

      const publishedYear = vi.publishedDate
        ? parseInt(vi.publishedDate.substring(0, 4), 10) || null
        : null;

      results.push({
        key: item.id ? `/google/${item.id}` : `gb-${results.length}`,
        title,
        author,
        cover_url: coverUrl,
        published_year: publishedYear,
        page_count: vi.pageCount || null,
        isbn: isbn10,
        isbn13: isbn13,
        genres: Array.isArray(vi.categories) ? vi.categories.slice(0, 5) : [],
        snippet: vi.description ? vi.description.slice(0, 220) + "..." : null,
      });
    }

    return results;
  } catch (err) {
    console.warn("Google Books search fallback failed:", err);
    return [];
  }
}

interface CachedBookResult {
  timestamp: number;
  results: SearchResultItem[];
}

// In-memory ISBN lookup cache (24hr TTL) for instant sub-millisecond responses
export const isbnCache = new Map<string, CachedBookResult>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

export function clearIsbnCache() {
  isbnCache.clear();
}

/**
 * High-speed direct Open Library Books API query by ISBN (jscmd=data)
 */
export async function fetchOpenLibraryIsbn(cleanIsbn: string): Promise<SearchResultItem | null> {
  try {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`;
    const res = await fetch(url, {
      headers: { "User-Agent": "TBRScout/1.0 (contact@tbrscout.vercel.app)" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const book = data[`ISBN:${cleanIsbn}`];
    if (!book || !book.title) return null;

    const title = book.title.trim();
    const author = Array.isArray(book.authors) && book.authors[0]?.name
      ? book.authors[0].name.trim()
      : "Unknown Author";

    if (isStudyGuideOrJunk(title, author)) return null;

    let coverUrl: string | null = null;
    if (book.cover?.large) coverUrl = book.cover.large;
    else if (book.cover?.medium) coverUrl = book.cover.medium;
    else if (book.cover?.small) coverUrl = book.cover.small;

    const isbn10 = cleanIsbn.length === 10 ? cleanIsbn : isbn13To10(cleanIsbn);
    if (!coverUrl && isbn10) {
      coverUrl = `https://images-na.ssl-images-amazon.com/images/P/${isbn10}.01.LZZZZZZZ.jpg`;
    }

    if (isBadCoverUrl(coverUrl)) coverUrl = null;

    let publishedYear: number | null = null;
    if (book.publish_date) {
      const match = String(book.publish_date).match(/\b(19\d\d|20\d\d)\b/);
      if (match) publishedYear = parseInt(match[1], 10);
    }

    const genres: string[] = Array.isArray(book.subjects)
      ? book.subjects.map((s: any) => (typeof s === "string" ? s : s.name)).filter(Boolean).slice(0, 5)
      : [];

    return {
      key: book.key || `/isbn/${cleanIsbn}`,
      title,
      author,
      cover_url: coverUrl,
      published_year: publishedYear,
      page_count: typeof book.number_of_pages === "number" ? book.number_of_pages : null,
      isbn: isbn10 || cleanIsbn,
      isbn13: cleanIsbn.length === 13 ? cleanIsbn : null,
      genres,
      snippet: typeof book.notes === "string" ? book.notes : null,
    };
  } catch {
    return null;
  }
}

/**
 * High-speed direct Google Books query by ISBN
 */
export async function fetchGoogleBooksIsbn(cleanIsbn: string): Promise<SearchResultItem | null> {
  try {
    const results = await searchGoogleBooks(`isbn:${cleanIsbn}`);
    return results.length > 0 ? results[0] : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const workKey = searchParams.get("work")?.trim();

    // 1. If fetching full description for a specific work key
    if (workKey) {
      const cleanWork = workKey.startsWith("/works/") ? workKey : `/works/${workKey}`;
      try {
        const workRes = await fetch(`https://openlibrary.org${cleanWork}.json`, {
          headers: { "User-Agent": "TBRScout/1.0" },
          signal: AbortSignal.timeout(6000),
        });
        if (workRes.ok) {
          const workData = await workRes.json();
          let description: string | null = null;
          if (typeof workData.description === "string") {
            description = workData.description;
          } else if (workData.description && typeof workData.description.value === "string") {
            description = workData.description.value;
          }
          return NextResponse.json({ description });
        }
      } catch (err) {
        console.warn("Failed to fetch work description:", err);
      }
      return NextResponse.json({ description: null });
    }

    // 2. Query search
    if (!query || query.length < 2) {
      return NextResponse.json({ results: [], hasMore: false, page: 1, total: 0 });
    }

    const pageParam = searchParams.get("page");
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(50, Math.max(5, parseInt(limitParam, 10))) : 20;

    // FAST-PATH: If query is an ISBN (10 or 13 digits), execute direct parallel lookup
    const cleanIsbn = query.replace(/[-\s]/g, "").trim();
    const isIsbn = /^\d{9}[\dX]$/i.test(cleanIsbn) || /^\d{13}$/.test(cleanIsbn);

    if (isIsbn) {
      // 1. Instant In-Memory Cache (0ms)
      const cached = isbnCache.get(cleanIsbn);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return NextResponse.json(
          { results: cached.results, hasMore: false, page: 1, total: cached.results.length },
          { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } }
        );
      }

      // 2. Parallel Provider Race (Open Library Direct Books API + Google Books)
      const [olMatch, gbMatch] = await Promise.all([
        fetchOpenLibraryIsbn(cleanIsbn),
        fetchGoogleBooksIsbn(cleanIsbn),
      ]);

      const primary = olMatch || gbMatch;
      if (primary) {
        const results = [primary];
        if (gbMatch && olMatch && gbMatch.title.toLowerCase() !== olMatch.title.toLowerCase()) {
          results.push(gbMatch);
        }
        isbnCache.set(cleanIsbn, { timestamp: Date.now(), results });
        return NextResponse.json(
          { results, hasMore: false, page: 1, total: results.length },
          { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } }
        );
      }
    }

    let olResults: SearchResultItem[] = [];
    let totalFound = 0;

    // Attempt primary search via Open Library
    try {
      const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(
        query
      )}&page=${page}&limit=${limit}&fields=key,title,author_name,cover_i,first_publish_year,number_of_pages_median,isbn,subject,first_sentence,language,editions`;

      const res = await fetch(searchUrl, {
        headers: { "User-Agent": "TBRScout/1.0 (contact@tbrscout.vercel.app)" },
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json();
        if (typeof data.numFound === "number") {
          totalFound = data.numFound;
        }
        const docs = Array.isArray(data.docs) ? data.docs : [];

        for (const doc of docs) {
          const title = doc.title || "Untitled";
          const author = Array.isArray(doc.author_name)
            ? doc.author_name[0]
            : (doc.author_name || "Unknown Author");

          // Reject study guides, SuperSummary, and box sets
          if (isStudyGuideOrJunk(title, author)) {
            continue;
          }

          // 1. Cover URL resolution: prioritize cover_i, then child editions
          let coverUrl: string | null = null;
          if (doc.cover_i) {
            coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
          } else if (doc.editions?.docs && Array.isArray(doc.editions.docs)) {
            const engEdition = doc.editions.docs.find(
              (e: any) => e.cover_i && (e.language?.includes("eng") || e.language?.includes("en"))
            );
            const editionCover = engEdition?.cover_i || doc.editions.docs[0]?.cover_i;
            if (editionCover) {
              coverUrl = `https://covers.openlibrary.org/b/id/${editionCover}-L.jpg`;
            }
          }

          // 2. ISBN resolution
          const isbns: string[] = Array.isArray(doc.isbn) ? doc.isbn : [];
          const isbn13 = isbns.find((i) => i.replace(/-/g, "").length === 13) || null;
          const isbn10 = isbns.find((i) => i.replace(/-/g, "").length === 10) || isbns[0] || null;

          // 3. Amazon ISBN CDN fallback if Open Library cover is missing
          if (!coverUrl) {
            const resolvedIsbn10 = isbn10 || (isbn13 ? isbn13To10(isbn13) : null);
            if (resolvedIsbn10 && resolvedIsbn10.length === 10) {
              coverUrl = `https://images-na.ssl-images-amazon.com/images/P/${resolvedIsbn10}.01.LZZZZZZZ.jpg`;
            }
          }

          // Reject known bad or placeholder covers
          if (isBadCoverUrl(coverUrl)) {
            coverUrl = null;
          }

          // 4. First sentence / snippet preview
          let snippet: string | null = null;
          if (Array.isArray(doc.first_sentence) && doc.first_sentence.length > 0) {
            snippet = doc.first_sentence[0];
          } else if (typeof doc.first_sentence === "string") {
            snippet = doc.first_sentence;
          }

          olResults.push({
            key: doc.key || "",
            title,
            author,
            cover_url: coverUrl,
            published_year: doc.first_publish_year || null,
            page_count: doc.number_of_pages_median || null,
            isbn: isbn10,
            isbn13: isbn13,
            genres: Array.isArray(doc.subject) ? doc.subject.slice(0, 5) : [],
            snippet,
          });
        }
      }
    } catch (olError) {
      console.warn("Open Library search request failed, falling back to Google Books:", olError);
    }

    // If Open Library yielded fewer than 3 results or failed, supplement with Google Books
    if (olResults.length < 3) {
      const gbResults = await searchGoogleBooks(query);
      const existingKeys = new Set(olResults.map((r) => normalizeTitle(r.title)));

      for (const gb of gbResults) {
        const norm = normalizeTitle(gb.title);
        if (!existingKeys.has(norm)) {
          existingKeys.add(norm);
          olResults.push(gb);
        }
      }
    }

    const hasMore = totalFound > page * limit;

    return NextResponse.json({
      results: olResults,
      hasMore,
      page,
      total: totalFound || olResults.length,
    });
  } catch (error: any) {
    console.error("Multi-Provider Book Search Error:", error);
    return NextResponse.json(
      { error: error?.message || "Search failed", results: [] },
      { status: 500 }
    );
  }
}
