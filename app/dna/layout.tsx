import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reading DNA Card",
  description:
    "Explore your verified literary archetype, dominant emotional tone, and preferred narrative pacing on GoodBetterBestReads.",
  openGraph: {
    type: "website",
    title: "Reading DNA Card | GoodBetterBestReads",
    description:
      "Explore your verified literary archetype, dominant emotional tone, and preferred narrative pacing on GoodBetterBestReads.",
    images: [
      {
        url: "/api/og/reading-dna",
        width: 1200,
        height: 630,
        alt: "GoodBetterBestReads — Reading DNA Card",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reading DNA Card | GoodBetterBestReads",
    description:
      "Explore your verified literary archetype, dominant emotional tone, and preferred narrative pacing on GoodBetterBestReads.",
    images: ["/api/og/reading-dna"],
  },
};

export default function DnaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
