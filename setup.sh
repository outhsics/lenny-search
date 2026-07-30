#!/usr/bin/env bash
# 一键搭建: 数据底座 + Obsidian + 网站索引 + 启动网站
# (RAG 部分需要 RAGFLOW_API_KEY,见 README ②)
set -e
cd "$(dirname "$0")"

echo "🔧 [1/4] 生成数据底座..."
bun scripts/pipeline.ts

echo ""
echo "📚 [2/4] 生成 Obsidian 知识库..."
bun scripts/build-obsidian.ts

echo ""
echo "✂️  [3/4] 生成分块数据(RAG 用)..."
bun scripts/chunk.ts

echo ""
echo "🌐 [4/4] 生成网站索引..."
bun scripts/build-web-index.ts

echo ""
echo "✅ 全部就绪!"
echo ""
echo "📦 Obsidian 知识库: $(pwd)/vault/Lenny-Vault"
echo "   → 打开 Obsidian,选择「打开文件夹」"
echo ""
echo "🌐 启动网站:"
echo "   cd web && pnpm install && pnpm dev"
echo "   → http://localhost:3002"
echo ""
echo "🤖 RAG 问答(需要 RAGFlow):"
echo "   export RAGFLOW_API_KEY=xxx && bun scripts/ingest-ragflow.ts && bun scripts/ask.ts"
