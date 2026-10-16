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
 * POST /api/notifications/subscribe
 * Registers or updates a device's Web Push subscription.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`push-sub:${ip}`, { maxRequests: 30, windowMs: 60_000 });
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
    const { subscription, userAgent } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { error: "Invalid subscription payload. Must include endpoint, p256dh, and auth keys." },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const headerUserAgent = req.headers.get("user-agent") || null;

    const { error } = await admin.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: userAgent || headerUserAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) {
      console.error("Failed to save push subscription:", error);
      return NextResponse.json({ error: "Failed to store subscription" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Device subscribed successfully",
    });
  } catch (error: any) {
    console.error("POST /api/notifications/subscribe error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/notifications/subscribe
 * Removes a device's Web Push subscription.
 */
export async function DELETE(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`push-unsub:${ip}`, { maxRequests: 30, windowMs: 60_000 });
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
    const endpoint = body.endpoint || new URL(req.url).searchParams.get("endpoint");

    if (!endpoint) {
      return NextResponse.json({ error: "Missing 'endpoint' parameter" }, { status: 400 });
    }

    const admin = getAdminClient();
    const { error } = await admin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (error) {
      console.error("Failed to remove push subscription:", error);
      return NextResponse.json({ error: "Failed to unsubscribe device" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Device unsubscribed successfully",
    });
  } catch (error: any) {
    console.error("DELETE /api/notifications/subscribe error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
