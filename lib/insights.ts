/**
 * Reading Insights & Visual Analytics Engine (Issue #42)
 * Pure computation of monthly velocity, rating distribution, literary milestones,
 * top genres, top authors, and reading velocity.
 */

export interface InsightBookItem {
  id: string;
  book_id: string;
  title: string;
  author: string;
  cover_url?: string | null;
  rating?: number | null;
  page_count?: number | null;
  genres?: string[] | null;
  date_read?: string | null;
  published_year?: number | null;
}

export interface MonthlyVelocityItem {
  month: string;
  monthIndex: number;
  count: number;
  pages: number;
}

export interface RatingBreakdown {
  stars5: number;
  stars4: number;
  stars3: number;
  stars2: number;
  stars1: number;
  unrated: number;
  totalRated: number;
  averageRating: number | null;
  generosityRate: number; // percentage of rated books that are 4 or 5 stars
}

export interface LiteraryMilestone {
  pages: number;
  comparisonText: string;
  iconName: string;
}

export interface AuthorStats {
  author: string;
  count: number;
  avgRating: number | null;
}

export interface GenreStats {
  genre: string;
  count: number;
  percentage: number;
}

export interface ReadingInsightsData {
  year: number | "all";
  totalBooks: number;
  totalPages: number;
  avgPagesPerBook: number;
  monthlyVelocity: MonthlyVelocityItem[];
  ratings: RatingBreakdown;
  milestone: LiteraryMilestone;
  topAuthors: AuthorStats[];
  topGenres: GenreStats[];
  shortestBook: { title: string; author: string; pages: number; coverUrl?: string | null } | null;
  longestBook: { title: string; author: string; pages: number; coverUrl?: string | null } | null;
  booksPerMonthAvg: number;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function calculateLiteraryMilestone(totalPages: number): LiteraryMilestone {
  if (totalPages <= 0) {
    return {
      pages: 0,
      comparisonText: "Ready for your first reading adventure of the year!",
      iconName: "BookOpen",
    };
  }

  if (totalPages < 1000) {
    return {
      pages: totalPages,
      comparisonText: `Equivalent to reading George Orwell's '1984' ${Math.max(1, Math.round((totalPages / 328) * 10) / 10)} times!`,
      iconName: "Feather",
    };
  }

  if (totalPages < 3000) {
    const lotr = Math.round((totalPages / 1178) * 10) / 10;
    return {
      pages: totalPages,
      comparisonText: `You've read equivalent to ${lotr}x 'The Lord of the Rings' trilogy!`,
      iconName: "Sparkles",
    };
  }

  if (totalPages < 6000) {
    const hpCount = Math.round((totalPages / 4224) * 100) / 100;
    return {
      pages: totalPages,
      comparisonText: `That's equivalent to ${(hpCount * 100).toFixed(0)}% of the entire Harry Potter 7-book series!`,
      iconName: "Flame",
    };
  }

  if (totalPages < 12000) {
    const warAndPeace = Math.round((totalPages / 1225) * 10) / 10;
    return {
      pages: totalPages,
      comparisonText: `You've conquered the equivalent of ${warAndPeace} full copies of Tolstoy's 'War and Peace'!`,
      iconName: "Crown",
    };
  }

  const stackFeet = Math.round((totalPages / 300) * 0.75 * 10) / 10;
  return {
    pages: totalPages,
    comparisonText: `A towering literary fortress—equivalent to a stack of books over ${stackFeet} feet tall!`,
    iconName: "Trophy",
  };
}

export function computeReadingInsights(
  books: InsightBookItem[],
  targetYear?: number | "all"
): ReadingInsightsData {
  const yearFilter = targetYear !== undefined ? targetYear : new Date().getFullYear();

  // Filter books by date_read year if not "all"
  const filteredBooks = books.filter((book) => {
    if (yearFilter === "all") return true;

    if (book.date_read) {
      const readDate = new Date(book.date_read);
      if (!isNaN(readDate.getTime())) {
        return readDate.getFullYear() === yearFilter;
      }
    }
    return false;
  });

  const totalBooks = filteredBooks.length;

  // Pages analysis
  let totalPages = 0;
  let booksWithPages = 0;
  let shortest: InsightBookItem | null = null;
  let longest: InsightBookItem | null = null;

  for (const b of filteredBooks) {
    if (b.page_count && b.page_count > 0) {
      totalPages += b.page_count;
      booksWithPages++;

      if (!shortest || b.page_count < (shortest.page_count || Infinity)) {
        shortest = b;
      }
      if (!longest || b.page_count > (longest.page_count || 0)) {
        longest = b;
      }
    }
  }

  const avgPagesPerBook = booksWithPages > 0 ? Math.round(totalPages / booksWithPages) : 0;

  // Monthly velocity (0 = Jan, 11 = Dec)
  const monthlyVelocity: MonthlyVelocityItem[] = MONTH_NAMES.map((month, idx) => ({
    month,
    monthIndex: idx,
    count: 0,
    pages: 0,
  }));

  for (const b of filteredBooks) {
    if (b.date_read) {
      const d = new Date(b.date_read);
      if (!isNaN(d.getTime())) {
        const m = d.getMonth();
        if (m >= 0 && m < 12) {
          monthlyVelocity[m].count++;
          monthlyVelocity[m].pages += b.page_count || 0;
        }
      }
    }
  }

  // Rating breakdown
  let stars5 = 0;
  let stars4 = 0;
  let stars3 = 0;
  let stars2 = 0;
  let stars1 = 0;
  let unrated = 0;
  let ratingSum = 0;
  let ratedCount = 0;

  for (const b of filteredBooks) {
    if (typeof b.rating === "number" && b.rating > 0) {
      ratedCount++;
      ratingSum += b.rating;
      const r = Math.round(b.rating);
      if (r >= 5) stars5++;
      else if (r === 4) stars4++;
      else if (r === 3) stars3++;
      else if (r === 2) stars2++;
      else if (r <= 1) stars1++;
    } else {
      unrated++;
    }
  }

  const averageRating = ratedCount > 0 ? Math.round((ratingSum / ratedCount) * 10) / 10 : null;
  const generosityRate = ratedCount > 0 ? Math.round(((stars5 + stars4) / ratedCount) * 100) : 0;

  const ratings: RatingBreakdown = {
    stars5,
    stars4,
    stars3,
    stars2,
    stars1,
    unrated,
    totalRated: ratedCount,
    averageRating,
    generosityRate,
  };

  // Top Authors
  const authorMap = new Map<string, { count: number; ratingSum: number; ratedCount: number }>();
  for (const b of filteredBooks) {
    if (!b.author) continue;
    const author = b.author.trim();
    const entry = authorMap.get(author) || { count: 0, ratingSum: 0, ratedCount: 0 };
    entry.count++;
    if (typeof b.rating === "number" && b.rating > 0) {
      entry.ratingSum += b.rating;
      entry.ratedCount++;
    }
    authorMap.set(author, entry);
  }

  const topAuthors: AuthorStats[] = Array.from(authorMap.entries())
    .map(([author, data]) => ({
      author,
      count: data.count,
      avgRating: data.ratedCount > 0 ? Math.round((data.ratingSum / data.ratedCount) * 10) / 10 : null,
    }))
    .sort((a, b) => b.count - a.count || (b.avgRating || 0) - (a.avgRating || 0))
    .slice(0, 8);

  // Top Genres
  const genreMap = new Map<string, number>();
  for (const b of filteredBooks) {
    if (Array.isArray(b.genres)) {
      for (const g of b.genres) {
        if (!g) continue;
        const clean = g.trim();
        genreMap.set(clean, (genreMap.get(clean) || 0) + 1);
      }
    }
  }

  const topGenres: GenreStats[] = Array.from(genreMap.entries())
    .map(([genre, count]) => ({
      genre,
      count,
      percentage: totalBooks > 0 ? Math.round((count / totalBooks) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const monthsElapsed = yearFilter === new Date().getFullYear()
    ? Math.max(1, new Date().getMonth() + 1)
    : 12;

  const booksPerMonthAvg = Math.round((totalBooks / monthsElapsed) * 10) / 10;

  return {
    year: yearFilter,
    totalBooks,
    totalPages,
    avgPagesPerBook,
    monthlyVelocity,
    ratings,
    milestone: calculateLiteraryMilestone(totalPages),
    topAuthors,
    topGenres,
    shortestBook: shortest
      ? {
          title: shortest.title,
          author: shortest.author,
          pages: shortest.page_count || 0,
          coverUrl: shortest.cover_url,
        }
      : null,
    longestBook: longest
      ? {
          title: longest.title,
          author: longest.author,
          pages: longest.page_count || 0,
          coverUrl: longest.cover_url,
        }
      : null,
    booksPerMonthAvg,
  };
}
