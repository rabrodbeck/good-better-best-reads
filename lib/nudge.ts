import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createAndDispatchNotification } from "@/lib/notifications";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createAdminClient(supabaseUrl, supabaseKey);
}

export function getIsoWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export interface WeekendNudgeResult {
  currentWeek: string;
  processedUsers: number;
  nudgesSent: number;
  skippedActiveReaders: number;
  skippedEmptyTbr: number;
  skippedAlreadyNotified: number;
  skippedOptedOut: number;
}

export interface NudgeOptions {
  force?: boolean;
  targetUserId?: string;
  currentDate?: Date;
}

/**
 * Context-aware Friday afternoon weekend reading concierge.
 *
 * Rules:
 * 1. Honors user notification preferences (weekend_nudges !== false).
 * 2. ONLY notifies users with 0 books on their 'currently-reading' shelf.
 * 3. Requires at least 1 book on their 'to-read' shelf.
 * 4. Selects a book pick from their TBR shelf and deep-links to /library?shelf=to-read.
 * 5. Idempotent per calendar week (one nudge per week max unless forced).
 */
export async function runWeekendReadingNudge(options: NudgeOptions = {}): Promise<WeekendNudgeResult> {
  const admin = getAdminClient();
  const date = options.currentDate || new Date();
  const currentWeek = getIsoWeek(date);

  let query = admin.from("profiles").select("id, display_name, notification_preferences");
  if (options.targetUserId) {
    query = query.eq("id", options.targetUserId);
  }

  const { data: profiles, error: pError } = await query;
  if (pError || !profiles) {
    console.error("Failed to query profiles for weekend nudge:", pError);
    return {
      currentWeek,
      processedUsers: 0,
      nudgesSent: 0,
      skippedActiveReaders: 0,
      skippedEmptyTbr: 0,
      skippedAlreadyNotified: 0,
      skippedOptedOut: 0,
    };
  }

  let nudgesSent = 0;
  let skippedActiveReaders = 0;
  let skippedEmptyTbr = 0;
  let skippedAlreadyNotified = 0;
  let skippedOptedOut = 0;

  for (const profile of profiles) {
    const prefs = profile.notification_preferences as Record<string, any> | null;
    if (prefs?.weekend_nudges === false) {
      skippedOptedOut++;
      continue;
    }

    // Weekly idempotency check
    if (!options.force) {
      const { data: existingNotif } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", profile.id)
        .eq("type", "weekend_nudge")
        .filter("data->>week", "eq", currentWeek)
        .maybeSingle();

      if (existingNotif) {
        skippedAlreadyNotified++;
        continue;
      }
    }

    // Query user's current reading shelves
    const { data: userBooks, error: ubError } = await admin
      .from("user_books")
      .select(`
        id,
        shelf,
        created_at,
        books (
          id,
          title,
          author,
          cover_url,
          page_count
        )
      `)
      .eq("user_id", profile.id)
      .in("shelf", ["currently-reading", "to-read"]);

    if (ubError || !userBooks) {
      continue;
    }

    const currentlyReading = userBooks.filter((ub) => ub.shelf === "currently-reading");
    // Context check 1: Only nudge if user has 0 books currently being read
    if (currentlyReading.length > 0) {
      skippedActiveReaders++;
      continue;
    }

    const toReadBooks = userBooks.filter((ub) => ub.shelf === "to-read");
    // Context check 2: Must have at least 1 book on their To-Read shelf
    if (toReadBooks.length === 0) {
      skippedEmptyTbr++;
      continue;
    }

    // Select concierge pick (first book on TBR shelf)
    const pickRecord = toReadBooks[0];
    const book = Array.isArray(pickRecord.books) ? pickRecord.books[0] : pickRecord.books;

    const bookTitle = book?.title || "your next great read";
    const authorText = book?.author ? ` by ${book.author}` : "";

    const title = "☕ Weekend Reading Pick";
    const body = `Your Currently Reading shelf is open! How about starting "${bookTitle}"${authorText} this weekend?`;

    await createAndDispatchNotification({
      userId: profile.id,
      type: "weekend_nudge",
      title,
      body,
      data: {
        url: "/library?shelf=to-read",
        week: currentWeek,
        bookId: book?.id || null,
        bookTitle,
        coverUrl: book?.cover_url || null,
      },
    });

    nudgesSent++;
  }

  return {
    currentWeek,
    processedUsers: profiles.length,
    nudgesSent,
    skippedActiveReaders,
    skippedEmptyTbr,
    skippedAlreadyNotified,
    skippedOptedOut,
  };
}
