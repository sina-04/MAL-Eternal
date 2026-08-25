import type { Metadata } from "next";
import { Inter, Oxanium } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "../components/locale-provider";

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
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "MAL Eternal — My Achievements List",
  description: "Enter the chronicle. Record every victory and make it eternal.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "MAL Eternal — My Achievements List",
    description: "Every victory deserves to be remembered.",
    type: "website",
    images: [{ url: "/og.png", width: 1792, height: 1024 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MAL Eternal — My Achievements List",
    description: "Every victory deserves to be remembered.",
    images: ["/og.png"],
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
