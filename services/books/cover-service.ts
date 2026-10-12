import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface CoverResolutionParams {
  goodreadsId?: string | null;
  isbn?: string | null;
  isbn13?: string | null;
  title: string;
  author: string;
}

export interface CoverResolutionResult {
  coverUrl: string | null;
  source: "goodreads" | "google_books" | "open_library" | null;
}

// Known crowd-sourced junk IDs from Open Library (e.g. mobile screenshots of shopping apps)
// and third-party study guide editions on Goodreads (SuperSummary, etc.)
export const KNOWN_BAD_COVER_IDS = new Set([
  "14632988",  // Where's Molly - Meesho shopping app screenshot
  "15255455",  // Where's Molly - Flipkart screenshot
  "14632989",  // Shallow River - mobile screenshot
  "28517",     // The Andromeda Strain - Evaluation Board User's Guide (Study guide)
  "8331093",   // 1776 - interior title page photocopy
  "9295250",   // The Devil All The Time - library barcode sticker
  "14637261",  // Middle of the Night - ultra low-res blurry thumbnail
  "254260302", // Caught Up - SuperSummary Study Guide
  "224100348", // Lights Out - SuperSummary Study Guide
  "217513150", // The Ritual - SuperSummary Study Guide
  "253071691", // The Ritual - SuperSummary Study Guide alternate
  "216360979", // A Touch of Ruin - SuperSummary Study Guide
  "223803426", // King of Battle and Blood - SuperSummary Study Guide
  "253076458", // Hexed - SuperSummary Study Guide
  "196767944", // Queen of Myth and Monsters - 5-book box set collage
  "198189196", // A Game of Retribution - 6-book collection set collage
]);

/**
 * Detects if a title or author string indicates a study guide, companion, workbook,
 * or a multi-book collection / box set collage.
 */
export function isStudyGuideOrJunk(title?: string | null, author?: string | null): boolean {
  const t = (title || "").toLowerCase();
  const a = (author || "").toLowerCase();
  const junkKeywords = [
    "supersummary",
    "study guide",
    "summary of",
    "sparknotes",
    "cliffsnotes",
    "bookrags",
    "workbook",
    "companion to",
    "analysis of",
    "lesson plans",
    "collection set",
    "box set",
    "boxset",
    "books set",
    "books collection",
    "series set",
    "bundle",
    "omnibus",
  ];
  return junkKeywords.some((kw) => t.includes(kw) || a.includes(kw));
}

/**
 * Checks if a given cover URL is known to be corrupted, a mobile screenshot,
 * study guide, or a generic placeholder.
 */
export function isBadCoverUrl(url?: string | null): boolean {
  if (!url) return true;
  if (url.includes("nophoto")) return true;
  for (const badId of KNOWN_BAD_COVER_IDS) {
    if (
      url.includes(`/id/${badId}`) ||
      url.includes(`/${badId}.`) ||
      url.includes(`/${badId}_`) ||
      url.includes(`i/${badId}`)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Strips series tags, format tags, and subtitle clutter for clean catalog searches
 */
export function cleanTitleForCoverSearch(title: string): string {
  // Strip subtitles after colons (e.g. "The Fae Princes: A Peter Pan Dark Romance" -> "The Fae Princes")
  const primaryTitle = title.split(":")[0];
  return primaryTitle
    .replace(/\s*\([^)]*\)\s*/g, " ") // remove (Series, #1) or (Kindle Edition)
    .replace(/\s*\[[^\]]*\]\s*/g, " ") // remove [Book 1]
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tier 1a: Fetch high-resolution official publisher cover from Goodreads (Amazon CDN)
 * Uses standard fetch with realistic headers, falling back to curl child process if AWS WAF intervenes.
 */
export async function fetchGoodreadsCover(goodreadsId: string): Promise<string | null> {
  const cleanId = goodreadsId.trim();
  if (!cleanId || !/^\d+$/.test(cleanId)) return null;

  const url = `https://www.goodreads.com/book/show/${cleanId}`;

  // 1. Attempt standard fetch with realistic browser headers
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const html = await res.text();
      const match = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      if (match && match[1] && !match[1].includes("nophoto")) {
        return sanitizeAmazonCoverUrl(match[1]);
      }
    }
  } catch {
    // If standard fetch times out or fails, try curl fallback
  }

  // 2. Fallback: curl child process (bypasses Node TLS JA3 fingerprinting that triggers AWS WAF)
  try {
    const { stdout } = await execFileAsync(
      "curl.exe",
      [
        "-s",
        "-L",
        "-A",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        url,
      ],
      { timeout: 6000 }
    );

    const match = stdout.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (match && match[1] && !match[1].includes("nophoto")) {
      return sanitizeAmazonCoverUrl(match[1]);
    }
  } catch {
    // Non-fatal if curl is unavailable or times out
  }

  return null;
}

