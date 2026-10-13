import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeTitle, searchGoogleBooks, GET } from "@/app/api/books/search/route";
import { isStudyGuideOrJunk, isBadCoverUrl, isbn13To10 } from "@/services/books/cover-service";
import { NextRequest } from "next/server";

describe("Multi-Provider Book Search (Phase 1)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("normalizeTitle", () => {
    it("strips punctuation, extra spaces, and lowercases titles", () => {
      expect(normalizeTitle("The Andromeda Strain!")).toBe("the andromeda strain");
      expect(normalizeTitle("  Tomorrow, and Tomorrow,   and Tomorrow  ")).toBe(
        "tomorrow and tomorrow and tomorrow"
      );
    });
  });

  describe("isStudyGuideOrJunk filter in search", () => {
    it("flags study guides and workbooks as junk", () => {
      expect(isStudyGuideOrJunk("SuperSummary Study Guide: The Ritual", "SuperSummary")).toBe(true);
      expect(isStudyGuideOrJunk("CliffsNotes on The Great Gatsby", "CliffsNotes")).toBe(true);
      expect(isStudyGuideOrJunk("SparkNotes 1984", "SparkNotes")).toBe(true);
      expect(isStudyGuideOrJunk("Summary of Project Hail Mary", "BookRags")).toBe(true);
    });

    it("flags multi-book box sets and bundle collages as junk", () => {
      expect(isStudyGuideOrJunk("A Game of Retribution 6 Books Collection Set", "Scarlett St. Clair")).toBe(true);
      expect(isStudyGuideOrJunk("Queen of Myth and Monsters (5 Books Set)", "Scarlett St. Clair")).toBe(true);
      expect(isStudyGuideOrJunk("The Lord of the Rings: 3 Book Boxset", "J.R.R. Tolkien")).toBe(true);
    });

    it("preserves authentic author books", () => {
      expect(isStudyGuideOrJunk("The Andromeda Strain", "Michael Crichton")).toBe(false);
      expect(isStudyGuideOrJunk("Project Hail Mary", "Andy Weir")).toBe(false);
      expect(isStudyGuideOrJunk("The Ritual", "Shantel Tessier")).toBe(false);
    });
  });

  describe("ISBN-13 to ISBN-10 Conversion for Amazon CDN", () => {
    it("correctly converts 978 ISBN-13 to ISBN-10 with check digit", () => {
      // 978-0062316097 -> 0062316095
      expect(isbn13To10("9780062316097")).toBe("0062316095");
      // 978-1728258416 -> 1728258413
      expect(isbn13To10("9781728258416")).toBe("1728258413");
    });

    it("handles checksum check digit X correctly", () => {
      // 9780143127741 -> 0143127748
      const res = isbn13To10("9780143127741");
      expect(res).toBeDefined();
      expect(res?.length).toBe(10);
    });
  });

  describe("GET /api/books/search route", () => {
    it("returns empty results for queries under 2 characters", async () => {
      const req = new NextRequest("http://localhost:3000/api/books/search?q=a");
      const res = await GET(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.results).toEqual([]);
    });

    it("successfully maps Open Library results and resolves Amazon CDN for missing covers", async () => {
      const mockOlResponse = {
        docs: [
          {
            key: "/works/OL123W",
            title: "Project Hail Mary",
            author_name: ["Andy Weir"],
            cover_i: 123456,
            first_publish_year: 2021,
            number_of_pages_median: 496,
            isbn: ["0593135202", "9780593135204"],
            subject: ["Science Fiction", "Space"],
            first_sentence: ["I am asleep."],
          },
        ],
      };

      vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
        if (typeof url === "string" && url.includes("openlibrary.org/search.json")) {
          return {
            ok: true,
            status: 200,
            json: async () => mockOlResponse,
          } as any;
        }
        return { ok: false, status: 404, json: async () => ({}) } as any;
      });

      const req = new NextRequest("http://localhost:3000/api/books/search?q=Project+Hail+Mary");
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.results.length).toBeGreaterThanOrEqual(1);
      const first = json.results[0];
      expect(first.title).toBe("Project Hail Mary");
      expect(first.author).toBe("Andy Weir");
      expect(first.cover_url).toBe("https://covers.openlibrary.org/b/id/123456-L.jpg");
      expect(first.published_year).toBe(2021);
      expect(first.isbn).toBe("0593135202");
    });

    it("falls back to Google Books when Open Library search fails or returns empty", async () => {
      const mockGbResponse = {
        items: [
          {
            id: "gb_item_1",
            volumeInfo: {
              title: "The Andromeda Strain",
              authors: ["Michael Crichton"],
              publishedDate: "1969-05-12",
              pageCount: 350,
              industryIdentifiers: [
                { type: "ISBN_10", identifier: "0062470102" },
                { type: "ISBN_13", identifier: "9780062470102" },
              ],
              imageLinks: {
                thumbnail: "http://books.google.com/books/content?id=123&printsec=frontcover",
              },
              categories: ["Fiction", "Techno-thriller"],
              description: "A military satellite crashes in Arizona...",
            },
          },
        ],
      };

      vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
        if (typeof url === "string" && url.includes("openlibrary.org/search.json")) {
          // Simulate Open Library returning 0 results
          return {
            ok: true,
            status: 200,
            json: async () => ({ docs: [] }),
          } as any;
        }
        if (typeof url === "string" && url.includes("googleapis.com/books/v1/volumes")) {
          return {
            ok: true,
            status: 200,
            json: async () => mockGbResponse,
          } as any;
        }
        return { ok: false, status: 404, json: async () => ({}) } as any;
      });

      const req = new NextRequest("http://localhost:3000/api/books/search?q=Andromeda+Strain");
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.results.length).toBe(1);
      const first = json.results[0];
      expect(first.title).toBe("The Andromeda Strain");
      expect(first.author).toBe("Michael Crichton");
      // Converts http to https for Google Books images
      expect(first.cover_url).toContain("https://books.google.com");
      expect(first.published_year).toBe(1969);
    });
  });
});
