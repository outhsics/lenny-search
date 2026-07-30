// 共享数据底座:解析 index.json + markdown frontmatter/正文
// pipeline.ts / build-obsidian.ts / build-web-index.ts / ingest-ragflow.ts 都从这里取数据
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const DATA = join(ROOT, "data");

export type DocType = "podcast" | "newsletter";

/** 播客对话轮 */
export interface Turn {
  speaker: string;
  time: string; // HH:MM:SS
  text: string;
}

/** 统一文档(三块产物共同的数据契约) */
export interface Doc {
  id: string; // 稳定 id = type + slug
  type: DocType;
  slug: string; // 文件名(无扩展名),如 fiona-fung
  path: string; // 相对项目根,如 data/podcasts/fiona-fung.md
  title: string;
  subtitle?: string; // newsletter
  guest?: string; // podcast
  date: string; // YYYY-MM-DD
  description: string;
  tags: string[];
  wordCount: number;
  postUrl: string;
  body: string; // frontmatter 之后的纯正文(markdown)
  // podcast 结构化
  speakers?: string[];
  turns?: Turn[];
  // newsletter 结构化
  headings?: { level: number; text: string }[];
}

export interface Unified {
  schemaVersion: string;
  generatedAt: string;
  docs: Doc[];
  byType: Record<DocType, number>;
  tags: { tag: string; count: number }[];
  guests: { guest: string; count: number }[];
}

// ---------- 工具函数 ----------

function slugFromFile(filename: string): string {
  // index.json 里 filename 形如 "03-podcasts/fiona-fung.md"
  return basename(filename).replace(/\.md$/, "");
}

