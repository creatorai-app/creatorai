import Image from "next/image"
import { Linkedin, User } from "lucide-react"
import type { BlogAuthor } from "@/lib/authors"

// lucide-react dropped the bird mark; X ships its own glyph and nothing else.
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

const SOCIALS = [
  { key: "x" as const, label: "on X", Icon: XIcon },
  { key: "linkedin" as const, label: "on LinkedIn", Icon: Linkedin },
]

function Socials({ author, className = "" }: { author: BlogAuthor; className?: string }) {
  const links = SOCIALS.filter((s) => author[s.key])
  if (links.length === 0) return null
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {links.map(({ key, label, Icon }) => (
        <a
          key={key}
          href={author[key]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${author.name} ${label}`}
          className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 text-slate-500 hover:text-purple-700 hover:border-purple-300 transition-colors"
        >
          <Icon className="w-3.5 h-3.5" />
        </a>
      ))}
    </div>
  )
}

function Avatar({ author, size }: { author: BlogAuthor; size: number }) {
  if (!author.avatar) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0"
      >
        <User className="w-1/2 h-1/2 text-white" />
      </div>
    )
  }
  return (
    <Image
      src={author.avatar}
      alt={`${author.name}, ${author.title}`}
      width={size}
      height={size}
      className="rounded-full object-cover shrink-0"
    />
  )
}

/** Compact byline for the post hero. */
export function AuthorByline({ author }: { author: BlogAuthor }) {
  return (
    <span className="flex items-center gap-2.5">
      <Avatar author={author} size={32} />
      <span className="font-medium text-slate-700">{author.name}</span>
      <Socials author={author} />
    </span>
  )
}

/** Full card shown after the article body — the E-E-A-T "who wrote this". */
export function AuthorCard({ author }: { author: BlogAuthor }) {
  return (
    <div className="mt-14 pt-8 border-t border-slate-200">
      {/* items-start, or the default stretch pulls the avatar to the full
          height of the bio column and the circle renders as an oval. */}
      <div className="flex flex-col sm:flex-row items-start gap-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-6">
        <Avatar author={author} size={64} />
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{author.name}</p>
          <p className="text-sm text-purple-700 mb-2">{author.title}</p>
          <p className="text-sm text-slate-600 leading-relaxed">{author.bio}</p>
          <Socials author={author} className="mt-3" />
        </div>
      </div>
    </div>
  )
}
