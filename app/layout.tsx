import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/layout/providers";
import { Navbar } from "@/components/layout/navbar";
import { BottomNav } from "@/components/layout/bottom-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://tbrscout.vercel.app");

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl),
  title: {
    default: "TBRScout — Scout Your Next Read Before You Buy",
    template: "%s | TBRScout",
  },
  description:
    "Your in-store reading concierge. Scan barcodes, match your taste DNA, and check series order before buying.",
  applicationName: "TBRScout",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TBRScout",
  },
  openGraph: {
    type: "website",
    siteName: "TBRScout",
    title: "TBRScout — Scout Your Next Read Before You Buy",
    description:
      "Your in-store reading concierge. Scan barcodes, match your taste DNA, and scout books for your TBR stack.",
    images: [
      {
        url: "/api/og/reading-dna",
        width: 1200,
        height: 630,
        alt: "TBRScout — Reading DNA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TBRScout — Scout Your Next Read Before You Buy",
    description:
      "Your in-store reading concierge. Scan barcodes, match your taste DNA, and scout books for your TBR stack.",
    images: ["/api/og/reading-dna"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20 flex flex-col`}
      >
        <AppProviders>
          <Navbar />
          <main className="flex-1 pb-20 md:pb-0">{children}</main>
          <BottomNav />
        </AppProviders>
      </body>
    </html>
  );
}