export type DocType = "podcast" | "newsletter";

export interface SearchDoc {
  id: string;
  type: DocType;
  slug: string;
  title: string;
  subtitle: string;
  guest: string;
  date: string;
  year: string;
  description: string;
  tags: string[];
  wordCount: number;
  postUrl: string;
}

export interface Facet {
  value: string;
  count: number;
}

export interface SiteData {
  generatedAt: string;
  stats: { podcast: number; newsletter: number };
  facets: { tags: Facet[]; guests: Facet[]; years: Facet[] };
  docs: SearchDoc[];
}

// 阅读页用的完整文档(unified.json 的 Doc)
export interface FullDoc {
  id: string;
  type: DocType;
  slug: string;
  path: string;
  title: string;
  subtitle?: string;
  guest?: string;
  date: string;
  description: string;
  tags: string[];
  wordCount: number;
  postUrl: string;
  body: string;
  speakers?: string[];
  turns?: { speaker: string; time: string; text: string }[];
  headings?: { level: number; text: string }[];
}
