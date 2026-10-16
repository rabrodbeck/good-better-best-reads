import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAndDispatchNotification, sendDirectPush } from "@/lib/notifications";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/test
 * Dispatches an immediate test push and in-app alert to verify device notifications.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`notif-test:${ip}`, { maxRequests: 10, windowMs: 60_000 });
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Too many test requests. Please wait a moment." }, { status: 429 });
    }

    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { subscription } = body;

    const testPayload = {
      title: "☕ TBRScout Notification Test",
      body: "Push notifications are working perfectly on this device!",
      tag: "tbrscout-test",
      data: {
        url: "/profile",
        testedAt: new Date().toISOString(),
      },
    };

    // If client supplied its specific active subscription, test direct push
    if (subscription && subscription.endpoint && subscription.keys?.p256dh && subscription.keys?.auth) {
      const result = await sendDirectPush(
        {
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        testPayload
      );

      // Also record an in-app alert for consistency
      await createAndDispatchNotification({
        userId: user.id,
        type: "system",
        title: testPayload.title,
        body: testPayload.body,
        data: testPayload.data,
      });

      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error || "Failed to deliver push notification",
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Test notification delivered directly to this device!",
      });
    }

    // Otherwise dispatch across all registered subscriptions for this user
    const dispatchResult = await createAndDispatchNotification({
      userId: user.id,
      type: "system",
      title: testPayload.title,
      body: testPayload.body,
      data: testPayload.data,
    });

    return NextResponse.json({
      success: true,
      message: `Test alert sent! Delivered to ${dispatchResult.pushSentCount} device(s).`,
      details: dispatchResult,
    });
  } catch (error: any) {
    console.error("POST /api/notifications/test error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
