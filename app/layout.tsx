import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "GoodBetterBestReads | AI Book Discovery & Reading DNA",
  description:
    "Transform your reading history into an intelligent Personal Librarian with semantic taste matching and shareable Reading DNA.",
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