import type React from "react"
import type { Metadata } from "next"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"
import { ErrorReporter, ConsoleReporter, ReactErrorBoundary } from "@/components/error-reporter"
import { AppAnalytics } from "@/components/app-analytics"
import { AppProvider } from "@/components/tj/app-context"

export const metadata: Metadata = {
  title: { default: "ترب‌جو | مقایسهٔ قیمت و خرید حضوری", template: "%s | ترب‌جو" },
  description: "قیمت کالاها را در فروشگاه‌های حضوری تهران مقایسه کن، نزدیک‌ترین فروشنده را پیدا کن و با دستیار هوشمند خرید کن.",
  icons: "/icon.svg",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className="font-sans antialiased">
        <ReactErrorBoundary>
          <AppProvider>{children}</AppProvider>
        </ReactErrorBoundary>
        <Toaster position="top-center" dir="rtl" />
        <ErrorReporter />
        <ConsoleReporter />
        <AppAnalytics />
      </body>
    </html>
  );
}
