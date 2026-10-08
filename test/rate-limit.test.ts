import { describe, it, expect, beforeEach } from "vitest";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/test", {
    headers: new Headers(headers),
  });
}

describe("Rate Limiting & Client IP Extraction (SEC / Issue #23)", () => {
  describe("getClientIp", () => {
    it("prioritizes x-vercel-forwarded-for edge header", () => {
      const req = makeRequest({
        "x-vercel-forwarded-for": "198.51.100.22",
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
        "x-real-ip": "10.0.0.1",
      });
      expect(getClientIp(req)).toBe("198.51.100.22");
    });

    it("prioritizes cf-connecting-ip over x-real-ip and x-forwarded-for", () => {
      const req = makeRequest({
        "cf-connecting-ip": "198.51.100.33",
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
        "x-real-ip": "10.0.0.1",
      });
      expect(getClientIp(req)).toBe("198.51.100.33");
    });

    it("prioritizes x-real-ip over x-forwarded-for", () => {
      const req = makeRequest({
        "x-real-ip": "198.51.100.44",
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      });
      expect(getClientIp(req)).toBe("198.51.100.44");
    });

    it("extracts the rightmost IP from x-forwarded-for to prevent spoofing", () => {
      // Attacker injected 1.1.1.1 on leftmost; proxy appended authentic IP 203.0.113.99 on right
      const req = makeRequest({
        "x-forwarded-for": "1.1.1.1, 10.0.0.5, 203.0.113.99",
      });
      expect(getClientIp(req)).toBe("203.0.113.99");
    });

    it("handles single IP in x-forwarded-for with whitespace correctly", () => {
      const req = makeRequest({
        "x-forwarded-for": "   203.0.113.50   ",
      });
      expect(getClientIp(req)).toBe("203.0.113.50");
    });

    it("handles trailing commas or empty segments in x-forwarded-for", () => {
      const req = makeRequest({
        "x-forwarded-for": "1.2.3.4, 5.6.7.8, ,  ",
      });
      expect(getClientIp(req)).toBe("5.6.7.8");
    });

    it("falls back to 127.0.0.1 when no IP headers are present", () => {
      const req = makeRequest({});
      expect(getClientIp(req)).toBe("127.0.0.1");
    });
  });

  describe("checkRateLimit", () => {
    const testId = () => `test-ip-${Math.random()}`;

    it("tracks allowed requests and decrements remaining count", () => {
      const id = testId();
      const r1 = checkRateLimit(id, { maxRequests: 3, windowMs: 10_000 });
      expect(r1.success).toBe(true);
      expect(r1.remaining).toBe(2);

      const r2 = checkRateLimit(id, { maxRequests: 3, windowMs: 10_000 });
      expect(r2.success).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = checkRateLimit(id, { maxRequests: 3, windowMs: 10_000 });
      expect(r3.success).toBe(true);
      expect(r3.remaining).toBe(0);

      // 4th request must be blocked
      const r4 = checkRateLimit(id, { maxRequests: 3, windowMs: 10_000 });
      expect(r4.success).toBe(false);
      expect(r4.remaining).toBe(0);
    });

    it("isolates counters between different identifiers", () => {
      const id1 = testId();
      const id2 = testId();

      const r1 = checkRateLimit(id1, { maxRequests: 1, windowMs: 10_000 });
      expect(r1.success).toBe(true);

      const r1Blocked = checkRateLimit(id1, { maxRequests: 1, windowMs: 10_000 });
      expect(r1Blocked.success).toBe(false);

      // id2 is still fresh
      const r2 = checkRateLimit(id2, { maxRequests: 1, windowMs: 10_000 });
      expect(r2.success).toBe(true);
    });
  });
});
