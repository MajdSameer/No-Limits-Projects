import "./globals.css";

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { brandColors, company } from "@nlr/config/brand";
import { SkipLink } from "@nlr/ui";

// Self-hosted brand fonts (OFL licences sit alongside the files in ./fonts).
// Big Shoulders: condensed display face with truck-signage energy — headlines
// only. Work Sans: friendly humanist body face.
const displayFont = localFont({
  src: [
    { path: "./fonts/BigShoulders-Regular.ttf", weight: "400" },
    { path: "./fonts/BigShoulders-Bold.ttf", weight: "700" },
  ],
  variable: "--font-display-local",
  display: "swap",
});

const bodyFont = localFont({
  src: [
    { path: "./fonts/WorkSans-Regular.ttf", weight: "400" },
    { path: "./fonts/WorkSans-Bold.ttf", weight: "700" },
  ],
  variable: "--font-body-local",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? company.url),
  // TODO(new app): replace the title and description for your app.
  title: {
    default: `App Template | ${company.name}`,
    template: `%s | ${company.name}`,
  },
  description: `${company.tagline} Built by ${company.name}.`,
  openGraph: {
    siteName: company.name,
    locale: "en_AU",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: brandColors.navy,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="flex min-h-dvh flex-col bg-white font-sans text-slate-900 antialiased">
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
