// ② 把 chunks.json 灌入 RAGFlow,并创建问答助手
// 流程: 创建知识库(若不存在) -> 为每篇文档创建空文档 -> 逐块添加(带元数据) -> 创建 chat assistant
// 幂等: 已存在同名 dataset / chat 则复用
//
// 用法:
//   RAGFLOW_API_KEY=ragflow-xxx RAGFLOW_BASE=http://127.0.0.1:9380 bun scripts/ingest-ragflow.ts
//
// 元数据策略: 每篇原文(60篇)对应一个 RAGFlow document,把它的多个 chunk 作为子块加入,
// 这样检索回来的 reference 能定位到「哪期节目/哪篇文章」+ 块内自带说话人/时间戳。
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.RAGFLOW_BASE ?? "http://127.0.0.1:9380";
const API_KEY = process.env.RAGFLOW_API_KEY ?? "";
const DATASET_NAME = "Lenny 知识库";
const CHAT_NAME = "Lenny 助手";

if (!API_KEY) {
  console.error("❌ 缺少 RAGFLOW_API_KEY 环境变量");
  console.error("   在 RAGFlow 网页 (http://127.0.0.1:9380) → 头像 → API Key 复制");
  console.error("   然后运行: RAGFLOW_API_KEY=ragflow-xxxx bun scripts/ingest-ragflow.ts");
  process.exit(1);
}

const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` });

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers(), ...(init.headers ?? {}) } });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  if (!res.ok && json.code !== 0) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}: ${text.slice(0, 200)}`);
  }
  return json;
}

// ---------- 工具 ----------

async function findDataset(name: string): Promise<string | null> {
  const j = await api(`/api/v1/datasets?name=${encodeURIComponent(name)}&page=1&page_size=30`);
  const arr = j.data ?? [];
  const hit = arr.find((d: any) => d.name === name);
  return hit?.id ?? null;
}

async function createDataset(): Promise<string> {
  const j = await api("/api/v1/datasets", {
    method: "POST",
    body: JSON.stringify({
      name: DATASET_NAME,
      description: "Lenny's Newsletter & Podcast starter 数据包(50播客+10文章)",
      permission: "me",
      // embedding 在 UI 里用 bge-m3;API 创建时留空用账户默认。可在 UI 后续调整。
    }),
  });
  return j.data.id;
}

async function listDocIds(datasetId: string): Promise<Map<string, string>> {
  // 返回 name -> id 的映射,用于幂等
  const map = new Map<string, string>();
  let page = 1;
  while (true) {
    const j = await api(`/api/v1/datasets/${datasetId}/documents?page=${page}&page_size=100`);
    const docs = j.data?.docs ?? [];
    for (const d of docs) map.set(d.name, d.id);
    if (docs.length < 100) break;
    page++;
  }
  return map;
}

