"use client";

import * as React from "react";
import {
  BellRing,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  BellOff,
  Trophy,
  Users,
  BarChart3,
  Coffee,
  Sparkles,
  Send,
  Loader2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from "@/types/database";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationSettingsCard() {
  const [supported, setSupported] = React.useState(true);
  const [permission, setPermission] = React.useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = React.useState(false);
  const [currentSubscription, setCurrentSubscription] = React.useState<PushSubscription | null>(null);
  const [enrolling, setEnrolling] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const [preferences, setPreferences] = React.useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [loadingPrefs, setLoadingPrefs] = React.useState(true);

  // 1. Check browser capabilities and active subscription
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setSupported(false);
      return;
    }

    setPermission(Notification.permission);

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) {
          setIsSubscribed(true);
          setCurrentSubscription(sub);
        } else {
          setIsSubscribed(false);
        }
      });
    });
  }, []);

  // 2. Fetch user preferences from API
  React.useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.preferences) {
          setPreferences(data.preferences);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPrefs(false));
  }, []);

  // Enroll in Web Push
  const handleSubscribe = async () => {
    setEnrolling(true);
    setFeedback(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        setFeedback({
          type: "error",
          text: "Notification permission was denied. You can re-enable alerts in your browser site settings.",
        });
        setEnrolling(false);
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        throw new Error("Missing public VAPID key on client");
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      setCurrentSubscription(sub);
      setIsSubscribed(true);

      // Register with backend
      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to register subscription with server");
      }

      setFeedback({
        type: "success",
        text: "🎉 Push notifications active! This device is registered for reader alerts.",
      });
    } catch (err: any) {
      console.error("Subscription error:", err);
      setFeedback({
        type: "error",
        text: err.message || "Failed to enable notifications.",
      });
    } finally {
      setEnrolling(false);
    }
  };

  // Unsubscribe device
  const handleUnsubscribe = async () => {
    setEnrolling(true);
    setFeedback(null);
    try {
      if (currentSubscription) {
        const endpoint = currentSubscription.endpoint;
        await currentSubscription.unsubscribe();
        await fetch("/api/notifications/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setIsSubscribed(false);
      setCurrentSubscription(null);
      setFeedback({
        type: "success",
        text: "Device unsubscribed from Web Push notifications.",
      });
    } catch (err: any) {
      console.error("Unsubscribe error:", err);
      setFeedback({ type: "error", text: "Failed to unsubscribe device." });
    } finally {
      setEnrolling(false);
    }
  };

  // Send Test Push
  const handleTestPush = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: currentSubscription ? currentSubscription.toJSON() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send test alert");
      }

      setFeedback({
        type: "success",
        text: "🔔 Test alert sent! Check your notification center or lock screen banner.",
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Could not dispatch test notification.",
      });
    } finally {
      setTesting(false);
    }
  };

  // Toggle Category Preference
  const handleTogglePreference = async (key: keyof NotificationPreferences) => {
    const updated = {
      ...preferences,
      [key]: !preferences[key],
    };
    setPreferences(updated);

    try {
      await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: updated }),
      });
    } catch (err) {
      console.error("Failed to update preferences:", err);
    }
  };

  return (
    <Card id="notifications" className="border-border/60 bg-card/60 backdrop-blur-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <BellRing className="size-5 text-primary" />
              <span>Push Notifications & Reader Alerts</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Choose which literary moments and recommendations reach your phone or desktop.
            </p>
          </div>
          {supported && (
            <div>
              {isSubscribed && permission === "granted" ? (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1.5 py-1 px-2.5">
                  <CheckCircle2 className="size-3.5" />
                  <span>Device Active</span>
                </Badge>
              ) : permission === "denied" ? (
                <Badge variant="outline" className="border-rose-500/40 text-rose-500 gap-1.5 py-1 px-2.5">
                  <AlertCircle className="size-3.5" />
                  <span>Blocked in Browser</span>
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1.5 py-1 px-2.5 text-muted-foreground">
                  <Smartphone className="size-3.5" />
                  <span>Not Subscribed</span>
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Browser Support Warning */}
        {!supported && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Web Push Not Supported on this Browser</p>
              <p className="mt-0.5 opacity-90">
                On iOS, install TBRScout to your Home Screen via Safari (Share → &quot;Add to Home Screen&quot;) to enable Apple APNs push notifications.
              </p>
            </div>
          </div>
        )}

        {/* Device Enrollment Action Box */}
        {supported && (
          <div className="p-4 rounded-xl border border-border/40 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-foreground">
                {isSubscribed && permission === "granted"
                  ? "This device is registered for native push alerts"
                  : permission === "denied"
                  ? "Notifications are blocked in your browser"
                  : "Enable lock-screen alerts on this device"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                {isSubscribed && permission === "granted"
                  ? "Receive instant alerts for friend book pitches and goal milestones even when the tab is closed."
                  : permission === "denied"
                  ? "To unblock: Click the tune/padlock icon next to 'localhost:3000' in your browser's address bar, change Notifications from 'Block' to 'Allow', then click 'Check Permission'."
                  : "Grant permission to receive instant friend book recommendations and reading challenge milestones."}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isSubscribed && permission === "granted" ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestPush}
                    disabled={testing}
                    className="text-xs font-semibold gap-1.5"
                  >
                    {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5 text-primary" />}
                    <span>Test Notification</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleUnsubscribe}
                    disabled={enrolling}
                    className="text-xs text-muted-foreground hover:text-rose-500"
                  >
                    Unsubscribe
                  </Button>
                </>
              ) : permission === "denied" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (typeof window !== "undefined" && "Notification" in window) {
                      const current = Notification.permission;
                      setPermission(current);
                      if (current === "granted") {
                        handleSubscribe();
                      } else {
                        setFeedback({
                          type: "error",
                          text: "Notifications are still marked as Blocked. In your browser's address bar, click the site settings / tune icon next to 'localhost:3000', change Notifications to 'Allow', then click here again.",
                        });
                      }
                    }
                  }}
                  className="text-xs font-semibold gap-1.5 border-rose-500/40 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                >
                  <AlertCircle className="size-3.5" />
                  <span>Check Permission</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSubscribe}
                  disabled={enrolling}
                  className="bg-primary text-primary-foreground font-semibold text-xs gap-1.5 shadow-xs"
                >
                  {enrolling ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  <span>Enable Push Alerts</span>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs font-medium animate-in fade-in duration-200 ${
              feedback.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Granular Category Toggles */}
        <div className="space-y-4">
          <div className="border-b border-border/40 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Granular Notification Preferences
            </h3>
          </div>

          <div className="space-y-3">
            {/* 1. Friend Recommendations */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-card/40 hover:border-primary/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                  <Users className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Friend Book Recommendations</p>
                  <p className="text-[11px] text-muted-foreground">
                    Get notified when a friend sends a book pitch directly to your queue.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.friend_recommendations}
                onClick={() => handleTogglePreference("friend_recommendations")}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  preferences.friend_recommendations ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    preferences.friend_recommendations ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* 2. Goal Milestones */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-card/40 hover:border-primary/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                  <Trophy className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Annual Challenge Milestones</p>
                  <p className="text-[11px] text-muted-foreground">
                    Celebratory alerts when you cross 25%, 50%, 75%, and 100% of your reading goal.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.goal_milestones}
                onClick={() => handleTogglePreference("goal_milestones")}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  preferences.goal_milestones ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    preferences.goal_milestones ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* 3. Monthly Reading Wrap-ups */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-card/40 hover:border-primary/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                  <BarChart3 className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Monthly Reading Wrap-ups</p>
                  <p className="text-[11px] text-muted-foreground">
                    A recap of books finished, total pages, and reading velocity on the 1st of each month.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.monthly_recaps}
                onClick={() => handleTogglePreference("monthly_recaps")}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  preferences.monthly_recaps ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    preferences.monthly_recaps ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* 4. Weekend Reading Nudge */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-card/40 hover:border-primary/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                  <Coffee className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Weekend Reading Nudges</p>
                  <p className="text-[11px] text-muted-foreground">
                    Gentle Friday afternoon recommendations when your Currently Reading shelf is empty.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.weekend_nudges}
                onClick={() => handleTogglePreference("weekend_nudges")}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  preferences.weekend_nudges ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    preferences.weekend_nudges ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
