import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface SearchResultItem {
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
          headers: { "User-Agent": "GoodBetterBestReads/1.0" },
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
      return NextResponse.json({ results: [] });
    }

    const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(
      query
    )}&limit=12&fields=key,title,author_name,cover_i,first_publish_year,number_of_pages_median,isbn,subject,first_sentence,language,editions`;

    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "GoodBetterBestReads/1.0 (contact@goodbetterbestreads.com)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Open Library responded with status ${res.status}`, results: [] },
        { status: 502 }
      );
    }

    const data = await res.json();
    const docs = Array.isArray(data.docs) ? data.docs : [];

    const results: SearchResultItem[] = docs.map((doc: any) => {
      // 1. Cover URL resolution: prioritize cover_i, then check child editions, then ISBN
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

      if (!coverUrl && (isbn13 || isbn10)) {
        const isbnToUse = isbn13 || isbn10;
        coverUrl = `https://covers.openlibrary.org/b/isbn/${isbnToUse}-L.jpg?default=false`;
      }

      // 3. First sentence / snippet preview
      let snippet: string | null = null;
      if (Array.isArray(doc.first_sentence) && doc.first_sentence.length > 0) {
        snippet = doc.first_sentence[0];
      } else if (typeof doc.first_sentence === "string") {
        snippet = doc.first_sentence;
      }

      return {
        key: doc.key || "",
        title: doc.title || "Untitled",
        author: Array.isArray(doc.author_name) ? doc.author_name[0] : (doc.author_name || "Unknown Author"),
        cover_url: coverUrl,
        published_year: doc.first_publish_year || null,
        page_count: doc.number_of_pages_median || null,
        isbn: isbn10,
        isbn13: isbn13,
        genres: Array.isArray(doc.subject) ? doc.subject.slice(0, 5) : [],
        snippet,
      };
    });

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("Open Library Search Error:", error);
    return NextResponse.json(
      { error: error?.message || "Search failed", results: [] },
      { status: 500 }
    );
  }
}
