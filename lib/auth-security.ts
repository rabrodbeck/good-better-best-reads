/**
 * Validates and sanitizes a post-authentication redirect path.
 * Guards against Open Redirect vulnerabilities (protocol-relative URLs like `//evil.com`,
 * scheme injections, backslash confusion `/\evil.com`, and external URLs).
 */
export function sanitizeRedirectPath(rawPath: string | null | undefined): string {
  if (!rawPath || typeof rawPath !== "string") {
    return "/library";
  }

  const trimmed = rawPath.trim();

  // Must begin with a single slash, cannot start with '//', and cannot contain backslashes
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return "/library";
  }

  // Reject URLs containing protocol schemes (e.g., /http://evil.com or /javascript:...)
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return "/library";
  }

  // Reject CR/LF control characters that could facilitate HTTP response splitting
  if (/[\r\n]/.test(trimmed)) {
    return "/library";
  }

  return trimmed;
}

/**
 * Validates whether an incoming forwarded host header belongs to an approved
 * deployment or local domain before using it for redirects.
 */
export function isAllowedHost(host: string | null | undefined): boolean {
  if (!host) return false;

  const normalized = host.toLowerCase().trim();

  // Allow local development hosts with optional port
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
    return true;
  }

  // Allow standard Vercel deployments and preview URLs
  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.vercel\.app$/.test(normalized)) {
    return true;
  }

  // Check against explicit application environment variables if configured
  const envHosts = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ]
    .filter(Boolean)
    .map((url) => {
      try {
        return new URL(url as string).host.toLowerCase();
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return envHosts.includes(normalized);
}

/**
 * Resolves the safe absolute redirect URL after successful OAuth exchange.
 */
export function resolveSafeRedirectUrl(
  rawNext: string | null | undefined,
  requestOrigin: string,
  forwardedHost?: string | null,
  isLocalEnv: boolean = process.env.NODE_ENV === "development"
): string {
  const safePath = sanitizeRedirectPath(rawNext);

  if (!isLocalEnv && forwardedHost && isAllowedHost(forwardedHost)) {
    return `https://${forwardedHost}${safePath}`;
  }

  return `${requestOrigin}${safePath}`;
}
