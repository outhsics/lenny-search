// AI 问答后端代理: 转发到 RAGFlow chat completion (流式)
// 这样前端不接触 API key;key 从服务端环境变量读
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const BASE = process.env.RAGFLOW_BASE ?? "http://127.0.0.1:9380";
const API_KEY = process.env.RAGFLOW_API_KEY ?? "";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getChatId(): Promise<string | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(`${BASE}/api/v1/chats?name=${encodeURIComponent("Lenny 助手")}&page=1&page_size=30`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const j = await res.json();
    const c = (j.data?.chats ?? []).find((x: any) => x.name === "Lenny 助手");
    return c?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { question } = await req.json();
  if (!question) return Response.json({ error: "缺少 question" }, { status: 400 });

  if (!API_KEY) {
    return Response.json({
      error: "NOT_CONFIGURED",
      message: "尚未配置 RAGFlow。请先在项目根运行灌库脚本(见 README),并设置 RAGFLOW_API_KEY。",
    }, { status: 503 });
  }

  const chatId = await getChatId();
  if (!chatId) {
    return Response.json({
      error: "NOT_CONFIGURED",
      message: "RAGFlow 里还没创建「Lenny 助手」。请先运行: cd .. && bun scripts/ingest-ragflow.ts",
    }, { status: 503 });
  }

  // 流式转发
  const upstream = await fetch(`${BASE}/api/v1/chats/${chatId}/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ question, stream: true }),
  });

  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: "UPSTREAM_ERROR", message: `RAGFlow 返回 ${upstream.status}` }, { status: 502 });
  }

  // 转发 SSE 流
  return new Response(upstream.body, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

// 健康检查: 是否已配置
export async function GET() {
  const chatId = await getChatId();
  return Response.json({ configured: !!chatId, base: BASE });
}
