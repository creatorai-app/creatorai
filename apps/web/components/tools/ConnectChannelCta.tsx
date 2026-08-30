import Link from "next/link"
import { ArrowRight } from "lucide-react"

/**
 * Quiet secondary CTA under the generator: the free tool knows nothing about
 * you, and this is the one thing that changes that.
 *
 * Points at AI Studio rather than /signup because that is the honest
 * destination for "connect your channel". Middleware sends a logged-out
 * visitor to /login with a redirectedFrom, so it works for both the creator
 * who already has an account and the one who does not.
 */
export default function ConnectChannelCta({
  label = "Connect your channel for personalized results",
  className = "",
}: {
  label?: string
  className?: string
}) {
  return (
    <Link
      href="/dashboard/train"
      className={`group inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-purple-600 ${className}`}
    >
      {label}
      <ArrowRight
        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  )
}
