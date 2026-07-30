"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MiniSearch from "minisearch";
import type { SiteData, SearchDoc } from "@/lib/types";

export default function SearchClient() {
  const [data, setData] = useState<SiteData | null>(null);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "podcast" | "newsletter">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data.json").then((r) => r.json()).then(setData);
  }, []);

  const ms = useMemo(() => {
    if (!data) return null;
    const index = new MiniSearch<SearchDoc>({
      fields: ["title", "guest", "description", "tags"],
      storeFields: ["title", "slug", "type", "guest", "date", "tags", "wordCount", "description", "subtitle"],
      searchOptions: {
        boost: { title: 3, guest: 2, tags: 1.5 },
        fuzzy: 0.2,
        prefix: true,
        combineWith: "AND",
      },
    });
    index.addAll(data.docs);
    return index;
  }, [data]);

  const results = useMemo(() => {
    if (!data) return [];
    let list: SearchDoc[];
    if (q.trim() && ms) {
      const hits = ms.search(q);
      list = hits as unknown as SearchDoc[];
    } else {
      list = [...data.docs];
    }
    if (typeFilter !== "all") list = list.filter((d) => d.type === typeFilter);
    if (tagFilter) list = list.filter((d) => d.tags.includes(tagFilter));
    if (yearFilter) list = list.filter((d) => d.year === yearFilter);
    return list;
  }, [q, ms, data, typeFilter, tagFilter, yearFilter]);

  if (!data) return <p className="text-stone-400">加载索引中…</p>;

  return (
    <div>
      {/* 搜索框 */}
      <div className="relative">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索嘉宾、话题、内容…  例: Claude Code / 高 agency / taste"
          className="w-full rounded-xl border border-stone-300 bg-white px-5 py-3.5 pr-12 text-base shadow-sm outline-none transition focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-stone-400">
          {q ? `${results.length}` : "🔍"}
        </span>
      </div>

      {/* 类型切换 */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {(["all", "podcast", "newsletter"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`rounded-full px-3 py-1 transition ${
              typeFilter === t ? "bg-stone-900 text-white" : "bg-white text-stone-600 hover:bg-stone-200"
            }`}
          >
            {t === "all" ? `全部 ${data.docs.length}` : t === "podcast" ? `🎙 播客 ${data.stats.podcast}` : `📰 文章 ${data.stats.newsletter}`}
          </button>
        ))}
        <div className="mx-1 h-4 w-px bg-stone-300" />
        {tagFilter || yearFilter ? (
          <button
            onClick={() => { setTagFilter(null); setYearFilter(null); }}
            className="rounded-full bg-red-50 px-3 py-1 text-red-600 hover:bg-red-100"
          >
            清除筛选 ✕
          </button>
        ) : null}
      </div>

      {/* 标签云 */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {data.facets.tags.slice(0, 14).map((t) => (
          <button
            key={t.value}
            onClick={() => setTagFilter(tagFilter === t.value ? null : t.value)}
            className={`rounded px-2 py-0.5 text-xs transition ${
              tagFilter === t.value ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
            }`}
          >
            #{t.value} <span className="opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {/* 年份 */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {data.facets.years.map((y) => (
          <button
            key={y.value}
            onClick={() => setYearFilter(yearFilter === y.value ? null : y.value)}
            className={`rounded px-2 py-0.5 text-xs transition ${
              yearFilter === y.value ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
            }`}
          >
            {y.value} <span className="opacity-60">{y.count}</span>
          </button>
        ))}
      </div>

      {/* 结果列表 */}
      <div className="mt-6 space-y-2">
        {results.length === 0 ? (
          <p className="py-12 text-center text-stone-400">没有匹配的内容,换个关键词试试?</p>
        ) : (
          results.map((d) => <ResultCard key={d.id} doc={d} query={q} onTag={setTagFilter} />)
        )}
      </div>
    </div>
  );
}

function ResultCard({ doc, query, onTag }: { doc: SearchDoc; query: string; onTag: (t: string) => void }) {
  return (
    <Link
      href={`/doc/${doc.slug}`}
      className="block rounded-lg border border-stone-200 bg-white p-4 transition hover:border-stone-400 hover:shadow-md"
    >
      <div className="flex items-center gap-2 text-xs text-stone-400">
        <span>{doc.type === "podcast" ? "🎙 播客" : "📰 文章"}</span>
        <span>·</span>
        <span>{doc.date}</span>
        <span>·</span>
        <span>{doc.wordCount.toLocaleString()} 词</span>
      </div>
      <h3 className="mt-1 font-medium leading-snug text-stone-900">{doc.title}</h3>
      {doc.subtitle && <p className="text-sm text-stone-500">{doc.subtitle}</p>}
      {doc.guest && <p className="mt-0.5 text-sm text-stone-600">👤 {doc.guest}</p>}
      <p className="mt-1.5 line-clamp-2 text-sm text-stone-500">{doc.description}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {doc.tags.slice(0, 5).map((t) => (
          <button
            key={t}
            onClick={(e) => { e.preventDefault(); onTag(t); }}
            className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-500 hover:bg-stone-200"
          >
            #{t}
          </button>
        ))}
      </div>
    </Link>
  );
}
