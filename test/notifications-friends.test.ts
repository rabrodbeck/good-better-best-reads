import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as recPost } from "@/app/api/friends/recommendations/route";
import { PATCH as recPatch } from "@/app/api/friends/recommendations/[id]/route";
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
  createAndDispatchNotification: vi.fn().mockResolvedValue({
    notificationId: "notif-rec-123",
    inAppCreated: true,
    pushSentCount: 1,
    pushSuppressed: false,
  }),
}));

describe("Phase 6 / Step 4: Friend Recommendation Alerts (Issue #60)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/friends/recommendations", () => {
    it("returns 401 Unauthorized for unauthenticated requests", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });

      const req = new Request("http://localhost:3000/api/friends/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: "user-2", bookId: "book-1" }),
      });

      const res = await recPost(req);
      expect(res.status).toBe(401);
      expect(createAndDispatchNotification).not.toHaveBeenCalled();
    });

    it("rejects recommending a book to yourself with 400", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "user-1", email: "user1@example.com" } },
      });

      const req = new Request("http://localhost:3000/api/friends/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: "user-1", bookId: "book-1" }),
      });

      const res = await recPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("cannot recommend a book to yourself");
      expect(createAndDispatchNotification).not.toHaveBeenCalled();
    });

    it("returns 403 Forbidden if sender and recipient are not mutual friends", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "user-1", email: "user1@example.com" } },
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "friendships") {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
        };
      });

      const req = new Request("http://localhost:3000/api/friends/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: "user-2", bookId: "book-1" }),
      });

      const res = await recPost(req);
      expect(res.status).toBe(403);
      expect(createAndDispatchNotification).not.toHaveBeenCalled();
    });

    it("creates recommendation and dispatches friend_recommendation alert to recipient", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "user-1",
            email: "alice@example.com",
            user_metadata: { full_name: "Alice Reader" },
          },
        },
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "friendships") {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: "friendship-1" }, error: null }),
          };
        }
        if (table === "books") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "book-100",
                title: "Tomorrow, and Tomorrow, and Tomorrow",
                author: "Gabrielle Zevin",
                cover_url: "https://example.com/cover.jpg",
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
                    id: "rec-999",
                    note: "You will love this video game story!",
                    status: "unread",
                    created_at: new Date().toISOString(),
                    book: {
                      id: "book-100",
                      title: "Tomorrow, and Tomorrow, and Tomorrow",
                      author: "Gabrielle Zevin",
                      cover_url: "https://example.com/cover.jpg",
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
        return {
          select: vi.fn().mockReturnThis(),
        };
      });

      const req = new Request("http://localhost:3000/api/friends/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: "user-2",
          bookId: "book-100",
          note: "You will love this video game story!",
        }),
      });

      const res = await recPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.recommendation.id).toBe("rec-999");

      // Verify createAndDispatchNotification was called with friend_recommendation
      expect(createAndDispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-2",
          type: "friend_recommendation",
          title: "📚 Alice recommended a book!",
          body: expect.stringContaining("You will love this video game story!"),
          data: expect.objectContaining({
            url: "/library?shelf=recommended",
            recommendationId: "rec-999",
            bookId: "book-100",
            senderId: "user-1",
            senderName: "Alice",
          }),
        })
      );
    });
  });

  describe("PATCH /api/friends/recommendations/[id]", () => {
    it("accepts recommendation, queues to to-read shelf, and dispatches notification to sender", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: {
            id: "user-2",
            email: "bob@example.com",
            user_metadata: { full_name: "Bob Reader" },
          },
        },
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "book_recommendations") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "rec-999",
                recipient_id: "user-2",
                sender_id: "user-1",
                book_id: "book-100",
                status: "unread",
              },
              error: null,
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "rec-999", status: "accepted" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "user_books") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { display_name: "Bob" },
              error: null,
            }),
          };
        }
        if (table === "books") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { title: "Tomorrow, and Tomorrow, and Tomorrow" },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
        };
      });

      const req = new Request("http://localhost:3000/api/friends/recommendations/rec-999", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });

      const res = await recPatch(req, {
        params: Promise.resolve({ id: "rec-999" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify sender was notified about acceptance
      expect(createAndDispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          type: "friend_recommendation",
          title: "✨ Recommendation queued!",
          body: expect.stringContaining("Bob added \"Tomorrow, and Tomorrow, and Tomorrow\" to their To-Read shelf."),
          data: expect.objectContaining({
            recommendationId: "rec-999",
            bookId: "book-100",
            recipientId: "user-2",
            recipientName: "Bob",
          }),
        })
      );
    });
  });
});
