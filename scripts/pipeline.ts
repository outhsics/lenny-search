// 共享数据底座入口:解析 index.json + 全部 md -> data/unified.json
// 所有产物(Obsidian / RAGFlow / Web)都从 unified.json 生成
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildUnified, DATA, listDataFiles } from "./lib.ts";

const u = buildUnified();
writeFileSync(join(DATA, "unified.json"), JSON.stringify(u, null, 2));

// 核对 index 里的文件是否都存在
const onDisk = listDataFiles();
const inIndex = {
  podcasts: new Set(u.docs.filter((d) => d.type === "podcast").map((d) => d.slug)),
  newsletters: new Set(u.docs.filter((d) => d.type === "newsletter").map((d) => d.slug)),
};
const missingPod = onDisk.podcasts.filter((s) => !inIndex.podcasts.has(s));
const missingNews = onDisk.newsletters.filter((s) => !inIndex.newsletters.has(s));

console.log("✅ unified.json generated");
console.log(`   podcasts:   ${u.byType.podcast}`);
console.log(`   newsletters:${u.byType.newsletter}`);
console.log(`   total words: ${u.docs.reduce((s, d) => s + d.wordCount, 0).toLocaleString()}`);
console.log(`   unique tags: ${u.tags.length}`);
console.log(`   unique guests: ${u.guests.length}`);
const totalTurns = u.docs.reduce((s, d) => s + (d.turns?.length ?? 0), 0);
console.log(`   podcast turns parsed: ${totalTurns.toLocaleString()}`);
if (missingPod.length) console.log(`   ⚠ podcasts on disk not in index: ${missingPod.join(", ")}`);
if (missingNews.length) console.log(`   ⚠ newsletters on disk not in index: ${missingNews.join(", ")}`);
