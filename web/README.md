# Lenny 搜索站

[Lenny's Newsletter & Podcast](https://github.com/LennysNewsletter/lennys-newsletterpodcastdata) 的元数据导航与发现工具。

## 这是什么

一个可搜索的导航站,帮你快速发现 Lenny 50 期播客 + 10 篇文章里与你关心的主题(AI 产品、工程管理、创业、产品方法论)相关的内容,然后跳转到原文阅读。

- **全文搜索**(MiniSearch,客户端秒级)—— 按标题、嘉宾、描述、标签检索
- **筛选** —— 按类型、标签、年份
- **详情页** —— 元数据 + 同主题相关推荐 + 跳转原文链接
- **AI 问答** —— 接入本地 RAGFlow(需单独配置)

## 本地开发

```bash
cd web
pnpm install
pnpm dev          # http://localhost:3002
```

公开元数据已内置在 `public/data.json`,开箱即用。

## ⚠️ 关于文字稿正文

本仓库 **不包含任何文章/播客的文字稿正文**。

原因:Lenny 的内容受版权保护(见 [`data/LICENSE.md`](../data/LICENSE.md)),许可证明确禁止重新分发原始内容。本站只发布公开的元数据(标题、嘉宾、日期、标签、描述 —— 这些在 Lenny 的公开数据包里本就可获取),并提供跳转到原作者网站的链接。

如果你在本地拥有数据包,项目根目录的 `scripts/` 提供了完整的工具链,可以在本地生成含文字稿的阅读器、Obsidian 知识库、RAG 知识库 —— 但这些仅限个人本地使用,不应公开部署。详见[根目录 README](../README.md)。
