import type { Metadata } from "next";
import "./globals.css";

function getSiteBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL);
  }

  if (process.env.GITHUB_PAGES === "true" && process.env.GITHUB_REPOSITORY) {
    const [owner, repository] = process.env.GITHUB_REPOSITORY.split("/");
    const path = repository === `${owner}.github.io` ? "" : `${repository}/`;
    return new URL(`https://${owner}.github.io/${path}`);
  }

  return new URL(
    "https://birthday-side-quest-hqy.light-boot-8679.chatgpt.site/",
  );
}

const siteBaseUrl = getSiteBaseUrl();
const previewImage = new URL("og.png", siteBaseUrl).toString();

export const metadata: Metadata = {
  metadataBase: siteBaseUrl,
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
