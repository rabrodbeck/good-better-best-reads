/**
 * Friends & Taste Overlap Service (Issues #28, #29)
 * Pure helper functions and deterministic comparison algorithms.
 */

export interface TasteProfileData {
  archetype_name: string;
  archetype_summary?: string;
  preferred_pacing?: string | null;
  emotional_tone?: string | null;
  top_tropes?: string[];
  dealbreakers?: string[];
}

export interface UserBookData {
  id: string;
  book_id: string;
  shelf: string;
  rating: number | null;
  books?: {
    id: string;
    title: string;
    author: string;
    cover_url?: string | null;
  } | null;
}

export interface SharedRead {
  bookId: string;
  title: string;
  author: string;
  coverUrl: string | null;
  myRating: number | null;
  friendRating: number | null;
  ratingDiff: number | null;
}

export interface OverlapRecommendation {
  bookId: string;
  title: string;
  author: string;
  coverUrl: string | null;
  rating: number | null;
  reason: string;
}

export interface OverlapResult {
  sharedReads: SharedRead[];
  recommendationsForYou: OverlapRecommendation[];
  recommendationsForThem: OverlapRecommendation[];
  tasteComparison: {
    myArchetype: string;
    friendArchetype: string;
    myPacing: string | null;
    friendPacing: string | null;
    myTone: string | null;
    friendTone: string | null;
    sharedTropes: string[];
    uniqueToMeTropes: string[];
    uniqueToFriendTropes: string[];
    dealbreakerClashes: Array<{
      trope: string;
      lovedBy: "me" | "friend";
      dealbreakerFor: "friend" | "me";
    }>;
  };
  stats: {
    totalSharedReads: number;
    avgRatingDelta: number | null;
    tasteMatchPercentage: number;
  };
}

/**
 * Normalizes email strings for consistent lookup.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Computes deterministic catalog and taste overlap between two users.
 */
