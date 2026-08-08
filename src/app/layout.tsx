import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthGuard } from "@/lib/supabase/auth-guard";
import ErrorBoundary from "@/components/error-boundary";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-display",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "GYMX — carnet de musculation",
  description: "Suivi de musculation personnel",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GYMX",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${geist.variable} ${geistMono.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GYMX" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body className="safe-area-top safe-area-bottom">
        <ErrorBoundary><AuthGuard>{children}</AuthGuard></ErrorBoundary>
      </body>
    </html>
  );
}
