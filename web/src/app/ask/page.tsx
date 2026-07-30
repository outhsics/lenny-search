import AskClient from "@/components/AskClient";

export default function AskPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">🤖 AI 问答</h1>
        <p className="mt-1 text-sm text-stone-500">
          基于 Lenny 访谈内容的 RAG 问答。回答会引用来源嘉宾与时间戳。由本地 RAGFlow + bge-m3 + qwen2.5 驱动。
        </p>
      </div>
      <AskClient />
    </div>
  );
}
