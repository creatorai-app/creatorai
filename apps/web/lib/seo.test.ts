import { createMetadata, noIndexRobots, siteConfig } from "./seo"
import { AUTHORS, authorProfileUrls, getAuthor } from "./authors"

/**
 * Metadata defaults ship on every page, so a slip here is a site-wide SEO
 * regression that nothing else would catch.
 */

describe("createMetadata", () => {
  it("falls back to the site title and description with no overrides", () => {
    const meta = createMetadata()
    expect(meta.title).toBe(`${siteConfig.name} | AI Assistant for YouTube Creators`)
    expect(meta.description).toBe(siteConfig.description)
  })

  it("mirrors an overridden title into the OG and Twitter cards", () => {
    // Three places have to agree or the social preview contradicts the page.
    const meta = createMetadata({ title: "Pricing" })
    expect(meta.openGraph?.title).toBe("Pricing")
    expect(meta.twitter?.title).toBe("Pricing")
  })

  it("defaults the canonical to the site root and honors an override", () => {
    expect(createMetadata().alternates?.canonical).toBe("/")
    expect(createMetadata({ alternates: { canonical: "/pricing" } }).alternates?.canonical).toBe(
      "/pricing",
    )
  })

  it("is indexable by default", () => {
    expect(createMetadata().robots).toMatchObject({ index: true, follow: true })
  })

  it("lets a page opt out of indexing while staying crawlable", () => {
    // follow stays true so link equity still flows off a noindex page.
    const meta = createMetadata({ robots: noIndexRobots })
    expect(meta.robots).toMatchObject({ index: false, follow: true })
  })

  // KNOWN DEFECT, pinned rather than asserted as correct: the trailing `...overrides`
  // spread replaces `openGraph` wholesale, so the merge above it never applies. A
  // caller passing a partial object (app/pricing/layout.tsx passes only `url`) loses
  // siteName, type, locale, title and description from its social card. Fixing it
  // means moving `...overrides` above the openGraph/twitter/robots keys.
  it("currently replaces openGraph wholesale instead of merging the defaults", () => {
    const meta = createMetadata({ openGraph: { images: ["/og.png"] } })
    expect(meta.openGraph).toEqual({ images: ["/og.png"] })
  })

  it("resolves relative URLs against an absolute metadataBase", () => {
    expect(createMetadata().metadataBase?.href).toBe(new URL(siteConfig.url).href)
  })
})

describe("authors", () => {
  it("looks a byline up by the exact name stored on the post", () => {
    expect(getAuthor("Afrin Nahar")?.title).toBe("Founder, Creator AI")
  })

  it("returns undefined for an unknown byline, so the org fallback applies", () => {
    expect(getAuthor("Creator AI Team")).toBeUndefined()
  })

  it("emits only the profiles that exist, for schema.org sameAs", () => {
    const urls = authorProfileUrls(AUTHORS["Afrin Nahar"]!)
    expect(urls).toHaveLength(2)
    expect(urls.every((u) => u.startsWith("https://"))).toBe(true)
  })

  it("drops an author's unset profiles rather than emitting empty strings", () => {
    expect(authorProfileUrls({ name: "N", title: "T", bio: "B", avatar: "/a.jpg" })).toEqual([])
  })

  it("keys every author by their own name, which is what posts match on", () => {
    for (const [key, author] of Object.entries(AUTHORS)) {
      expect(author.name).toBe(key)
    }
  })
})
