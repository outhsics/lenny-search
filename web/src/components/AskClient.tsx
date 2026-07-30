"use client";
import { useEffect, useRef, useState } from "react";

interface Ref {
  document_name?: string;
  docnm_kwd?: string;
  content?: string;
  content_with_weight?: string;
}
interface Msg {
  role: "user" | "assistant";
  text: string;
  refs?: Ref[];
}

const SUGGESTIONS = [
  "Claude Code 团队是怎么管理工程师的?",
  "Tony Fadell 谈如何在 AI 时代培养品味?",
  "产品经理如何避免被 AI 淘汰?",
  "Marc Andreessen 对 AI 繁荣有什么看法?",
];

export default function AskClient() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ask").then((r) => r.json()).then((d) => setConfigured(d.configured));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setInput("");
    setLoading(true);
    setMsgs((m) => [...m, { role: "user", text: question }, { role: "assistant", text: "", refs: [] }]);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setMsgs((m) => { const last = m[m.length - 1]; last.text = `⚠️ ${e.message ?? "请求失败"}`; return [...m]; });
        return;
      }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let refs: Ref[] = [];
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
          if (!payload || payload === "[DONE]") continue;
          try {
            const obj = JSON.parse(payload);
            if (obj.answer) {
              setMsgs((m) => { const last = m[m.length - 1]; last.text += obj.answer; return [...m]; });
            }
            if (obj.reference?.chunks?.length) refs = obj.reference.chunks;
          } catch {}
        }
      }
      if (refs.length) {
        setMsgs((m) => { const last = m[m.length - 1]; last.refs = refs; return [...m]; });
      }
    } catch (e: any) {
      setMsgs((m) => { const last = m[m.length - 1]; last.text = `⚠️ 网络错误: ${e.message}`; return [...m]; });
    } finally {
      setLoading(false);
    }
  }

  if (configured === null) return <p className="text-stone-400">检查 RAGFlow 连接…</p>;

  if (configured === false) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="font-semibold text-amber-900">RAGFlow 尚未配置</h2>
        <p className="mt-2 text-sm text-amber-800">要启用 AI 问答,需要先完成两步:</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-amber-800">
          <li>
            在 RAGFlow 网页 (<code className="rounded bg-amber-100 px-1">http://127.0.0.1:9380</code>) → 头像 → 复制 API Key
          </li>
          <li>
            在项目根目录运行灌库脚本:
            <pre className="mt-1 overflow-x-auto rounded bg-amber-100 p-2 text-xs">cd .. &amp;&amp; RAGFLOW_API_KEY=ragflow-xxx bun scripts/ingest-ragflow.ts</pre>
          </li>
        </ol>
        <p className="mt-3 text-xs text-amber-700">
          完成后刷新本页即可。在此之前,你可以先使用上方的 🔍 全文搜索功能。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 220px)" }}>
      {/* 对话区 */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
        {msgs.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-stone-400">问我任何关于 AI 产品、工程管理、创业方法论的问题 👇</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-600 hover:border-stone-400 hover:bg-stone-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[80%] rounded-2xl bg-stone-900 px-4 py-2 text-white" : "max-w-[90%]"}>
              {m.role === "assistant" && <div className="mb-1 text-xs text-stone-400">🤖 Lenny 助手</div>}
              <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
                {m.text || (loading && i === msgs.length - 1 ? "思考中…" : "")}
              </div>
              {m.refs && m.refs.length > 0 && (
                <div className="mt-3 border-t border-stone-200 pt-2">
                  <div className="text-xs font-medium text-stone-400">📎 引用来源</div>
                  <div className="mt-1.5 space-y-1.5">
                    {m.refs.slice(0, 5).map((r, j) => (
                      <div key={j} className="rounded bg-stone-50 p-2 text-xs">
                        <div className="font-medium text-stone-700">{r.document_name ?? r.docnm_kwd ?? "未知文档"}</div>
                        {(r.content ?? r.content_with_weight ?? "") && (
                          <div className="mt-0.5 line-clamp-2 text-stone-500">
                            "{(r.content ?? r.content_with_weight ?? "").replace(/\s+/g, " ").slice(0, 150)}..."
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 输入区 */}
      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(input); }}
          placeholder="输入问题…"
          className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
        />
        <button
          onClick={() => ask(input)}
          disabled={loading || !input.trim()}
          className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-40"
        >
          {loading ? "…" : "发送"}
        </button>
      </div>
    </div>
  );
}
