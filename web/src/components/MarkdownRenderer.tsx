import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownRenderer({ body }: { body: string }) {
  return (
    <div className="prose prose-stone max-w-none prose-headings:scroll-mt-20 prose-headings:font-semibold prose-a:text-stone-700 prose-a:underline hover:prose-a:text-stone-900 prose-img:rounded-lg prose-code:rounded prose-code:bg-stone-100 prose-code:px-1 prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}
