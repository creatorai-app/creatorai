import Link from "next/link"

/**
 * Google-marked signup CTA used across the /tools pages.
 *
 * Deliberately a link to /signup rather than a direct signInWithOAuth call: the
 * real signup flow gates Google auth behind accepting the terms, and firing
 * OAuth from a marketing page would skip that. The Google mark sets the
 * expectation that one click finishes it, which is still true.
 */
export default function GoogleSignupCta({
  source,
  label = "Get 500 free credits",
  className = "",
}: {
  /** Attribution slug for ?ref=. NOT named `ref`: React reserves that prop and
   *  it never reaches the component. */
  source: string
  label?: string
  className?: string
}) {
  return (
    <Link
      href={`/signup?ref=${source}`}
      className={`inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 px-6 py-3 text-sm font-medium text-white shadow-md transition hover:brightness-110 sm:text-base ${className}`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
      </span>
      {label}
    </Link>
  )
}