export function calculateTasteOverlap(
  myTaste: TasteProfileData | null,
  friendTaste: TasteProfileData | null,
  myBooks: UserBookData[],
  friendBooks: UserBookData[]
): OverlapResult {
  // 1. Index books by book_id
  const myBooksMap = new Map<string, UserBookData>();
  for (const b of myBooks) {
    if (b.book_id) myBooksMap.set(b.book_id, b);
  }

  const friendBooksMap = new Map<string, UserBookData>();
  for (const b of friendBooks) {
    if (b.book_id) friendBooksMap.set(b.book_id, b);
  }

  // 2. Shared Reads
  const sharedReads: SharedRead[] = [];
  let totalRatingDiff = 0;
  let ratedCount = 0;

  for (const [bookId, myBook] of myBooksMap.entries()) {
    const friendBook = friendBooksMap.get(bookId);
    if (!friendBook) continue;

    // Both have this book cataloged
    const bookInfo = myBook.books || friendBook.books;
    const myRating = myBook.rating ?? null;
    const friendRating = friendBook.rating ?? null;

    let diff: number | null = null;
    if (myRating !== null && friendRating !== null) {
      diff = Math.abs(myRating - friendRating);
      totalRatingDiff += diff;
      ratedCount++;
    }

    sharedReads.push({
      bookId,
      title: bookInfo?.title || "Unknown Title",
      author: bookInfo?.author || "Unknown Author",
      coverUrl: bookInfo?.cover_url || null,
      myRating,
      friendRating,
      ratingDiff: diff,
    });
  }

  // Sort shared reads by highest mutual rating
  sharedReads.sort((a, b) => {
    const aSum = (a.myRating || 0) + (a.friendRating || 0);
    const bSum = (b.myRating || 0) + (b.friendRating || 0);
    return bSum - aSum;
  });

  // 3. Recommendations For You (Books Friend rated highly that you haven't read)
  const recommendationsForYou: OverlapRecommendation[] = [];
  for (const friendBook of friendBooks) {
    if (!friendBook.book_id) continue;
    const myBook = myBooksMap.get(friendBook.book_id);

    const isHighRated = friendBook.rating && friendBook.rating >= 4;
    const isFriendRead = friendBook.shelf === "read" || isHighRated;

    if (isFriendRead) {
      const bookInfo = friendBook.books;
      if (!myBook) {
        recommendationsForYou.push({
          bookId: friendBook.book_id,
          title: bookInfo?.title || "Unknown Title",
          author: bookInfo?.author || "Unknown Author",
          coverUrl: bookInfo?.cover_url || null,
          rating: friendBook.rating,
          reason: `Rated ${friendBook.rating || 5}★ by friend`,
        });
      } else if (myBook.shelf === "to-read") {
        recommendationsForYou.push({
          bookId: friendBook.book_id,
          title: bookInfo?.title || "Unknown Title",
          author: bookInfo?.author || "Unknown Author",
          coverUrl: bookInfo?.cover_url || null,
          rating: friendBook.rating,
          reason: `On your Want to Read shelf (rated ${friendBook.rating || 5}★ by friend)`,
        });
      }
    }
  }

  // 4. Recommendations For Them (Books You rated highly that they haven't read)
  const recommendationsForThem: OverlapRecommendation[] = [];
  for (const myBook of myBooks) {
    if (!myBook.book_id) continue;
    const friendBook = friendBooksMap.get(myBook.book_id);

    const isHighRated = myBook.rating && myBook.rating >= 4;
    const isMyRead = myBook.shelf === "read" || isHighRated;

    if (isMyRead) {
      const bookInfo = myBook.books;
      if (!friendBook) {
        recommendationsForThem.push({
          bookId: myBook.book_id,
          title: bookInfo?.title || "Unknown Title",
          author: bookInfo?.author || "Unknown Author",
          coverUrl: bookInfo?.cover_url || null,
          rating: myBook.rating,
          reason: `Rated ${myBook.rating || 5}★ by you`,
        });
      } else if (friendBook.shelf === "to-read") {
        recommendationsForThem.push({
          bookId: myBook.book_id,
          title: bookInfo?.title || "Unknown Title",
          author: bookInfo?.author || "Unknown Author",
          coverUrl: bookInfo?.cover_url || null,
          rating: myBook.rating,
          reason: `On friend's Want to Read shelf (rated ${myBook.rating || 5}★ by you)`,
        });
      }
    }
  }

  // 5. Taste Comparison (Tropes, Dealbreakers, Pacing)
  const myTropes = (myTaste?.top_tropes || []).map((t) => t.trim());
  const friendTropes = (friendTaste?.top_tropes || []).map((t) => t.trim());
  const myDealbreakers = (myTaste?.dealbreakers || []).map((d) => d.trim().toLowerCase());
  const friendDealbreakers = (friendTaste?.dealbreakers || []).map((d) => d.trim().toLowerCase());

  const friendTropesSet = new Set(friendTropes.map((t) => t.toLowerCase()));
  const myTropesSet = new Set(myTropes.map((t) => t.toLowerCase()));

  const sharedTropes = myTropes.filter((t) => friendTropesSet.has(t.toLowerCase()));
  const uniqueToMeTropes = myTropes.filter((t) => !friendTropesSet.has(t.toLowerCase()));
  const uniqueToFriendTropes = friendTropes.filter((t) => !myTropesSet.has(t.toLowerCase()));

  // Check clashes: does friend's loved trope clash with my dealbreaker, or vice versa?
  const dealbreakerClashes: Array<{
    trope: string;
    lovedBy: "me" | "friend";
    dealbreakerFor: "friend" | "me";
  }> = [];

  for (const t of myTropes) {
    if (friendDealbreakers.some((d) => d.includes(t.toLowerCase()) || t.toLowerCase().includes(d))) {
      dealbreakerClashes.push({ trope: t, lovedBy: "me", dealbreakerFor: "friend" });
    }
  }

  for (const t of friendTropes) {
    if (myDealbreakers.some((d) => d.includes(t.toLowerCase()) || t.toLowerCase().includes(d))) {
      dealbreakerClashes.push({ trope: t, lovedBy: "friend", dealbreakerFor: "me" });
    }
  }

  // 6. Overall Match Percentage calculation
  // Base 60%, + up to 25% for shared tropes, + up to 15% for rating agreement
  let matchScore = 60;

  if (myTropes.length > 0 || friendTropes.length > 0) {
    const totalUniqueTropes = new Set([...myTropesSet, ...friendTropesSet]).size;
    const tropeOverlapRatio = totalUniqueTropes > 0 ? sharedTropes.length / totalUniqueTropes : 0;
    matchScore += Math.round(tropeOverlapRatio * 25);
  }

  if (ratedCount > 0) {
    const avgDiff = totalRatingDiff / ratedCount;
    // max diff is 4 (5 - 1). 0 diff = +15%, 4 diff = +0%
    const ratingBonus = Math.max(0, 15 - (avgDiff / 4) * 15);
    matchScore += Math.round(ratingBonus);
  } else {
    // Neutral bonus if no books rated in common yet
    matchScore += 8;
  }

  // Penalize dealbreaker clashes slightly
  matchScore = Math.max(40, Math.min(98, matchScore - dealbreakerClashes.length * 3));

  return {
    sharedReads,
    recommendationsForYou: recommendationsForYou.slice(0, 10),
    recommendationsForThem: recommendationsForThem.slice(0, 10),
    tasteComparison: {
      myArchetype: myTaste?.archetype_name || "Avid Reader",
      friendArchetype: friendTaste?.archetype_name || "Avid Reader",
      myPacing: myTaste?.preferred_pacing || null,
      friendPacing: friendTaste?.preferred_pacing || null,
      myTone: myTaste?.emotional_tone || null,
      friendTone: friendTaste?.emotional_tone || null,
      sharedTropes,
      uniqueToMeTropes,
      uniqueToFriendTropes,
      dealbreakerClashes,
    },
    stats: {
      totalSharedReads: sharedReads.length,
      avgRatingDelta: ratedCount > 0 ? Number((totalRatingDiff / ratedCount).toFixed(1)) : null,
      tasteMatchPercentage: matchScore,
    },
  };
}
