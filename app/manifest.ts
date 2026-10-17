import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TBRScout",
    short_name: "TBRScout",
    description:
      "Scan barcodes, discover reading DNA, and scout books for your TBR stack.",
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
