// Server-safe: styled element map for react-markdown + heading helpers. No
// hooks, no client APIs — rendered on the server so react-markdown stays out of
// the client bundle.
import Link from "next/link"
import { type Components } from "react-markdown"

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export function extractHeadings(
  markdown: string
): { id: string; title: string; level: number }[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm
  const headings: { id: string; title: string; level: number }[] = []
  let match
  while ((match = headingRegex.exec(markdown)) !== null) {
    const hashes = match[1] ?? ""
    const text = match[2] ?? ""
    headings.push({ id: slugify(text), title: text, level: hashes.length })
  }
  return headings
}

export const markdownComponents: Components = {
  h2: ({ children, ...props }) => {
    const text = typeof children === "string" ? children : String(children)
    return (
      <h2
        id={slugify(text)}
        className="scroll-mt-24 text-2xl md:text-[1.65rem] font-bold text-slate-900 tracking-tight mt-14 mb-5 pb-3 border-b border-slate-200 first:mt-0"
        {...props}
      >
        {children}
      </h2>
    )
  },
  h3: ({ children, ...props }) => {
    const text = typeof children === "string" ? children : String(children)
    return (
      <h3
        id={slugify(text)}
        className="scroll-mt-24 text-xl font-semibold text-slate-800 mt-10 mb-3"
        {...props}
      >
        {children}
      </h3>
    )
  },
  p: ({ children, ...props }) => (
    <p className="text-[1.05rem] leading-[1.85] text-slate-600 mb-5" {...props}>
      {children}
    </p>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-slate-800" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="text-slate-700 not-italic font-medium" {...props}>
      {children}
    </em>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-4 ml-1 space-y-2.5" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-4 ml-1 space-y-2.5 list-decimal list-inside" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="flex gap-2.5 text-[1.02rem] text-slate-600 leading-relaxed" {...props}>
      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
      <span className="flex-1">{children}</span>
    </li>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-6 border-l-4 border-purple-400 bg-purple-50/60 rounded-r-xl py-4 px-6 text-slate-700 italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-10 border-slate-200" />,
  a: ({ children, href, ...props }) => {
    const linkClass =
      "text-purple-600 font-medium underline underline-offset-4 decoration-purple-300 hover:decoration-purple-500 transition-colors"
    const isExternal = !!href && /^https?:\/\//.test(href)
    if (href && href.startsWith("/")) {
      return (
        <Link href={href} className={linkClass}>
          {children}
        </Link>
      )
    }
    return (
      <a
        href={href}
        className={linkClass}
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...props}
      >
        {children}
      </a>
    )
  },
  // A YouTube URL as a markdown image renders as a prominent captioned embed;
  // anything else falls back to a normal image. The figure semantics + visible
  // caption help Google treat the page as the video's "watch page" (paired with
  // the VideoObject JSON-LD in the blog layout). Spans (not <figure>) keep the
  // markup valid inside react-markdown's <p> wrapper.
  img: ({ src, alt }) => {
    const url = typeof src === "string" ? src : ""
    const yt = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/
    )
    if (yt) {
      const caption = alt || "Video walkthrough"
      return (
        <span role="figure" aria-label={caption} className="block my-8">
          <span className="block aspect-video w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${yt[1]}`}
              title={caption}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="h-full w-full"
            />
          </span>
          <span className="mt-2 block text-center text-sm text-slate-500">{caption}</span>
        </span>
      )
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt || ""} className="my-8 w-full rounded-xl border border-slate-200" />
  },
}
