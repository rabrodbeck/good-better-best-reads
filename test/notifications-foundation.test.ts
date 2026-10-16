import { describe, it, expect } from "vitest";
import * as dotenv from "dotenv";
import {
  isPushAllowedForType,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "@/lib/notifications";
import { NotificationType } from "@/types/database";

dotenv.config({ path: ".env.local" });

describe("Phase 6: Web Push & In-App Notifications Foundation (Issue #55, #56)", () => {
  describe("Granular Notification Preferences", () => {
    it("has all notification types enabled by default", () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES.friend_recommendations).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.goal_milestones).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.monthly_recaps).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.weekend_nudges).toBe(true);
    });

    it("allows notifications when preferences are null or empty", () => {
      expect(isPushAllowedForType("friend_recommendation", null)).toBe(true);
      expect(isPushAllowedForType("goal_milestone", undefined)).toBe(true);
      expect(isPushAllowedForType("monthly_recap", {})).toBe(true);
      expect(isPushAllowedForType("weekend_nudge", {})).toBe(true);
    });

    it("always permits system notifications regardless of toggles", () => {
      const allOff = {
        friend_recommendations: false,
        goal_milestones: false,
        monthly_recaps: false,
        weekend_nudges: false,
      };
      expect(isPushAllowedForType("system", allOff)).toBe(true);
    });

    it("respects granular opt-outs for individual alert categories", () => {
      const customPrefs = {
        friend_recommendations: true,
        goal_milestones: false, // User disabled goal celebrations
        monthly_recaps: true,
        weekend_nudges: false, // User disabled weekend nudges
      };

      expect(isPushAllowedForType("friend_recommendation", customPrefs)).toBe(true);
      expect(isPushAllowedForType("goal_milestone", customPrefs)).toBe(false);
      expect(isPushAllowedForType("monthly_recap", customPrefs)).toBe(true);
      expect(isPushAllowedForType("weekend_nudge", customPrefs)).toBe(false);
    });
  });

  describe("VAPID Credentials & Environment", () => {
    it("reads public VAPID key from environment", () => {
      const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      expect(pubKey).toBeDefined();
      expect(pubKey?.length).toBeGreaterThan(20);
    });

    it("reads private VAPID key from environment", () => {
      const privKey = process.env.VAPID_PRIVATE_KEY;
      expect(privKey).toBeDefined();
      expect(privKey?.length).toBeGreaterThan(20);
    });
  });
});
