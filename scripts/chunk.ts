// 分块器: unified.json -> chunks.json
// 策略:
//   podcast  : 按对话轮滚动聚合,目标 ~450 词/块,块内附「该段所有说话人 + 时间范围」
//   newsletter: 按 heading 分段,过长再按段落切
// 每个 chunk 带 source 元数据,便于检索后溯源(文件、嘉宾、时间戳、标签、类型)
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadUnified, DATA, type Doc, type Turn } from "./lib.ts";

export interface Chunk {
  id: string;
  docId: string;
  type: "podcast" | "newsletter";
  slug: string;
  title: string;
  guest?: string;
  tags: string[];
  date: string;
  // 播客特有:该块覆盖的时间范围与说话人
  timeStart?: string;
  timeEnd?: string;
  speakers?: string[];
  // 块序号(同一文档内)
  ord: number;
  text: string;
}

const TARGET_WORDS = 450;
const MAX_WORDS = 650;

function wc(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

function chunkPodcast(d: Doc): Chunk[] {
  const turns = d.turns ?? [];
  if (!turns.length) return [];
  const chunks: Chunk[] = [];
  let buf: Turn[] = [];
  let bufWords = 0;

  const flush = () => {
    if (!buf.length) return;
    const text = buf
      .map((t) => `**${t.speaker}** (${t.time}): ${t.text}`)
      .join("\n\n");
    const speakers = [...new Set(buf.map((t) => t.speaker))];
    chunks.push({
      id: `${d.id}-c${chunks.length}`,
      docId: d.id,
      type: "podcast",
      slug: d.slug,
      title: d.title,
      guest: d.guest,
      tags: d.tags,
      date: d.date,
      timeStart: buf[0].time,
      timeEnd: buf[buf.length - 1].time,
      speakers,
      ord: chunks.length,
      text,
    });
    buf = [];
    bufWords = 0;
  };

  for (const t of turns) {
    const tw = wc(t.text);
    // 单轮超长:单独成块,截断
    if (tw >= MAX_WORDS) {
      flush();
      buf.push(t);
      bufWords = tw;
      flush();
      continue;
    }
    buf.push(t);
    bufWords += tw;
    if (bufWords >= TARGET_WORDS) flush();
  }
  flush();
  return chunks;
}

function chunkNewsletter(d: Doc): Chunk[] {
  // 按 heading 分段;无 heading 则按段落
  const lines = d.body.split("\n");
  const sections: { heading: string; lines: string[] }[] = [];
  let cur = { heading: "(开头)", lines: [] as string[] };
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      if (cur.lines.length) sections.push(cur);
      cur = { heading: m[2].replace(/\*\*/g, "").trim(), lines: [] };
    } else {
      cur.lines.push(line);
    }
  }
  if (cur.lines.length) sections.push(cur);

  const chunks: Chunk[] = [];
  for (const sec of sections) {
    const paras = sec.lines.join("\n").split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    if (!paras.length) continue;
    let buf: string[] = [];
    let bufWords = 0;
    for (const p of paras) {
      const pw = wc(p);
      if (pw >= MAX_WORDS) {
        if (buf.length) {
          pushChunk(buf);
          buf = [];
          bufWords = 0;
        }
        pushChunk([p]);
        continue;
      }
      buf.push(p);
      bufWords += pw;
      if (bufWords >= TARGET_WORDS) {
        pushChunk(buf);
        buf = [];
        bufWords = 0;
      }
    }
    if (buf.length) pushChunk(buf);

    function pushChunk(parts: string[]) {
      const text = `## ${sec.heading}\n\n${parts.join("\n\n")}`;
      chunks.push({
        id: `${d.id}-c${chunks.length}`,
        docId: d.id,
        type: "newsletter",
        slug: d.slug,
        title: d.title,
        tags: d.tags,
        date: d.date,
        ord: chunks.length,
        text,
      });
    }
  }
  return chunks;
}

const u = loadUnified();
let all: Chunk[] = [];
for (const d of u.docs) {
  all = all.concat(d.type === "podcast" ? chunkPodcast(d) : chunkNewsletter(d));
}

writeFileSync(join(DATA, "chunks.json"), JSON.stringify(all, null, 2));

const podChunks = all.filter((c) => c.type === "podcast").length;
const newsChunks = all.filter((c) => c.type === "newsletter").length;
const words = all.reduce((s, c) => s + wc(c.text), 0);
const lens = all.map((c) => wc(c.text)).sort((a, b) => a - b);
const median = lens.length ? lens[Math.floor(lens.length / 2)] : 0;
const tooBig = all.filter((c) => wc(c.text) > MAX_WORDS).length;

console.log("✅ chunks.json generated");
console.log(`   总块数: ${all.length} (podcast ${podChunks} / newsletter ${newsChunks})`);
console.log(`   平均词数: ${Math.round(words / all.length)}, 中位数: ${median}, 超 ${MAX_WORDS} 词的块: ${tooBig}`);
