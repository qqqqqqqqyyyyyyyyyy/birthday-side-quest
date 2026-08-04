import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);
  const previewImage = new URL("/og.png", baseUrl).toString();

  return {
    metadataBase: baseUrl,
    title: "生日支线任务｜给最特别的朋友",
    description: "一场只为寿星开放的互动生日小冒险。",
    openGraph: {
      title: "生日支线任务",
      description: "仅限今日 · 单人副本",
      type: "website",
      locale: "zh_CN",
      images: [{ url: previewImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "生日支线任务",
      description: "仅限今日 · 单人副本",
      images: [previewImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
