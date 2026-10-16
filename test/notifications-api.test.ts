import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH, DELETE } from "@/app/api/notifications/route";

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

describe("Phase 6 / Step 2: In-App Notification Center API Routes (Issue #58)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/notifications", () => {
    it("returns 401 Unauthorized when user is not logged in", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });

      const req = new Request("http://localhost:3000/api/notifications", {
        headers: { "x-forwarded-for": "10.0.0.1" },
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns notifications and unread count for authenticated user", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "user-123" } },
      });

      const mockNotifications = [
        {
          id: "notif-1",
          type: "friend_recommendation",
          title: "Sarah recommended a book",
          body: "Check out Project Hail Mary!",
          data: { url: "/library" },
          read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: "notif-2",
          type: "goal_milestone",
          title: "Milestone reached!",
          body: "You're 50% toward your reading goal.",
          data: { url: "/insights" },
          read: true,
          created_at: new Date().toISOString(),
        },
      ];

      // Mock from('notifications').select(...)
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
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: mockNotifications, error: null }),
                  }),
                }),
              };
            }),
          };
        }
        return {};
      });

      const req = new Request("http://localhost:3000/api/notifications", {
        headers: { "x-forwarded-for": "10.0.0.2" },
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.notifications).toHaveLength(2);
      expect(data.unreadCount).toBe(1);
    });
  });

  describe("PATCH /api/notifications", () => {
    it("returns 401 Unauthorized when user is not logged in", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });

      const req = new Request("http://localhost:3000/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.3" },
        body: JSON.stringify({ markAllRead: true }),
      });

      const res = await PATCH(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 Bad Request when neither id nor markAllRead is provided", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "user-123" } },
      });

      const req = new Request("http://localhost:3000/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.4" },
        body: JSON.stringify({}),
      });

      const res = await PATCH(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("Missing 'id' or 'markAllRead'");
    });

    it("marks all notifications as read when markAllRead is true", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "user-123" } },
      });

      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });
      mockFrom.mockReturnValue({ update: mockUpdate });

      const req = new Request("http://localhost:3000/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.5" },
        body: JSON.stringify({ markAllRead: true }),
      });

      const res = await PATCH(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({ read: true });
    });

    it("marks a single notification as read when id is provided", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "user-123" } },
      });

      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });
      mockFrom.mockReturnValue({ update: mockUpdate });

      const req = new Request("http://localhost:3000/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.6" },
        body: JSON.stringify({ id: "notif-abc" }),
      });

      const res = await PATCH(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockEq1).toHaveBeenCalledWith("id", "notif-abc");
    });
  });

  describe("DELETE /api/notifications", () => {
    it("returns 401 Unauthorized when user is not logged in", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });

      const req = new Request("http://localhost:3000/api/notifications?clearAll=true", {
        method: "DELETE",
        headers: { "x-forwarded-for": "10.0.0.7" },
      });

      const res = await DELETE(req);
      expect(res.status).toBe(401);
    });

    it("deletes a single notification when id is provided", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "user-123" } },
      });

      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
      mockFrom.mockReturnValue({ delete: mockDelete });

      const req = new Request("http://localhost:3000/api/notifications?id=notif-xyz", {
        method: "DELETE",
        headers: { "x-forwarded-for": "10.0.0.8" },
      });

      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockEq1).toHaveBeenCalledWith("id", "notif-xyz");
    });

    it("clears all notifications when clearAll=true is provided", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "user-123" } },
      });

      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ delete: mockDelete });

      const req = new Request("http://localhost:3000/api/notifications?clearAll=true", {
        method: "DELETE",
        headers: { "x-forwarded-for": "10.0.0.9" },
      });

      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockEq).toHaveBeenCalledWith("user_id", "user-123");
    });
  });
});
