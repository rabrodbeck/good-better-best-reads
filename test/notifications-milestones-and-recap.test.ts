import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAndDispatchGoalMilestones, runMonthlyReadingRecap } from "@/lib/milestones";
import { GET as cronGet, POST as cronPost } from "@/app/api/cron/notifications/route";
import { createAndDispatchNotification } from "@/lib/notifications";

const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("@/lib/notifications", () => ({
  createAndDispatchNotification: vi.fn().mockResolvedValue({
    notificationId: "notif-mock-123",
    inAppCreated: true,
    pushSentCount: 1,
    pushSuppressed: false,
  }),
}));

describe("Phase 6 / Step 5: Annual Goal Milestones & Monthly Reading Wrap-ups (Issues #61 & #62)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Goal Milestones Engine (Issue #61)", () => {
    it("does not dispatch a notification when progress is below 25%", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { reading_goal: 20 },
              error: null,
            }),
          };
        }
        if (table === "user_books") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            // 2 books out of 20 = 10%
            then: (resolve: any) =>
              resolve({
                data: [
                  { date_read: "2026-02-01T00:00:00Z" },
                  { date_read: "2026-02-15T00:00:00Z" },
                ],
                error: null,
              }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const res = await checkAndDispatchGoalMilestones("user-1", 2026);
      expect(res.milestoneDispatched).toBeNull();
      expect(res.percentage).toBe(10);
      expect(createAndDispatchNotification).not.toHaveBeenCalled();
    });

    it("dispatches 25% milestone notification when user crosses 25%", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { reading_goal: 12 },
              error: null,
            }),
          };
        }
        if (table === "user_books") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            // 3 books of 12 = 25%
            then: (resolve: any) =>
              resolve({
                data: [
                  { date_read: "2026-01-10T00:00:00Z" },
                  { date_read: "2026-01-20T00:00:00Z" },
                  { date_read: "2026-02-05T00:00:00Z" },
                ],
                error: null,
              }),
          };
        }
        if (table === "notifications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            // No previous milestone notifications
            then: (resolve: any) => resolve({ data: [], error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const res = await checkAndDispatchGoalMilestones("user-1", 2026);
      expect(res.milestoneDispatched).toBe(25);
      expect(createAndDispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          type: "goal_milestone",
          title: "🎉 25% Goal Milestone Reached!",
          body: expect.stringContaining("completed 3 of 12 books"),
          data: expect.objectContaining({
            milestone: 25,
            readCount: 3,
            goal: 12,
            year: 2026,
            url: "/library",
          }),
        })
      );
    });

    it("is idempotent: does not re-dispatch milestone if already recorded in notifications", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { reading_goal: 12 },
              error: null,
            }),
          };
        }
        if (table === "user_books") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) =>
              resolve({
                data: [
                  { date_read: "2026-01-10T00:00:00Z" },
                  { date_read: "2026-01-20T00:00:00Z" },
                  { date_read: "2026-02-05T00:00:00Z" },
                ],
                error: null,
              }),
          };
        }
        if (table === "notifications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            // Already dispatched 25% milestone
            then: (resolve: any) =>
              resolve({
                data: [{ data: { milestone: 25, year: 2026 } }],
                error: null,
              }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const res = await checkAndDispatchGoalMilestones("user-1", 2026);
      expect(res.milestoneDispatched).toBeNull();
      expect(createAndDispatchNotification).not.toHaveBeenCalled();
    });

    it("dispatches 100% challenge completion milestone", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { reading_goal: 4 },
              error: null,
            }),
          };
        }
        if (table === "user_books") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) =>
              resolve({
                data: [
                  { date_read: "2026-01-15T12:00:00Z" },
                  { date_read: "2026-02-15T12:00:00Z" },
                  { date_read: "2026-03-15T12:00:00Z" },
                  { date_read: "2026-04-15T12:00:00Z" },
                ],
                error: null,
              }),
          };
        }
        if (table === "notifications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve: any) =>
              resolve({
                data: [
                  { data: { milestone: 25, year: 2026 } },
                  { data: { milestone: 50, year: 2026 } },
                  { data: { milestone: 75, year: 2026 } },
                ],
                error: null,
              }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const res = await checkAndDispatchGoalMilestones("user-1", 2026);
      expect(res.milestoneDispatched).toBe(100);
      expect(createAndDispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          type: "goal_milestone",
          title: "🏆 Reading Goal Achieved! 100% Complete!",
          body: expect.stringContaining("finished all 4 books for your 2026 Reading Challenge"),
        })
      );
    });
  });

  describe("Monthly Reading Wrap-Up & Cron Trigger (Issue #62)", () => {
    it("aggregates read books and sends monthly recap notification", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "user-alice",
                  display_name: "Alice",
                  notification_preferences: { monthly_recaps: true },
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
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "ub-1",
                  rating: 5,
                  date_read: "2026-10-10T12:00:00Z",
                  books: { title: "Dune", page_count: 688 },
                },
                {
                  id: "ub-2",
                  rating: 4,
                  date_read: "2026-10-25T12:00:00Z",
                  books: { title: "Project Hail Mary", page_count: 496 },
                },
              ],
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      // Target October 2026 (month 9)
      const res = await runMonthlyReadingRecap(9, 2026);
      expect(res.recapsSent).toBe(1);
      expect(res.month).toBe("October");

      expect(createAndDispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-alice",
          type: "monthly_recap",
          title: "📊 Your October Reading Wrap-Up",
          body: expect.stringContaining("finished 2 books and 1,184 pages in October!"),
          data: expect.objectContaining({
            url: "/insights",
            month: "October",
            year: 2026,
            bookCount: 2,
            pageCount: 1184,
          }),
        })
      );
    });

    it("skips users who have opted out of monthly recaps", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "user-bob",
                  display_name: "Bob",
                  notification_preferences: { monthly_recaps: false },
                },
              ],
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const res = await runMonthlyReadingRecap(9, 2026);
      expect(res.recapsSent).toBe(0);
      expect(createAndDispatchNotification).not.toHaveBeenCalled();
    });

    it("triggers via GET /api/cron/notifications?type=monthly-recap", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      const req = new Request("http://localhost:3000/api/cron/notifications?type=monthly-recap&month=10&year=2026");
      const res = await cronGet(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.type).toBe("monthly-recap");
      expect(data.result.month).toBe("October");
    });
  });
});
