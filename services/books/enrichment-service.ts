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
            publishedYear: item.publish_date ? parseInt(item.publish_date.slice(-4), 10) || null : null,
            openLibraryKey: item.key || null,
          };
        }
      }
    }

    // 2. Fallback: Search by clean Title and Author with English-first edition prioritization
    const cleanTitle = cleanTitleForSearch(title);
    const query = encodeURIComponent(`${cleanTitle} ${author}`);
    searchUrl = `https://openlibrary.org/search.json?q=${query}&fields=key,title,author_name,cover_i,language,editions&limit=3`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "GoodBetterBestReads/1.0" },
    });

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    if (!searchData.docs || searchData.docs.length === 0) return null;

    const doc = searchData.docs[0];

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