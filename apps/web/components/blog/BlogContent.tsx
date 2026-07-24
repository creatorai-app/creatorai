// Server Component: react-markdown + remark-gfm run at build/request time, so
// those ~140kB never reach the browser. No "use client" — nothing here is
// interactive.
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import BlogTable from "@/components/blog/BlogTable";
import { splitBlogContent } from "@/lib/parse-blog-tables";

interface BlogContentProps {
  content: string;
  components: Components;
}

export default function BlogContent({ content, components }: BlogContentProps) {
  const segments = splitBlogContent(content);

  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "table" ? (
          <BlogTable key={`table-${index}`} table={segment.table} />
        ) : (
          <ReactMarkdown
            key={`md-${index}`}
            remarkPlugins={[remarkGfm]}
            components={components}
          >
            {segment.content}
          </ReactMarkdown>
        )
      )}
    </>
  );
}
