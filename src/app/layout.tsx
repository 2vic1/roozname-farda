import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "روزنامه فردا | هشدار جنگ و پیش‌بینی بازارها",
  description:
    "روزنامه فردا — خبرهای فردا را امروز بخوان: هشدار زودهنگام ریسک جنگ، پیش‌بینی ۳۰ روزه بازارها (تحلیل تکنیکال، چرخه‌های بلندمدت، استرولوژی مالی)، سیگنال‌های خبری، پروازهای نظامی و تحلیل هوش مصنوعی",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} dark`}
      suppressHydrationWarning
    >
      <body
        className={`${vazirmatn.className} min-h-screen antialiased bg-zinc-950 text-zinc-100`}
      >
        {children}
        <Toaster theme="dark" position="bottom-center" richColors />
      </body>
    </html>
  );
}
