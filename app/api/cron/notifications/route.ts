import { NextResponse } from "next/server";
import { runMonthlyReadingRecap } from "@/lib/milestones";

export const dynamic = "force-dynamic";

/**
 * Validates optional cron authentication secret.
 */
function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // Allowed in local dev / test if unset

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;

  const url = new URL(req.url);
  if (url.searchParams.get("key") === cronSecret) return true;

  return false;
}

/**
 * GET /api/cron/notifications?type=monthly-recap
 * POST /api/cron/notifications
 * Scheduled cron handler for automated recurring notifications.
 */
export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}

async function handleCron(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
    }

    const url = new URL(req.url);
    let type = url.searchParams.get("type");
    let monthParam = url.searchParams.get("month");
    let yearParam = url.searchParams.get("year");

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.type) type = body.type;
      if (body.month !== undefined) monthParam = String(body.month);
      if (body.year !== undefined) yearParam = String(body.year);
    }

    if (!type) {
      return NextResponse.json(
        { error: "Missing 'type' parameter. Expected 'monthly-recap' or 'weekend-nudge'." },
        { status: 400 }
      );
    }

    if (type === "monthly-recap") {
      let overrideMonth: number | undefined;
      if (monthParam !== null && monthParam !== undefined) {
        const lower = monthParam.trim().toLowerCase();
        const monthMap: Record<string, number> = {
          january: 0, jan: 0,
          february: 1, feb: 1,
          march: 2, mar: 2,
          april: 3, apr: 3,
          may: 4,
          june: 5, jun: 5,
          july: 6, jul: 6,
          august: 7, aug: 7,
          september: 8, sep: 8, sept: 8,
          october: 9, oct: 9,
          november: 10, nov: 10,
          december: 11, dec: 11,
        };
        if (lower in monthMap) {
          overrideMonth = monthMap[lower];
        } else {
          const num = parseInt(lower, 10);
          if (!isNaN(num)) {
            // Standard human 1-12 calendar month numbering (1 = Jan, 10 = Oct)
            overrideMonth = num >= 1 && num <= 12 ? num - 1 : num;
          }
        }
      }
      const overrideYear = yearParam !== null ? parseInt(yearParam, 10) : undefined;

      const result = await runMonthlyReadingRecap(overrideMonth, overrideYear);
      return NextResponse.json({
        success: true,
        type: "monthly-recap",
        result,
      });
    }

    if (type === "weekend-nudge") {
      // Reserved for Step 6 (Issue #63)
      return NextResponse.json({
        success: true,
        type: "weekend-nudge",
        message: "Weekend nudge handler ready for Step 6 implementation",
      });
    }

    return NextResponse.json(
      { error: `Unknown notification cron type: ${type}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Cron notifications route error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
