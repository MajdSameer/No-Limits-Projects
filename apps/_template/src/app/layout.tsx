import "./globals.css";

import type { Metadata, Viewport } from "next";

import { brandColors, company } from "@nlr/config/brand";
import { SkipLink } from "@nlr/ui";

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
    <html lang="en-AU">
      <body className="flex min-h-dvh flex-col bg-white font-sans text-slate-900 antialiased">
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
