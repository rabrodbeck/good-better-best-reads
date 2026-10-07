import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/layout/providers";
import { Navbar } from "@/components/layout/navbar";

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
  maximumScale: 1,
};

const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://goodbetterbestreads.vercel.app");

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl),
  title: {
    default: "GoodBetterBestReads | AI Book Discovery & Reading DNA",
    template: "%s | GoodBetterBestReads",
  },
  description:
    "Transform your Goodreads or StoryGraph reading history into an active Personal Librarian with semantic taste matching and a shareable Reading DNA card.",
  applicationName: "GoodBetterBestReads",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GBBReads",
  },
  openGraph: {
    type: "website",
    siteName: "GoodBetterBestReads",
    title: "GoodBetterBestReads | AI Book Discovery & Reading DNA",
    description:
      "Transform your reading history into an active Personal Librarian and shareable Reading DNA.",
    images: [
      {
        url: "/api/og/reading-dna",
        width: 1200,
        height: 630,
        alt: "GoodBetterBestReads — Reading DNA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GoodBetterBestReads | AI Book Discovery & Reading DNA",
    description:
      "Transform your reading history into an active Personal Librarian and shareable Reading DNA.",
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
          <main className="flex-1">{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}