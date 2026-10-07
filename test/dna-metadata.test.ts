import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateMetadata } from "@/app/dna/page";

describe("Reading DNA generateMetadata", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://goodbetterbestreads.vercel.app";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("generates default metadata when no user query parameter is provided", async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe("Reading DNA Card | GoodBetterBestReads");
    expect(metadata.metadataBase).toBeDefined();

    const images = Array.isArray(metadata.openGraph?.images)
      ? metadata.openGraph?.images
      : [];
    expect(images.length).toBeGreaterThan(0);

    const imageUrl = (images[0] as { url: string }).url;
    expect(imageUrl).toMatch(/^https?:\/\//);
    expect(imageUrl).toBe("https://goodbetterbestreads.vercel.app/api/og/reading-dna");
    expect(imageUrl).not.toContain("userId=");
  });

  it("appends user query parameter to absolute OG image URL and canonical link", async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ user: "usr_abc123" }),
    });

    const images = Array.isArray(metadata.openGraph?.images)
      ? metadata.openGraph?.images
      : [];
    const imageUrl = (images[0] as { url: string }).url;

    expect(imageUrl).toMatch(/^https?:\/\//);
    expect(imageUrl).toBe("https://goodbetterbestreads.vercel.app/api/og/reading-dna?userId=usr_abc123");
    expect(metadata.openGraph?.url).toBe("https://goodbetterbestreads.vercel.app/dna?user=usr_abc123");

    const twitterImages = metadata.twitter?.images as string[];
    expect(twitterImages[0]).toBe("https://goodbetterbestreads.vercel.app/api/og/reading-dna?userId=usr_abc123");
  });

  it("handles userId search parameter synonymously", async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ userId: "usr_xyz789" }),
    });

    const images = Array.isArray(metadata.openGraph?.images)
      ? metadata.openGraph?.images
      : [];
    const imageUrl = (images[0] as { url: string }).url;

    expect(imageUrl).toBe("https://goodbetterbestreads.vercel.app/api/og/reading-dna?userId=usr_xyz789");
  });
});
