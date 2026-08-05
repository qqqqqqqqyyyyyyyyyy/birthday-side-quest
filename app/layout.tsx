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
    description: "把蛋糕放进现实，再亲手点亮并吹灭蜡烛的 AR 生日小冒险。",
    openGraph: {
      title: "生日支线任务",
      description: "把蛋糕送进现实 · 仅限今日",
      type: "website",
      locale: "zh_CN",
      images: [{ url: previewImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "生日支线任务",
      description: "把蛋糕送进现实 · 仅限今日",
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
