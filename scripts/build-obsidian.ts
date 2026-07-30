// ① 生成 Obsidian 知识库 -> vault/Lenny-Vault/
// 命名: 「AI开发与产品方法」资料库
// 结构:
//   Episodes/   播客(保留说话人+时间戳对话)
//   Newsletters/ 文章(保留 markdown)
//   Guests/     嘉宾页 + 双链
//   Topics/     标签 MOC(按 tag 聚合)
//   Index/      总目录 MOC
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadUnified, type Doc } from "./lib.ts";

const VAULT = join(import.meta.dir, "..", "vault", "Lenny-Vault");
const VAULT_NAME = "AI开发与产品方法";

// Obsidian 合法文件名(去掉非法字符)
function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|#^\[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

function frontmatter(obj: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${JSON.stringify(item)}`);
    } else if (typeof v === "string") {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    } else {
      lines.push(`${k}: ${String(v)}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

// 内联标签: Obsidian frontmatter tags 需去掉特殊字符
function obTag(t: string): string {
  return t.replace(/[^a-zA-Z0-9/_-]/g, "-");
}

function docInlineBody(d: Doc): string {
  // 保留原始正文;Obsidian 能直接渲染。播客的 **Speaker** (HH:MM:SS): 行也保留。
  return d.body.trim();
}

// ---------- 生成 ----------

const u = loadUnified();
rmSync(VAULT, { recursive: true, force: true });
const dirs = ["Episodes", "Newsletters", "Guests", "Topics", "Index"];
for (const d of dirs) mkdirSync(join(VAULT, d), { recursive: true });

// 每篇文档
for (const d of u.docs) {
  const titleName = safeName(d.title);
  const links: string[] = [];
  if (d.guest) links.push(`[[Guests/${safeName(d.guest)}|${d.guest}]]`);

  const tagLinks = d.tags.map((t) => `[[Topics/${obTag(t)}|#${t}]]`).join(" ");

  const header = [
    frontmatter({
      title: d.title,
      type: d.type,
      guest: d.guest,
      date: d.date,
      tags: d.tags.map(obTag),
      word_count: d.wordCount,
      source: d.postUrl,
      slug: d.slug,
      ...(d.subtitle ? { subtitle: d.subtitle } : {}),
    }),
    "",
    `# ${d.title}`,
    "",
    d.subtitle ? `> **${d.subtitle}**` : "",
    d.type === "podcast" && d.guest ? `🎙 **嘉宾**: [[Guests/${safeName(d.guest)}|${d.guest}]]` : "",
    `📅 **日期**: ${d.date}`,
    `📝 **字数**: ${d.wordCount.toLocaleString()}`,
    `🏷 **话题**: ${tagLinks}`,
    `🔗 **原文**: [Lenny's Newsletter](${d.postUrl})`,
    "",
    d.description ? `> ${d.description}` : "",
    "",
    "---",
    "",
  ].join("\n");

  const subDir = d.type === "podcast" ? "Episodes" : "Newsletters";
  const fname = `${d.slug}.md`; // 用稳定 slug 做文件名,便于跨工具引用
  writeFileSync(join(VAULT, subDir, fname), header + docInlineBody(d) + "\n");
}

// 嘉宾页
for (const g of u.guests) {
  const eps = u.docs.filter((d) => d.guest === g.guest);
  const links = eps
    .map((d) => `- [[${d.type === "podcast" ? "Episodes" : "Newsletters"}/${d.slug}|${d.title}]] (${d.date})`)
    .join("\n");
  const content = [
    frontmatter({ guest: g.guest, episodes: g.count, type: "guest" }),
    "",
    `# ${g.guest}`,
    "",
    `> 出现 ${g.count} 次。`,
    "",
    "## 出现的节目",
    links,
    "",
  ].join("\n");
  writeFileSync(join(VAULT, "Guests", `${safeName(g.guest)}.md`), content + "\n");
}

// 话题 MOC
for (const t of u.tags) {
  const eps = u.docs.filter((d) => d.tags.includes(t.tag));
  const podcastLinks = eps
    .filter((d) => d.type === "podcast")
    .map((d) => `- [[Episodes/${d.slug}|${d.title}]] — ${d.guest ?? ""} (${d.date})`)
    .join("\n");
  const newsLinks = eps
    .filter((d) => d.type === "newsletter")
    .map((d) => `- [[Newsletters/${d.slug}|${d.title}]] (${d.date})`)
    .join("\n");
  const content = [
    frontmatter({ tag: t.tag, count: t.count, type: "topic" }),
    "",
    `# #${t.tag}`,
    "",
    `> 共 ${t.count} 篇相关内容。`,
    "",
    podcastLinks ? `## 🎙 播客\n${podcastLinks}\n` : "",
    newsLinks ? `## 📰 文章\n${newsLinks}\n` : "",
  ].join("\n");
  writeFileSync(join(VAULT, "Topics", `${obTag(t.tag)}.md`), content + "\n");
}

// 总目录 MOC
const topTags = u.tags.slice(0, 8).map((t) => `- [[Topics/${obTag(t.tag)}|#${t.tag}]] (${t.count})`).join("\n");
const recentPods = u.docs
  .filter((d) => d.type === "podcast")
  .slice(0, 10)
  .map((d) => `- [[Episodes/${d.slug}|${d.title}]] — ${d.guest} (${d.date})`)
  .join("\n");
const recentNews = u.docs
  .filter((d) => d.type === "newsletter")
  .map((d) => `- [[Newsletters/${d.slug}|${d.title}]] (${d.date})`)
  .join("\n");

const indexContent = [
  frontmatter({ name: VAULT_NAME, generated: new Date().toISOString() }),
  "",
  `# ${VAULT_NAME}`,
  "",
  `> 基于 Lenny's Newsletter & Podcast 公开数据包构建。共 **${u.byType.podcast}** 期播客 + **${u.byType.newsletters}** 篇文章。`,
  `> ⚠️ 内容版权归原作者所有,仅用于个人学习。`,
  "",
  "## 🧭 导航",
  "",
  "- 按话题浏览 👉 任选一个 Topic 进入,会列出所有相关节目",
  "- 按嘉宾浏览 👉 `Guests/` 目录,每位嘉宾聚合其出场节目",
  "- 按时间浏览 👉 下面「最新播客」按日期倒序",
  "",
  "## 🔥 热门话题",
  topTags,
  "",
  "## 🎙 最新播客(Top 10)",
  recentPods,
  "",
  "## 📰 全部文章",
  recentNews,
  "",
  "## ⚙️ 使用提示",
  "- `Ctrl/Cmd + P` → 输入标签名(如 `ai`)可跳到话题页",
  "- 在任一节目页点击嘉宾 `[[双链]]` 可看 ta 的所有出场",
  "- 全文搜索 `Ctrl/Cmd + Shift + F`",
  "",
].join("\n");
writeFileSync(join(VAULT, "Index", "README.md"), indexContent + "\n");

// .obsidian 基础配置:开启标签面板等(最小化,不覆盖用户已有配置)
writeFileSync(
  join(VAULT, "Index", "开始这里.md"),
  [
    frontmatter({ type: "start" }),
    "",
    "# 👋 开始使用",
    "",
    `这是「${VAULT_NAME}」资料库。`,
    "",
    "1. 推荐在 Obsidian 设置里打开:核心插件 → **标签面板、关系图谱、反向链接**",
    "2. 左侧 **标签面板** 点击任意话题快速过滤",
    `3. 顶部打开 [[README|总目录]] 看全局`,
    "",
    "数据来源:Lenny's Newsletter Podcast Data(公开 starter 包)。",
  ].join("\n") + "\n",
);

console.log("✅ Obsidian 知识库已生成");
console.log(`   位置: ${VAULT}`);
console.log(`   Episodes: ${u.byType.podcast}, Newsletters: ${u.byType.newsletter}`);
console.log(`   Guests: ${u.guests.length}, Topics: ${u.tags.length}`);
