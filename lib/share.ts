/**
 * Native Web Share API Integration (Issue #44)
 * Handles native iOS/Android system share sheet with graceful clipboard copy fallback.
 */

export interface ShareResult {
  success: boolean;
  method: "native" | "clipboard" | "none";
  message: string;
}

export function canUseNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export async function shareContent(data: {
  title: string;
  text: string;
  url: string;
}): Promise<ShareResult> {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://goodbetterbestreads.vercel.app";
  const shareUrl = data.url.startsWith("http") ? data.url : `${origin}${data.url.startsWith("/") ? "" : "/"}${data.url}`;

  // 1. Try Native Web Share API (iOS, Android, macOS Safari, Windows Edge)
  if (canUseNativeShare()) {
    try {
      await navigator.share({
        title: data.title,
        text: data.text,
        url: shareUrl,
      });
      return {
        success: true,
        method: "native",
        message: "Shared successfully!",
      };
    } catch (err: any) {
      // User cancelled share sheet (AbortError) -> not a hard failure
      if (err.name === "AbortError") {
        return {
          success: false,
          method: "none",
          message: "Share cancelled.",
        };
      }
      // If native share failed for another reason, proceed to clipboard fallback
      console.warn("Native share failed, falling back to clipboard:", err);
    }
  }

  // 2. Clipboard Fallback
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      return {
        success: true,
        method: "clipboard",
        message: "Link copied to clipboard!",
      };
    } catch (clipErr) {
      console.error("Clipboard copy failed:", clipErr);
    }
  }

  // 3. Document ExecCommand Fallback
  if (typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (copied) {
        return {
          success: true,
          method: "clipboard",
          message: "Link copied to clipboard!",
        };
      }
    } catch {}
  }

  return {
    success: false,
    method: "none",
    message: "Could not share or copy link on this device.",
  };
}

export async function shareBook(book: {
  id?: string;
  book_id?: string;
  title: string;
  author: string;
}): Promise<ShareResult> {
  const identifier = book.book_id || book.id || encodeURIComponent(book.title);
  return shareContent({
    title: `${book.title} by ${book.author} | GoodBetterBestReads`,
    text: `Check out "${book.title}" by ${book.author} on GoodBetterBestReads!`,
    url: `/library?book=${identifier}`,
  });
}

export async function shareReadingDna(taste: {
  archetype_name: string;
  archetype_summary?: string;
  user_id?: string;
}): Promise<ShareResult> {
  const url = taste.user_id ? `/dna?user=${encodeURIComponent(taste.user_id)}` : "/dna";
  return shareContent({
    title: `${taste.archetype_name} — Verified Reading DNA`,
    text: `Discover my literary taste archetype (${taste.archetype_name}) on GoodBetterBestReads!`,
    url,
  });
}

export async function shareLibrary(options?: {
  displayName?: string;
  userId?: string;
}): Promise<ShareResult> {
  const url = options?.userId ? `/friends/${options.userId}/library` : "/library";
  const name = options?.displayName || "My";
  return shareContent({
    title: `${name} Reading Shelves | GoodBetterBestReads`,
    text: `Explore ${name === "My" ? "my" : `${name}'s`} cataloged book shelves and reading progress on GoodBetterBestReads!`,
    url,
  });
}
