import { describe, it, expect } from "vitest";
import {
  isBadCoverUrl,
  cleanTitleForCoverSearch,
  sanitizeAmazonCoverUrl,
  resolveBookCover,
  KNOWN_BAD_COVER_IDS,
  isStudyGuideOrJunk,
} from "../services/books/cover-service";

describe("Cover Service - 3-Tier Resolution Engine", () => {
  describe("isBadCoverUrl", () => {
    it("identifies null or undefined as bad/missing", () => {
      expect(isBadCoverUrl(null)).toBe(true);
      expect(isBadCoverUrl(undefined)).toBe(true);
      expect(isBadCoverUrl("")).toBe(true);
    });

    it("flags generic Goodreads nophoto placeholders", () => {
      expect(
        isBadCoverUrl("https://s.gr-assets.com/assets/nophoto/book/111x148-bcc042a9c91a29c1d680899eff700a03.png")
      ).toBe(true);
    });

    it("flags known Open Library mobile screenshots and junk IDs", () => {
      for (const badId of KNOWN_BAD_COVER_IDS) {
        expect(isBadCoverUrl(`https://covers.openlibrary.org/b/id/${badId}-L.jpg`)).toBe(true);
        expect(isBadCoverUrl(`https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1723769734i/${badId}.jpg`)).toBe(true);
      }
    });

    it("accepts valid high-resolution covers", () => {
      expect(
        isBadCoverUrl(
          "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1705506392i/205514089.jpg"
        )
      ).toBe(false);
      expect(isBadCoverUrl("https://covers.openlibrary.org/b/id/12860070-L.jpg")).toBe(false);
    });
  });

  describe("isStudyGuideOrJunk", () => {
    it("detects SuperSummary study guide titles and authors", () => {
      expect(isStudyGuideOrJunk("Study Guide: The Ritual by Shantel Tessier", "SuperSummary")).toBe(true);
      expect(isStudyGuideOrJunk("Study Guide: Hexed", "SuperSummary")).toBe(true);
      expect(isStudyGuideOrJunk("Summary of King of Battle and Blood", "BookRags")).toBe(true);
      expect(isStudyGuideOrJunk("The Great Gatsby SparkNotes Literature Guide", "SparkNotes")).toBe(true);
    });

    it("detects box set and collection set collages", () => {
      expect(isStudyGuideOrJunk("Hades x Persephone Saga 6 Books Collection Set", "Scarlett St. Clair")).toBe(true);
      expect(isStudyGuideOrJunk("Scarlett St Clair Hades X Persephone 5 Books Collection Set", "Scarlett St. Clair")).toBe(true);
      expect(isStudyGuideOrJunk("Cat and Mouse Duet Box Set", "H.D. Carlton")).toBe(true);
    });

    it("passes genuine books and authors", () => {
      expect(isStudyGuideOrJunk("The Ritual", "Shantel Tessier")).toBe(false);
      expect(isStudyGuideOrJunk("King of Battle and Blood", "Scarlett St. Clair")).toBe(false);
      expect(isStudyGuideOrJunk("Hexed", "Emily McIntire")).toBe(false);
      expect(isStudyGuideOrJunk("Queen of Myth and Monsters", "Scarlett St. Clair")).toBe(false);
      expect(isStudyGuideOrJunk("A Game of Retribution", "Scarlett St. Clair")).toBe(false);
    });
  });

  describe("cleanTitleForCoverSearch", () => {
    it("strips parenthetical series tags", () => {
      expect(cleanTitleForCoverSearch("Where's Molly (Cat and Mouse, #2.5)")).toBe("Where's Molly");
      expect(cleanTitleForCoverSearch("The Never King (Vicious Lost Boys, #1)")).toBe("The Never King");
    });

    it("strips format qualifiers", () => {
      expect(cleanTitleForCoverSearch("Does It Hurt? (Kindle Edition)")).toBe("Does It Hurt?");
    });

    it("strips brackets and common subtitle markers", () => {
      expect(cleanTitleForCoverSearch("Haunting Adeline [Special Edition]")).toBe("Haunting Adeline");
      expect(cleanTitleForCoverSearch("The Shining: A Novel")).toBe("The Shining");
    });
  });

  describe("sanitizeAmazonCoverUrl", () => {
    it("removes dimension compression modifiers to yield full resolution", () => {
      const compressed =
        "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1630917669i/58934508._SX98_.jpg";
      const sanitized = sanitizeAmazonCoverUrl(compressed);
      expect(sanitized).toBe(
        "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1630917669i/58934508.jpg"
      );
    });

    it("leaves already full-resolution URLs untouched", () => {
      const fullRes =
        "https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1705506392i/205514089.jpg";
      expect(sanitizeAmazonCoverUrl(fullRes)).toBe(fullRes);
    });
  });

  describe("resolveBookCover waterfall", () => {
    it("returns Goodreads Amazon CDN cover when valid goodreadsId is provided", async () => {
      // Where's Molly Goodreads ID
      const result = await resolveBookCover({
        goodreadsId: "205514089",
        title: "Where's Molly",
        author: "H.D. Carlton",
      });

      expect(["goodreads", "google_books", "open_library"]).toContain(result.source);
      expect(result.coverUrl).toBeTruthy();
      expect(isBadCoverUrl(result.coverUrl)).toBe(false);
    }, 15000);

    it("gracefully falls back when book has no Goodreads ID or matches Open Library", async () => {
      const result = await resolveBookCover({
        title: "Does It Hurt?",
        author: "H.D. Carlton",
        isbn: "1957635029",
      });

      // Should find either Google Books or Open Library
      expect(result.coverUrl).toBeTruthy();
      expect(isBadCoverUrl(result.coverUrl)).toBe(false);
    }, 15000);

    it("rejects SuperSummary study guide and box set IDs even if passed as goodreadsId", async () => {
      // SuperSummary ID for The Ritual
      const studyGuideResult = await resolveBookCover({
        goodreadsId: "217513150",
        title: "The Ritual",
        author: "Shantel Tessier",
      });

      // Must reject the study guide cover
      expect(studyGuideResult.coverUrl ?? "").not.toContain("217513150");

      // Box set collage ID for Queen of Myth and Monsters
      const boxSetResult = await resolveBookCover({
        goodreadsId: "196767944",
        title: "Queen of Myth and Monsters",
        author: "Scarlett St. Clair",
        isbn: "1728259673",
      });

      // Must reject the box set cover and resolve official Amazon CDN publisher cover
      expect(boxSetResult.coverUrl ?? "").not.toContain("196767944");
      expect(boxSetResult.coverUrl).toContain("1728259673");
    }, 15000);
  });
});
