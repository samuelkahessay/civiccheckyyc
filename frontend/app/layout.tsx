import type { Metadata } from "next";
import "./globals.css";
import { TremorColorSafelist } from "@/components/TremorColorSafelist";
import { Navigation } from "@/components/Navigation";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "CivicCheckYYC - Calgary Election 2025",
    template: "%s | CivicCheckYYC"
  },
  description: "What they say. What they did. What it means. Track voting records of Calgary mayoral candidates.",
  keywords: ["Calgary", "election", "2025", "mayoral", "candidates", "voting records", "city council", "YYC"],
  authors: [{ name: "CivicCheckYYC" }],
  creator: "CivicCheckYYC",
  publisher: "CivicCheckYYC",
  icons: {
    icon: {
      url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🗳️</text></svg>",
      type: "image/svg+xml",
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_CA',
    url: absoluteUrl(),
    siteName: 'CivicCheckYYC',
    title: 'CivicCheckYYC - Calgary Election 2025',
    description: 'Track voting records of Calgary mayoral candidates. Beyond promises. Real votes.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'CivicCheckYYC — Track Calgary council voting records. Beyond promises. Real votes.',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CivicCheckYYC - Calgary Election 2025',
    description: 'Track voting records of Calgary mayoral candidates.',
    creator: '@civiccheckyyc',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark:bg-gray-950">
      <body className="antialiased">
        {/* Calgary civic stripe */}
        <div className="h-[3px] bg-red-700 dark:bg-red-600" aria-hidden="true" />
        {/* Skip to main content link for screen readers and keyboard navigation */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-red-700 focus:text-white focus:rounded-md focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        {/* Safelist Tremor chart fill utilities so donut colors render */}
        <TremorColorSafelist />
        <Navigation />
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
