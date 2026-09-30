export type ReadingShelf = "read" | "currently-reading" | "to-read" | "did-not-finish";

export interface NormalizedBook {
    goodreadsId: string;
    title: string;
    cleanTitle: string;
    series: string | null;
    author: string;
    additionalAuthors: string[];
    isbn: string | null;
    isbn13: string | null;
    myRating: number; // 0 means unrated, 1-5 stars
    averageRating: number;
    publisher: string | null;
    binding: string | null;
    pageCount: number | null;
    yearPublished: number | null;
    originalPublicationYear: number | null;
    dateRead: string | null; // ISO Date String
    dateAdded: string | null; // ISO Date String
    shelf: ReadingShelf;
    userShelves: string[];
    userReview: string | null;
    readCount: number;
}

export interface IngestionStats {
    totalParsed: number;
    readCount: number;
    currentlyReadingCount: number;
    toReadCount: number;
    dnfCount: number;
    fiveStarCount: number;
    oneStarCount: number;
    unratedCount: number;
}

export interface ParseResult {
    books: NormalizedBook[];
    stats: IngestionStats;
    errors: string[];
}