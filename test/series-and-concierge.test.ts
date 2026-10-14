import { describe, it, expect } from "vitest";
import {
  parseSeriesInfo,
  groupBooksBySeries,
  LibraryBookForSeries,
} from "@/lib/series";

describe("Phase 3: Series Tracking & Progression Engine (Issue #40)", () => {
  describe("parseSeriesInfo", () => {
    it("parses standard series pattern with comma and hash (e.g. Adrian X Isolde, #2)", () => {
      const res = parseSeriesInfo("Queen of Myth and Monsters (Adrian X Isolde, #2)");
      expect(res).not.toBeNull();
      expect(res?.cleanTitle).toBe("Queen of Myth and Monsters");
      expect(res?.seriesName).toBe("Adrian X Isolde");
      expect(res?.volume).toBe(2);
      expect(res?.displaySeries).toBe("Adrian X Isolde #2");
    });

    it("parses volume with Book prefix (e.g. Dune Chronicles, Book 1)", () => {
      const res = parseSeriesInfo("Dune (Dune Chronicles, Book 1)");
      expect(res).not.toBeNull();
      expect(res?.cleanTitle).toBe("Dune");
      expect(res?.seriesName).toBe("Dune Chronicles");
      expect(res?.volume).toBe(1);
      expect(res?.displaySeries).toBe("Dune Chronicles #1");
    });

    it("parses volume with no comma before hash (e.g. The Hunger Games #2)", () => {
      const res = parseSeriesInfo("Catching Fire (The Hunger Games #2)");
      expect(res).not.toBeNull();
      expect(res?.cleanTitle).toBe("Catching Fire");
      expect(res?.seriesName).toBe("The Hunger Games");
      expect(res?.volume).toBe(2);
      expect(res?.displaySeries).toBe("The Hunger Games #2");
    });

    it("parses decimal / prequel volumes (e.g. Throne of Glass, #0.5)", () => {
      const res = parseSeriesInfo("The Assassin's Blade (Throne of Glass, #0.5)");
      expect(res).not.toBeNull();
      expect(res?.cleanTitle).toBe("The Assassin's Blade");
      expect(res?.seriesName).toBe("Throne of Glass");
      expect(res?.volume).toBe(0.5);
      expect(res?.displaySeries).toBe("Throne of Glass #0.5");
    });

    it("ignores non-series parenthetical subtitles like '(A Novel)' or '(Memoir)'", () => {
      expect(parseSeriesInfo("A Gentleman in Moscow (A Novel)")).toBeNull();
      expect(parseSeriesInfo("Educated (Memoir)")).toBeNull();
      expect(parseSeriesInfo("The Hobbit (Illustrated Edition)")).toBeNull();
    });

    it("handles trilogy/chronicles mentions without a specific volume number", () => {
      const res = parseSeriesInfo("The Fellowship of the Ring (The Lord of the Rings Trilogy)");
      expect(res).not.toBeNull();
      expect(res?.cleanTitle).toBe("The Fellowship of the Ring");
      expect(res?.seriesName).toBe("The Lord of the Rings Trilogy");
      expect(res?.volume).toBeNull();
    });

    it("returns null for titles without parentheses", () => {
      expect(parseSeriesInfo("Project Hail Mary")).toBeNull();
      expect(parseSeriesInfo("Neuromancer")).toBeNull();
      expect(parseSeriesInfo("")).toBeNull();
    });
  });

  describe("groupBooksBySeries", () => {
    const mockBooks: LibraryBookForSeries[] = [
      {
        id: "b1",
        book_id: "book-1",
        title: "King of Battle and Blood (Adrian X Isolde, #1)",
        author: "Scarlett St. Clair",
        shelf: "read",
        rating: 4,
      },
      {
        id: "b2",
        book_id: "book-2",
        title: "Queen of Myth and Monsters (Adrian X Isolde, #2)",
        author: "Scarlett St. Clair",
        shelf: "currently-reading",
        rating: null,
      },
      {
        id: "b3",
        book_id: "book-3",
        title: "The Never King (Vicious Lost Boys, #1)",
        author: "Nikki St. Crowe",
        shelf: "read",
        rating: 5,
      },
      {
        id: "b4",
        book_id: "book-4",
        title: "The Dark One (Vicious Lost Boys, #2)",
        author: "Nikki St. Crowe",
        shelf: "read",
        rating: 4,
      },
      {
        id: "b5",
        book_id: "book-5",
        title: "Their Vicious Darling (Vicious Lost Boys, #3)",
        author: "Nikki St. Crowe",
        shelf: "to-read",
        rating: null,
      },
      {
        id: "b6",
        book_id: "book-6",
        title: "Project Hail Mary",
        author: "Andy Weir",
        shelf: "read",
        rating: 5,
      },
    ];

    it("groups books correctly by parsed series name and ignores standalone books", () => {
      const groups = groupBooksBySeries(mockBooks);
      const seriesNames = groups.map((g) => g.seriesName);

      expect(seriesNames).toContain("Adrian X Isolde");
      expect(seriesNames).toContain("Vicious Lost Boys");
      expect(seriesNames).not.toContain("Project Hail Mary");
    });

    it("sorts volumes chronologically within a series group", () => {
      const groups = groupBooksBySeries(mockBooks);
      const vlb = groups.find((g) => g.seriesName === "Vicious Lost Boys");

      expect(vlb).toBeDefined();
      expect(vlb?.books.length).toBe(3);
      expect(vlb?.books[0].seriesInfo.volume).toBe(1);
      expect(vlb?.books[1].seriesInfo.volume).toBe(2);
      expect(vlb?.books[2].seriesInfo.volume).toBe(3);
    });

    it("calculates completion percentage and status flags accurately", () => {
      const groups = groupBooksBySeries(mockBooks);
      const axi = groups.find((g) => g.seriesName === "Adrian X Isolde");
      const vlb = groups.find((g) => g.seriesName === "Vicious Lost Boys");

      // Adrian X Isolde: 1 of 2 read = 50%
      expect(axi?.totalCount).toBe(2);
      expect(axi?.readCount).toBe(1);
      expect(axi?.completionPercentage).toBe(50);
      expect(axi?.isComplete).toBe(false);

      // Vicious Lost Boys: 2 of 3 read = 67%
      expect(vlb?.totalCount).toBe(3);
      expect(vlb?.readCount).toBe(2);
      expect(vlb?.completionPercentage).toBe(67);
      expect(vlb?.isComplete).toBe(false);
    });

    it("determines nextBookToRead prioritizing currently-reading over unread queue", () => {
      const groups = groupBooksBySeries(mockBooks);
      const axi = groups.find((g) => g.seriesName === "Adrian X Isolde");
      const vlb = groups.find((g) => g.seriesName === "Vicious Lost Boys");

      // Adrian X Isolde #2 is currently-reading -> should be nextBookToRead
      expect(axi?.nextBookToRead?.seriesInfo.volume).toBe(2);
      expect(axi?.nextBookToRead?.shelf).toBe("currently-reading");

      // Vicious Lost Boys: #1 & #2 are read, #3 is to-read -> #3 is nextBookToRead
      expect(vlb?.nextBookToRead?.seriesInfo.volume).toBe(3);
      expect(vlb?.nextBookToRead?.shelf).toBe("to-read");
    });

    it("marks completed series correctly when all volumes are read", () => {
      const allReadBooks: LibraryBookForSeries[] = [
        {
          id: "b1",
          book_id: "book-1",
          title: "The Hunger Games (The Hunger Games, #1)",
          author: "Suzanne Collins",
          shelf: "read",
        },
        {
          id: "b2",
          book_id: "book-2",
          title: "Catching Fire (The Hunger Games, #2)",
          author: "Suzanne Collins",
          shelf: "read",
        },
      ];

      const groups = groupBooksBySeries(allReadBooks);
      expect(groups[0].isComplete).toBe(true);
      expect(groups[0].completionPercentage).toBe(100);
      expect(groups[0].nextBookToRead).toBeNull();
    });
  });
});
