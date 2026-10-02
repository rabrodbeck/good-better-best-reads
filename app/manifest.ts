import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GoodBetterBestReads — AI Personal Librarian",
    short_name: "GBBReads",
    description:
      "Transform your reading history into an active Personal Librarian and shareable Reading DNA.",
    start_url: "/",
    display: "standalone",
    background_color: "#070a12",
    theme_color: "#10b981",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
