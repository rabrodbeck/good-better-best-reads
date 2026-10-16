import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createAdminClient(supabaseUrl, supabaseKey);
}

/**
 * GET /api/notifications
 * Fetches the user's notifications and unread count.
 */
export async function GET(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`notifs-get:${ip}`, { maxRequests: 90, windowMs: 60_000 });
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getAdminClient();

    // Query notifications and unread count concurrently
    const [notifsResult, unreadCountResult] = await Promise.all([
      admin
        .from("notifications")
        .select("id, type, title, body, data, read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false),
    ]);

    if (notifsResult.error) {
      console.error("Notifications fetch error:", notifsResult.error);
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      notifications: notifsResult.data || [],
      unreadCount: unreadCountResult.count || 0,
    });
  } catch (error: any) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 * Marks a single notification or all notifications as read.
 */
export async function PATCH(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`notifs-patch:${ip}`, { maxRequests: 60, windowMs: 60_000 });
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { id, markAllRead } = body;

    const admin = getAdminClient();

    if (markAllRead) {
      const { error } = await admin
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) {
        console.error("Failed to mark all notifications read:", error);
        return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "All marked as read" });
    }

    if (id) {
      const { error } = await admin
        .from("notifications")
        .update({ read: true })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to mark notification read:", error);
        return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Notification marked as read" });
    }

    return NextResponse.json({ error: "Missing 'id' or 'markAllRead' parameter" }, { status: 400 });
  } catch (error: any) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/notifications
 * Dismisses a single notification or clears all read notifications.
 */
export async function DELETE(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`notifs-delete:${ip}`, { maxRequests: 60, windowMs: 60_000 });
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const clearAll = url.searchParams.get("clearAll") === "true";

    const admin = getAdminClient();

    if (clearAll) {
      const { error } = await admin
        .from("notifications")
        .delete()
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to clear notifications:", error);
        return NextResponse.json({ error: "Failed to clear notifications" }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Notifications cleared" });
    }

    if (id) {
      const { error } = await admin
        .from("notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to delete notification:", error);
        return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Notification deleted" });
    }

    return NextResponse.json({ error: "Missing 'id' or 'clearAll' parameter" }, { status: 400 });
  } catch (error: any) {
    console.error("DELETE /api/notifications error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