async function createEmptyDoc(datasetId: string, name: string): Promise<string> {
  const j = await api(`/api/v1/datasets/${datasetId}/documents?type=empty`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return j.data[0].id;
}

async function addChunk(datasetId: string, docId: string, c: Chunk): Promise<void> {
  await api(`/api/v1/datasets/${datasetId}/documents/${docId}/chunks`, {
    method: "POST",
    body: JSON.stringify({
      content: c.text,
      important_keywords: c.keywords,
    }),
  });
}

interface Chunk {
  id: string; docId: string; type: string; slug: string; title: string;
  guest?: string; tags: string[]; date: string;
  timeStart?: string; timeEnd?: string; speakers?: string[]; ord: number; text: string;
  keywords?: string[];
}

// ---------- 主流程 ----------

async function main() {
  console.log(`🔗 连接 RAGFlow: ${BASE}`);
  // 健康检查
  try {
    const h = await (await fetch(`${BASE}/api/v1/system/healthz`)).json();
    if (h.status === "ok") console.log("   ✅ 系统健康");
    else console.warn("   ⚠️ 系统状态:", h.status);
  } catch (e) {
    console.warn("   ⚠️ 健康检查失败(可能旧端点),继续...");
  }

  // 1. 知识库
  let datasetId = await findDataset(DATASET_NAME);
  if (datasetId) {
    console.log(`📁 复用知识库 "${DATASET_NAME}" (${datasetId})`);
  } else {
    datasetId = await createDataset();
    console.log(`📁 创建知识库 "${DATASET_NAME}" (${datasetId})`);
    console.log("   ⚠️  请到 RAGFlow 网页把该知识库的 embedding 模型设为 bge-m3(Ollama),否则检索质量下降");
  }

  // 2. 灌数据
  const chunks: Chunk[] = JSON.parse(readFileSync(join(import.meta.dir, "..", "data", "chunks.json"), "utf8"));
  // 按文档分组
  const byDoc = new Map<string, { meta: Chunk; chunks: Chunk[] }>();
  for (const c of chunks) {
    if (!byDoc.has(c.docId)) byDoc.set(c.docId, { meta: c, chunks: [] });
    byDoc.get(c.docId)!.chunks.push(c);
  }
  console.log(`📦 待灌入: ${byDoc.size} 篇文档, ${chunks.length} 个块`);

  const existingDocs = await listDocIds(datasetId);
  const docNameOf = (c: Chunk) => `${c.slug}.md`;
  const stateFile = join(import.meta.dir, "..", "data", "ragflow-state.json");
  let state: Record<string, string> = {};
  try { state = JSON.parse(readFileSync(stateFile, "utf8")); } catch {}

  let addedDocs = 0, addedChunks = 0;
  let i = 0;
  for (const [, { meta, chunks: cs }] of byDoc) {
    i++;
    const name = docNameOf(meta);
    let docId = existingDocs.get(name) ?? state[meta.docId];
    if (!docId) {
      docId = await createEmptyDoc(datasetId, name);
      addedDocs++;
      state[meta.docId] = docId;
      if (addedDocs % 5 === 0) writeFileSync(stateFile, JSON.stringify(state, null, 2));
    }
    // 为每个块补充 keywords(嘉宾/时间/标签帮助检索)
    const enriched = cs.map((c) => {
      const kw = [meta.guest, meta.slug, ...(c.timeStart ? [c.timeStart] : []), ...meta.tags.slice(0, 3)].filter(Boolean) as string[];
      return { ...c, keywords: kw };
    });
    for (const c of enriched) {
      await addChunk(datasetId, docId, c);
      addedChunks++;
    }
    if (i % 10 === 0) console.log(`   进度 ${i}/${byDoc.size} 文档, ${addedChunks} 块`);
  }
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log(`✅ 灌入完成: 新增 ${addedDocs} 文档(复用 ${byDoc.size - addedDocs}), 共 ${addedChunks} 块`);

  // 3. chat assistant
  const existingChat = await api(`/api/v1/chats?name=${encodeURIComponent(CHAT_NAME)}&page=1&page_size=30`);
  const chat = (existingChat.data?.chats ?? []).find((c: any) => c.name === CHAT_NAME);
  let chatId = chat?.id;
  if (chatId) {
    console.log(`🤖 复用助手 "${CHAT_NAME}" (${chatId})`);
  } else {
    const prompt = [
      "你是「Lenny 知识库」助手,基于 Lenny's Newsletter & Podcast 的访谈内容回答问题。",
      "内容涵盖 AI 产品开发、工程管理、创业、产品方法论、职业发展。",
      "回答要求:",
      "1. 严格基于检索到的 {knowledge} 回答,不要编造。",
      "2. 引用访谈时,指出来源嘉宾和(如有)时间戳。",
      "3. 用中文回答,技术术语保留英文。",
      "4. 如果检索内容不足以回答,明确说明并建议用户换个问法。",
    ].join("\n");
    const j = await api("/api/v1/chats", {
      method: "POST",
      body: JSON.stringify({
        name: CHAT_NAME,
        dataset_ids: [datasetId],
        prompt_config: {
          system: prompt,
          prologue: "你好!我是 Lenny 知识库助手。问我任何关于 AI 产品、工程管理、创业方法论的问题,我会基于 Lenny 的访谈内容回答并附上出处。",
          quote: true,
          parameters: [{ key: "knowledge", optional: false }],
        },
        llm_setting: { temperature: 0.3, top_p: 0.7, presence_penalty: 0.3, frequency_penalty: 0.5 },
        top_n: 6,
        top_k: 1024,
        similarity_threshold: 0.2,
        vector_similarity_weight: 0.3,
      }),
    });
    chatId = j.data.id;
    console.log(`🤖 创建助手 "${CHAT_NAME}" (${chatId})`);
  }

  console.log("\n🎉 全部就绪!");
  console.log(`   知识库 ID: ${datasetId}`);
  console.log(`   助手 ID:   ${chatId}`);
  console.log(`   RAGFlow 网页: ${BASE}`);
  console.log("\n📌 下一步:");
  console.log("   1. 到 RAGFlow 网页确认知识库 embedding=bge-m3,助手 LLM=qwen2.5:7b");
  console.log("   2. 在网页里直接问答,或用 scripts/ask.ts 命令行问答");
  console.log(`   3. 这些 ID 已存入 data/ragflow-state.json 供 web 站复用`);
}

main().catch((e) => { console.error("❌ 失败:", e.message); process.exit(1); });
