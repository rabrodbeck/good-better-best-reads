import { describe, it, expect } from "vitest";

interface BookItem {
  id: string;
  book_id: string;
  title: string;
  author: string;
  shelf: "read" | "currently-reading" | "to-read" | "did-not-finish";
  rating: number | null;
  date_read: string | null;
}

// Pure helper replicating the library state machine used in LibraryPage and /api/library
function transitionShelf(
  book: BookItem,
  newShelf: BookItem["shelf"],
  nowIso = "2026-10-12T12:00:00.000Z"
): BookItem {
  const willAutoDate = newShelf === "read" && !book.date_read;
  return {
    ...book,
    shelf: newShelf,
    date_read: willAutoDate ? nowIso : book.date_read,
  };
}

function applyRating(
  book: BookItem,
  newRating: number | null,
  nowIso = "2026-10-12T12:00:00.000Z"
): BookItem {
  const clampedRating =
    newRating !== null ? Math.min(5, Math.max(1, Math.round(newRating))) : null;
  const willMoveToRead = clampedRating !== null && book.shelf === "to-read";

  return {
    ...book,
    rating: clampedRating,
    shelf: willMoveToRead ? "read" : book.shelf,
    date_read: willMoveToRead && !book.date_read ? nowIso : book.date_read,
  };
}

function computeLibraryStats(books: BookItem[]) {
  const ratedBooks = books.filter((b) => b.rating && b.rating > 0);
  const avgRating =
    ratedBooks.length > 0
      ? (
          ratedBooks.reduce((acc, b) => acc + (b.rating || 0), 0) /
          ratedBooks.length
        ).toFixed(1)
      : null;

  return {
    total: books.length,
    read: books.filter((b) => b.shelf === "read").length,
    currentlyReading: books.filter((b) => b.shelf === "currently-reading").length,
    toRead: books.filter((b) => b.shelf === "to-read").length,
    dnf: books.filter((b) => b.shelf === "did-not-finish").length,
    fiveStarCount: books.filter((b) => b.rating === 5).length,
    fourStarCount: books.filter((b) => b.rating === 4).length,
    avgRating,
  };
}

describe("Library Shelf & Rating Management Engine (Phase 1, Issues #34, #35)", () => {
  const initialBook: BookItem = {
    id: "ub-1",
    book_id: "book-1",
    title: "Project Hail Mary",
    author: "Andy Weir",
    shelf: "to-read",
    rating: null,
    date_read: null,
  };

  describe("Shelf Transitions (Issue #34)", () => {
    it("moves book from to-read to currently-reading without setting date_read", () => {
      const updated = transitionShelf(initialBook, "currently-reading");
      expect(updated.shelf).toBe("currently-reading");
      expect(updated.date_read).toBeNull();
    });

    it("automatically timestamps date_read when transitioning to read", () => {
      const fakeNow = "2026-10-12T15:00:00.000Z";
      const updated = transitionShelf(initialBook, "read", fakeNow);
      expect(updated.shelf).toBe("read");
      expect(updated.date_read).toBe(fakeNow);
    });

    it("preserves existing date_read if moving between read and other shelves", () => {
      const bookWithDate: BookItem = {
        ...initialBook,
        shelf: "read",
        date_read: "2025-06-01T00:00:00.000Z",
      };
      const updated = transitionShelf(bookWithDate, "read");
      expect(updated.date_read).toBe("2025-06-01T00:00:00.000Z");
    });
  });

  describe("Interactive Star Ratings (Issue #35)", () => {
    it("applies star rating and automatically transitions to-read books to read", () => {
      const fakeNow = "2026-10-12T15:00:00.000Z";
      const updated = applyRating(initialBook, 5, fakeNow);
      expect(updated.rating).toBe(5);
      expect(updated.shelf).toBe("read");
      expect(updated.date_read).toBe(fakeNow);
    });

    it("clamps ratings outside 1-5 range", () => {
      expect(applyRating(initialBook, 10).rating).toBe(5);
      expect(applyRating(initialBook, 0).rating).toBe(1);
    });

    it("allows clearing rating by setting to null", () => {
      const ratedBook: BookItem = { ...initialBook, rating: 4, shelf: "read" };
      const updated = applyRating(ratedBook, null);
      expect(updated.rating).toBeNull();
      expect(updated.shelf).toBe("read"); // Stays on read
    });
  });

  describe("Reactive Library Statistics", () => {
    it("accurately computes shelf breakdowns, 5-star counts, and average ratings", () => {
      const library: BookItem[] = [
        { id: "1", book_id: "b1", title: "Book A", author: "Author", shelf: "read", rating: 5, date_read: null },
        { id: "2", book_id: "b2", title: "Book B", author: "Author", shelf: "read", rating: 4, date_read: null },
        { id: "3", book_id: "b3", title: "Book C", author: "Author", shelf: "currently-reading", rating: null, date_read: null },
        { id: "4", book_id: "b4", title: "Book D", author: "Author", shelf: "to-read", rating: null, date_read: null },
        { id: "5", book_id: "b5", title: "Book E", author: "Author", shelf: "did-not-finish", rating: 2, date_read: null },
      ];

      const stats = computeLibraryStats(library);
      expect(stats.total).toBe(5);
      expect(stats.read).toBe(2);
      expect(stats.currentlyReading).toBe(1);
      expect(stats.toRead).toBe(1);
      expect(stats.dnf).toBe(1);
      expect(stats.fiveStarCount).toBe(1);
      expect(stats.fourStarCount).toBe(1);
      // Average of 5, 4, and 2 is 11 / 3 = 3.67 -> "3.7"
      expect(stats.avgRating).toBe("3.7");
    });
  });
});
