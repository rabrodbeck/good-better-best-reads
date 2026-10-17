import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createAndDispatchNotification } from "@/lib/notifications";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createAdminClient(supabaseUrl, supabaseKey);
}

export interface MilestoneResult {
  milestoneDispatched: number | null;
  readCount: number;
  goal: number;
  percentage: number;
}

export const MILESTONES = [25, 50, 75, 100] as const;

/**
 * Checks reading challenge progress and dispatches celebration notifications
 * when crossing 25%, 50%, 75%, and 100% of the annual goal.
 * Fully idempotent: skips milestones already recorded in the notifications table.
 */
export async function checkAndDispatchGoalMilestones(
  userId: string,
  targetYear: number = new Date().getFullYear()
): Promise<MilestoneResult> {
  const admin = getAdminClient();

  // 1. Fetch user profile reading goal
  const { data: profile } = await admin
    .from("profiles")
    .select("reading_goal")
    .eq("id", userId)
    .maybeSingle();

  const goal = Math.max(1, profile?.reading_goal || 12);

  // 2. Query books read in the specified calendar year
  const { data: readBooksData, error: readError } = await admin
    .from("user_books")
    .select("date_read, created_at")
    .eq("user_id", userId)
    .eq("shelf", "read");

  if (readError) {
    console.error("Failed to query user_books for milestones:", readError);
    return { milestoneDispatched: null, readCount: 0, goal, percentage: 0 };
  }

  const booksThisYear = (readBooksData || []).filter((ub) => {
    if (!ub.date_read) return false;
    const d = new Date(ub.date_read);
    return (
      !isNaN(d.getTime()) &&
      (d.getUTCFullYear() === targetYear || d.getFullYear() === targetYear)
    );
  });

  const readCount = booksThisYear.length;
  const percentage = Math.floor((readCount / goal) * 100);

  // Determine which milestones have been earned
  const earnedMilestones = MILESTONES.filter((m) => percentage >= m);
  if (earnedMilestones.length === 0) {
    return { milestoneDispatched: null, readCount, goal, percentage };
  }

  // 3. Query existing milestone notifications to prevent duplicates
  const { data: existingNotifs } = await admin
    .from("notifications")
    .select("data")
    .eq("user_id", userId)
    .eq("type", "goal_milestone");

  const dispatchedMilestones = new Set<number>();
  if (existingNotifs) {
    for (const notif of existingNotifs) {
      const data = notif.data as Record<string, any> | null;
      if (data?.year === targetYear && typeof data?.milestone === "number") {
        dispatchedMilestones.add(data.milestone);
      }
    }
  }

  // Identify newly earned milestones
  const newlyEarned = earnedMilestones.filter((m) => !dispatchedMilestones.has(m));
  if (newlyEarned.length === 0) {
    return { milestoneDispatched: null, readCount, goal, percentage };
  }

  // Dispatch the highest newly earned milestone
  const milestone = newlyEarned[newlyEarned.length - 1];
  let title = "";
  let body = "";

  switch (milestone) {
    case 25:
      title = "🎉 25% Goal Milestone Reached!";
      body = `You've completed ${readCount} of ${goal} books for ${targetYear}. Keep the momentum going!`;
      break;
    case 50:
      title = "🌟 Halfway There! 50% Milestone!";
      body = `You've read ${readCount} of ${goal} books. Fantastic progress on your ${targetYear} reading challenge!`;
      break;
    case 75:
      title = "🔥 75% Goal Milestone! Almost there!";
      body = `${readCount} of ${goal} books finished for ${targetYear}. The finish line is in sight!`;
      break;
    case 100:
      title = "🏆 Reading Goal Achieved! 100% Complete!";
      body = `Congratulations! You've finished all ${goal} books for your ${targetYear} Reading Challenge!`;
      break;
  }

  await createAndDispatchNotification({
    userId,
    type: "goal_milestone",
    title,
    body,
    data: {
      url: "/library",
      year: targetYear,
      milestone,
      readCount,
      goal,
    },
  });

  return { milestoneDispatched: milestone, readCount, goal, percentage };
}

export interface MonthlyRecapResult {
  month: string;
  year: number;
  processedUsers: number;
  recapsSent: number;
}

/**
 * Compiles and dispatches monthly reading recap alerts for a specific month and year.
 * Dispatches to all users who have finished >= 1 book in that month.
 */
export async function runMonthlyReadingRecap(
  overrideMonth?: number,
  overrideYear?: number
): Promise<MonthlyRecapResult> {
  const admin = getAdminClient();

  const now = new Date();
  // Default to previous month
  let targetMonth = overrideMonth !== undefined ? overrideMonth : now.getMonth() - 1;
  let targetYear = overrideYear !== undefined ? overrideYear : now.getFullYear();

  if (targetMonth < 0) {
    targetMonth = 11;
    targetYear -= 1;
  }

  const startDate = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999));

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthName = monthNames[targetMonth];

  // 1. Fetch eligible users
  const { data: profiles, error: pError } = await admin
    .from("profiles")
    .select("id, display_name, notification_preferences");

  if (pError || !profiles) {
    console.error("Failed to query profiles for monthly recap:", pError);
    return { month: monthName, year: targetYear, processedUsers: 0, recapsSent: 0 };
  }

  let recapsSent = 0;

  for (const profile of profiles) {
    const prefs = profile.notification_preferences as Record<string, any> | null;
    // Check if user turned off monthly recaps
    if (prefs?.monthly_recaps === false) {
      continue;
    }

    // 2. Check if recap already dispatched to this user for this month/year
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", profile.id)
      .eq("type", "monthly_recap")
      .filter("data->>month", "eq", monthName)
      .filter("data->>year", "eq", String(targetYear))
      .maybeSingle();

    if (existing) {
      continue;
    }

    // 3. Query books read by user during target month
    const { data: readBooks } = await admin
      .from("user_books")
      .select(`
        id,
        rating,
        date_read,
        books (
          title,
          page_count
        )
      `)
      .eq("user_id", profile.id)
      .eq("shelf", "read")
      .gte("date_read", startDate.toISOString())
      .lte("date_read", endDate.toISOString());

    if (!readBooks || readBooks.length === 0) {
      continue;
    }

    const bookCount = readBooks.length;
    let pageCount = 0;
    for (const ub of readBooks) {
      const b = Array.isArray(ub.books) ? ub.books[0] : ub.books;
      if (b?.page_count) pageCount += b.page_count;
    }

    const title = `📊 Your ${monthName} Reading Wrap-Up`;
    const pagesText = pageCount > 0 ? ` and ${pageCount.toLocaleString()} pages` : "";
    const body = `You finished ${bookCount} book${bookCount > 1 ? "s" : ""}${pagesText} in ${monthName}! Tap to see your reading stats.`;

    await createAndDispatchNotification({
      userId: profile.id,
      type: "monthly_recap",
      title,
      body,
      data: {
        url: "/insights",
        month: monthName,
        year: targetYear,
        bookCount,
        pageCount,
      },
    });

    recapsSent++;
  }

  return {
    month: monthName,
    year: targetYear,
    processedUsers: profiles.length,
    recapsSent,
  };
}
