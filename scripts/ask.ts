// ② 命令行问答: 调 RAGFlow chat completion,回答 + 引用来源
// 用法:
//   RAGFLOW_API_KEY=xxx bun scripts/ask.ts "Claude Code 团队怎么管理工作?"
//   不带参数则进入交互模式
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as readline from "node:readline/promises";

const BASE = process.env.RAGFLOW_BASE ?? "http://127.0.0.1:9380";
const API_KEY = process.env.RAGFLOW_API_KEY ?? "";
const statePath = join(import.meta.dir, "..", "data", "ragflow-state.json");

if (!API_KEY) { console.error("❌ 需要 RAGFLOW_API_KEY 环境变量"); process.exit(1); }
if (!existsSync(statePath)) { console.error("❌ 先运行 ingest-ragflow.ts 灌库"); process.exit(1); }

const state = JSON.parse(readFileSync(statePath, "utf8"));
// assistant id 存在 state 里?ingest 没存,这里按名字查
async function getChatId(): Promise<string> {
  const j = await fetch(`${BASE}/api/v1/chats?name=${encodeURIComponent("Lenny 助手")}&page=1&page_size=30`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  }).then((r) => r.json());
  const c = (j.data?.chats ?? []).find((x: any) => x.name === "Lenny 助手");
  if (!c) throw new Error("没找到助手,先运行 ingest-ragflow.ts");
  return c.id;
}

async function ask(chatId: string, question: string): Promise<{ answer: string; refs: any[] }> {
  // 流式调用,实时打印
  const res = await fetch(`${BASE}/api/v1/chats/${chatId}/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ question, stream: true, session_id: state.sessionId }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`请求失败 ${res.status}: ${await res.text()}`);
  }
  let answer = "";
  let refs: any[] = [];
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  process.stdout.write("\n🤖 ");
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "" || payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        if (obj.answer) { answer += obj.answer; process.stdout.write(obj.answer); }
        if (obj.reference && obj.reference.chunks?.length) refs = obj.reference.chunks;
      } catch {}
    }
  }
  console.log("\n");
  return { answer, refs };
}

function printRefs(refs: any[]) {
  if (!refs.length) { console.log("(无引用)"); return; }
  console.log("📎 引用来源:");
  for (const r of refs.slice(0, 6)) {
    const name = r.document_name ?? r.docnm_kwd ?? r.doc_name ?? "(未知文档)";
    // 块正文里带说话人时间戳,直接展示前 120 字
    const snippet = (r.content ?? r.content_with_weight ?? "").replace(/\s+/g, " ").slice(0, 120);
    console.log(`   • ${name}`);
    if (snippet) console.log(`     "${snippet}..."`);
  }
}

async function main() {
  const chatId = await getChatId();
  const argQ = process.argv.slice(2).join(" ").trim();
  if (argQ) {
    const { refs } = await ask(chatId, argQ);
    printRefs(refs);
    return;
  }
  // 交互模式
  console.log("🗣 Lenny 知识库问答 (输入 exit 退出)\n");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  while (true) {
    const q = (await rl.question("🧑 ")).trim();
    if (!q || q === "exit") break;
    try {
      const { refs } = await ask(chatId, q);
      printRefs(refs);
    } catch (e: any) {
      console.error("出错:", e.message);
    }
    console.log();
  }
  rl.close();
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
