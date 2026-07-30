import { notFound } from "next/navigation";
import Link from "next/link";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FullDoc } from "@/lib/types";
import MarkdownRenderer from "@/components/MarkdownRenderer";
// 公开元数据 (build 时打包, 无需运行时文件系统访问) —— 详情页主要数据源
import siteData from "@/../public/data.json";

// PUBLIC_MODE=1 时为公开发布版: 不渲染文字稿正文,只展示元数据+相关+跳转原文
const PUBLIC_MODE = process.env.PUBLIC_MODE === "1";

interface PublicDoc {
  id: string;
  type: "podcast" | "newsletter";
  slug: string;
  title: string;
  subtitle?: string;
  guest?: string;
  date: string;
  description: string;
  tags: string[];
  wordCount: number;
  postUrl: string;
  related?: { id: string; type: string; slug: string; title: string; guest?: string; date: string; postUrl: string }[];
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");

function loadUnifiedDocs(): FullDoc[] {
  const p = join(ROOT, "data", "unified.json");
  if (!existsSync(p)) return [];
  try {
    const u = JSON.parse(readFileSync(p, "utf8"));
    return u.docs;
  } catch {
    return [];
  }
}

export function generateStaticParams() {
  // slug 来源: siteData (公开元数据,部署时一定存在)
  return (siteData.docs as PublicDoc[]).map((d) => ({ slug: d.slug }));
}

export const dynamic = "force-static";

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // 本地 + 非 PUBLIC_MODE: 渲染完整文字稿(需 unified.json)
  if (!PUBLIC_MODE) {
    const docs = loadUnifiedDocs();
    const doc = docs.find((d) => d.slug === slug);
    if (doc) return <FullDocView doc={doc} />;
  }

  // 公开版 / 本地无 unified.json: 用 siteData 元数据
  const meta = (siteData.docs as PublicDoc[]).find((d) => d.slug === slug);
  if (!meta) notFound();
  return <PublicDocView meta={meta} />;
}

/** 公开版详情页: 元数据 + 相关 + 跳转原文,无文字稿 */
function PublicDocView({ meta }: { meta: PublicDoc }) {
  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/" className="mb-6 inline-flex items-center text-sm text-stone-500 hover:text-stone-900">
        ← 返回搜索
      </Link>

      <div className="mb-8 border-b border-stone-200 pb-6">
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <span>{meta.type === "podcast" ? "🎙 播客" : "📰 文章"}</span>
          <span>·</span>
          <span>{meta.date}</span>
          <span>·</span>
          <span>{meta.wordCount.toLocaleString()} 词</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold leading-tight text-stone-900 sm:text-3xl">{meta.title}</h1>
        {meta.subtitle && <p className="mt-2 text-lg text-stone-500">{meta.subtitle}</p>}
        {meta.guest && (
          <p className="mt-2 text-stone-700">
            👤 嘉宾:<span className="font-medium">{meta.guest}</span>
          </p>
        )}
        <p className="mt-3 text-stone-600">{meta.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(meta.tags ?? []).map((t) => (
            <span key={t} className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
              #{t}
            </span>
          ))}
        </div>
      </div>

      <a
        href={meta.postUrl}
        target="_blank"
        rel="noopener"
        className="block rounded-xl border-2 border-stone-900 bg-stone-900 px-6 py-4 text-center font-medium text-white transition hover:bg-stone-700"
      >
        🔗 在 Lenny&apos;s Newsletter 阅读完整原文 →
      </a>
      <p className="mt-2 text-center text-xs text-stone-400">完整文字稿受版权保护,请前往原作者网站阅读</p>

      {meta.related?.length ? (
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">同主题相关</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {meta.related.map((r) => (
              <a
                key={r.id}
                href={r.postUrl}
                target="_blank"
                rel="noopener"
                className="block rounded-lg border border-stone-200 bg-white p-3 transition hover:border-stone-400 hover:shadow-sm"
              >
                <div className="text-xs text-stone-400">
                  {r.type === "podcast" ? "🎙" : "📰"} {r.date}
                </div>
                <div className="mt-0.5 line-clamp-2 text-sm font-medium text-stone-800">{r.title}</div>
                {r.guest && <div className="text-xs text-stone-500">👤 {r.guest}</div>}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

/** 本地完整版: 渲染文字稿(仅本地运行时) */
function FullDocView({ doc }: { doc: FullDoc }) {
  return (
    <article className="mx-auto max-w-3xl">
      <div className="mb-3 inline-block rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
        🔒 本地模式 · 完整文字稿(受版权保护,请勿公开分享)
      </div>
      <Link href="/" className="mb-6 inline-flex items-center text-sm text-stone-500 hover:text-stone-900">
        ← 返回搜索
      </Link>

      <div className="mb-8 border-b border-stone-200 pb-6">
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <span>{doc.type === "podcast" ? "🎙 播客" : "📰 文章"}</span>
          <span>·</span>
          <span>{doc.date}</span>
          <span>·</span>
          <span>{doc.wordCount.toLocaleString()} 词</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold leading-tight text-stone-900 sm:text-3xl">{doc.title}</h1>
        {doc.subtitle && <p className="mt-2 text-lg text-stone-500">{doc.subtitle}</p>}
        {doc.guest && (
          <p className="mt-2 text-stone-700">
            👤 嘉宾:<span className="font-medium">{doc.guest}</span>
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {doc.tags.map((t) => (
            <span key={t} className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
              #{t}
            </span>
          ))}
        </div>
        <a href={doc.postUrl} target="_blank" rel="noopener" className="mt-4 inline-block text-sm text-stone-500 underline hover:text-stone-900">
          查看原文 ↗
        </a>
      </div>

      {doc.type === "podcast" && doc.turns ? <PodcastTranscript turns={doc.turns} /> : <MarkdownRenderer body={doc.body} />}
    </article>
  );
}

function PodcastTranscript({ turns }: { turns: NonNullable<FullDoc["turns"]> }) {
  const speakerColor = (speaker: string) =>
    speaker === "Lenny Rachitsky" ? "border-l-stone-400 bg-stone-50" : "border-l-emerald-400 bg-emerald-50/40";
  const speakerBadge = (speaker: string) =>
    speaker === "Lenny Rachitsky" ? "text-stone-600" : "text-emerald-700 font-semibold";
  return (
    <div className="space-y-1">
      {turns.map((t, i) => (
        <div key={i} className={`rounded-r-md border-l-2 px-3 py-2 ${speakerColor(t.speaker)}`}>
          <div className="flex items-baseline gap-2">
            <span className={`text-sm ${speakerBadge(t.speaker)}`}>{t.speaker}</span>
            <span className="font-mono text-[11px] text-stone-400">{t.time}</span>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-relaxed text-stone-700">{t.text}</p>
        </div>
      ))}
    </div>
  );
}
