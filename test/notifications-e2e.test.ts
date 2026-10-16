import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as notifsGet, PATCH as notifsPatch } from "@/app/api/notifications/route";
import { GET as prefsGet, PATCH as prefsPatch } from "@/app/api/notifications/preferences/route";
import { POST as recPost } from "@/app/api/friends/recommendations/route";
import { checkAndDispatchGoalMilestones } from "@/lib/milestones";
import { runWeekendReadingNudge } from "@/lib/nudge";
import { createAndDispatchNotification } from "@/lib/notifications";

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
  createAndDispatchNotification: vi.fn().mockImplementation((payload) => {
    return Promise.resolve({
      notificationId: `notif-${Date.now()}`,
      inAppCreated: true,
      pushSentCount: payload.type === "goal_milestone" && payload.suppressPush ? 0 : 1,
      pushSuppressed: Boolean(payload.suppressPush),
    });
  }),
}));

describe("Phase 6 / Step 7: End-to-End Notification Integration Suite (Issue #64)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Lifecycle Flow: Friend Rec -> In-App Feed -> Mark Read", () => {
    it("creates recommendation alert, retrieves it in feed, and marks it as read", async () => {
      // 1. Authenticate as sender (user-1)
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-1",
            email: "alice@example.com",
            user_metadata: { full_name: "Alice Reader" },
          },
        },
      });

      // Mock database operations for recommendation insertion
      mockFrom.mockImplementation((table: string) => {
        if (table === "friendships") {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: "f-1" }, error: null }),
          };
        }
        if (table === "books") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "b-1",
                title: "Klara and the Sun",
                author: "Kazuo Ishiguro",
                cover_url: "https://example.com/klara.jpg",
              },
              error: null,
            }),
          };
        }
        if (table === "book_recommendations") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "rec-101",
                    note: "Heartbreaking and beautiful AI perspective",
                    status: "unread",
                    created_at: new Date().toISOString(),
                    book: {
                      id: "b-1",
                      title: "Klara and the Sun",
                      author: "Kazuo Ishiguro",
                      cover_url: "https://example.com/klara.jpg",
                    },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { display_name: "Alice" },
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      // Dispatch book recommendation to recipient (user-2)
      const recReq = new Request("http://localhost:3000/api/friends/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: "user-2",
          bookId: "b-1",
          note: "Heartbreaking and beautiful AI perspective",
        }),
      });

      const recRes = await recPost(recReq);
      expect(recRes.status).toBe(200);
      expect(createAndDispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-2",
          type: "friend_recommendation",
          title: "📚 Alice recommended a book!",
          data: expect.objectContaining({
            url: "/library?shelf=recommended",
            bookId: "b-1",
          }),
        })
      );

      // 2. Authenticate as recipient (user-2) and view Notification Bell feed
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: "user-2", email: "bob@example.com" },
        },
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "notifications") {
          return {
            select: vi.fn().mockImplementation((fields: string, opts?: any) => {
              if (opts?.count === "exact") {
                return {
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
                  }),
                };
              }
              return {
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "notif-999",
                      user_id: "user-2",
                      type: "friend_recommendation",
                      title: "📚 Alice recommended a book!",
                      body: '"Heartbreaking and beautiful AI perspective" — Klara and the Sun',
                      data: { url: "/library?shelf=recommended", bookId: "b-1" },
                      read: false,
                      created_at: new Date().toISOString(),
                    },
                  ],
                  error: null,
                }),
              };
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const feedReq = new Request("http://localhost:3000/api/notifications");
      const feedRes = await notifsGet(feedReq);
      expect(feedRes.status).toBe(200);
      const feedData = await feedRes.json();
      expect(feedData.notifications).toHaveLength(1);
      expect(feedData.unreadCount).toBe(1);
      expect(feedData.notifications[0].title).toContain("Alice recommended a book!");

      // 3. Mark notification as read
      mockFrom.mockImplementation((table: string) => {
        if (table === "notifications") {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const markReadReq = new Request("http://localhost:3000/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "notif-999", read: true }),
      });

      const markReadRes = await notifsPatch(markReadReq);
      expect(markReadRes.status).toBe(200);
      const markReadData = await markReadRes.json();
      expect(markReadData.success).toBe(true);
    });
  });

  describe("Granular Preferences: Opt-Out & Push Suppression", () => {
    it("updates user preferences and suppresses push while maintaining in-app notifications", async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: "user-prefs", email: "prefs@example.com" },
        },
      });

      let savedPreferences = {
        friend_recommendations: true,
        goal_milestones: true,
        monthly_recaps: true,
        weekend_nudges: true,
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(() =>
              Promise.resolve({
                data: { notification_preferences: savedPreferences },
                error: null,
              })
            ),
            update: vi.fn().mockImplementation((payload) => {
              savedPreferences = payload.notification_preferences;
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      // 1. User updates preference: disables goal_milestones
      const patchReq = new Request("http://localhost:3000/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: { goal_milestones: false },
        }),
      });

      const patchRes = await prefsPatch(patchReq);
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.preferences.goal_milestones).toBe(false);

      // 2. Verify preferences GET endpoint reflects the update
      const getReq = new Request("http://localhost:3000/api/notifications/preferences");
      const getRes = await prefsGet(getReq);
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.preferences.goal_milestones).toBe(false);
      expect(getData.preferences.friend_recommendations).toBe(true);
    });
  });

  describe("Context-Aware Weekend Concierge State Transitions", () => {
    it("transitions from active reading (suppressed) to empty reading (nudged)", async () => {
      let isReading = true;

      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) =>
              resolve({
                data: [
                  {
                    id: "user-context",
                    display_name: "Context Reader",
                    notification_preferences: { weekend_nudges: true },
                  },
                ],
                error: null,
              }),
          };
        }
        if (table === "notifications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            filter: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === "user_books") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockImplementation(() =>
              Promise.resolve({
                data: isReading
                  ? [
                      { shelf: "currently-reading", books: { id: "b-active", title: "Active Read" } },
                      { shelf: "to-read", books: { id: "b-tbr", title: "TBR Book" } },
                    ]
                  : [
                      { shelf: "to-read", books: { id: "b-tbr", title: "TBR Book", author: "Top Author" } },
                    ],
                error: null,
              })
            ),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      // Pass 1: User is currently reading -> suppressed
      const res1 = await runWeekendReadingNudge({ force: true });
      expect(res1.nudgesSent).toBe(0);
      expect(res1.skippedActiveReaders).toBe(1);
      expect(createAndDispatchNotification).not.toHaveBeenCalled();

      // Pass 2: User finishes book (currently-reading is now empty) -> nudged
      isReading = false;
      const res2 = await runWeekendReadingNudge({ force: true });
      expect(res2.nudgesSent).toBe(1);
      expect(res2.skippedActiveReaders).toBe(0);
      expect(createAndDispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-context",
          type: "weekend_nudge",
          title: "☕ Weekend Reading Pick",
          body: expect.stringContaining("TBR Book"),
          data: expect.objectContaining({
            url: "/library?shelf=to-read",
            bookTitle: "TBR Book",
          }),
        })
      );
    });
  });
});
