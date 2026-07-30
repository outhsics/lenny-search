// ③ 构建前端搜索索引: unified.json -> web/public/data.json
// ⚠️ 公开发布合规版: 只导出公开元数据(标题/嘉宾/日期/标签/描述/原文链接),
//    不含任何正文文字稿内容。搜索基于元数据(标题/嘉宾/描述/标签),全部为公开信息。
//    文字稿阅读是本地专属功能(直接读 unified.json),不打包进线上部署。
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadUnified } from "./lib.ts";

const u = loadUnified();

// 每篇文档的公开元数据(无正文、无正文预览)
const index = u.docs.map((d) => ({
  id: d.id,
  type: d.type,
  slug: d.slug,
  title: d.title,
  subtitle: d.subtitle ?? "",
  guest: d.guest ?? "",
  date: d.date,
  year: d.date ? d.date.slice(0, 4) : "",
  description: d.description,
  tags: d.tags,
  wordCount: d.wordCount,
  postUrl: d.postUrl,
  hasTranscript: d.type === "podcast",
}));

// 为每篇计算「同主题相关」(共享标签最多的 top4,排除自身)
const tagSet = (d: (typeof index)[number]) => new Set(d.tags);
const relatedOf = (doc: (typeof index)[number]) =>
  index
    .filter((o) => o.id !== doc.id)
    .map((o) => {
      let shared = 0;
      const ds = tagSet(doc);
      for (const t of o.tags) if (ds.has(t)) shared++;
      return { o, shared };
    })
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared || (a.o.date < a.o.date ? 1 : -1))
    .slice(0, 4)
    .map((x) => ({ id: x.o.id, type: x.o.type, slug: x.o.slug, title: x.o.title, guest: x.o.guest, date: x.o.date, postUrl: x.o.postUrl }));

const docs = index.map((d) => ({ ...d, related: relatedOf(d) }));

// 筛选项
const facets = {
  tags: u.tags.map((t) => ({ value: t.tag, count: t.count })),
  guests: u.guests.map((g) => ({ value: g.guest, count: g.count })),
  years: [...new Set(u.docs.map((d) => d.date?.slice(0, 4)).filter(Boolean))].sort().reverse().map((y) => ({
    value: y as string,
    count: u.docs.filter((d) => d.date?.slice(0, 4) === y).length,
  })),
};

const out = {
  generatedAt: new Date().toISOString(),
  stats: u.byType,
  facets,
  docs,
  // 公开声明:本站不含文字稿正文
  publicMode: true,
};

const outPath = join(import.meta.dir, "..", "web", "public", "data.json");
writeFileSync(outPath, JSON.stringify(out));

const sizeKb = (JSON.stringify(out).length / 1024).toFixed(0);
console.log("✅ web/public/data.json generated (公开元数据版, 无正文)");
console.log(`   文档: ${docs.length}, 体积: ${sizeKb} KB`);
console.log(`   标签: ${facets.tags.length}, 嘉宾: ${facets.guests.length}, 年份: ${facets.years.length}`);
console.log(`   ⚠️  正文字段已剥离,仅含可公开的元数据`);
