import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { NotificationType, NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from "@/types/database";

export { DEFAULT_NOTIFICATION_PREFERENCES };

// Configure Web Push with VAPID credentials if available
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@goodbetterbestreads.com";

let vapidConfigured = false;
if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    vapidConfigured = true;
  } catch (err) {
    console.warn("Could not initialize VAPID details:", err);
  }
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export interface NotificationDispatchPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  tag?: string;
}

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface DispatchResult {
  notificationId?: string;
  inAppCreated: boolean;
  pushSentCount: number;
  pushSuppressed: boolean;
  error?: string;
}

/**
 * Checks whether the user has enabled Web Push for a given notification type.
 */
export function isPushAllowedForType(
  type: NotificationType,
  preferences?: Partial<NotificationPreferences> | null
): boolean {
  if (type === "system") return true;
  const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(preferences || {}) };

  switch (type) {
    case "friend_recommendation":
      return prefs.friend_recommendations !== false;
    case "goal_milestone":
      return prefs.goal_milestones !== false;
    case "monthly_recap":
      return prefs.monthly_recaps !== false;
    case "weekend_nudge":
      return prefs.weekend_nudges !== false;
    default:
      return true;
  }
}

/**
 * Creates an in-app notification record and dispatches Web Push notifications
 * to all active browser/PWA subscriptions for the user, respecting their preferences.
 */
export async function createAndDispatchNotification(
  payload: NotificationDispatchPayload
): Promise<DispatchResult> {
  const admin = getAdminClient();

  // 1. Insert in-app notification record
  let notificationId: string | undefined;
  try {
    const { data: newNotif, error: insertError } = await admin
      .from("notifications")
      .insert({
        user_id: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        read: false,
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      console.warn("Could not insert in-app notification:", insertError.message);
    } else if (newNotif) {
      notificationId = newNotif.id;
    }
  } catch (err: any) {
    console.warn("Error creating in-app notification record:", err.message);
  }

  // 2. Fetch user notification preferences
  let userPrefs: Partial<NotificationPreferences> = DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("notification_preferences")
      .eq("id", payload.userId)
      .maybeSingle();

    if (profile?.notification_preferences) {
      userPrefs = profile.notification_preferences as Partial<NotificationPreferences>;
    }
  } catch {
    // Fall back to default preferences
  }

  // Check if push is allowed for this category
  if (!isPushAllowedForType(payload.type, userPrefs)) {
    return {
      notificationId,
      inAppCreated: Boolean(notificationId),
      pushSentCount: 0,
      pushSuppressed: true,
    };
  }

  if (!vapidConfigured) {
    return {
      notificationId,
      inAppCreated: Boolean(notificationId),
      pushSentCount: 0,
      pushSuppressed: false,
      error: "VAPID credentials not configured",
    };
  }

  // 3. Fetch all active device push subscriptions for this user
  let subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }> = [];
  try {
    const { data, error: subsError } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", payload.userId);

    if (subsError) {
      console.warn("Could not fetch push_subscriptions:", subsError.message);
    } else {
      subscriptions = data || [];
    }
  } catch (err: any) {
    console.warn("Error querying push_subscriptions:", err.message);
  }

  if (subscriptions.length === 0) {
    return {
      notificationId,
      inAppCreated: Boolean(notificationId),
      pushSentCount: 0,
      pushSuppressed: false,
    };
  }

  // 4. Construct Web Push payload
  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: "/icon",
    badge: "/icon",
    tag: payload.tag || `tbrscout-${payload.type}`,
    data: {
      url: payload.data?.url || "/library",
      type: payload.type,
      notificationId,
      ...payload.data,
    },
  });

  // 5. Concurrently dispatch to all registered devices
  let pushSentCount = 0;
  const expiredIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushPayload
        );
        pushSentCount++;
      } catch (err: any) {
        // Prune expired or revoked subscriptions (HTTP 404 Not Found or HTTP 410 Gone)
        if (err.statusCode === 404 || err.statusCode === 410) {
          expiredIds.push(sub.id);
        } else {
          console.warn(`Web push delivery error for subscription ${sub.id}:`, err.message);
        }
      }
    })
  );

  // Prune expired subscriptions in the background
  if (expiredIds.length > 0) {
    try {
      await admin.from("push_subscriptions").delete().in("id", expiredIds);
    } catch {
      // Non-fatal
    }
  }

  return {
    notificationId,
    inAppCreated: Boolean(notificationId),
    pushSentCount,
    pushSuppressed: false,
  };
}

/**
 * Sends an immediate direct test push notification to a specific device subscription.
 */
export async function sendDirectPush(
  subscription: PushSubscriptionKeys,
  payload: { title: string; body: string; data?: Record<string, any>; tag?: string }
): Promise<{ success: boolean; error?: string }> {
  if (!vapidConfigured) {
    return { success: false, error: "VAPID credentials not configured on server" };
  }

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: "/icon",
    badge: "/icon",
    tag: payload.tag || "tbrscout-test",
    data: {
      url: payload.data?.url || "/profile",
      ...payload.data,
    },
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      pushPayload
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Push notification delivery failed" };
  }
}
