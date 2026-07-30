import SearchClient from "@/components/SearchClient";

export default function Home() {
  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          搜索 Lenny 的 AI 产品与工程访谈
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          50 期播客 + 10 篇文章 · 涵盖 AI 产品开发、工程管理、创业方法论 · 全文检索,秒级响应
        </p>
      </div>
      <SearchClient />
    </div>
  );
}
