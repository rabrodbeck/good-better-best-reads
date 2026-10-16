import { describe, it, expect, vi, beforeEach } from "vitest";
import { runWeekendReadingNudge, getIsoWeek } from "@/lib/nudge";
import { GET as cronGet } from "@/app/api/cron/notifications/route";
import { createAndDispatchNotification } from "@/lib/notifications";

const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("@/lib/notifications", () => ({
  createAndDispatchNotification: vi.fn().mockResolvedValue({
    notificationId: "notif-nudge-123",
    inAppCreated: true,
    pushSentCount: 1,
    pushSuppressed: false,
  }),
}));

describe("Phase 6 / Step 6: Context-Aware Weekend Reading Nudge (Issue #63)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getIsoWeek", () => {
    it("returns formatted ISO week string", () => {
      const week = getIsoWeek(new Date("2026-10-16T12:00:00Z"));
      expect(week).toBe("2026-W42");
    });
  });

  describe("runWeekendReadingNudge", () => {
    it("skips user who already has a book in 'currently-reading' (active reader)", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) =>
              resolve({
                data: [
                  {
                    id: "user-active",
                    display_name: "Active Reader",
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
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "ub-1",
                  shelf: "currently-reading",
                  books: { id: "b-1", title: "Active Book" },
                },
                {
                  id: "ub-2",
                  shelf: "to-read",
                  books: { id: "b-2", title: "TBR Book" },
                },
              ],
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const res = await runWeekendReadingNudge();
      expect(res.nudgesSent).toBe(0);
      expect(res.skippedActiveReaders).toBe(1);
      expect(createAndDispatchNotification).not.toHaveBeenCalled();
    });

    it("skips user who has 0 books on their 'to-read' shelf", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) =>
              resolve({
                data: [
                  {
                    id: "user-empty",
                    display_name: "Empty Shelf",
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
            in: vi.fn().mockResolvedValue({
              data: [], // No currently-reading and no to-read
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const res = await runWeekendReadingNudge();
      expect(res.nudgesSent).toBe(0);
      expect(res.skippedEmptyTbr).toBe(1);
      expect(createAndDispatchNotification).not.toHaveBeenCalled();
    });

    it("dispatches weekend nudge when user has 0 currently-reading and >=1 to-read", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) =>
              resolve({
                data: [
                  {
                    id: "user-ready",
                    display_name: "Ready Reader",
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
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "ub-10",
                  shelf: "to-read",
                  books: {
                    id: "b-10",
                    title: "Project Hail Mary",
                    author: "Andy Weir",
                    cover_url: "https://example.com/hail-mary.jpg",
                  },
                },
              ],
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const res = await runWeekendReadingNudge({
        currentDate: new Date("2026-10-16T16:30:00Z"),
      });

      expect(res.nudgesSent).toBe(1);
      expect(createAndDispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-ready",
          type: "weekend_nudge",
          title: "☕ Weekend Reading Pick",
          body: expect.stringContaining("Project Hail Mary"),
          data: expect.objectContaining({
            url: "/library?shelf=to-read",
            week: "2026-W42",
            bookId: "b-10",
            bookTitle: "Project Hail Mary",
          }),
        })
      );
    });

    it("is idempotent: skips user already notified during the current ISO week", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) =>
              resolve({
                data: [
                  {
                    id: "user-ready",
                    display_name: "Ready Reader",
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
            // Already notified for current week
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: "notif-prev" }, error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const res = await runWeekendReadingNudge();
      expect(res.nudgesSent).toBe(0);
      expect(res.skippedAlreadyNotified).toBe(1);
      expect(createAndDispatchNotification).not.toHaveBeenCalled();
    });

    it("skips user who turned off weekend nudges in preferences", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) =>
              resolve({
                data: [
                  {
                    id: "user-optout",
                    display_name: "Opted Out",
                    notification_preferences: { weekend_nudges: false },
                  },
                ],
                error: null,
              }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const res = await runWeekendReadingNudge();
      expect(res.nudgesSent).toBe(0);
      expect(res.skippedOptedOut).toBe(1);
      expect(createAndDispatchNotification).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/cron/notifications?type=weekend-nudge", () => {
    it("handles weekend-nudge trigger successfully", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) => resolve({ data: [], error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const req = new Request("http://localhost:3000/api/cron/notifications?type=weekend-nudge");
      const res = await cronGet(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.type).toBe("weekend-nudge");
      expect(data.result).toHaveProperty("currentWeek");
    });
  });
});