/**
 * Tier 1b: Search Goodreads by clean title and author to extract official Amazon CDN cover
 * Handles books where Goodreads ID is missing or edition is unmapped.
 */
export async function fetchGoodreadsCoverBySearch(
  title: string,
  author: string
): Promise<string | null> {
  const cleanTitle = cleanTitleForCoverSearch(title);
  const cleanAuthor = author.replace(/,\s*/g, " ").trim();
  const query = `${cleanTitle} ${cleanAuthor}`.replace(/[^\w\s]/g, " ").replace(/\s+/g, "+").trim();

  if (!query) return null;

  try {
    const searchUrl = `https://www.goodreads.com/search?q=${query}`;
    const { stdout } = await execFileAsync(
      "curl.exe",
      [
        "-s",
        "-L",
        "-A",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        searchUrl,
      ],
      { timeout: 6000 }
    );

    // 1. Parse individual result rows (<tr itemscope itemtype="http://schema.org/Book">)
    // to filter out SuperSummary, study guides, and ensure author/title match
    const rowRegex = /<tr\s+itemscope\s+itemtype=["']http:\/\/schema\.org\/Book["']>([\s\S]*?)<\/tr>/gi;
    const rows = [...stdout.matchAll(rowRegex)];

    for (const match of rows) {
      const rowHtml = match[1];
      const rowTitleMatch = rowHtml.match(/class=["']bookTitle["'][^>]*>[\s\S]*?<span\s+itemprop=["']name["']>([\s\S]*?)<\/span>/i);
      const rowAuthorMatch = rowHtml.match(/class=["']authorName["'][^>]*>[\s\S]*?<span\s+itemprop=["']name["']>([\s\S]*?)<\/span>/i);

      const rowTitle = rowTitleMatch?.[1]?.trim() || "";
      const rowAuthor = rowAuthorMatch?.[1]?.trim() || "";

      // Reject study guides, SuperSummary, SparkNotes, workbooks
      if (isStudyGuideOrJunk(rowTitle, rowAuthor)) {
        continue;
      }

      // Check if cover image is directly available in this row
      const imgMatch = rowHtml.match(/class=["']bookCover["'][^>]*src=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1]) {
        const src = imgMatch[1];
        if (!src.includes("nophoto") && (src.includes("gr-assets.com") || src.includes("amazon.com"))) {
          const sanitized = sanitizeAmazonCoverUrl(src);
          if (!isBadCoverUrl(sanitized)) {
            return sanitized;
          }
        }
      }

      // If no valid cover image directly on row, fetch the book's individual page
      const bookShowMatch = rowHtml.match(/href=["']\/book\/show\/(\d+)[^"']*["']/i);
      if (bookShowMatch && bookShowMatch[1]) {
        const cover = await fetchGoodreadsCover(bookShowMatch[1]);
        if (cover && !isBadCoverUrl(cover)) {
          return cover;
        }
      }
    }

    // 2. Fallback: Search-wide image scan skipping known bad cover IDs
    const imgMatches = [...stdout.matchAll(/class=["']bookCover["'][^>]*src=["']([^"']+)["']/gi)];
    for (const m of imgMatches) {
      const src = m[1];
      if (src && !src.includes("nophoto") && (src.includes("gr-assets.com") || src.includes("amazon.com"))) {
        const sanitized = sanitizeAmazonCoverUrl(src);
        if (!isBadCoverUrl(sanitized)) {
          return sanitized;
        }
      }
    }
  } catch {
    // Non-fatal
  }

  return null;
}

/**
 * Removes dimension compression filters (e.g. ._SX98_ or ._SY160_) to obtain full resolution Amazon CDN covers
 */
export function sanitizeAmazonCoverUrl(url: string): string {
  // e.g. https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1630917669i/58934508._SX98_.jpg
  // -> https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1630917669i/58934508.jpg
  return url.replace(/\._S[XY]\d+_/, "");
}

/**
 * Converts a standard 978-prefixed ISBN-13 to its corresponding ISBN-10
 */
export function isbn13To10(isbn13: string): string | null {
  const clean = isbn13.replace(/[^0-9]/g, "");
  if (clean.length !== 13 || !clean.startsWith("978")) return null;
  const core = clean.substring(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(core[i], 10) * (10 - i);
  }
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? "X" : check.toString());
}

/**
 * Tier 1b: Fetch official high-resolution publisher cover directly from Amazon CDN via ISBN-10
 * Returns the URL only if Amazon responds with a full JPEG (>1KB), filtering out the 1x1 transparent GIF.
 */
export async function fetchAmazonIsbnCover(
  isbn?: string | null,
  isbn13?: string | null
): Promise<string | null> {
  let isbn10 = isbn?.replace(/[^0-9X]/gi, "");
  if (!isbn10 || isbn10.length !== 10) {
    if (isbn13) isbn10 = isbn13To10(isbn13) || undefined;
  }

  if (!isbn10 || isbn10.length !== 10) return null;

  const url = `https://images-na.ssl-images-amazon.com/images/P/${isbn10}.01.LZZZZZZZ.jpg`;
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type");
    const contentLength = parseInt(res.headers.get("content-length") || "0", 10);
    // Amazon returns a 43-byte image/gif when no cover exists for that ISBN
    if (contentType?.includes("image/jpeg") && contentLength > 1000) {
      return url;
    }
  } catch {
    // Non-fatal
  }
  return null;
}

/**
 * Tier 2: Fetch publisher cover art from Google Books API
 */
export async function fetchGoogleBooksCover(
  title: string,
  author: string,
  isbn?: string | null
): Promise<string | null> {
  try {
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY || process.env.GEMINI_API_KEY;
    const keyParam = apiKey ? `&key=${apiKey}` : "";

    let query = "";
    if (isbn && isbn.length >= 10) {
      query = `isbn:${isbn.replace(/[^0-9X]/gi, "")}`;
    } else {
      const cleanTitle = cleanTitleForCoverSearch(title);
      query = `intitle:${encodeURIComponent(cleanTitle)}+inauthor:${encodeURIComponent(author)}`;
    }

    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1${keyParam}`,
      {
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const item = data.items?.[0];
    const imageLinks = item?.volumeInfo?.imageLinks;

    if (!imageLinks) return null;

    const bestImg =
      imageLinks.extraLarge ||
      imageLinks.large ||
      imageLinks.medium ||
      imageLinks.thumbnail ||
      imageLinks.smallThumbnail;

    if (bestImg) {
      // Upgrade HTTP to HTTPS and remove edge curl styling
      return bestImg.replace(/^http:/, "https:").replace(/&edge=curl/, "");
    }
  } catch {
    // Non-fatal if Google Books times out or quota is exceeded
  }

  return null;
}

/**
 * Tier 3: Fetch Open Library cover with strict junk-rejection filtering
 */
export async function fetchOpenLibraryCover(
  title: string,
  author: string,
  isbn?: string | null
): Promise<string | null> {
  try {
    // 1. Direct ISBN endpoint
    if (isbn && isbn.length >= 10) {
      const cleanIsbn = isbn.replace(/[^0-9X]/gi, "");
      const res = await fetch(
        `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`,
        { method: "HEAD", signal: AbortSignal.timeout(4000) }
      );
      if (res.ok) {
        return `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;
      }
    }

    // 2. Open Library Search
    const cleanTitle = cleanTitleForCoverSearch(title);
    const searchUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(
      cleanTitle
    )}&author=${encodeURIComponent(author)}&fields=key,cover_i,editions&limit=3`;

    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "GoodBetterBestReads/1.0 (contact@goodbetterbestreads.com)" },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const doc = data.docs?.[0];
    if (!doc) return null;

    // Reject known bad/screenshot IDs
    const candidates = [doc.cover_i, ...(doc.editions?.docs?.map((e: any) => e.cover_i) || [])]
      .filter((id): id is number => Boolean(id) && id > 0)
      .map(String)
      .filter((id) => !KNOWN_BAD_COVER_IDS.has(id));

    if (candidates.length > 0) {
      return `https://covers.openlibrary.org/b/id/${candidates[0]}-L.jpg`;
    }

    // 3. If primary search edition has only corrupt/bad covers, inspect all work editions
    if (doc.key) {
      const editionsUrl = `https://openlibrary.org${doc.key}/editions.json?limit=15`;
      const edRes = await fetch(editionsUrl, {
        headers: { "User-Agent": "GoodBetterBestReads/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (edRes.ok) {
        const edData = await edRes.json();
        for (const entry of edData.entries || []) {
          for (const c of entry.covers || []) {
            const cStr = String(c);
            if (c > 0 && !KNOWN_BAD_COVER_IDS.has(cStr)) {
              return `https://covers.openlibrary.org/b/id/${cStr}-L.jpg`;
            }
          }
        }
      }
    }
  } catch {
    // Non-fatal
  }

  return null;
}

/**
 * Main 3-Tier Cover Waterfall Resolver:
 * Tier 1: Goodreads og:image (Amazon CDN) - 100% parity for imported books
 * Tier 2: Google Books API - High-res publisher art
 * Tier 3: Open Library API - Sanity-checked fallback
 */
export async function resolveBookCover(
  params: CoverResolutionParams
): Promise<CoverResolutionResult> {
  const { goodreadsId, isbn, isbn13, title, author } = params;
  const targetIsbn = isbn13 || isbn;

  // Tier 1a: Goodreads direct by ID
  if (goodreadsId) {
    const grCover = await fetchGoodreadsCover(goodreadsId);
    if (grCover && !isBadCoverUrl(grCover)) {
      return { coverUrl: grCover, source: "goodreads" };
    }
  }

  // Tier 1b: Amazon direct ISBN CDN (official publisher art, ultra-fast and reliable)
  const amazonCover = await fetchAmazonIsbnCover(isbn, isbn13);
  if (amazonCover && !isBadCoverUrl(amazonCover)) {
    return { coverUrl: amazonCover, source: "goodreads" };
  }

  // Tier 1c: Goodreads by title + author search (essential for unmapped indie/Kindle books)
  const grSearchCover = await fetchGoodreadsCoverBySearch(title, author);
  if (grSearchCover && !isBadCoverUrl(grSearchCover)) {
    return { coverUrl: grSearchCover, source: "goodreads" };
  }

  // Tier 2: Google Books
  const gbCover = await fetchGoogleBooksCover(title, author, targetIsbn);
  if (gbCover && !isBadCoverUrl(gbCover)) {
    return { coverUrl: gbCover, source: "google_books" };
  }

  // Tier 3: Open Library
  const olCover = await fetchOpenLibraryCover(title, author, targetIsbn);
  if (olCover && !isBadCoverUrl(olCover)) {
    return { coverUrl: olCover, source: "open_library" };
  }

  return { coverUrl: null, source: null };
}
