import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { DEFAULT_NOTIFICATION_PREFERENCES, NotificationPreferences } from "@/types/database";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createAdminClient(supabaseUrl, supabaseKey);
}

/**
 * GET /api/notifications/preferences
 * Retrieves the user's granular notification preferences.
 */
export async function GET(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`notif-prefs-get:${ip}`, { maxRequests: 60, windowMs: 60_000 });
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
    const { data: profile, error } = await admin
      .from("profiles")
      .select("notification_preferences")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch notification preferences:", error);
      return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
    }

    const preferences: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(profile?.notification_preferences || {}),
    };

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error: any) {
    console.error("GET /api/notifications/preferences error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications/preferences
 * Updates the user's granular notification preferences.
 */
export async function PATCH(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`notif-prefs-patch:${ip}`, { maxRequests: 60, windowMs: 60_000 });
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
    const updates = body.preferences || body;

    const admin = getAdminClient();

    // Fetch existing preferences
    const { data: profile } = await admin
      .from("profiles")
      .select("notification_preferences")
      .eq("id", user.id)
      .maybeSingle();

    const mergedPreferences: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(profile?.notification_preferences || {}),
      ...(updates || {}),
    };

    const { error: updateError } = await admin
      .from("profiles")
      .update({ notification_preferences: mergedPreferences })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to update notification preferences:", updateError);
      return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      preferences: mergedPreferences,
    });
  } catch (error: any) {
    console.error("PATCH /api/notifications/preferences error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
