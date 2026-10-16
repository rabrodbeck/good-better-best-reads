import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as subscribePost, DELETE as subscribeDelete } from "@/app/api/notifications/subscribe/route";
import { GET as prefsGet, PATCH as prefsPatch } from "@/app/api/notifications/preferences/route";
import { POST as testPost } from "@/app/api/notifications/test/route";

// Mock Supabase server and admin clients
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("@/lib/notifications", () => ({
  createAndDispatchNotification: vi.fn().mockResolvedValue({
    notificationId: "notif-test-123",
    inAppCreated: true,
    pushSentCount: 1,
    pushSuppressed: false,
  }),
  sendDirectPush: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Phase 6 / Step 3: Granular User Notification Controls & Device Subscriptions (Issue #59)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST & DELETE /api/notifications/subscribe", () => {
    it("returns 401 Unauthorized for unauthenticated POST", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });

      const req = new Request("http://localhost:3000/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.1" },
        body: JSON.stringify({ subscription: { endpoint: "https://push.example/123" } }),
      });

      const res = await subscribePost(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 Bad Request for incomplete subscription payload", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

      const req = new Request("http://localhost:3000/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.2" },
        body: JSON.stringify({ subscription: { endpoint: "https://push.example/123" } }), // missing keys
      });

      const res = await subscribePost(req);
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toContain("Invalid subscription payload");
    });

    it("upserts valid push subscription for authenticated user", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ upsert: mockUpsert });

      const req = new Request("http://localhost:3000/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.3" },
        body: JSON.stringify({
          subscription: {
            endpoint: "https://fcm.googleapis.com/fcm/send/abc-123",
            keys: {
              p256dh: "key-p256dh",
              auth: "key-auth",
            },
          },
        }),
      });

      const res = await subscribePost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpsert).toHaveBeenCalled();
    });

    it("removes device subscription on DELETE", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
      mockFrom.mockReturnValue({ delete: mockDelete });

      const req = new Request("http://localhost:3000/api/notifications/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.4" },
        body: JSON.stringify({ endpoint: "https://fcm.googleapis.com/fcm/send/abc-123" }),
      });

      const res = await subscribeDelete(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockEq1).toHaveBeenCalledWith("user_id", "user-1");
    });
  });

  describe("GET & PATCH /api/notifications/preferences", () => {
    it("returns default preferences when profile has null preferences", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { notification_preferences: null },
              error: null,
            }),
          }),
        }),
      });

      const req = new Request("http://localhost:3000/api/notifications/preferences", {
        headers: { "x-forwarded-for": "10.0.1.5" },
      });

      const res = await prefsGet(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.preferences.friend_recommendations).toBe(true);
      expect(data.preferences.goal_milestones).toBe(true);
      expect(data.vapidPublicKey).toBeDefined();
    });

    it("updates specific preferences on PATCH", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    notification_preferences: {
                      friend_recommendations: true,
                      goal_milestones: true,
                      monthly_recaps: true,
                      weekend_nudges: true,
                    },
                  },
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      const req = new Request("http://localhost:3000/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.6" },
        body: JSON.stringify({
          preferences: {
            weekend_nudges: false,
          },
        }),
      });

      const res = await prefsPatch(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.preferences.weekend_nudges).toBe(false);
      expect(data.preferences.friend_recommendations).toBe(true);
    });
  });

  describe("POST /api/notifications/test", () => {
    it("returns 401 when unauthorized", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });

      const req = new Request("http://localhost:3000/api/notifications/test", {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.1.7" },
      });

      const res = await testPost(req);
      expect(res.status).toBe(401);
    });

    it("dispatches test notification when authenticated", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });

      const req = new Request("http://localhost:3000/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.1.8" },
        body: JSON.stringify({}),
      });

      const res = await testPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("Test alert sent");
    });
  });
});