function readMdRaw(absPath: string): { fm: Record<string, unknown>; body: string } {
  const raw = readFileSync(absPath, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  const fmText = m[1];
  const body = m[2];
  const fm: Record<string, unknown> = {};
  // 最小 YAML 解析:只处理本项目里出现的 简单 "key: value" 与 "key: [a, b]" 形式
  for (const line of fmText.split("\n")) {
    const mm = line.match(/^(\w+):\s*(.*)$/);
    if (!mm) continue;
    const [, k, vRaw] = mm;
    let v: unknown = vRaw;
    const trimmed = vRaw.trim();
    // 去掉首尾引号
    if (/^".*"$/.test(trimmed) || /^'.*'$/.test(trimmed)) {
      v = trimmed.slice(1, -1);
    } else if (/^\[.*\]$/.test(trimmed)) {
      // 数组 ["a", "b"]
      v = trimmed
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else if (/^-?\d+$/.test(trimmed)) {
      v = Number(trimmed);
    }
    fm[k] = v;
  }
  return { fm, body };
}

// 播客对话头:**Fiona Fung** (00:00:05):   <- 正文在该行之后,直到下一个对话头
const TURN_HEAD_RE = /^\*\*(.+?)\*\*\s*\((\d{2}:\d{2}:\d{2})\):\s*(.*)$/;

function parsePodcast(body: string): { speakers: string[]; turns: Turn[] } {
  const lines = body.split("\n");
  const turns: Turn[] = [];
  const speakerSet = new Set<string>();
  // 先定位所有对话头的行号,然后每个头的正文 = 到下一个头之间的所有行
  const heads: { speaker: string; time: string; inline: string; line: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(TURN_HEAD_RE);
    if (m) heads.push({ speaker: m[1], time: m[2], inline: m[3], line: i });
  }
  for (let idx = 0; idx < heads.length; idx++) {
    const h = heads[idx];
    const next = idx + 1 < heads.length ? heads[idx + 1].line : lines.length;
    // 正文 = 同行 inline + 后续行(到下一个头之前)
    const parts: string[] = [];
    if (h.inline.trim()) parts.push(h.inline.trim());
    for (let j = h.line + 1; j < next; j++) {
      const l = lines[j];
      // 遇到空行或 markdown 结构也保留(正文段落);但不吃进下一个头
      if (TURN_HEAD_RE.test(l)) break;
      parts.push(l);
    }
    const text = parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    turns.push({ speaker: h.speaker, time: h.time, text });
    speakerSet.add(h.speaker);
  }
  return { speakers: [...speakerSet], turns };
}

function parseNewsletter(body: string): { headings: { level: number; text: string }[] } {
  const headings: { level: number; text: string }[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) headings.push({ level: m[1].length, text: m[2].replace(/\*\*/g, "").trim() });
  }
  return { headings };
}

function stableId(type: DocType, slug: string): string {
  return createHash("sha1").update(`${type}:${slug}`).digest("hex").slice(0, 12);
}

// ---------- 主解析 ----------

interface IndexEntry {
  title: string;
  filename: string;
  tags?: string[];
  word_count?: number;
  date?: string;
  description?: string;
  guest?: string;
  subtitle?: string;
  post_url?: string;
}

interface IndexFile {
  schema_version?: string;
  generated_at?: string;
  podcasts?: IndexEntry[];
  newsletters?: IndexEntry[];
}

export function buildUnified(): Unified {
  const index: IndexFile = JSON.parse(readFileSync(join(DATA, "index.json"), "utf8"));
  const docs: Doc[] = [];

  const ingest = (entries: IndexEntry[] | undefined, type: DocType) => {
    if (!entries) return;
    for (const e of entries) {
      const absPath = join(ROOT, e.filename); // "03-podcasts/x.md" -> 项目根下不存在,需映射
      // index.json 用的是 zip 内路径 02-newsletters/...,我们映射到 data/newsletters|podcasts
      const slug = slugFromFile(e.filename);
      const subDir = type === "podcast" ? "podcasts" : "newsletters";
      const realPath = join(DATA, subDir, `${slug}.md`);
      const realRel = `data/${subDir}/${slug}.md`;
      if (!existsSync(realPath)) {
        console.warn(`[warn] missing ${realRel}`);
        continue;
      }
      const { fm, body } = readMdRaw(realPath);
      const date = (e.date ?? (fm.date as string) ?? "unknown") as string;
      const tags = (e.tags ?? (fm.tags as string[]) ?? []) as string[];
      const wordCount = (e.word_count ?? (fm.word_count as number) ?? 0) as number;
      const doc: Doc = {
        id: stableId(type, slug),
        type,
        slug,
        path: realRel,
        title: e.title ?? (fm.title as string) ?? slug,
        subtitle: e.subtitle ?? (fm.subtitle as string),
        guest: e.guest ?? (fm.guest as string),
        date,
        description: e.description ?? (fm.description as string) ?? "",
        tags,
        wordCount,
        postUrl: e.post_url ?? (fm.post_url as string) ?? "",
        body,
      };
      if (type === "podcast") {
        const { speakers, turns } = parsePodcast(body);
        doc.speakers = speakers;
        doc.turns = turns;
      } else {
        doc.headings = parseNewsletter(body).headings;
      }
      docs.push(doc);
      // 触碰 absPath 避免 lint 抱怨未使用;保留以说明 index 路径映射逻辑
      void absPath;
    }
  };

  ingest(index.podcasts, "podcast");
  ingest(index.newsletters, "newsletter");

  docs.sort((a, b) => (a.date < b.date ? 1 : -1));

  const tagCount = new Map<string, number>();
  const guestCount = new Map<string, number>();
  for (const d of docs) {
    for (const t of d.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    if (d.guest) guestCount.set(d.guest, (guestCount.get(d.guest) ?? 0) + 1);
  }

  return {
    schemaVersion: index.schema_version ?? "2.0",
    generatedAt: new Date().toISOString(),
    docs,
    byType: {
      podcast: docs.filter((d) => d.type === "podcast").length,
      newsletter: docs.filter((d) => d.type === "newsletter").length,
    },
    tags: [...tagCount.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
    guests: [...guestCount.entries()].map(([guest, count]) => ({ guest, count })).sort((a, b) => b.count - a.count),
  };
}

// 便捷:直接读已生成的 unified.json
export function loadUnified(): Unified {
  const p = join(DATA, "unified.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

// 列出 data 目录,用于核对
export function listDataFiles(): { podcasts: string[]; newsletters: string[] } {
  const list = (sub: string) =>
    readdirSync(join(DATA, sub))
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""));
  return { podcasts: list("podcasts"), newsletters: list("newsletters") };
}
