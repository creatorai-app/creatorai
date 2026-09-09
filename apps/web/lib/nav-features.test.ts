import { navItem, footerItems } from "@repo/ui";
import { CORE_FEATURES, getFeature } from "@/lib/product-features";

/**
 * The navbar lives in packages/ui and the feature registry lives in apps/web, so
 * the dropdown cannot import the slugs it links to — nothing but this test stops
 * the two drifting into a menu full of 404s.
 *
 * It runs here rather than in packages/ui because this is the only package that
 * can see both.
 */

const featuresNav = navItem.find((item) => item.name === "Features")!

describe("Features navigation", () => {
  it("has a dropdown entry per registered feature", () => {
    expect(featuresNav.children).toHaveLength(CORE_FEATURES.length)
  })

  it("points every child at a registered feature slug", () => {
    for (const child of featuresNav.children ?? []) {
      expect(child.href).toMatch(/^\/features\/[a-z0-9-]+$/)
      const slug = child.href.replace("/features/", "")
      // The assertion that actually matters: a slug with no registry entry is a
      // 404 in the navbar, because /features/[slug] has dynamicParams disabled.
      expect(getFeature(slug)).toBeDefined()
    }
  })

  // Regression: these were /features#<id> anchors. The hub keeps those ids, so
  // old links in the wild still work, but the menu must not point at them.
  it("no longer uses hash anchors", () => {
    for (const child of featuresNav.children ?? []) {
      expect(child.href).not.toContain("#")
    }
  })

  it("keeps the overview link on the parent and its view-all footer", () => {
    expect(featuresNav.href).toBe("/features")
    expect(featuresNav.viewAllLabel).toBeTruthy()
  })

  it("leaves the footer Features link on the hub", () => {
    expect(footerItems.Product).toContainEqual({ name: "Features", href: "/features" })
  })
})
