import type { Metadata } from "next";
import { Inter, Oxanium } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "../components/locale-provider";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const socialImage = new URL("og.svg", siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`).toString();

const display = Oxanium({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    siteUrl,
  ),
  title: "MAL Eternal — My Achievements List",
  description: "Enter the chronicle. Record every victory and make it eternal.",
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
  },
  openGraph: {
    title: "MAL Eternal — My Achievements List",
    description: "Every victory deserves to be remembered.",
    type: "website",
    images: [{ url: socialImage, width: 1670, height: 940 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MAL Eternal — My Achievements List",
    description: "Every victory deserves to be remembered.",
    images: [socialImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable}`}><LocaleProvider>{children}</LocaleProvider></body>
    </html>
  );
}
