// Server Component: react-markdown + remark-gfm run at build/request time, so
// those ~140kB never reach the browser. No "use client" — nothing here is
// interactive.
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import BlogTable from "@/components/blog/BlogTable";
import { splitBlogContent, splitAtMiddleHeading } from "@/lib/parse-blog-tables";

interface BlogContentProps {
  content: string;
  components: Components;
  /** Rendered at the `##` heading nearest the middle of the post. */
  midSlot?: React.ReactNode;
}

function Markdown({ content, components }: { content: string; components: Components }) {
  return (
    <>
      {splitBlogContent(content).map((segment, index) =>
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

export default function BlogContent({ content, components, midSlot }: BlogContentProps) {
  // Splitting the markdown before parsing keeps the CTA on a section boundary,
  // so it can never land mid-paragraph or inside a table.
  const [before, after] = midSlot ? splitAtMiddleHeading(content) : [content, ""];

  return (
    <>
      <Markdown content={before} components={components} />
      {after && (
        <>
          {midSlot}
          <Markdown content={after} components={components} />
        </>
      )}
    </>
  );
}
