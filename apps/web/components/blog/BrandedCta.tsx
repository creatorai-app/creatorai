// Server Component: the mid-article sign-up card. Copy comes from the post's
// branded_cta column so the offer matches the article and admins can edit it
// without a deploy.
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { BlogBrandedCta } from "@/lib/blog-types"

export default function BrandedCta({ cta }: { cta: BlogBrandedCta }) {
  return (
    // The title is a <p>, not a heading: an ad headline in the heading outline
    // competes with the article's own h2s. aria-label names the region instead.
    <aside
      aria-label={cta.title}
      className="my-12 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 p-6 sm:p-8 text-center"
    >
      <p className="text-xl sm:text-2xl font-bold text-white mb-2.5">{cta.title}</p>
      <p className="text-purple-50 text-[0.98rem] leading-relaxed mb-6 max-w-xl mx-auto">
        {cta.description}
      </p>
      <Link
        href={cta.buttonHref ?? "/signup"}
        className="inline-flex items-center gap-2 bg-white text-purple-700 font-semibold px-6 py-3 rounded-lg hover:bg-purple-50 transition-colors"
      >
        {cta.buttonLabel}
        <ArrowRight className="w-4 h-4" />
      </Link>
      <p className="text-purple-100/90 text-xs mt-4">No credit card required.</p>
    </aside>
  )
}
