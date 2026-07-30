#!/usr/bin/env node
// Lenny 知识库检索 MCP server (stdio)
// 把 RAGFlow 的检索能力暴露给 Hermes / 任何 MCP 客户端
// Hermes 注册: hermes mcp add lenny-kb -- node /path/to/lenny-search-mcp.mjs
//
// 提供两个工具:
//   search_lenny  : 语义检索知识库,返回相关片段(带嘉宾/时间戳)
//   ask_lenny     : 端到端问答,返回答案 + 引用
//
// 需要环境变量:
//   RAGFLOW_API_KEY  (必填)
//   RAGFLOW_BASE     (默认 http://127.0.0.1:9380)
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE = process.env.RAGFLOW_BASE ?? "http://127.0.0.1:9380";
const API_KEY = process.env.RAGFLOW_API_KEY ?? "";

if (!API_KEY) {
  process.stderr.write("[lenny-mcp] 缺少 RAGFLOW_API_KEY 环境变量\n");
}

let cachedDatasetId = null;

async function getDatasetId() {
  if (cachedDatasetId) return cachedDatasetId;
  const res = await fetch(`${BASE}/api/v1/datasets?name=${encodeURIComponent("Lenny 知识库")}&page=1&page_size=30`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const j = await res.json();
  const hit = (j.data ?? []).find((d) => d.name === "Lenny 知识库");
  if (!hit) throw new Error("RAGFlow 中找不到「Lenny 知识库」,先运行 ingest-ragflow.ts");
  cachedDatasetId = hit.id;
  return cachedDatasetId;
}

async function getChatId() {
  const res = await fetch(`${BASE}/api/v1/chats?name=${encodeURIComponent("Lenny 助手")}&page=1&page_size=30`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const j = await res.json();
  const c = (j.data?.chats ?? []).find((x) => x.name === "Lenny 助手");
  if (!c) throw new Error("RAGFlow 中找不到「Lenny 助手」,先运行 ingest-ragflow.ts");
  return c.id;
}

const server = new Server(
  { name: "lenny-kb", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_lenny",
      description:
        "语义检索 Lenny's Newsletter & Podcast 知识库(50期播客+10篇文章,涵盖AI产品/工程/创业/产品方法论)。返回最相关的片段,含来源嘉宾、时间戳、标签。适合需要引用具体访谈内容时调用。",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "检索问题或关键词,中英文均可" },
          top_k: { type: "number", description: "返回片段数,默认5", default: 5 },
        },
        required: ["query"],
      },
    },
    {
      name: "ask_lenny",
      description:
        "向 Lenny 知识库提问,返回完整答案 + 引用来源。基于检索增强生成(RAG),答案严格来自访谈内容。",
      inputSchema: {
        type: "object",
        properties: {
          question: { type: "string", description: "问题,中英文均可" },
        },
        required: ["question"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name } = req.params;
  const args = req.params.arguments ?? {};
  try {
    if (name === "search_lenny") {
      const datasetId = await getDatasetId();
      const res = await fetch(`${BASE}/api/v1/retrieval`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          dataset_ids: [datasetId],
          question: args.query,
          top_k: args.top_k ?? 5,
          similarity_threshold: 0.2,
        }),
      });
      const j = await res.json();
      const chunks = j.data?.chunks ?? j.data ?? [];
      const text = chunks
        .map((c, i) => {
          const doc = c.document_name ?? c.docnm_kwd ?? "?";
          const snippet = (c.content ?? c.content_with_weight ?? "").replace(/\s+/g, " ").slice(0, 400);
          return `【${i + 1}】来源: ${doc}\n${snippet}`;
        })
        .join("\n\n---\n\n");
      return { content: [{ type: "text", text: text || "(无匹配片段)" }] };
    }
    if (name === "ask_lenny") {
      const chatId = await getChatId();
      const res = await fetch(`${BASE}/api/v1/chats/${chatId}/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({ question: args.question, stream: false }),
      });
      const j = await res.json();
      const answer = j.data?.answer ?? j.answer ?? "(无回答)";
      const refs = (j.data?.reference?.chunks ?? [])
        .map((c) => c.document_name ?? c.docnm_kwd)
        .filter(Boolean);
      const text = refs.length ? `${answer}\n\n📎 来源: ${refs.join(", ")}` : answer;
      return { content: [{ type: "text", text }] };
    }
    throw new Error(`未知工具: ${name}`);
  } catch (e) {
    return { content: [{ type: "text", text: `⚠️ ${e.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("[lenny-mcp] 已启动,等待 Hermes 调用\n");
