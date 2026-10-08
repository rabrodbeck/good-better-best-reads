import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  sanitizeRedirectPath,
  isAllowedHost,
  resolveSafeRedirectUrl,
} from "@/lib/auth-security";

describe("OAuth Security & Safe Redirect Resolution (Issue #20)", () => {
  describe("sanitizeRedirectPath", () => {
    it("allows clean relative internal paths", () => {
      expect(sanitizeRedirectPath("/library")).toBe("/library");
      expect(sanitizeRedirectPath("/dna")).toBe("/dna");
      expect(sanitizeRedirectPath("/dna?user=123-abc")).toBe("/dna?user=123-abc");
      expect(sanitizeRedirectPath("/quiz?step=2&theme=dark")).toBe("/quiz?step=2&theme=dark");
    });

    it("defaults to /library on empty, null, or non-string inputs", () => {
      expect(sanitizeRedirectPath(null)).toBe("/library");
      expect(sanitizeRedirectPath(undefined)).toBe("/library");
      expect(sanitizeRedirectPath("")).toBe("/library");
      expect(sanitizeRedirectPath("   ")).toBe("/library");
    });

    it("neutralizes protocol-relative open redirects (//evil.com)", () => {
      expect(sanitizeRedirectPath("//evil.com")).toBe("/library");
      expect(sanitizeRedirectPath("//attacker.org/phish")).toBe("/library");
      expect(sanitizeRedirectPath("///evil.com")).toBe("/library");
    });

    it("neutralizes backslash tricks (\\evil.com and /\\evil.com)", () => {
      expect(sanitizeRedirectPath("\\evil.com")).toBe("/library");
      expect(sanitizeRedirectPath("/\\evil.com")).toBe("/library");
      expect(sanitizeRedirectPath("/library\\evil.com")).toBe("/library");
      expect(sanitizeRedirectPath("\\\\evil.com\\share")).toBe("/library");
    });

    it("rejects absolute scheme URLs", () => {
      expect(sanitizeRedirectPath("https://evil.com")).toBe("/library");
      expect(sanitizeRedirectPath("http://evil.com/login")).toBe("/library");
      expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/library");
      expect(sanitizeRedirectPath("/https://evil.com")).toBe("/library");
      expect(sanitizeRedirectPath("/javascript:void(0)")).toBe("/library");
    });

    it("rejects CR/LF injection characters", () => {
      expect(sanitizeRedirectPath("/library\r\nSet-Cookie:admin=true")).toBe("/library");
      expect(sanitizeRedirectPath("/library\nInjected-Header:test")).toBe("/library");
    });
  });

  describe("isAllowedHost", () => {
    it("approves localhost and loopback interfaces", () => {
      expect(isAllowedHost("localhost")).toBe(true);
      expect(isAllowedHost("localhost:3000")).toBe(true);
      expect(isAllowedHost("127.0.0.1")).toBe(true);
      expect(isAllowedHost("127.0.0.1:3000")).toBe(true);
    });

    it("approves official Vercel app domains", () => {
      expect(isAllowedHost("goodbetterbestreads.vercel.app")).toBe(true);
      expect(isAllowedHost("good-better-best-reads-git-main-rabrodbeck.vercel.app")).toBe(true);
    });

    it("rejects unauthorized external hosts and subdomain bypass attempts", () => {
      expect(isAllowedHost("evil.com")).toBe(false);
      expect(isAllowedHost("attacker.org")).toBe(false);
      expect(isAllowedHost("vercel.app.evil.com")).toBe(false);
      expect(isAllowedHost("evil-vercel.app")).toBe(false);
      expect(isAllowedHost(null)).toBe(false);
      expect(isAllowedHost("")).toBe(false);
    });
  });

  describe("resolveSafeRedirectUrl", () => {
    const origin = "https://goodbetterbestreads.vercel.app";

    it("resolves safe destination using verified origin", () => {
      const result = resolveSafeRedirectUrl("/dna", origin);
      expect(result).toBe("https://goodbetterbestreads.vercel.app/dna");
    });

    it("rejects spoofed X-Forwarded-Host and falls back to origin", () => {
      const result = resolveSafeRedirectUrl("/library", origin, "evil.com");
      expect(result).toBe("https://goodbetterbestreads.vercel.app/library");
      expect(result).not.toContain("evil.com");
    });

    it("accepts valid Vercel forwarded host in non-local environments", () => {
      const result = resolveSafeRedirectUrl(
        "/library",
        origin,
        "goodbetterbestreads.vercel.app",
        false
      );
      expect(result).toBe("https://goodbetterbestreads.vercel.app/library");
    });

    it("sanitizes open redirect target even with trusted forwarded host", () => {
      const result = resolveSafeRedirectUrl(
        "//malicious-site.com",
        origin,
        "goodbetterbestreads.vercel.app",
        false
      );
      expect(result).toBe("https://goodbetterbestreads.vercel.app/library");
    });
  });
});
