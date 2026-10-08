import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "営業管理ダッシュボード",
  description: "トップチーム 5人の営業実績（2026年7〜9月）",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen">
        <Suspense fallback={<div className="h-28 border-b border-line bg-surface" />}>
          <Header />
        </Suspense>
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
