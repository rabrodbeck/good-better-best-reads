export interface EnrichedBookDetails {
  title: string;
  author: string;
  coverUrl: string | null;
  description: string | null;
  genres: string[];
  pageCount: number | null;
  publishedYear: number | null;
  openLibraryKey: string | null;
}

/**
 * Cleanly extracts an Open Library cover URL if an ID exists
 */
function getCoverUrl(coverId?: number): string | null {
  if (!coverId) return null;
  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
}

/**
 * Safely extracts a 4-digit publication year across varied Open Library date formats
 * (e.g. "2018-05-15", "May 2004", "ca. 1995", "1984").
 */
function parsePublishYear(publishDate?: string | null): number | null {
  if (!publishDate) return null;
  const match = publishDate.match(/\b(18|19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Verifies that a search result doc from Open Library genuinely corresponds to
 * the query title and author, preventing unrelated fuzzy full-text false positives.
 */
function isBookMatch(
  queryTitle: string,
  queryAuthor: string,
  doc: { title?: string; author_name?: string[] }
): boolean {
  if (!doc.title) return false;

  const normQuery = queryTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normDoc = doc.title.toLowerCase().replace(/[^a-z0-9]/g, "");

  const titleMatches =
    normDoc === normQuery ||
    normDoc.includes(normQuery) ||
    normQuery.includes(normDoc);

  if (!titleMatches) return false;

  if (queryAuthor && doc.author_name && doc.author_name.length > 0) {
    const queryAuthorWords = queryAuthor
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const docAuthorStr = doc.author_name.join(" ").toLowerCase();

    const authorMatches =
      queryAuthorWords.length === 0 ||
      queryAuthorWords.some((word) => docAuthorStr.includes(word));

    if (!authorMatches) return false;
  }

  return true;
}

/**
 * Strips series tags like "(North Falls, #1)" or "(Vicious Lost Boys Book 2)" from book titles
 */
export function cleanTitleForSearch(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*/g, " ").trim();
}

/**
 * Fetches verified cover, blurb, and publication metadata from Open Library.
 * Prioritizes direct ISBN lookup, then falls back to English-first Title + Author edition search.
 */
export async function enrichBookDetails(
  title: string,
  author: string,
  isbn?: string | null
): Promise<EnrichedBookDetails | null> {
  try {
    let searchUrl = "";

    // 1. If clean ISBN is available, query directly by ISBN
    if (isbn && isbn.length >= 10) {
      searchUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": "GoodBetterBestReads/1.0 (contact@goodbetterbestreads.com)" },
      });

      if (res.ok) {
        const data = await res.json();
        const bookKey = `ISBN:${isbn}`;
        if (data[bookKey]) {
          const item = data[bookKey];
          return {
            title: item.title || title,
            author: item.authors?.[0]?.name || author,
            coverUrl: item.cover?.large || item.cover?.medium || null,
            description: typeof item.notes === "string" ? item.notes : null,
            genres: (item.subjects || []).slice(0, 5).map((s: { name: string }) => s.name),
            pageCount: item.number_of_pages || null,
            publishedYear: parsePublishYear(item.publish_date),
            openLibraryKey: item.key || null,
          };
        }
      }
    }

    // 2. Fallback: Search by clean Title and Author with English-first edition prioritization
    const cleanTitle = cleanTitleForSearch(title);

    // Prefer structured title & author search first to prevent broad full-text matching
    searchUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(
      cleanTitle
    )}&author=${encodeURIComponent(
      author
    )}&fields=key,title,author_name,cover_i,language,editions,subject,number_of_pages_median,first_publish_year&limit=5`;

    let searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "GoodBetterBestReads/1.0 (contact@goodbetterbestreads.com)" },
      signal: AbortSignal.timeout(8000),
    });

    let searchData = searchRes.ok ? await searchRes.json() : null;
    let docs: any[] = searchData?.docs || [];

    // Fall back to combined query if structured search returned nothing
    if (docs.length === 0) {
      searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(
        `${cleanTitle} ${author}`
      )}&fields=key,title,author_name,cover_i,language,editions,subject,number_of_pages_median,first_publish_year&limit=5`;
      searchRes = await fetch(searchUrl, {
        headers: { "User-Agent": "GoodBetterBestReads/1.0 (contact@goodbetterbestreads.com)" },
        signal: AbortSignal.timeout(8000),
      });
      searchData = searchRes.ok ? await searchRes.json() : null;
      docs = searchData?.docs || [];
    }

    // Strictly verify document identity to reject false positives (e.g. unrelated comic books or old scans)
    const doc = docs.find((d) => isBookMatch(cleanTitle, author, d));
    if (!doc) return null;

    // Inspect child editions to prioritize an English ('eng') cover over foreign translations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editions: any[] = doc.editions?.docs || [];
    const engEdition = editions.find(
      (e) => e.cover_i && (e.language?.includes("eng") || e.language?.includes("en"))
    );

    const coverId = engEdition?.cover_i || doc.cover_i;

    return {
      title: doc.title || title,
      author: doc.author_name?.[0] || author,
      coverUrl: getCoverUrl(coverId),
      description: null,
      genres: (doc.subject || []).slice(0, 5),
      pageCount: doc.number_of_pages_median || null,
      publishedYear: doc.first_publish_year || null,
      openLibraryKey: doc.key || null,
    };
  } catch (err) {
    console.error(`Failed to enrich book "${title}" by ${author}:`, err);
    return null;
  }
}