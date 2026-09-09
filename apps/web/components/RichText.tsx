import Link from "next/link"

/**
 * The inline formatting registry copy is allowed to use: `**bold**`, `*italic*`
 * and `[label](/href)`. Nothing else — this is deliberately not a markdown
 * renderer, because the copy it formats lives in TypeScript string literals
 * rather than in .md files.
 *
 * Lived inside ToolPageShell until the /features pages needed the same parser.
 * Two copies would have drifted the moment one of them learned a new token.
 */
export default function RichText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g)
        .map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-slate-900">
              {part.slice(2, -2)}
            </strong>
          )
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          return <em key={i}>{part.slice(1, -1)}</em>
        }
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
        if (link) {
          const [, label, href] = link as unknown as [string, string, string]
          const external = href.startsWith("http")
          return external ? (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener"
              className="font-medium text-purple-600 underline underline-offset-2 hover:text-purple-700"
            >
              {label}
            </a>
          ) : (
            <Link
              key={i}
              href={href}
              className="font-medium text-purple-600 underline underline-offset-2 hover:text-purple-700"
            >
              {label}
            </Link>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
