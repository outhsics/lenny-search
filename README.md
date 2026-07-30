# Lenny Lab

把 [Lenny's Newsletter & Podcast 公开数据包](https://github.com/LennysNewsletter/lennys-newsletterpodcastdata)（50 期播客 + 10 篇文章，约 91 万词）做成三种可用的形态，共享一套数据底座：

1. **Obsidian 知识库** —— 带双链、标签 MOC、嘉宾聚合页的资料库
2. **RAG 知识问答** —— 灌入本地 RAGFlow，用 bge-m3 + qwen2.5 做检索增强问答
3. **Next.js 搜索站** —— 全文搜索 + 阅读器 + AI 问答的作品集项目

```
lenny-lab/
├─ data/                  # 数据源(zip 解压的 63 个文件 + 生成的 unified/chunks)
│  ├─ index.json          # 原始元数据
│  ├─ newsletters/        # 10 篇文章
│  ├─ podcasts/           # 50 期播客文字稿
│  ├─ unified.json        # ⭐ 解析后的统一数据(所有产物的基础)
│  └─ chunks.json         # 分块后的数据(RAG 用)
├─ scripts/               # 数据处理脚本(TypeScript,用 bun 跑)
│  ├─ lib.ts              # 共享数据底座
│  ├─ pipeline.ts         # 生成 unified.json
│  ├─ chunk.ts            # 生成 chunks.json
│  ├─ build-obsidian.ts   # ① Obsidian
│  ├─ ingest-ragflow.ts   # ② 灌入 RAGFlow
│  ├─ ask.ts              # ② 命令行问答
│  ├─ build-web-index.ts  # ③ 网站索引
│  └─ lenny-search-mcp.mjs# ② Hermes 检索工具
├─ vault/Lenny-Vault/     # ① 生成的 Obsidian 知识库
└─ web/                   # ③ Next.js 项目
```

## 快速开始

环境要求：**bun**（脚本）、**Node 18+**（网站）。数据处理零依赖。

```bash
# 0. 重新生成数据底座(解析所有 md → unified.json)
bun scripts/pipeline.ts

# 1. ① Obsidian 知识库
bun scripts/build-obsidian.ts
#    然后用 Obsidian 打开 vault/Lenny-Vault 文件夹即可

# 2. RAG 分块
bun scripts/chunk.ts

# 3. ③ 网站搜索索引
bun scripts/build-web-index.ts
cd web && pnpm install && pnpm dev   # http://localhost:3002
```

---

## ① Obsidian 知识库

```bash
bun scripts/build-obsidian.ts
```

生成 `vault/Lenny-Vault/`，打开 Obsidian → 「打开文件夹」选择它。

**结构：**
- `Episodes/` — 播客，保留 `说话人 (时间戳)` 对话格式
- `Newsletters/` — 文章，保留 markdown
- `Guests/` — 每位嘉宾一个页面，双链聚合其所有出场（50 位）
- `Topics/` — 按标签的 MOC 索引页（17 个话题）
- `Index/README.md` — 总目录

每篇带 frontmatter（guest / date / tags / word_count / source），可用标签面板、关系图谱、反向链接。

---

## ② RAG 知识问答（RAGFlow + Ollama）

前提：本地已运行 [RAGFlow](https://github.com/infiniflow/ragflow)（默认 `http://127.0.0.1:9380`）和 Ollama，已拉取 `bge-m3`（embedding）和 `qwen2.5:7b`（生成）。

```bash
# 1. 在 RAGFlow 网页(头像 → API Key)复制 key
export RAGFLOW_API_KEY=ragflow-xxxxxxxx

# 2. 灌库(幂等,可重复运行)
bun scripts/ingest-ragflow.ts
#    会自动:创建知识库 → 灌入 1813 个块 → 创建「Lenny 助手」

# 3. 在 RAGFlow 网页把知识库 embedding 设为 bge-m3、助手 LLM 设为 qwen2.5:7b

# 4. 命令行问答
bun scripts/ask.ts "Claude Code 团队怎么管理工作?"
#    或交互模式(不带参数)
bun scripts/ask.ts
```

**接入 Hermes**（让 AI 助手能检索知识库）：

```bash
hermes mcp add lenny-kb -- node /Users/terre/Dev/lenny-lab/scripts/lenny-search-mcp.mjs
# 需要 MCP SDK: cd scripts && bun add @modelcontextprotocol/sdk
# 之后在 hermes chat 里就能调用 search_lenny / ask_lenny 工具
```

---

## ③ Next.js 搜索站

```bash
bun scripts/build-web-index.ts      # 生成 web/public/data.json
cd web
pnpm install
pnpm dev                            # http://localhost:3002
```

**功能：**
- **全文搜索**（MiniSearch，客户端秒级）—— 按标题/嘉宾/内容检索，支持模糊匹配
- **筛选** —— 按类型（播客/文章）、标签、年份
- **阅读页** —— 播客渲染成彩色对话（说话人 + 时间戳），文章渲染 markdown
- **AI 问答** —— `/ask` 页，流式回答 + 引用来源（需先完成 ② 灌库）

技术栈：Next.js 15 (App Router) · Tailwind · MiniSearch · react-markdown

---

## ⚠️ 许可证

数据版权归原作者 **Lenny Rachitsky** 所有。详见 `data/LICENSE.md`。

**可以做：** 个人学习、喂给 AI/RAG、做个人项目（含公开发布的作品集）。

**不可以做：** 重新分发原始文件、商用、收费。

本项目的网站**仅限本地运行或作为非商用作品集展示**，不要部署成公开的收费服务。
