import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lenny 搜索 · AI开发与产品方法",
  description: "搜索 Lenny's Newsletter & Podcast 的访谈内容,快速定位 AI 产品、工程管理、创业方法论的见解。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="min-h-screen bg-stone-50 text-stone-800 antialiased">
        <header className="sticky top-0 z-20 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="text-xl">🎙️</span>
              <span>Lenny 搜索</span>
              <span className="hidden text-sm font-normal text-stone-500 sm:inline">· AI开发与产品方法</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded px-3 py-1.5 text-stone-600 hover:bg-stone-200/70 hover:text-stone-900">
                搜索
              </Link>
              <Link href="/ask" className="rounded px-3 py-1.5 text-stone-600 hover:bg-stone-200/70 hover:text-stone-900">
                AI 问答
              </Link>
              <a
                href="https://github.com/LennysNewsletter/lennys-newsletterpodcastdata"
                target="_blank"
                rel="noopener"
                className="rounded px-3 py-1.5 text-stone-400 hover:text-stone-900"
                title="数据来源"
              >
                数据源 ↗
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-stone-400">
          <p>
            内容版权归原作者 Lenny Rachitsky 所有 · 仅用于个人学习与作品集展示 ·{" "}
            <a className="underline" href="https://www.lennysnewsletter.com" target="_blank" rel="noopener">
              订阅原文
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
