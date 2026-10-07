export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
}

interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix timestamp in milliseconds
}

// In-memory sliding window cache for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Periodic cleanup every 60 seconds to prevent unbounded memory growth
let lastCleanup = Date.now();
function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup > 60_000) {
    lastCleanup = now;
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt <= now) {
        rateLimitStore.delete(key);
      }
    }
  }
}

/**
 * Checks if a given identifier exceeds the configured rate limit window.
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  cleanupExpired();
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return {
      success: true,
      limit: options.maxRequests,
      remaining: options.maxRequests - 1,
      reset: Math.ceil((now + options.windowMs) / 1000),
    };
  }

  if (entry.count >= options.maxRequests) {
    return {
      success: false,
      limit: options.maxRequests,
      remaining: 0,
      reset: Math.ceil(entry.resetAt / 1000),
    };
  }

  entry.count += 1;
  return {
    success: true,
    limit: options.maxRequests,
    remaining: options.maxRequests - entry.count,
    reset: Math.ceil(entry.resetAt / 1000),
  };
}

/**
 * Extracts client IP from standard request headers.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}
